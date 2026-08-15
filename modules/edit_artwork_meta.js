import { state } from "../core/state.js";
import { buildArtworksFromCheckins, getArtworkCover } from "./artwork.js";

// 编辑打卡增强：选中单张图后，可以修改它属于哪个 artwork，以及当前进度标签。
let styleInjected = false;
let observerStarted = false;
let metaDraft = new Map();
let savePassthrough = false;

startEditArtworkMeta();

function startEditArtworkMeta(){
  injectStyles();

  document.addEventListener("click", handleSaveClick, true);

  if(observerStarted) return;
  observerStarted = true;

  const observer = new MutationObserver(() => {
    requestAnimationFrame(enhanceEditModal);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function enhanceEditModal(){
  const modal = document.getElementById("edit-modal");
  if(!modal){
    metaDraft = new Map();
    return;
  }

  const tagPanel = modal.querySelector(".edit-tag-panel");
  if(!tagPanel) return;

  if(modal.querySelector(".edit-artwork-box")) return;

  const selectedThumb = modal.querySelector(".edit-thumb.selected");
  const imageId = selectedThumb?.dataset.imgId || "";
  const box = document.createElement("div");
  box.className = "edit-artwork-box";

  if(!imageId){
    box.innerHTML = `
      <div class="edit-artwork-title">作品关系</div>
      <div class="hint-text">点击上方某一张图后，可以修改它是新作品，还是已有作品的某个进度。</div>
    `;
    tagPanel.after(box);
    return;
  }

  const image = findImageById(imageId);
  const currentMeta = getDraftMeta(imageId, image);
  const artworks = getCandidateArtworks(image);

  box.innerHTML = `
    <div class="edit-artwork-title">作品关系</div>

    <label class="edit-artwork-label">这张图属于</label>
    <select id="edit-artwork-target" data-image-id="${escapeAttr(imageId)}">
      <option value="same" ${currentMeta.target === "same" ? "selected" : ""}>保持当前作品</option>
      <option value="new" ${currentMeta.target === "new" ? "selected" : ""}>拆成一个新作品</option>
      ${artworks.map(artwork => renderArtworkOption(artwork, currentMeta)).join("")}
    </select>

    <div class="edit-artwork-row">
      <div>
        <label class="edit-artwork-label">当前进度</label>
        <select id="edit-progress-label" data-image-id="${escapeAttr(imageId)}">
          ${["作品", "草稿", "线稿", "上色", "完成稿"].map(label => `
            <option value="${escapeAttr(label)}" ${currentMeta.progress_label === label ? "selected" : ""}>${escapeHtml(label)}</option>
          `).join("")}
        </select>
      </div>
      <div>
        <label class="edit-artwork-label">顺序</label>
        <input id="edit-progress-order" data-image-id="${escapeAttr(imageId)}" type="number" min="0" step="1" value="${escapeAttr(currentMeta.progress_order)}">
      </div>
    </div>

    <div class="hint-text">保存修改时会一起保存作品关系。数据库需要先执行 artwork 迁移 SQL。</div>
  `;

  tagPanel.after(box);
  bindControls(box, imageId, image);
}

function bindControls(box, imageId, image){
  const target = box.querySelector("#edit-artwork-target");
  const label = box.querySelector("#edit-progress-label");
  const order = box.querySelector("#edit-progress-order");

  const sync = () => {
    const current = getDraftMeta(imageId, image);
    metaDraft.set(imageId, {
      ...current,
      target: target?.value || current.target,
      progress_label: label?.value || current.progress_label,
      progress_order: Number.isFinite(Number(order?.value)) ? Number(order.value) : current.progress_order
    });
  };

  target?.addEventListener("change", sync);
  label?.addEventListener("change", sync);
  order?.addEventListener("input", sync);
}

function handleSaveClick(e){
  const btn = e.target.closest?.("#edit-save");
  if(!btn) return;

  if(savePassthrough){
    savePassthrough = false;
    return;
  }

  if(!metaDraft.size) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation?.();

  saveDraftThenContinue(btn);
}

async function saveDraftThenContinue(btn){
  const sb = window.__sb;

  if(!sb){
    window.showToast?.("数据库连接失败，请刷新后重试。", "保存失败", "error");
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "保存作品关系...";

  const ok = await saveArtworkMetaDraft(sb);

  if(!ok){
    btn.disabled = false;
    btn.textContent = originalText || "保存修改";
    return;
  }

  btn.disabled = false;
  savePassthrough = true;
  btn.click();
}

async function saveArtworkMetaDraft(sb){
  for(const [imageId, meta] of metaDraft.entries()){
    const image = findImageById(imageId);
    if(!image) continue;

    const artworkId = resolveArtworkId(meta, image);
    const payload = {
      artwork_id: artworkId,
      progress_label: meta.progress_label || "作品",
      progress_order: Number.isFinite(Number(meta.progress_order)) ? Number(meta.progress_order) : 0,
      progress_date: meta.progress_date || getCheckinDateForImage(imageId)
    };

    const { error } = await sb
      .from("checkin_images")
      .update(payload)
      .eq("id", imageId);

    if(error){
      if(isArtworkSchemaMissing(error)){
        window.showToast?.(
          "作品进度字段还没建好。请先在 Supabase 执行 supabase-artwork-migration.sql。",
          "保存失败",
          "error"
        );
      }else{
        window.showToast?.("作品关系保存失败：" + error.message, "保存失败", "error");
      }
      return false;
    }
  }

  return true;
}

function resolveArtworkId(meta, image){
  if(meta.target === "new"){
    return createUuid();
  }

  if(meta.target && meta.target !== "same"){
    return meta.target;
  }

  return image.artwork_id || image.id;
}

function renderArtworkOption(artwork, currentMeta){
  const cover = getArtworkCover(artwork);
  const label = [
    formatDate(artwork.created_at),
    artwork.progresses?.length > 1 ? `${artwork.progresses.length}阶段` : "1阶段"
  ].filter(Boolean).join(" · ");

  const selected = currentMeta.target === artwork.id
    || (currentMeta.target === "same" && currentMeta.artwork_id === artwork.id);

  return `<option value="${escapeAttr(artwork.id)}" ${selected ? "selected" : ""}>加入已有作品：${escapeHtml(label || cover?.progress_label || "作品")}</option>`;
}

function getDraftMeta(imageId, image){
  if(metaDraft.has(imageId)){
    return metaDraft.get(imageId);
  }

  return {
    target: "same",
    artwork_id: image?.artwork_id || image?.id || "",
    progress_label: image?.progress_label || "作品",
    progress_order: Number.isFinite(Number(image?.progress_order)) ? Number(image.progress_order) : 0,
    progress_date: image?.progress_date || getCheckinDateForImage(imageId)
  };
}

function getCandidateArtworks(image){
  const userId = image?.user_id || window.__user?.id;
  const artworks = buildArtworksFromCheckins(state.checkins || []);

  return artworks
    .filter(artwork => !userId || artwork.user_id === userId)
    .slice(0, 60);
}

function findImageById(imageId){
  for(const checkin of state.checkins || []){
    for(const image of checkin.checkin_images || []){
      if(String(image.id) === String(imageId)){
        return image;
      }
    }
  }

  for(const checkin of state.profileCheckins || []){
    for(const image of checkin.checkin_images || []){
      if(String(image.id) === String(imageId)){
        return image;
      }
    }
  }

  return null;
}

function getCheckinDateForImage(imageId){
  const all = [...(state.checkins || []), ...(state.profileCheckins || [])];

  for(const checkin of all){
    if((checkin.checkin_images || []).some(img => String(img.id) === String(imageId))){
      return checkin.created_at || null;
    }
  }

  return null;
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

function createUuid(){
  if(window.crypto?.randomUUID){
    return window.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
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
  style.id = "edit-artwork-meta-style";
  style.textContent = `
    .edit-artwork-box{
      margin-top:-2px;
      padding:13px;
      border-radius:18px;
      background:#f7f8f9;
    }

    .edit-artwork-title{
      margin-bottom:8px;
      font-size:13px;
      font-weight:900;
      color:#111;
    }

    .edit-artwork-label{
      display:block;
      margin:8px 0 5px !important;
      font-size:11px !important;
      font-weight:850;
      color:#777 !important;
    }

    .edit-artwork-box select,
    .edit-artwork-box input{
      width:100%;
      border:0;
      border-radius:12px;
      background:#fff;
      padding:10px 11px;
      font-family:inherit;
      font-size:13px;
      outline:none;
    }

    .edit-artwork-row{
      display:grid;
      grid-template-columns:1fr 82px;
      gap:10px;
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
