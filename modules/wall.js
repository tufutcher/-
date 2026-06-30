import { openEditModal } from "./profile.js";
import { deleteCheckinWithImages, loadCheckins } from "../api/checkin.js";

let currentMode = "time";
let allCheckins = [];

function fmtDate(ts){
  const d = new Date(ts);
  return (d.getMonth()+1) + "月" + d.getDate() + "日";
}

function cardHtml(item){
  const tagSet = new Set();
  (item.checkin_images || []).forEach(img => (img.tags||[]).forEach(t => tagSet.add(t)));
  const tagsHtml = tagSet.size ? `<div class="tags">${Array.from(tagSet).map(t=>"#"+t).join(" ")}</div>` : "";
  const imgs = item.checkin_images || [];
  const cover = imgs[0];
  const extra = imgs.length > 1 ? `<div class="extra-count">+${imgs.length - 1}</div>` : "";
  return `
    <div class="wall-card" data-id="${item.id}">
      <div class="wall-card-img-wrap">
        ${cover ? `<img src="${cover.image_url}">` : ""}
        ${extra}
      </div>
      <div class="wall-card-body">
        <div class="who-row"><b>${item.username || "匿名"}</b><span class="when">${fmtDate(item.created_at)}</span></div>
        ${item.note ? `<div class="note">${item.note}</div>` : ""}
        ${tagsHtml}
      </div>
    </div>
  `;
}

export function renderWall(items){
  allCheckins = items;
  return `
    <div class="topbar">
      <button onclick="switchView('wall')">墙</button>
      <button onclick="switchView('me')">我的</button>
    </div>
    <div class="wall-controls">
      <div class="seg" id="wall-seg">
        <span data-m="time" class="${currentMode==='time'?'on':''}">最新</span>
        <span data-m="person" class="${currentMode==='person'?'on':''}">按人分组</span>
      </div>
    </div>
    <div id="wall-content">${renderWallContent(items, currentMode)}</div>
  `;
}

function renderWallContent(items, mode){
  if(!items.length) return `<div class="card empty">还没有人打卡，点右下角"＋"第一个来！</div>`;

  if(mode === "time"){
    return `<div class="wall-grid">${items.map(cardHtml).join("")}</div>`;
  }

  const byPerson = {};
  items.forEach(x => { (byPerson[x.username] = byPerson[x.username] || []).push(x); });
  return Object.keys(byPerson).map(name => `
    <div class="group-block">
      <div class="group-head">${name}　<span class="muted">${byPerson[name].length} 次打卡</span></div>
      <div class="wall-grid">${byPerson[name].map(cardHtml).join("")}</div>
    </div>
  `).join("");
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
  document.querySelectorAll(".wall-card").forEach(card => {
    card.onclick = () => {
      const item = allCheckins.find(x => x.id === card.dataset.id);
      if(item) openDetail(item);
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
          ${(img.tags && img.tags.length) ? `<div class="tags">${img.tags.map(t=>"#"+t).join(" ")}</div>` : ""}
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
      const ok = confirm("确定删除这次打卡吗？图片也会一起删除。");
      if(!ok) return;

      const sb = window.__sb;
      const user = window.__user;
      if(!sb || !user){
        alert("请先登录");
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
      alert("已删除");
    };
  }
}
