import { state } from "./state.js";
import { initSupabase } from "../api/supabase.js";
import { auth } from "../api/auth.js";
import { loadCheckins } from "../api/checkin.js";
import { renderWall } from "../modules/wall.js";
import { renderProfile } from "../modules/profile.js";
import { openCheckinModal } from "../modules/checkin_modal.js";

const sb = initSupabase();
window.__sb = sb;

/* ===== AUTH ===== */
async function start(){
  const user = await auth(sb);
  if(!user){
    document.getElementById("app").innerHTML = `
      <div class="card">
        <button onclick="window.login()">登录 / 注册</button>
      </div>
    `;
    return;
  }
  window.__user = user;
  state.user = user;
  state.checkins = await loadCheckins(sb);
  render();
}

/* ===== RENDER ===== */
function render(){
  const app = document.getElementById("app");
  if(state.view === "wall"){
    app.innerHTML = renderWall(state.checkins);
  }
  if(state.view === "me"){
    app.innerHTML = renderProfile(state);
  }
  renderFab();
}

function renderFab(){
  let fab = document.getElementById("fab-add");
  if(!fab){
    fab = document.createElement("div");
    fab.id = "fab-add";
    fab.textContent = "＋";
    fab.onclick = () => openCheckinModal();
    document.body.appendChild(fab);
  }
}

/* ===== GLOBAL ===== */
window.switchView = (v) => {
  state.view = v;
  render();
};

window.login = async () => {
  const u = await auth(sb);
  if(u){
    window.__user = u;
    state.user = u;
    state.checkins = await loadCheckins(sb);
    render();
  }
};

// 打卡提交成功后，重新拉取数据刷新页面
window.addEventListener("checkin-submitted", async () => {
  state.checkins = await loadCheckins(sb);
  render();
});

start();
