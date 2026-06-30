import { state, setState, subscribe } from "./state.js";
import { initSupabase } from "../api/supabase.js";
import { getCurrentUser } from "../api/auth.js";
import { loadCheckins } from "../api/checkin.js";
import { Wall, bindWallEvents } from "../modules/wall.js";
import { renderProfile } from "../modules/profile.js";
import { openCheckinModal } from "../modules/checkin_modal.js";
import { openAuthModal } from "../modules/auth_modal.js";

const sb = initSupabase();
window.__sb = sb;
window.setState = setState;

window.switchView = (view) => {
  setState({ view });
};

async function loadProfile(userId){
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if(error){
    console.error("loadProfile error:", error);
    return null;
  }

  return data || null;
}

async function loadProfiles(){
  const { data, error } = await sb
    .from("profiles")
    .select("id, username, avatar_url");

  if(error){
    console.error("loadProfiles error:", error);
    return [];
  }

  return data || [];
}

// 渲染函数（唯一入口）
function render(){
  const app = document.getElementById("app");

  if(state.view === "wall"){
    app.innerHTML = renderWall(state.checkins, state.profiles || []);
    bindWallEvents();
  }

  if(state.view === "me"){
    if(!state.user){
      app.innerHTML = renderWall(state.checkins, state.profiles || []);
      bindWallEvents();

      openAuthModal(sb, async (user) => {
        window.__user = user;
        setState({ user });

        const profile = await loadProfile(user.id);
        const profiles = await loadProfiles();

        setState({ profile, profiles, view: "me", viewUserId: null });
      });

    } else {
      app.innerHTML = renderProfile(state, {
        userId: state.user.id,
        readonly: false
      });
    }
  }

  if(state.view === "user"){
    if(!state.viewUserId){
      setState({ view: "wall" });
      return;
    }

    app.innerHTML = renderProfile(state, {
      userId: state.viewUserId,
      readonly: true
    });
  }

  renderFab();
}

// 浮动按钮
function Fab(){
  let nav = document.getElementById("bottom-nav");

  if(!nav){
    nav = document.createElement("div");
    nav.id = "bottom-nav";
    nav.innerHTML = `
      <button id="nav-wall" class="nav-btn">墙</button>
      <button id="fab-add">＋</button>
      <button id="nav-me" class="nav-btn">我的</button>
    `;
    document.body.appendChild(nav);
  }

  const wallBtn = nav.querySelector("#nav-wall");
  const meBtn = nav.querySelector("#nav-me");
  const addBtn = nav.querySelector("#fab-add");

  wallBtn.classList.toggle("on", state.view === "wall");
  meBtn.classList.toggle("on", state.view === "me");

  wallBtn.onclick = () => setState({ view: "wall", viewUserId: null });
  meBtn.onclick = () => setState({ view: "me", viewUserId: null });

  addBtn.onclick = () => {
    if(state.user){
      openCheckinModal();
    } else {
      openAuthModal(sb, async (user) => {
        window.__user = user;
        setState({ user });

        const profile = await loadProfile(user.id);
        const profiles = await loadProfiles();

        setState({ profile, profiles });
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
  const profiles = await loadProfiles();

  window.__user = user;

  setState({
    user,
    profile,
    checkins
  });
}

// ⭐ 关键：自动刷新绑定
subscribe();

start();
