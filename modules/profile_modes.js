import { state } from "../core/state.js";
import { openProfileCheckinDetail } from "./detail_modal.js";

// Profile 视图增强：把个人页作品区拆成「画廊 / 打卡」两个模式。
// 非侵入式：不改 profile.js 主渲染，只在渲染后增强 archive-card。
let profileArchiveMode = "gallery";
let styleInjected = false;
let observerStarted = false;

startProfileModeEnhancer();

function startProfileModeEnhancer(){
  injectStyles();

  document.addEventListener("click", handleModeClick, true);
  document.addEventListener("click", handleCheckinClick, true);

  if(observerStarted) return;
  observerStarted = true;

  const observer = new MutationObserver(() => {
    requestAnimationFrame(enhanceProfileArchives);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", enhanceProfileArchives, { once: true });
  }else{
    enhanceProfileArchives();
  }
}

function enhanceProfileArchives(){
  document.querySelectorAll(".archive-card").forEach(card => {
    const gallerySection = card.querySelector(".archive-gallery-section");
    if(!gallerySection) return;

    if(!gallerySection.dataset.galleryHtml){
      gallerySection.dataset.galleryHtml = gallerySection.innerHTML;
    }

    if(!card.querySelector(".profile-archive-tabs")){
      const tabs = document.createElement("div");
      tabs.className = "profile-archive-tabs";
      tabs.innerHTML = `
        <button class="profile-archive-tab" data-profile-archive-mode="gallery" type="button">画廊</button>
        <button class="profile-archive-tab" data-profile-archive-mode="checkins" type="button">打卡</button>
      `;
      gallerySection.parentNode.insertBefore(tabs, gallerySection);
    }

    renderArchiveMode(card);
  });
}

function handleModeClick(e){
  const btn = e.target.closest?.("[data-profile-archive-mode]");
  if(!btn) return;

  const card = btn.closest(".archive-card");
  if(!card) return;

  e.preventDefault();
  e.stopPropagation();

  profileArchiveMode = btn.dataset.profileArchiveMode || "gallery";
  renderArchiveMode(card);
}

function handleCheckinClick(e){
  const btn = e.target.closest?.("[data-profile-checkin-id]");
  if(!btn) return;

  const card = btn.closest(".archive-card");
  if(!card) return;

  const item = getVisibleCheckins(card).find(x => String(x.id) === String(btn.dataset.profileCheckinId));
  if(!item) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation?.();

  const readonly = !!card.closest("#readonly-profile-modal") || state.view === "user";
  openProfileCheckinDetail(item, readonly);
}

function renderArchiveMode(card){
  const gallerySection = card.querySelector(".archive-gallery-section");
  if(!gallerySection) return;

  card.querySelectorAll(".profile-archive-tab").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.profileArchiveMode === profileArchiveMode);
  });

  if(profileArchiveMode === "gallery"){
    gallerySection.innerHTML = gallerySection.dataset.galleryHtml || gallerySection.innerHTML;
    return;
  }

  gallerySection.innerHTML = renderCheckinArchive(card);
}

function renderCheckinArchive(card){
  const checkins = getVisibleCheckins(card);

  if(!checkins.length){
    return `<div class="empty archive-empty">这个范围内还没有打卡记录</div>`;
  }

  return `
    <div class="profile-checkin-list">
      ${checkins.map(renderCheckinCard).join("")}
    </div>
  `;
}

function renderCheckinCard(item){
  const imgs = item.checkin_images || [];
  const thumbs = imgs.length
    ? imgs.map(img => `
        <button class="profile-checkin-thumb" data-profile-checkin-id="${escapeAttr(item.id)}" type="button">
          <img src="${escapeAttr(img.image_url)}" alt="">
        </button>
      `).join("")
    : `<div class="profile-checkin-empty">这次打卡没有图片</div>`;

  const note = item.note
    ? `<div class="profile-checkin-note">${escapeHtml(item.note)}</div>`
    : "";

  return `
    <article class="profile-checkin-card" data-profile-checkin-id="${escapeAttr(item.id)}">
      <button class="profile-checkin-main" data-profile-checkin-id="${escapeAttr(item.id)}" type="button">
        <div>
          <b>${formatDate(item.created_at)}</b>
          <span>${imgs.length} 张图</span>
        </div>
        <em>查看</em>
      </button>
      <div class="profile-checkin-thumbs">
        ${thumbs}
      </div>
      ${note}
    </article>
  `;
}

