import { state } from "./state.js";
import { events } from "./events.js";

import { initSupabase } from "../api/supabase.js";
import { auth } from "../api/auth.js";
import { loadCheckins } from "../api/checkin.js";

import { renderWall } from "../modules/wall.js";
import { renderProfile } from "../modules/profile.js";

const sb = initSupabase();

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
}

/* ===== GLOBAL ===== */
window.switchView = (v)=>{
  state.view = v;
  render();
};

window.login = async ()=>{
  const u = await auth(sb);
  if(u){
    state.user = u;
    state.checkins = await loadCheckins(sb);
    render();
  }
};

start();
