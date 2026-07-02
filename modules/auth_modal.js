import { signIn, signUp } from "../api/auth.js";

const MODE_LABEL = {
  login: "登录",
  register: "注册"
};

// 登录 / 注册弹窗 
export function openAuthModal(sb, onSuccess){
  const old = document.getElementById("auth-modal");
  if(old) old.remove();

  const modal = createAuthModal();
  document.body.appendChild(modal);

  const els = getAuthEls(modal);
  let mode = "login";

  setMode(mode, els);

  els.tabs.forEach(tab => {
    tab.onclick = () => {
      mode = tab.dataset.mode;
      setMode(mode, els);
    };
  });

  els.cancelBtn.onclick = () => modal.remove();

  modal.onclick = (e) => {
    if(e.target === modal) modal.remove();
  };

  els.submitBtn.onclick = async () => {
    await submitAuth({ sb, mode, els, modal, onSuccess });
  };
}

function createAuthModal(){
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

  return modal;
}

function getAuthEls(modal){
  return {
    tabs: Array.from(modal.querySelectorAll(".auth-tab")),
    username: modal.querySelector("#auth-username"),
    password: modal.querySelector("#auth-password"),
    invite: modal.querySelector("#auth-invite"),
    error: modal.querySelector("#auth-error"),
    submitBtn: modal.querySelector("#auth-submit"),
    cancelBtn: modal.querySelector("#auth-cancel")
  };
}

function setMode(mode, els){
  const isRegister = mode === "register";

  els.tabs.forEach(tab => {
    tab.classList.toggle("on", tab.dataset.mode === mode);
  });

  els.invite.style.display = isRegister ? "block" : "none";
  els.submitBtn.textContent = MODE_LABEL[mode];
  els.error.textContent = "";
}

async function submitAuth({ sb, mode, els, modal, onSuccess }){
  const username = els.username.value.trim();
  const password = els.password.value;
  const invite = els.invite.value.trim();

  els.error.textContent = "";

  const error = validateAuth(mode, username, password, invite);
  if(error){
    els.error.textContent = error;
    return;
  }

  setLoading(els, true);

  const result = mode === "login"
    ? await signIn(sb, username, password)
    : await signUp(sb, username, password, invite);

  setLoading(els, false, mode);

  if(result.error){
    els.error.textContent = result.error;
    return;
  }

  modal.remove();
  onSuccess(result.user);

  if(mode === "register"){
    window.showConfettiSuccess?.("欢迎来到这个社区！");
  }
}

function validateAuth(mode, username, password, invite){
  if(!username || !password) return "请填写昵称和密码";
  if(mode === "register" && !invite) return "注册需要填写邀请码";
  return "";
}

function setLoading(els, loading, mode = "login"){
  els.submitBtn.disabled = loading;
  els.submitBtn.textContent = loading ? "处理中..." : MODE_LABEL[mode];
}