function getVisibleCheckins(card){
  const target = getProfileTarget(card);
  let items = getProfileCheckins(target);
  items = filterByActiveRange(items, card);
  return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getProfileTarget(card){
  if(state.view === "me" && !card.closest("#readonly-profile-modal")){
    return state.profile || null;
  }

  if(state.view === "user" && state.viewUserId && !card.closest("#readonly-profile-modal")){
    return (state.profiles || []).find(p => p.id === state.viewUserId) || null;
  }

  const modal = card.closest("#readonly-profile-modal");
  if(modal){
    const name = modal.querySelector(".profile-greeting")?.textContent?.trim();
    if(name){
      return (state.profiles || []).find(p => p.username === name) || null;
    }
  }

  const greeting = card.closest("#app")?.querySelector(".profile-greeting")?.textContent || "";
  const normalized = greeting.replace(/^你好，/, "").replace(/！$/, "").trim();
  if(normalized){
    return (state.profiles || []).find(p => p.username === normalized) || null;
  }

  return state.profile || null;
}

function getProfileCheckins(profile){
  if(!profile) return [];

  const isOwn = profile.id === state.user?.id;
  const source = isOwn
    ? (state.profileCheckins || state.checkins || [])
    : (state.checkins || []);

  return source.filter(item => {
    if(item.user_id === profile.id) return true;
    if(profile.member_id && item.member_id === profile.member_id) return true;
    return false;
  });
}

function filterByActiveRange(items, card){
  const mode = card.querySelector("#profile-data-filter .on")?.dataset.mode || "month";
  if(mode === "all") return items;

  const now = new Date();
  const start = mode === "week" ? startOfWeek(now) : startOfMonth(now);
  const end = new Date(start);

  if(mode === "week") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);

  return items.filter(item => {
    const d = new Date(item.created_at);
    return d >= start && d < end;
  });
}

function startOfWeek(date){
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function startOfMonth(date){
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d;
}

function formatDate(date){
  const d = new Date(date);
  if(Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function injectStyles(){
  if(styleInjected) return;
  styleInjected = true;

  const style = document.createElement("style");
  style.id = "profile-modes-style";
  style.textContent = `
    .profile-archive-tabs{
      display:flex;
      gap:8px;
      margin:4px 0 14px;
      padding:4px;
      border-radius:999px;
      background:#f3f4f5;
    }

    .profile-archive-tab{
      flex:1;
      margin:0 !important;
      padding:9px 10px !important;
      border-radius:999px !important;
      background:transparent !important;
      color:#777 !important;
      font-size:13px !important;
      font-weight:850;
      box-shadow:none !important;
    }

    .profile-archive-tab.on{
      background:#111 !important;
      color:#fff !important;
    }

    .profile-checkin-list{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .profile-checkin-card{
      padding:12px;
      border-radius:20px;
      background:#f7f8f9;
    }

    .profile-checkin-main{
      width:100%;
      margin:0 0 10px !important;
      padding:0 !important;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      border:0;
      background:transparent !important;
      color:#111 !important;
      box-shadow:none !important;
      text-align:left;
    }

    .profile-checkin-main b{
      display:block;
      font-size:14px;
      font-weight:900;
      color:#111;
    }

    .profile-checkin-main span,
    .profile-checkin-main em{
      font-size:12px;
      color:#888;
      font-style:normal;
    }

    .profile-checkin-thumbs{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(72px,1fr));
      gap:8px;
    }

    .profile-checkin-thumb{
      aspect-ratio:1/1;
      margin:0 !important;
      padding:0 !important;
      overflow:hidden;
      border-radius:14px !important;
      background:#eee !important;
    }

    .profile-checkin-thumb img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }

    .profile-checkin-empty{
      padding:18px;
      border-radius:14px;
      background:#fff;
      color:#999;
      text-align:center;
      font-size:12px;
    }

    .profile-checkin-note{
      margin-top:10px;
      padding:10px 12px;
      border-radius:14px;
      background:#fff;
      color:#555;
      font-size:13px;
      line-height:1.55;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
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
