import { uploadImage } from "../api/storage.js";
import {
  createCheckin,
  addCheckinImage,
  loadCheckins
} from "../api/checkin.js";

export const TAG_CATEGORIES = {
  "内容": ["生物", "场景", "人物", "物件"],
  "类型": ["练习", "过程", "设计", "同人"],
  "完成度": ["草稿", "线稿", "上色", "完成稿"]
};

const NOTE_PLACEHOLDERS = [
  "遇到了什么难点？作画过程是否顺利？",
  "这张画的灵感是哪来的？",
  "哪个环节卡了最久？",
  "比起上一次，这次有什么不一样？",
  "画完之后觉得最满意的部分是？"
];

let pendingImages = [];
let globalTags = [];
let selectedImageId = null;

export function openCheckinModal(){
  const old = document.getElementById("checkin-modal");
  if(old) old.remove();

  pendingImages = [];
  globalTags = [];
  selectedImageId = null;

  const modal = document.createElement("div");
  modal.id = "checkin-modal";
  modal.className = "modal-bg";

  modal.innerHTML = `
    <div class="modal-card">
      <h3>本次打卡</h3>

      <label class="ci-upload-empty" id="ci-upload-empty" for="ci-files">
        <span>＋</span>
        <em>支持多选图片</em>
        <input type="file" id="ci-files" accept="image/*" multiple />
      </label>

      <div id="ci-img-list"></div>
      <div id="ci-tag-panel"></div>

      <label>感想（选填）</label>
      <textarea id="ci-note" placeholder="${NOTE_PLACEHOLDERS[Math.floor(Math.random() * NOTE_PLACEHOLDERS.length)]}"></textarea>

      <div class="hint-text">
        清晰记录创作感想，能帮你回顾自己的成长轨迹，也会让你的个人报告更有意思
      </div>

      <button id="ci-submit">提交打卡</button>
      <button id="ci-cancel" class="secondary">取消</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  document.getElementById("ci-cancel").onclick = () => {
    modal.remove();
  };

  document.getElementById("ci-files").onchange = async (e) => {
    const files = Array.from(e.target.files);

    for(const f of files){
      const dataUrl = await readAsDataUrl(f);

      const id = "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

      pendingImages.push({
        id,
        file: f,
        preview: dataUrl,
        tags: [...globalTags],
        customTags: false
      });
    }

    renderImgList();
    e.target.value = "";
  };

  document.getElementById("ci-submit").onclick = () => {
    submitCheckin(modal);
  };

  renderImgList();
}

function readAsDataUrl(file){
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target.result);
    };

    reader.readAsDataURL(file);
  });
}

function renderImgList(){
  const wrap = document.getElementById("ci-img-list");
  const tagPanel = document.getElementById("ci-tag-panel");
  const uploadEmpty = document.getElementById("ci-upload-empty");
  
  if(!wrap || !tagPanel) return;
  
  if(uploadEmpty){
    uploadEmpty.classList.toggle("has-images", pendingImages.length > 0);
  }

  if(!pendingImages.length){
    wrap.innerHTML = "";
    tagPanel.innerHTML = "";
    selectedImageId = null;
    return;
  }

  const selected = pendingImages.find(img => img.id === selectedImageId);
  const isSingleMode = !!selected;

  const gridHtml = pendingImages.map((img, index) => {
    const selectedClass = img.id === selectedImageId ? " selected" : "";
    const customMark = img.customTags ? '<span class="ci-custom-mark">单独</span>' : "";
    const pointer = img.id === selectedImageId ? '<span class="ci-thumb-pointer"></span>' : "";

    return `
      <button class="ci-thumb${selectedClass}" data-id="${img.id}" type="button">
        <img src="${img.preview}">
        <span class="ci-thumb-num">${index + 1}</span>
        ${customMark}
        <span class="ci-thumb-remove" data-remove-id="${img.id}">×</span>
        ${pointer}
      </button>
    `;
  }).join("");

  wrap.innerHTML = `
    <div class="ci-thumb-grid">
      ${gridHtml}
  
      <label class="ci-thumb ci-add-thumb" for="ci-files">
        <span>＋</span>
        <input type="file" id="ci-files-more" accept="image/*" multiple>
      </label>
    </div>
  `;

if(isSingleMode){
  tagPanel.innerHTML = `
    <div class="ci-tag-box single">
      <div class="ci-section-title">单张标签</div>

      ${renderTagGroups(selected.tags, "single")}

      <div class="ci-single-actions">
        <button id="ci-back-global" class="ci-icon-btn" type="button" title="返回套用标签">×</button>
        <button id="ci-reset-tags" class="ci-icon-btn" type="button" title="恢复统一标签">↻</button>
      </div>
    </div>
  `;
} else {
    tagPanel.innerHTML = `
      <div class="ci-tag-box">
        <div class="ci-section-title">套用标签</div>
        <div class="hint-text ci-tag-hint">选择的标签会套用到所有图片。点击图片可单独修改。</div>
        ${renderTagGroups(globalTags, "global")}
      </div>
    `;
  }
  const moreInput = document.getElementById("ci-files-more");
if(moreInput){
  moreInput.onchange = async (e) => {
    const files = Array.from(e.target.files);

    for(const f of files){
      const dataUrl = await readAsDataUrl(f);
      const id = "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

      pendingImages.push({
        id,
        file: f,
        preview: dataUrl,
        tags: [...globalTags],
        customTags: false
      });
    }

    renderImgList();
    e.target.value = "";
  };
}
  wrap.querySelectorAll(".ci-thumb").forEach(btn => {
    btn.onclick = (e) => {
      if(e.target.classList.contains("ci-thumb-remove")) return;
      selectedImageId = btn.dataset.id;
      renderImgList();
    };
  });

  wrap.querySelectorAll(".ci-thumb-remove").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();

      const id = btn.dataset.removeId;
      pendingImages = pendingImages.filter(img => img.id !== id);

      if(selectedImageId === id){
        selectedImageId = null;
      }

      renderImgList();
    };
  });

  tagPanel.querySelectorAll('.preset-tag[data-mode="global"]').forEach(btn => {
    btn.onclick = () => {
      const tag = btn.dataset.tag;
      globalTags = toggleTag(globalTags, tag);

      pendingImages = pendingImages.map(img => {
        if(img.customTags) return img;

        return {
          ...img,
          tags: [...globalTags]
        };
      });

      renderImgList();
    };
  });

  tagPanel.querySelectorAll('.preset-tag[data-mode="single"]').forEach(btn => {
    btn.onclick = () => {
      if(!selected) return;

      const tag = btn.dataset.tag;
      selected.tags = toggleTag(selected.tags, tag);
      selected.customTags = true;

      renderImgList();
    };
  });

  const backBtn = document.getElementById("ci-back-global");
  if(backBtn){
    backBtn.onclick = () => {
      selectedImageId = null;
      renderImgList();
    };
  }

  const resetBtn = document.getElementById("ci-reset-tags");
  if(resetBtn && selected){
    resetBtn.onclick = () => {
      selected.tags = [...globalTags];
      selected.customTags = false;
      renderImgList();
    };
  }
}

function toggleTag(list, tag){
  return list.includes(tag)
    ? list.filter(x => x !== tag)
    : [...list, tag];
}

function tagsLabel(tags){
  if(!tags || !tags.length) return "未选标签";
  return tags.map(t => "#" + t).join(" ");
}

function renderTagGroups(activeTags, mode){
  return Object.keys(TAG_CATEGORIES).map(cat => {
    const opts = TAG_CATEGORIES[cat].map(tag => {
      const onClass = activeTags.includes(tag) ? " on" : "";

      return `
        <span class="preset-tag${onClass}" data-mode="${mode}" data-tag="${tag}">
          ${tag}
        </span>
      `;
    }).join("");

    return `
      <div class="ci-tag-row">
        <div class="ci-tag-label">${cat}</div>
        <div class="ci-tag-options">${opts}</div>
      </div>
    `;
  }).join("");
}

async function submitCheckin(modal){
  const sb = window.__sb;
  const user = window.__user;

  if(!sb || !user){
    window.showToast?.("请先登录后再打卡。", "还不能打卡", "error");
    return;
  }

  if(!pendingImages.length){
    window.showToast?.("请至少选择一张图片。", "还没有作品", "error");
    return;
  }

  const note = document.getElementById("ci-note").value.trim();
  const btn = document.getElementById("ci-submit");

  btn.disabled = true;
  btn.textContent = "🖼️ 上传图片中...";

  const uploadedImages = [];

  for(const img of pendingImages){
    const safeFileName = img.file.name.replace(/[^\w.\-]/g, "_");
    const path = user.id + "/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "_" + safeFileName;

    const url = await uploadImage(sb, img.file, path);

    if(!url){
      if(uploadedImages.length){
        await sb.storage.from("art").remove(uploadedImages.map(x => x.path));
      }

      btn.disabled = false;
      btn.textContent = "提交打卡";
      window.showToast?.("有图片上传失败，本次打卡没有提交。\n请重新选择图片后再试。", "上传失败", "error");
      return;
    }

    uploadedImages.push({
      url,
      path,
      tags: img.tags
    });
  }

  btn.textContent = "🧾 创建打卡中...";

  const { data: profile } = await sb
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || "匿名";
  const checkin = await createCheckin(sb, user.id, username, note);

  if(!checkin){
    await sb.storage.from("art").remove(uploadedImages.map(x => x.path));
    btn.disabled = false;
    btn.textContent = "提交打卡";
    window.showToast?.("打卡创建失败，已取消本次提交。", "提交失败", "error");
    return;
  }

  btn.textContent = "🏷️ 保存标签中...";

  for(const img of uploadedImages){
    const imageRecord = await addCheckinImage(
      sb,
      checkin.id,
      user.id,
      img.url,
      img.path,
      img.tags
    );

    if(!imageRecord){
      await sb.storage.from("art").remove(uploadedImages.map(x => x.path));
      await sb.from("checkins").delete().eq("id", checkin.id).eq("user_id", user.id);

      btn.disabled = false;
      btn.textContent = "提交打卡";
      window.showToast?.("图片记录保存失败，本次打卡已取消。", "保存失败", "error");
      return;
    }
  }

  btn.textContent = "✨ 完成！";

  modal.remove();
  window.showConfettiSuccess?.("打卡成功！");

  const freshCheckins = await loadCheckins(sb);

  if(window.setState){
    window.setState({
      checkins: freshCheckins
    });
  }
}
