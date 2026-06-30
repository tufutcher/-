import { state } from "./state.js";
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

async function start(){
  const user = await getCurrentUser(sb);
  window.__user = user;
  state.user = user;
  if(user) state.profile = await loadProfile(user.id);
  state.checkins = await loadCheckins(sb);
  render();
}

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
        state.user = user;
        state.profile = await loadProfile(user.id);
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
      openAuthModal(sb, async (user) => {
        window.__user = user;
        state.user = user;
        state.profile = await loadProfile(user.id);
        render();
        openCheckinModal();
      });
    }
  };
}

window.switchView = (v) => {
  state.view = v;
  render();
};

window.addEventListener("checkin-submitted", async () => {
  state.checkins = await loadCheckins(sb);
  render();
});

start();
