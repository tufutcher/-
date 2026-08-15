import { state, setState, subscribe } from "./state.js";
import { initSupabase } from "../api/supabase.js";
import { getCurrentUser } from "../api/auth.js";
import { loadCheckins, loadProfileCheckins } from "../api/checkin.js";
import { renderWall, bindWallEvents } from "../modules/wall.js";
import { renderProfile } from "../modules/profile.js";
import { openCheckinModal } from "../modules/checkin_modal.js";
import { openAuthModal } from "../modules/auth_modal.js";
import { showToast, showConfettiSuccess, showConfirm } from "../modules/feedback.js";
import "../modules/artwork_detail.js";

const sb = initSupabase();
window.__sb = sb;
window.setState = setState;
window.state = state;
window.showToast = showToast;
window.showConfettiSuccess = showConfettiSuccess;
window.showConfirm = showConfirm;

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
    .select("id, username, avatar_url, member_id");

  if(error){
    console.error("loadProfiles error:", error);
    return [];
  }

  return data || [];
}

async function loadProfileData(profile){
  if(!profile){
    return [];
  }

  return await loadProfileCheckins(sb, profile);
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

    const profileCheckins = await loadProfileData(profile);
    
    setState({
      profile,
      profiles,
      profileCheckins,
      view: "me",
      viewUserId: null
    });
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
function renderFab(){
  let nav = document.getElementById("bottom-nav");

  if(!nav){
    nav = document.createElement("div");
    nav.id = "bottom-nav";
    nav.innerHTML = `
      <button id="nav-wall" class="nav-btn" aria-label="打卡墙">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="2"></rect>
          <rect x="13" y="4" width="7" height="7" rx="2"></rect>
          <rect x="4" y="13" width="7" height="7" rx="2"></rect>
          <rect x="13" y="13" width="7" height="7" rx="2"></rect>
        </svg>
      </button>
    
      <button id="fab-add" aria-label="新增打卡">＋</button>
    
      <button id="nav-me" class="nav-btn" aria-label="我的主页">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6"></path>
        </svg>
      </button>
    `;
    document.body.appendChild(nav);
  }

  const wallBtn = nav.querySelector("#nav-wall");
  const meBtn = nav.querySelector("#nav-me");
  const addBtn = nav.querySelector("#fab-add");

  wallBtn.classList.toggle("on", state.view === "wall");
  meBtn.classList.toggle("on", state.view === "me");

  wallBtn.onclick = () => setState({ view: "wall", viewUserId: null });
  meBtn.onclick = async () => {
    const profileCheckins = await loadProfileData(state.profile);
    setState({
      profileCheckins,
      view: "me",
      viewUserId: null
    });
  };

  addBtn.onclick = () => {
    if(state.user){
      openCheckinModal();
    } else {
      openAuthModal(sb, async (user) => {
        window.__user = user;
        setState({ user });

        const profile = await loadProfile(user.id);
        const profiles = await loadProfiles();

        const profileCheckins = await loadProfileData(profile);
        
        setState({
          profile,
          profiles,
          profileCheckins
        });
        
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
  const profileCheckins = profile ? await loadProfileData(profile) : [];

  window.__user = user;

  setState({
    user,
    profile,
    checkins,
    profiles,
    profileCheckins
  });
}

// 自动刷新绑定
subscribe(render);

start();
