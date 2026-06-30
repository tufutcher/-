import { uploadImage } from "../api/storage.js";
import { createCheckin, addCheckinImage } from "../api/checkin.js";

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

export function openCheckinModal(){
  const old = document.getElementById("checkin-modal");
  if(old) old.remove();
  pendingImages = [];

  const modal = document.createElement("div");
  modal.id = "checkin-modal";
  modal.className = "modal-bg";
  modal.innerHTML = `
    <div class="modal-card">
      <h3>本次打卡</h3>
      <div class="upload-trigger">
        <span>点击选择图片，可多选</span>
        <input type="file" id="ci-files" accept="image/*" multiple />
      </div>
      <div id="ci-img-list"></div>
      <label>这次的感想（选填）</label>
      <textarea id="ci-note" placeholder="${NOTE_PLACEHOLDERS[Math.floor(Math.random()*NOTE_PLACEHOLDERS.length)]}"></textarea>
      <div class="hint-text">清晰记录创作感想，能帮你回顾自己的成长轨迹，也会让你的个人报告更有意思</div>
      <button id="ci-submit">提交打卡</button>
      <button id="ci-cancel" class="secondary">取消</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
  document.getElementById("ci-cancel").onclick = () => modal.remove();

  document.getElementById("ci-files").onchange = async (e) => {
    const files = Array.from(e.target.files);
    for(const f of files){
      const dataUrl = await readAsDataUrl(f);
      pendingImages.push({ id: "img_" + Date.now() + "_" + Math.random().toString(36).slice(2,6), file: f, preview: dataUrl, tags: [] });
    }
    renderImgList();
    e.target.value = "";
  };

  document.getElementById("ci-submit").onclick = () => submitCheckin(modal);
}

function readAsDataUrl(file){
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

function renderImgList(){
  const wrap = document.getElementById("ci-img-list");
  wrap.innerHTML = "";
  pendingImages.forEach(img => {
    const card = document.createElement("div");
    card.className = "img-card";
    let groupsHtml = "";
    Object.keys(TAG_CATEGORIES).forEach(cat => {
      const opts = TAG_CATEGORIES[cat].map(t =>
        `<span class="preset-tag${img.tags.includes(t)?' on':''}" data-tag="${t}">${t}</span>`
      ).join("");
      groupsHtml += `<div class="tag-group"><div class="glabel">${cat}</div><div class="preset-tags">${opts}</div></div>`;
    });
    card.innerHTML = `<img src="${img.preview}"><div class="img-card-body">
      <span class="remove">移除</span>
      <div class="hint-text">标签选填，但填写后能帮你生成更精准的个人创作分析哦～</div>
      ${groupsHtml}
    </div>`;
    card.querySelector(".remove").onclick = () => {
      pendingImages = pendingImages.filter(x => x.id !== img.id);
      renderImgList();
    };
    card.querySelectorAll(".preset-tag").forEach(btn => {
      btn.onclick = () => {
        const t = btn.dataset.tag;
        if(img.tags.includes(t)) img.tags = img.tags.filter(x => x !== t);
        else img.tags.push(t);
        renderImgList();
      };
    });
    wrap.appendChild(card);
  });
}

async function submitCheckin(modal){
  const sb = window.__sb;
  const user = window.__user;
  if(!sb || !user){ alert("请先登录"); return; }
  if(!pendingImages.length){ alert("请至少选择一张图片"); return; }

  const note = document.getElementById("ci-note").value.trim();
  const btn = document.getElementById("ci-submit");
  btn.disabled = true;
  btn.textContent = "提交中...";

  const { data: profile } = await sb.from("profiles").select("username").eq("id", user.id).single();
  const username = profile?.username || "匿名";

  const checkin = await createCheckin(sb, user.id, username, note);
  if(!checkin){ btn.disabled = false; btn.textContent = "提交打卡"; return; }

  for(const img of pendingImages){
    const path = user.id + "/" + Date.now() + "_" + img.file.name;
    const url = await uploadImage(sb, img.file, path);
    if(url){
      await addCheckinImage(sb, checkin.id, user.id, url, path, img.tags);
    }
  }

  modal.remove();
  alert("打卡成功！");
  window.dispatchEvent(new CustomEvent("checkin-submitted"));
}
