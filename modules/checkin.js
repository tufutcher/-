import { uploadImage } from "/api/storage.js";
import { createCheckin, addCheckinImage } from "/api/checkin.js";

export function openCheckinModal(){
  const old = document.getElementById("checkin-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "checkin-modal";
  modal.className = "modal-bg";
  modal.innerHTML = `
    <div class="modal-card">
      <h3>本次打卡</h3>
      <input type="file" id="ci-files" accept="image/*" multiple />
      <textarea id="ci-note" placeholder="这次的感想（选填）"></textarea>
      <button id="ci-submit">提交打卡</button>
      <button id="ci-cancel" class="secondary">取消</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("ci-cancel").onclick = () => modal.remove();
  document.getElementById("ci-submit").onclick = () => submitCheckin(modal);
}

async function submitCheckin(modal){
  const sb = window.__sb;
  const user = window.__user;
  if(!sb || !user){
    alert("请先登录");
    return;
  }

  const files = document.getElementById("ci-files").files;
  if(!files.length){
    alert("请至少选择一张图片");
    return;
  }
  const note = document.getElementById("ci-note").value.trim();

  const btn = document.getElementById("ci-submit");
  btn.disabled = true;
  btn.textContent = "提交中...";

  // profiles 表里查用户名（注册时已写入）
  const { data: profile } = await sb.from("profiles").select("username").eq("id", user.id).single();
  const username = profile?.username || user.email.split("@")[0];

  const checkin = await createCheckin(sb, user.id, username, note);
  if(!checkin){
    btn.disabled = false;
    btn.textContent = "提交打卡";
    return;
  }

  for(const file of Array.from(files)){
    const path = user.id + "/" + Date.now() + "_" + file.name;
    const url = await uploadImage(sb, file, path);
    if(url){
      await addCheckinImage(sb, checkin.id, user.id, url, path, []);
    }
  }

  modal.remove();
  alert("打卡成功！");
  window.dispatchEvent(new CustomEvent("checkin-submitted"));
}
