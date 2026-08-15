import { state } from "../core/state.js";
import { loadCheckins, loadProfileCheckins } from "../api/checkin.js";

// 旧图合并管理：把多张旧图片合并成同一个 artwork 的多个进度。
let styleInjected = false;
let observerStarted = false;

startArtworkMergeManager();

function startArtworkMergeManager(){
  injectStyles();

  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".artwork-merge-open");
    if(!btn) return;

    e.preventDefault();
    e.stopPropagation();
    openMergeModal();
  });

  if(observerStarted) return;
  observerStarted = true;

  const observer = new MutationObserver(() => {
    requestAnimationFrame(injectMergeButtons);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  injectMergeButtons();
}

function injectMergeButtons(){
  if(state.view !== "me" || !state.user) return;

  document.querySelectorAll("#app .archive-card").forEach(card => {
    if(card.querySelector(".artwork-merge-open")) return;

    const top = card.querySelector(".archive-top") || card;
    const btn = document.createElement("button");
    btn.className = "artwork-merge-open";
    btn.type = "button";
    btn.textContent = "合并旧图";
    top.appendChild(btn);
  });
}

function openMergeModal(){
  const old = document.getElementById("artwork-merge-modal");
  if(old) old.remove();

  const images = getOwnImages();
  const modal = document.createElement("div");
  modal.id = "artwork-merge-modal";
  modal.className = "modal-bg detail-viewer-bg";

  modal.innerHTML = `
    <div class="detail-viewer-card artwork-merge-card">
      <button class="detail-x artwork-merge-close" type="button" aria-label="关闭">×</button>
      <div class="detail-viewer-head artwork-merge-head">
        <div>
          <div class="detail-author">合并为同一作品</div>
          <div class="detail-date">选择多张图，把它们设为同一张画的不同进度</div>
        </div>
      </div>

      ${images.length ? renderMergeBody(images) : `<div class="empty archive-empty">还没有可合并的图片</div>`}
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.onclick = (e) => {
    if(e.target === modal) close();
  };
  modal.querySelector(".artwork-merge-close")?.addEventListener("click", close);

  bindMergeModal(modal, images);
}

function renderMergeBody(images){
  return `
    <div class="artwork-merge-tip">
      旧图默认是一图一作品。这里可以把草稿、线稿、上色等图片合成同一个作品进度。
    </div>

    <div class="artwork-merge-grid">
      ${images.map(img => `
        <button class="artwork-merge-tile" data-image-id="${escapeAttr(img.id)}" type="button">
          <img src="${escapeAttr(img.image_url)}" alt="">
          <span>${formatDate(img.checkin_created_at)}</span>
        </button>
      `).join("")}
    </div>

    <div class="artwork-merge-selected" id="artwork-merge-selected">
      <div class="hint-text">选择至少两张图后，可以设置它们的进度顺序。</div>
    </div>

    <div class="detail-actions">
      <button id="artwork-merge-save">合并选中图片</button>
    </div>
  `;
}

function bindMergeModal(modal, images){
  const selected = new Set();

  const rerenderSelected = () => {
    modal.querySelectorAll(".artwork-merge-tile").forEach(tile => {
      tile.classList.toggle("on", selected.has(tile.dataset.imageId));
    });

    const wrap = modal.querySelector("#artwork-merge-selected");
    if(!wrap) return;

    const selectedImages = images.filter(img => selected.has(String(img.id)));

    if(selectedImages.length < 2){
      wrap.innerHTML = `<div class="hint-text">选择至少两张图后，可以设置它们的进度顺序。</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="artwork-merge-selected-title">进度顺序</div>
      ${selectedImages.map((img, index) => `
        <div class="artwork-merge-row" data-image-id="${escapeAttr(img.id)}">
          <img src="${escapeAttr(img.image_url)}" alt="">
          <select data-merge-label="${escapeAttr(img.id)}">
            ${["草稿", "线稿", "上色", "完成稿", "作品"].map((label, i) => `
              <option value="${escapeAttr(label)}" ${i === index ? "selected" : ""}>${escapeHtml(label)}</option>
            `).join("")}
          </select>
        </div>
      `).join("")}
    `;
  };

  modal.querySelectorAll(".artwork-merge-tile").forEach(tile => {
    tile.onclick = () => {
      const id = tile.dataset.imageId;
      if(selected.has(id)) selected.delete(id);
      else selected.add(id);
      rerenderSelected();
    };
  });

  const saveBtn = modal.querySelector("#artwork-merge-save");
  if(saveBtn){
    saveBtn.onclick = async () => {
      const selectedImages = images.filter(img => selected.has(String(img.id)));
      if(selectedImages.length < 2){
        window.showToast?.("请至少选择两张图。", "还不能合并", "error");
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "合并中...";

      const ok = await mergeImages(modal, selectedImages);

      if(!ok){
        saveBtn.disabled = false;
        saveBtn.textContent = "合并选中图片";
        return;
      }

      modal.remove();
      window.showToast?.("已合并为同一作品进度。", "合并成功", "success");
    };
  }
}

async function mergeImages(modal, selectedImages){
  const sb = window.__sb;
  if(!sb){
    window.showToast?.("数据库连接失败，请刷新后重试。", "合并失败", "error");
    return false;
  }

  const artworkId = selectedImages[0].artwork_id || selectedImages[0].id;

  for(let index = 0; index < selectedImages.length; index++){
    const img = selectedImages[index];
    const label = modal.querySelector(`[data-merge-label="${cssEscape(String(img.id))}"]`)?.value || defaultLabel(index);

    const { error } = await sb
      .from("checkin_images")
      .update({
        artwork_id: artworkId,
        progress_label: label,
        progress_order: index,
        progress_date: img.progress_date || img.checkin_created_at
      })
      .eq("id", img.id);

    if(error){
      if(isArtworkSchemaMissing(error)){
        window.showToast?.(
          "作品进度字段还没建好。请先在 Supabase 执行 supabase-artwork-migration.sql。",
          "合并失败",
          "error"
        );
      }else{
        window.showToast?.("合并失败：" + error.message, "合并失败", "error");
      }
      return false;
    }
  }

  await refreshState(sb);
  return true;
}

async function refreshState(sb){
  const checkins = await loadCheckins(sb);
  const profileCheckins = state.profile ? await loadProfileCheckins(sb, state.profile) : [];

  if(window.setState){
    window.setState({ checkins, profileCheckins });
  }
}

function getOwnImages(){
  const userId = state.user?.id;
  if(!userId) return [];

  const source = state.profileCheckins?.length ? state.profileCheckins : (state.checkins || []);
  const images = [];

  source.forEach(checkin => {
    if(checkin.user_id !== userId) return;

    (checkin.checkin_images || []).forEach((img, index) => {
      images.push({
        ...img,
        checkin_id: checkin.id,
        checkin_created_at: checkin.created_at,
        fallback_order: index
      });
    });
  });

  return images.sort((a, b) => new Date(b.progress_date || b.checkin_created_at) - new Date(a.progress_date || a.checkin_created_at));
}

function defaultLabel(index){
  return ["草稿", "线稿", "上色", "完成稿"][index] || "作品";
}

function isArtworkSchemaMissing(error){
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");

  return code === "PGRST204"
    || message.includes("artwork_id")
    || message.includes("progress_label")
    || message.includes("progress_order")
    || message.includes("progress_date")
    || message.includes("schema cache")
    || (message.includes("column") && message.includes("does not exist"));
}

function formatDate(date){
  const d = new Date(date);
  if(Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function cssEscape(value){
  if(window.CSS?.escape) return window.CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function injectStyles(){
  if(styleInjected) return;
  styleInjected = true;

  const style = document.createElement("style");
  style.id = "artwork-merge-style";
  style.textContent = `
    .artwork-merge-open{
      flex:0 0 auto;
      width:auto !important;
      margin:0 !important;
      padding:7px 11px !important;
      border-radius:999px !important;
      background:#111 !important;
      color:#fff !important;
      font-size:12px !important;
      font-weight:850;
    }

    .artwork-merge-card{
      overflow:hidden;
      padding:18px;
    }

    .artwork-merge-head{
      padding-right:56px;
    }

    .artwork-merge-tip{
      margin-bottom:12px;
      padding:10px 12px;
      border-radius:16px;
      background:#f7f8f9;
      color:#666;
      font-size:12px;
      line-height:1.55;
    }

    .artwork-merge-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(86px,1fr));
      gap:10px;
      max-height:38vh;
      overflow:auto;
      padding-right:2px;
    }

    .artwork-merge-tile{
      position:relative;
      aspect-ratio:1/1;
      margin:0 !important;
      padding:0 !important;
      overflow:hidden;
      border-radius:16px !important;
      background:#eee !important;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.04);
    }

    .artwork-merge-tile.on{
      box-shadow:0 0 0 4px rgba(12,192,223,.30), inset 0 0 0 1px rgba(12,192,223,.8);
    }

    .artwork-merge-tile img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }

    .artwork-merge-tile span{
      position:absolute;
      left:6px;
      right:6px;
      bottom:6px;
      padding:4px 6px;
      border-radius:999px;
      background:rgba(0,0,0,.56);
      color:#fff;
      font-size:10px;
      line-height:1;
      text-align:center;
    }

    .artwork-merge-selected{
      margin-top:12px;
      padding:12px;
      border-radius:18px;
      background:#f7f8f9;
    }

    .artwork-merge-selected-title{
      margin-bottom:8px;
      color:#111;
      font-size:13px;
      font-weight:900;
    }

    .artwork-merge-row{
      display:grid;
      grid-template-columns:46px 1fr;
      gap:9px;
      align-items:center;
      margin-top:8px;
    }

    .artwork-merge-row img{
      width:46px;
      height:46px;
      border-radius:12px;
      object-fit:cover;
      background:#eee;
    }

    .artwork-merge-row select{
      width:100%;
      border:0;
      border-radius:12px;
      background:#fff;
      padding:10px 11px;
      font-family:inherit;
      font-size:13px;
      outline:none;
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
