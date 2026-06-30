import { state, setState, subscribe } from "./state.js";
import { initSupabase } from "../api/supabase.js";
import { getCurrentUser } from "../api/auth.js";
import { loadCheckins } from "../api/checkin.js";
import { renderWall, bindWallEvents } from "../modules/wall.js";
import { renderProfile } from "../modules/profile.js";
import { openCheckinModal } from "../modules/checkin_modal.js";
import { openAuthModal } from "../modules/auth_modal.js";

const sb = initSupabase();
window.__sb = sb;

async function loadProfile(userId){
  const { data } = await sb.from("profiles").select("*").eq("id", userId).single();
  return data || null;
}

// 渲染函数（唯一入口）
function render(){
  const app = document.getElementById("app");

  if(state.view === "wall"){
    app.innerHTML = renderWall(state.checkins);
    bindWallEvents();
  }

  if(state.view === "me"){
    if(!state.user){
      app.innerHTML = renderWall(state.checkins);
      bindWallEvents();

      openAuthModal(sb, async (user) => {
        window.__user = user;
        setState({ user });

        const profile = await loadProfile(user.id);
        setState({ profile, view: "me" });
      });

    } else {
      app.innerHTML = renderProfile(state);
    }
  }

  renderFab();
}

// 浮动按钮
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
      openAuthModal(sb, async (user) => {
        window.__user = user;
        setState({ user });

        const profile = await loadProfile(user.id);
        setState({ profile });

        openCheckinModal();
      });
    }
  };
}

// 初始化
async function start(){
  const user = await getCurrentUser(sb);

  let profile = null;
  if(user){
    profile = await loadProfile(user.id);
  }

  const checkins = await loadCheckins(sb);

  window.__user = user;

  setState({
    user,
    profile,
    checkins
  });
}

// ⭐ 关键：自动刷新绑定
subscribe(render);

start();
