import { state } from "./state.js";
import { initSupabase } from "../api/supabase.js";
import { getCurrentUser } from "../api/auth.js";
import { loadCheckins } from "../api/checkin.js";
import { renderWall } from "../modules/wall.js";
import { renderProfile } from "../modules/profile.js";
import { openCheckinModal } from "../modules/checkin_modal.js";
import { openAuthModal } from "../modules/auth_modal.js";

const sb = initSupabase();
window.__sb = sb;

/* ===== 启动：不强制登录，先把墙加载出来 ===== */
async function start(){
  const user = await getCurrentUser(sb);
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
    if(!state.user){
      // 未登录时点"我的"，直接弹登录框
      app.innerHTML = renderWall(state.checkins);
      openAuthModal(sb, (user) => {
        window.__user = user;
        state.user = user;
        state.view = "me";
        render();
      });
    } else {
      app.innerHTML = renderProfile(state);
    }
  }
  renderFab();
}

function renderFab(){
  let fab = document.getElementById("fab-add");
  if(!fab){
    fab = document.createElement("div");
    fab.id = "fab-add";
    fab.textContent = "＋";
    document.body.appendChild(fab);
  }
  fab.onclick = () => {
    if(state.user){
      openCheckinModal();
    } else {
      openAuthModal(sb, (user) => {
        window.__user = user;
        state.user = user;
        render();
        openCheckinModal();
      });
    }
  };
}

/* ===== GLOBAL ===== */
window.switchView = (v) => {
  state.view = v;
  render();
};

// 打卡提交成功后，重新拉取数据刷新页面
window.addEventListener("checkin-submitted", async () => {
  state.checkins = await loadCheckins(sb);
  render();
});

start();
