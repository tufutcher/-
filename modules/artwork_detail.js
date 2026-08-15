import { state } from "../core/state.js";
import { buildArtworksFromCheckins, getArtworkCover } from "./artwork.js";
import { openEditModal } from "./edit_modal.js";

// 作品详情弹窗：从 profile 画廊进入时，按 artwork 展示同一张画的多个进度。
// 这是一个非侵入式补丁：通过 document 捕获 gallery-tile[data-artwork-id] 点击，
// 避免 profile 原来的 data-checkin-id 详情逻辑抢先打开。
let bound = false;

bindArtworkGalleryDetail();

function bindArtworkGalleryDetail(){
  if(bound) return;
  bound = true;

  document.addEventListener("click", (e) => {
    const tile = e.target.closest?.(".gallery-tile[data-artwork-id]");
    if(!tile) return;

    const artworkId = tile.dataset.artworkId;
    if(!artworkId) return;

    const artwork = findArtworkById(artworkId);
    if(!artwork) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();

    openArtworkDetailModal(artwork);
  }, true);
}

function findArtworkById(artworkId){
  const checkins = dedupeCheckins([
    ...(state.checkins || []),
    ...(state.profileCheckins || [])
  ]);

  return buildArtworksFromCheckins(checkins)
    .find(artwork => String(artwork.id) === String(artworkId));
}

function dedupeCheckins(items){
  const map = new Map();

  items.forEach(item => {
    if(item?.id) map.set(item.id, item);
  });

  return Array.from(map.values());
}

function openArtworkDetailModal(artwork){
  injectArtworkDetailStyles();

  const old = document.getElementById("detail-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "detail-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const cover = getArtworkCover(artwork);
  const sourceCheckin = getSourceCheckin(cover?.checkin_id);
  const user = window.__user;
  const isOwner = !!(user && sourceCheckin && user.id === sourceCheckin.user_id);
  const progresses = artwork.progresses || [];

  modal.innerHTML = `
    <div class="detail-viewer-card artwork-detail-card">
      <button class="detail-x artwork-detail-close" type="button" aria-label="关闭">×</button>

      <div class="detail-viewer-head artwork-detail-head">
        <div>
          <div class="detail-author">${escapeHtml(artwork.username || "匿名")}</div>
          <div class="detail-date">最新进度：${formatDate(artwork.created_at)}</div>
        </div>
        <div class="artwork-progress-total">${progresses.length || 1} 个进度</div>
      </div>

      <div class="artwork-progress-track" aria-label="作品进度">
        ${progresses.map((progress, index) => renderProgressCard(progress, index, progresses.length)).join("")}
      </div>

      ${renderTimeline(progresses)}

      ${artwork.note ? `<div class="note detail-note">${escapeHtml(artwork.note)}</div>` : ""}

      ${isOwner ? `
        <div class="detail-actions">
          <button id="artwork-detail-edit">编辑最新进度原打卡</button>
        </div>
      ` : ""}
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    document.removeEventListener("keydown", escClose);
  };

  const escClose = (e) => {
    if(e.key === "Escape") close();
  };

  document.addEventListener("keydown", escClose);

  modal.onclick = (e) => {
    if(e.target === modal) close();
  };

  modal.querySelector(".artwork-detail-close")?.addEventListener("click", close);

  if(isOwner && sourceCheckin){
    modal.querySelector("#artwork-detail-edit")?.addEventListener("click", () => {
      close();
      openEditModal(sourceCheckin);
    });
  }
}

function renderProgressCard(progress, index, total){
  const tagsHtml = progress.tags?.length
    ? `
      <div class="tags detail-tags artwork-progress-tags">
        ${progress.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join("")}
      </div>
    `
    : "";

  return `
    <article class="artwork-progress-card">
      <img src="${escapeAttr(progress.image_url)}" alt="">
      <div class="artwork-progress-caption">
        <b>${escapeHtml(progress.progress_label || `进度${index + 1}`)}</b>
        <span>${formatDate(progress.progress_date || progress.checkin_created_at)} · ${index + 1}/${total}</span>
      </div>
      ${tagsHtml}
    </article>
  `;
}

function renderTimeline(progresses){
  if(!progresses.length) return "";

  return `
    <div class="artwork-progress-timeline">
      ${progresses.map((progress, index) => `
        <span>
          <b>${index + 1}</b>
          ${escapeHtml(progress.progress_label || "作品")}
        </span>
      `).join("")}
    </div>
  `;
}

function getSourceCheckin(checkinId){
  if(!checkinId) return null;

  return [
    ...(state.checkins || []),
    ...(state.profileCheckins || [])
  ].find(item => item.id === checkinId) || null;
}

function formatDate(date){
  const d = new Date(date);
  if(Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function injectArtworkDetailStyles(){
  if(document.getElementById("artwork-detail-style")) return;

  const style = document.createElement("style");
  style.id = "artwork-detail-style";
  style.textContent = `
    .artwork-detail-card{
      overflow:hidden;
      padding:18px;
    }

    .artwork-detail-head{
      padding-right:58px;
      margin-bottom:12px;
    }

    .artwork-progress-total{
      flex:0 0 auto;
      padding:6px 10px;
      border-radius:999px;
      background:#f2f3f4;
      color:#666;
      font-size:12px;
      font-weight:850;
    }

    .artwork-progress-track{
      display:flex;
      gap:14px;
      overflow-x:auto;
      overflow-y:hidden;
      scroll-snap-type:x mandatory;
      scrollbar-width:none;
      padding-bottom:4px;
    }

    .artwork-progress-track::-webkit-scrollbar{
      display:none;
    }

    .artwork-progress-card{
      flex:0 0 100%;
      scroll-snap-align:center;
      min-width:0;
    }

    .artwork-progress-card img{
      width:100%;
      max-height:68vh;
      object-fit:contain;
      display:block;
      border-radius:20px;
      background:#f6f7f8;
    }

    .artwork-progress-caption{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-top:9px;
      color:#777;
      font-size:12px;
      line-height:1.35;
    }

    .artwork-progress-caption b{
      color:#111;
      font-size:13px;
    }

    .artwork-progress-tags{
      margin-top:8px;
    }

    .artwork-progress-timeline{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-top:12px;
    }

    .artwork-progress-timeline span{
      display:inline-flex;
      align-items:center;
      gap:5px;
      padding:6px 9px;
      border-radius:999px;
      background:#f2f3f4;
      color:#666;
      font-size:12px;
      font-weight:750;
    }

    .artwork-progress-timeline b{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:16px;
      height:16px;
      border-radius:50%;
      background:#111;
      color:#fff;
      font-size:10px;
      line-height:1;
    }

    @media (max-width:520px){
      .artwork-detail-card{
        padding:14px;
      }

      .artwork-progress-card img{
        max-height:64vh;
      }

      .artwork-progress-caption{
        align-items:flex-start;
        flex-direction:column;
        gap:3px;
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeAttr(value){
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
