import { signIn, signUp } from "../api/auth.js";

// onSuccess(user) 会在登录/注册成功后被调用
export function openAuthModal(sb, onSuccess){
  const old = document.getElementById("auth-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "auth-modal";
  modal.className = "modal-bg";
  modal.innerHTML = `
    <div class="modal-card">
      <div class="auth-tabs">
        <div class="auth-tab on" data-mode="login">登录</div>
        <div class="auth-tab" data-mode="register">注册</div>
      </div>
      <input type="text" id="auth-username" placeholder="昵称" />
      <input type="password" id="auth-password" placeholder="密码" />
      <input type="text" id="auth-invite" placeholder="邀请码" style="display:none;" />
      <div id="auth-error" class="auth-error"></div>
      <button id="auth-submit">登录</button>
      <button id="auth-cancel" class="secondary">取消</button>
    </div>
  `;
  document.body.appendChild(modal);

  let mode = "login";

  function setMode(m){
    mode = m;
    modal.querySelectorAll(".auth-tab").forEach(t => {
      t.classList.toggle("on", t.dataset.mode === m);
    });
    document.getElementById("auth-invite").style.display = (m === "register") ? "block" : "none";
    document.getElementById("auth-submit").textContent = (m === "register") ? "注册" : "登录";
    document.getElementById("auth-error").textContent = "";
  }

  modal.querySelectorAll(".auth-tab").forEach(tab => {
    tab.onclick = () => setMode(tab.dataset.mode);
  });

  document.getElementById("auth-cancel").onclick = () => modal.remove();
  modal.onclick = (e) => { if(e.target === modal) modal.remove(); };

  document.getElementById("auth-submit").onclick = async () => {
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const invite = document.getElementById("auth-invite").value.trim();
    const errBox = document.getElementById("auth-error");
    errBox.textContent = "";

    if(!username || !password){
      errBox.textContent = "请填写昵称和密码";
      return;
    }
    if(mode === "register" && !invite){
      errBox.textContent = "注册需要填写邀请码";
      return;
    }

    const btn = document.getElementById("auth-submit");
    btn.disabled = true;
    btn.textContent = "处理中...";

    const result = mode === "login"
      ? await signIn(sb, username, password)
      : await signUp(sb, username, password, invite);

    btn.disabled = false;
    btn.textContent = (mode === "register") ? "注册" : "登录";

    if(result.error){
      errBox.textContent = result.error;
      return;
    }

    modal.remove();
    onSuccess(result.user);
  };
}
