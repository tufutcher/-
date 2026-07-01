import { openEditModal } from "./profile.js";
import { deleteCheckinWithImages, loadCheckins } from "../api/checkin.js";

let currentMode = "time";
let allCheckins = [];
let allProfiles = [];

function fmtDate(ts){
  const d = new Date(ts);
  return (d.getMonth()+1) + "月" + d.getDate() + "日";
}

function cardHtml(item){
  const imgs = item.checkin_images || [];
  const cover = imgs[0];
  const extra = imgs.length > 1 ? `<div class="extra-count">+${imgs.length - 1}</div>` : "";

  const profile = getProfile(item.user_id, item.username);
  const avatar = profile?.avatar_url
    ? `<img src="${profile.avatar_url}">`
    : `<span>${(item.username || "匿").trim().slice(0, 1) || "匿"}</span>`;

  return `
    <div class="wall-card gallery-card" data-id="${item.id}">
      <div class="wall-card-img-wrap">
        ${cover ? `<img src="${cover.image_url}">` : ""}

        <div class="wall-avatar-chip" title="${item.username || "匿名"}">
          ${avatar}
        </div>

        <div class="wall-date-chip">${fmtDate(item.created_at)}</div>

        ${extra}
      </div>
    </div>
  `;
}

export function renderWall(items, profiles = []){
  allCheckins = items;
  allProfiles = profiles;

  return `
    <section class="wall-hero">
      <h1>不 画 画 真 的 要 完 了</h1>
    </section>

    <div class="wall-controls">
      <div class="seg" id="wall-seg">
        <span data-m="time" class="${currentMode==='time'?'on':''}">最新</span>
        <span data-m="person" class="${currentMode==='person'?'on':''}">按人分组</span>
      </div>
    </div>

    <div id="wall-content">${renderWallContent(items, currentMode)}</div>
  `;
}

function getProfile(userId, username){
  return allProfiles.find(p => p.id === userId) || allProfiles.find(p => p.username === username) || null;
}

function avatarHtml(profile, name){
  if(profile?.avatar_url){
    return `<img class="person-avatar" src="${profile.avatar_url}">`;
  }

  const first = (name || "匿").trim().slice(0, 1) || "匿";
  return `<div class="person-avatar avatar-fallback">${first}</div>`;
}

function getWeekKey(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum);
  return d.getUTCFullYear() + "-" + d.getUTCMonth() + "-" + d.getUTCDate();
}

function computeBadgesFor(items){
  const byWeek = {};

  items.forEach(x => {
    const d = new Date(x.created_at);
    const key = getWeekKey(d);
    (byWeek[key] = byWeek[key] || new Set()).add(d.toDateString());
  });

  let star = 0, fire = 0, palette = 0;

  Object.values(byWeek).forEach(daySet => {
    const days = daySet.size;
    if(days >= 7) palette++;
    else if(days >= 5) fire++;
    else if(days >= 3) star++;
  });

  return { star, fire, palette };
}

function badgesHtml(badges){
  const parts = [];

  if(badges.star) parts.push(`<span>⭐ ×${badges.star}</span>`);
  if(badges.fire) parts.push(`<span>🔥 ×${badges.fire}</span>`);
  if(badges.palette) parts.push(`<span>🎨 ×${badges.palette}</span>`);

  return parts.length ? parts.join("") : `<span class="muted">暂无徽章</span>`;
}

function personCardHtml(group){
  const profile = getProfile(group.userId, group.name);
  const badges = computeBadgesFor(group.items);

  const thumbs = group.items
    .filter(item => item.checkin_images && item.checkin_images.length)
    .slice(0, 4)
    .map(item => {
      const img = item.checkin_images[0];
      return `
        <div class="person-thumb" data-id="${item.id}">
          <img src="${img.image_url}">
        </div>
      `;
    })
    .join("");

  return `
    <div class="person-card">
      <div class="person-head">
        ${avatarHtml(profile, group.name)}
        <div class="person-meta">
          <div class="person-name">${group.name || "匿名"}</div>
          <div class="person-badges">${badgesHtml(badges)}</div>
        </div>
      </div>

      <div class="person-thumbs">
        ${thumbs || `<div class="person-empty">还没有缩略图</div>`}
      </div>
      
      <button class="person-profile-btn" data-user-id="${group.userId}">
        查看主页
      </button>
    </div>
  `;
}

