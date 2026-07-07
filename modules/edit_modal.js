import { TAG_CATEGORIES } from "./checkin_modal.js";
import {
  updateCheckinNote,
  updateCheckinDate,
  updateImageTags,
  deleteCheckinWithImages,
  loadCheckins
} from "../api/checkin.js";

function fmtDate(date){
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function dateInputValue(date){
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function localTodayString(){
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// 编辑已有打卡：日期、感想、标签和删除
export function openEditModal(item){
  const old = document.getElementById("edit-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const imgs = item.checkin_images || [];

  let editImages = imgs.map((img, index) => ({
    id: img.id,
    image_url: img.image_url,
    tags: [...(img.tags || [])],
    customTags: false,
    index
  }));

  let globalTags = editImages[0] ? [...editImages[0].tags] : [];
  let selectedImageId = null;
  let noteValue = item.note || "";
  let dateValue = dateInputValue(item.created_at);

  function selectedImage(){
    return editImages.find(img => img.id === selectedImageId);
  }

  function renderTagGroups(activeTags, mode){
    return Object.keys(TAG_CATEGORIES).map(cat => {
      const opts = TAG_CATEGORIES[cat].map(tag => {
        const onClass = activeTags.includes(tag) ? " on" : "";

        return (
          '<span class="preset-tag' + onClass + '" data-mode="' + mode + '" data-tag="' + tag + '">' +
            tag +
          '</span>'
        );
      }).join("");

      return (
        '<div class="ci-tag-row">' +
          '<div class="ci-tag-label">' + cat + '</div>' +
          '<div class="ci-tag-options">' + opts + '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderEditor(){
    const isSingleMode = !!selectedImageId;
    const selected = selectedImage();

    const thumbsHtml = editImages.map((img, idx) => {
      const selectedClass = img.id === selectedImageId ? " selected" : "";
      const customMark = img.customTags ? '<span class="ci-custom-mark">单独</span>' : "";
      const pointer = img.id === selectedImageId ? '<span class="ci-thumb-pointer"></span>' : "";

      return (
        '<button class="ci-thumb edit-thumb' + selectedClass + '" data-img-id="' + img.id + '" type="button">' +
          '<img src="' + img.image_url + '">' +
          '<span class="ci-thumb-num">' + (idx + 1) + '</span>' +
          customMark +
          pointer +
        '</button>'
      );
    }).join("");

    const tagPanelHtml = isSingleMode && selected
      ? (
        '<div class="ci-tag-box single edit-tag-panel">' +
          '<div class="ci-section-title">单张标签</div>' +
          renderTagGroups(selected.tags, "single") +
          '<div class="ci-single-actions">' +
            '<button id="edit-back-global" class="ci-icon-btn" type="button" title="返回套用标签">×</button>' +
            '<button id="edit-reset-tags" class="ci-icon-btn" type="button" title="恢复统一标签">↻</button>' +
          '</div>' +
        '</div>'
      )
      : (
        '<div class="ci-tag-box edit-tag-panel">' +
          '<div class="ci-section-title">套用标签</div>' +
          '<div class="hint-text ci-tag-hint">选择的标签会套用到所有图片。点击图片可单独修改。</div>' +
          renderTagGroups(globalTags, "global") +
        '</div>'
      );

    modal.innerHTML =
      '<div class="detail-viewer-card edit-checkin-card">' +
        '<button id="edit-close" class="detail-x" type="button">×</button>' +

        '<div class="detail-viewer-head">' +
          '<div>' +
            '<div class="detail-author">编辑这次打卡</div>' +
            '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="edit-checkin-body">' +
          '<div class="ci-date-row edit-date-row">' +
            '<label for="edit-date">打卡日期</label>' +
            '<input type="date" id="edit-date" value="' + dateValue + '">' +
          '</div>' +
        
          '<div class="ci-thumb-grid edit-thumb-grid">' +
            thumbsHtml +
          '</div>' +

          tagPanelHtml +

          '<div class="edit-note-box">' +
            '<label>感想</label>' +
            '<textarea id="edit-note">' + noteValue + '</textarea>' +
          '</div>' +

          '<div class="detail-actions edit-actions">' +
            '<button id="edit-save">保存修改</button>' +
            '<button id="edit-delete" class="danger">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindEditorEvents();
  }

  function saveCurrentForm(){
    const noteInput = document.getElementById("edit-note");
    if(noteInput){
      noteValue = noteInput.value;
    }
  
    const dateInput = document.getElementById("edit-date");
    if(dateInput){
      dateValue = dateInput.value;
    }
  }

  function bindEditorEvents(){
    const closeBtn = document.getElementById("edit-close");
    if(closeBtn){
      closeBtn.onclick = () => modal.remove();
    }

    modal.onclick = (e) => {
      if(e.target === modal) modal.remove();
    };

    modal.querySelectorAll(".edit-thumb").forEach(btn => {
      btn.onclick = () => {
        saveCurrentForm();
        selectedImageId = btn.dataset.imgId;
        renderEditor();
      };
    });

    modal.querySelectorAll('.preset-tag[data-mode="global"]').forEach(btn => {
      btn.onclick = () => {
        const tag = btn.dataset.tag;

        if(globalTags.includes(tag)){
          globalTags = globalTags.filter(x => x !== tag);
        } else {
          globalTags.push(tag);
        }

        editImages = editImages.map(img => {
          if(img.customTags) return img;

          return {
            ...img,
            tags: [...globalTags]
          };
        });

        saveCurrentForm();
        renderEditor();
      };
    });

    modal.querySelectorAll('.preset-tag[data-mode="single"]').forEach(btn => {
      btn.onclick = () => {
        const selected = selectedImage();
        if(!selected) return;

        const tag = btn.dataset.tag;

        if(selected.tags.includes(tag)){
          selected.tags = selected.tags.filter(x => x !== tag);
        } else {
          selected.tags.push(tag);
        }

        selected.customTags = true;

        saveCurrentForm();
        renderEditor();
      };
    });

    const backBtn = document.getElementById("edit-back-global");
    if(backBtn){
      backBtn.onclick = () => {
        saveCurrentForm();
        selectedImageId = null;
        renderEditor();
      };
    }

    const resetBtn = document.getElementById("edit-reset-tags");
    if(resetBtn){
      resetBtn.onclick = () => {
        const selected = selectedImage();
        if(!selected) return;

        selected.tags = [...globalTags];
        selected.customTags = false;

        saveCurrentForm();
        renderEditor();
      };
    }

    const saveBtn = document.getElementById("edit-save");
    if(saveBtn){
      saveBtn.onclick = async () => {
        const sb = window.__sb;
        const noteInput = document.getElementById("edit-note");
        const note = noteInput ? noteInput.value.trim() : noteValue.trim();
        
        const dateInput = document.getElementById("edit-date");
        const pickedDate = dateInput?.value || dateValue || dateInputValue(item.created_at);
        const today = localTodayString();
        
        if(pickedDate > today){
          window.showToast?.("不能选择未来日期。", "日期不对", "error");
          return;
        }
        
        const createdAt = pickedDate + "T12:00:00";

        if(!sb){
          window.showToast?.("数据库连接失败，请刷新后重试。", "保存失败", "error");
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "保存中...";

        await updateCheckinNote(sb, item.id, note);
        await updateCheckinDate(sb, item.id, createdAt);

        for(const img of editImages){
          await updateImageTags(sb, img.id, img.tags);
        }

        const freshCheckins = await loadCheckins(sb);

        if(window.setState){
          window.setState({ checkins: freshCheckins });
        }

        modal.remove();
        window.showToast?.("这次打卡已经更新。", "保存成功", "success");
      };
    }

    const deleteBtn = document.getElementById("edit-delete");
    if(deleteBtn){
      deleteBtn.onclick = async () => {
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

        deleteBtn.disabled = true;
        deleteBtn.textContent = "删除中...";

        const deleted = await deleteCheckinWithImages(sb, item.id, user.id);

        if(!deleted){
          deleteBtn.disabled = false;
          deleteBtn.textContent = "删除";
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

  document.body.appendChild(modal);
  renderEditor();
}

