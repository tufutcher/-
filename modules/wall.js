import { openEditModal, openReadonlyProfileModal } from "./profile.js";
import { deleteCheckinWithImages, loadCheckins } from "../api/checkin.js";

let currentMode = "time";
let allCheckins = [];
let allProfiles = [];

function fmtDate(date){
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function cardHtml(item){
  const imgs = item.checkin_images || [];
  const cover = imgs[0];
  const extra = imgs.length > 1 ? `<div class="extra-count">+${imgs.length - 1}</div>` : "";

  return `
    <div class="wall-card gallery-card" data-id="${item.id}">
      <div class="wall-card-img-wrap">
        ${cover ? `<img src="${cover.image_url}">` : ""}
        ${extra}
      </div>
    </div>
  `;
}

export function renderWall(items, profiles = []){
  allCheckins = items;
  allProfiles = profiles;

  return `
    <section class="wall-hero wall-logo-hero">
      <img class="wall-logo" src="./assets/wall-logo.png" alt="不画画真的要完了">
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
        <button class="person-thumb" data-id="${item.id}" type="button">
          <img src="${img.image_url}">
        </button>
      `;
    })
    .join("");

  return `
    <div class="person-card" data-profile-user-id="${group.userId}">
      <div class="person-head">
        ${avatarHtml(profile, group.name)}
        <div class="person-meta">
          <div class="person-name">${group.name || "匿名"}</div>
          <div class="person-count">${group.items.length} 次打卡</div>
        </div>
      </div>

      <div class="person-thumbs">
        ${thumbs || `<div class="person-empty">还没有作品</div>`}
      </div>

      <div class="person-badges">${badgesHtml(badges)}</div>
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
  // 普通打卡墙：点作品卡片，打开作品详情
  document.querySelectorAll(".wall-card").forEach(card => {
    card.onclick = () => {
      const item = allCheckins.find(x => x.id === card.dataset.id);
      if(item) openDetail(item);
    };
  });

  // 按人分组：点作品缩略图，打开作品详情
  document.querySelectorAll(".person-thumb").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();

      const item = allCheckins.find(x => x.id === btn.dataset.id);
      if(item) openDetail(item);
    };
  });

  // 按人分组：点头像、名字、卡片空白区域，打开这个人的主页弹窗
  document.querySelectorAll(".person-card").forEach(card => {
    card.onclick = () => {
      const userId = card.dataset.profileUserId;
      if(!userId) return;

      openReadonlyProfileModal(userId);
    };
  });
}

function openDetail(item){
  const old = document.getElementById("detail-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "detail-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const imgs = item.checkin_images || [];
  const profile = getProfile(item.user_id, item.username);
  const username = item.username || profile?.username || "匿名";
  const user = window.__user;
  const isOwner = user && user.id === item.user_id;

  const imagesHtml = imgs.map(img => {
    const tagsHtml = img.tags?.length
      ? `
        <div class="tags detail-tags">
          ${img.tags.map(t => `<span>#${t}</span>`).join("")}
        </div>
      `
      : "";

    return `
      <div class="detail-art-block">
        <img src="${img.image_url}">
        ${tagsHtml}
      </div>
    `;
  }).join("");

  modal.innerHTML = `
    <div class="detail-viewer-card">

      <div class="detail-viewer-head">
        <button class="detail-author-card" data-profile-user-id="${item.user_id}" type="button">
          ${avatarHtml(profile, username).replace("person-avatar", "detail-avatar")}
          <div>
            <div class="detail-author">${username}</div>
            <div class="detail-date">${fmtDate(item.created_at)}</div>
          </div>
        </button>
      </div>

      <div class="detail-art-list">
        ${imagesHtml}
      </div>

      ${item.note ? `<div class="note detail-note">${item.note}</div>` : ""}

      ${isOwner ? `
        <div class="detail-actions">
          <button id="detail-edit">编辑</button>
        </div>
      ` : ""}
    </div>
  `;

  document.body.appendChild(modal);

  const escClose = (e) => {
    if(e.key === "Escape"){
      modal.remove();
      document.removeEventListener("keydown", escClose);
    }
  };
  
  document.addEventListener("keydown", escClose);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
      document.removeEventListener("keydown", escClose);
    }
  };

  const authorCard = modal.querySelector(".detail-author-card");
  if(authorCard){
    authorCard.onclick = () => {
      const userId = authorCard.dataset.profileUserId;
      if(!userId) return;
  
      modal.remove();
      openReadonlyProfileModal(userId);
    };
  }

  if(isOwner){
    document.getElementById("detail-edit").onclick = () => {
      modal.remove();
      openEditModal(item);
    };
  }
}