function renderWallContent(items, mode){
  if(!items.length){
    return `<div class="card empty">还没有人打卡，点右下角"＋"第一个来！</div>`;
  }

  if(mode === "time"){
    return `<div class="wall-grid">${items.map(cardHtml).join("")}</div>`;
  }

  const groups = {};

  items.forEach(item => {
    const key = item.user_id || item.username || "anonymous";

    if(!groups[key]){
      groups[key] = {
        userId: item.user_id,
        name: item.username || "匿名",
        items: []
      };
    }

    groups[key].items.push(item);
  });

  const groupList = Object.values(groups)
    .sort((a, b) => b.items.length - a.items.length);

  return `<div class="person-grid">${groupList.map(personCardHtml).join("")}</div>`;
}

// 在 app.js render() 之后调用，绑定排序切换和点击查看详情
export function bindWallEvents(){
  const seg = document.getElementById("wall-seg");
  if(seg){
    seg.querySelectorAll("span").forEach(s => {
      s.onclick = () => {
        currentMode = s.dataset.m;
        document.getElementById("wall-content").innerHTML = renderWallContent(allCheckins, currentMode);
        seg.querySelectorAll("span").forEach(x => x.classList.toggle("on", x === s));
        bindCardClicks();
      };
    });
  }
  bindCardClicks();
}

function bindCardClicks(){
  document.querySelectorAll(".wall-card, .person-thumb").forEach(card => {
    card.onclick = () => {
      const item = allCheckins.find(x => x.id === card.dataset.id);
      if(item) openDetail(item);
    };
  });

  document.querySelectorAll(".person-profile-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const userId = btn.dataset.userId;
      if(!userId) return;

      const currentUser = window.__user;

      if(currentUser && currentUser.id === userId){
        window.setState?.({
          view: "me",
          viewUserId: null
        });
      } else {
        window.setState?.({
          view: "user",
          viewUserId: userId
        });
      }
    };
  });
}

function openDetail(item){
  const old = document.getElementById("detail-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "detail-modal";
  modal.className = "modal-bg";

  const imgs = item.checkin_images || [];
  const user = window.__user;
  const isOwner = user && user.id === item.user_id;

  modal.innerHTML = `
    <div class="modal-card">
      <div class="who-row"><b>${item.username}</b><span class="when">${fmtDate(item.created_at)}</span></div>

      ${imgs.map(img => `
        <div class="detail-img-block">
          <img src="${img.image_url}">
          ${(img.tags && img.tags.length) ? `
            <div class="tags detail-tags">
              ${img.tags.map(t => `<span>#${t}</span>`).join("")}
            </div>
          ` : ""}
        </div>
      `).join("")}

      ${item.note ? `<div class="note" style="margin-top:10px;">${item.note}</div>` : ""}

      ${isOwner ? `
        <button id="detail-edit">编辑</button>
        <button id="detail-delete" class="danger">删除</button>
      ` : ""}

      <button id="detail-close" class="secondary">关闭</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal) modal.remove();
  };

  document.getElementById("detail-close").onclick = () => modal.remove();

  if(isOwner){
    document.getElementById("detail-edit").onclick = () => {
      modal.remove();
      openEditModal(item);
    };

    document.getElementById("detail-delete").onclick = async () => {
      const ok = await window.showConfirm?.({
        title: "删除这次打卡？",
        message: "图片也会一起删除。这个动作不能撤回。",
        confirmText: "删除",
        cancelText: "取消",
        danger: true
      });
      
      if(!ok) return;

      const sb = window.__sb;
      const user = window.__user;
      if(!sb || !user){
        window.showToast?.("请先登录后再操作。", "还不能操作", "error");
        return;
      }

      const btn = document.getElementById("detail-delete");
      btn.disabled = true;
      btn.textContent = "删除中...";

      const deleted = await deleteCheckinWithImages(sb, item.id, user.id);

      if(!deleted){
        btn.disabled = false;
        btn.textContent = "删除";
        return;
      }

      const freshCheckins = await loadCheckins(sb);
      if(window.setState){
        window.setState({ checkins: freshCheckins });
      }

      modal.remove();
      window.showToast?.("这次打卡已经删除。", "已删除", "success");
    };
  }
}
