import { TAG_CATEGORIES } from "./checkin_modal.js";
import { updateCheckinNote, updateImageTags, deleteCheckinWithImages, loadCheckins } from "../api/checkin.js";
import { uploadImage } from "../api/storage.js";

const PIE_COLORS = ["#1a1a1a", "#5b8def", "#f0a13c", "#4cb38f"];

function fmtDate(ts){
  const d = new Date(ts);
  return (d.getMonth()+1) + "月" + d.getDate() + "日";
}

function getWeekKey(date){
  // 以周一为一周起点，返回 "年-第几周" 作为分组key
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 周一=0
  d.setUTCDate(d.getUTCDate() - dayNum);
  return d.getUTCFullYear() + "-" + d.getUTCMonth() + "-" + d.getUTCDate();
}

function computeBadges(mine){
  const byWeek = {};
  mine.forEach(x => {
    const d = new Date(x.created_at);
    const key = getWeekKey(d);
    (byWeek[key] = byWeek[key] || new Set()).add(d.toDateString());
  });
  let star = 0, fire = 0, palette = 0;
  Object.values(byWeek).forEach(daySet => {
    const days = daySet.size;
    if(days >= 7) palette++;
    else if(days >= 5) fire++;
    else if(days >= 3) star++;
  });
  return { star, fire, palette };
}

function startOfWeek(date){
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function startOfMonth(date){
  const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0);
  return d;
}

function dateKey(date){
  const d = new Date(date);
  return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
}

function imageCount(item){
  return item.checkin_images?.length || 0;
}

function computeStats(mine){
  const now = new Date(), weekStart = startOfWeek(now), monthStart = startOfMonth(now);
  const weekDays = new Set(), monthDays = new Set();
  let weekImages = 0, monthImages = 0, totalImages = 0;

  mine.forEach(item => {
    const d = new Date(item.created_at), imgs = imageCount(item);
    totalImages += imgs;
    if(d >= weekStart){ weekDays.add(dateKey(d)); weekImages += imgs; }
    if(d >= monthStart){ monthDays.add(dateKey(d)); monthImages += imgs; }
  });

  const allDays = Array.from(new Set(mine.map(item => dateKey(item.created_at))))
    .map(key => {
      const [y,m,d] = key.split("-").map(Number);
      return new Date(y, m - 1, d).getTime();
    })
    .sort((a,b) => a - b);

  let maxStreak = allDays.length ? 1 : 0, cur = allDays.length ? 1 : 0;
  for(let i=1; i<allDays.length; i++){
    if(allDays[i] - allDays[i-1] <= 86400000 * 1.5) cur++;
    else cur = 1;
    if(cur > maxStreak) maxStreak = cur;
  }

  return { weekDays:weekDays.size, weekImages, monthDays:monthDays.size, monthImages, maxStreak, totalImages };
}

function pieSvg(tagCount, catName){
  const opts = TAG_CATEGORIES[catName];
  const vals = opts.map(o => tagCount[o] || 0);
  const total = vals.reduce((a,b)=>a+b,0);
  const size=120, r=50, cx=60, cy=60;
  if(!total){
    return `<div class="pie-wrap"><svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#f1f1f1"/></svg><div class="pie-legend"><span class="muted">还没有数据</span></div></div>`;
  }
  let angle = -90, paths = "";
  opts.forEach((o,i) => {
    const v = vals[i];
    if(!v) return;
    const slice = (v/total)*360;
    const start = angle, end = angle+slice;
    const x1 = cx + r*Math.cos(start*Math.PI/180), y1 = cy + r*Math.sin(start*Math.PI/180);
    const x2 = cx + r*Math.cos(end*Math.PI/180), y2 = cy + r*Math.sin(end*Math.PI/180);
    const largeArc = slice > 180 ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${PIE_COLORS[i%PIE_COLORS.length]}"/>`;
    angle = end;
  });
  const legend = opts.map((o,i) => vals[i] ? `<div><span class="dot" style="background:${PIE_COLORS[i%PIE_COLORS.length]}"></span>${o} ×${vals[i]}</div>` : "").join("");
  return `<div class="pie-wrap"><svg width="${size}" height="${size}" viewBox="0 0 120 120">${paths}</svg><div class="pie-legend">${legend}</div></div>`;
}

export function renderProfile(state){
  const mine = state.checkins.filter(i => i.user_id === state.user.id);
  const stats = computeStats(mine);
  const badges = computeBadges(mine);
  const tagCount = {};
  mine.forEach(x => (x.checkin_images||[]).forEach(img => (img.tags||[]).forEach(t => { tagCount[t] = (tagCount[t]||0)+1; })));
  const topTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,6);

  const avatarUrl = state.profile?.avatar_url;
  const username = state.profile?.username || "我";

  const html = `
    <div class="topbar">
      <button onclick="switchView('wall')">墙</button>
      <button onclick="switchView('me')">我的</button>
    </div>
    <div class="card">
      <div class="profile-head">
        <img class="avatar-lg" id="avatar-img" src="${avatarUrl||''}" style="background:${avatarUrl?'transparent':'#ddd'};">
        <div><div class="name">${username}</div><div class="link-text" id="avatar-upload-link">上传/更换头像</div></div>
      </div>
      <input type="file" id="avatar-input" accept="image/*" style="display:none;">
    </div>
    <div class="stats-row">
      <div class="stat stat-block"><div class="stat-title">本周打卡</div><div class="stat-main">${stats.weekDays}天 | ${stats.weekImages}张</div></div>
      <div class="stat stat-block"><div class="stat-title">本月打卡</div><div class="stat-main">${stats.monthDays}天 | ${stats.monthImages}张</div></div>
      <div class="stat stat-block"><div class="stat-title">总计</div><div class="stat-main">连续${stats.maxStreak}天 | 共${stats.totalImages}张</div></div>
    </div>
    <div class="card">
      <div class="glabel">我的徽章</div>
      <div class="badge-row">
        <div class="badge-item"><span class="badge-emoji">⭐</span><span class="badge-count">×${badges.star}</span><span class="badge-desc">单周3-4天</span></div>
        <div class="badge-item"><span class="badge-emoji">🔥</span><span class="badge-count">×${badges.fire}</span><span class="badge-desc">单周5-6天</span></div>
        <div class="badge-item"><span class="badge-emoji">🎨</span><span class="badge-count">×${badges.palette}</span><span class="badge-desc">单周满勤</span></div>
      </div>
    </div>
<div class="card">
  <div class="glabel">创作分布</div>
  <div class="pie-grid">
    <div class="pie-panel"><div class="pie-title">内容</div>${pieSvg(tagCount,'内容')}</div>
    <div class="pie-panel"><div class="pie-title">类型</div>${pieSvg(tagCount,'类型')}</div>
    <div class="pie-panel"><div class="pie-title">完成度</div>${pieSvg(tagCount,'完成度')}</div>
  </div>
</div>
    <div class="card">
      <div class="glabel">常画标签</div>
      <div class="pillbar">${topTags.length ? topTags.map(t=>`<span>${t[0]} ×${t[1]}</span>`).join("") : '<span class="muted">还没有打卡记录，填写标签后这里会自动统计</span>'}</div>
    </div>
    <div class="card">
      <div class="glabel">历史打卡（共 ${mine.length} 次，点图片可编辑）</div>
      <div class="wall-grid" id="profile-grid">
        ${mine.slice(0,12).map(item => {
          const cover = (item.checkin_images||[])[0];
          return `<div class="wall-card" data-pid="${item.id}">
            <div class="wall-card-img-wrap">${cover?`<img src="${cover.image_url}">`:''}</div>
            <div class="wall-card-body">
              <div class="when">${fmtDate(item.created_at)}</div>
              ${cover && cover.tags && cover.tags.length ? `<div class="tags">${cover.tags.join(' · ')}</div>` : ''}
            </div>
          </div>`;
        }).join("") || '<div class="empty">还没有打卡记录</div>'}
      </div>
    </div>
  `;

  setTimeout(() => bindProfileEvents(state, mine), 0);
  return html;
}

function bindProfileEvents(state, mine){
  const link = document.getElementById("avatar-upload-link");
  if(link){
    link.onclick = () => document.getElementById("avatar-input").click();
    document.getElementById("avatar-input").onchange = async (e) => {
      const f = e.target.files[0];
      if(!f) return;
      const sb = window.__sb;
      const path = "avatars/" + state.user.id + "_" + Date.now() + "_" + f.name;
      const url = await uploadImage(sb, f, path);
      if(url){
        await sb.from("profiles").update({ avatar_url: url }).eq("id", state.user.id);
        if(state.profile) state.profile.avatar_url = url;
        document.getElementById("avatar-img").src = url;
        document.getElementById("avatar-img").style.background = "transparent";
      }
    };
  }

  document.querySelectorAll('#profile-grid .wall-card').forEach(card => {
    card.onclick = () => {
      const item = mine.find(x => x.id === card.dataset.pid);
      if(item) openEditModal(item);
    };
  });
}

export function openEditModal(item){
  const old = document.getElementById("edit-modal");
  if(old) old.remove();
  const modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.className = "modal-bg";
  const imgs = item.checkin_images || [];
  modal.innerHTML = `
    <div class="modal-card">
      <h3>编辑这次打卡</h3>
      ${imgs.map((img,idx) => {
        let groupsHtml = "";
        Object.keys(TAG_CATEGORIES).forEach(cat => {
          const opts = TAG_CATEGORIES[cat].map(t =>
            `<span class="preset-tag${(img.tags||[]).includes(t)?' on':''}" data-img="${idx}" data-tag="${t}">${t}</span>`
          ).join("");
          groupsHtml += `<div class="tag-group"><div class="glabel">${cat}</div><div class="preset-tags">${opts}</div></div>`;
        });
        return `<div class="img-card"><img src="${img.image_url}"><div class="img-card-body">${groupsHtml}</div></div>`;
      }).join("")}
      <label>感想</label>
      <textarea id="edit-note">${item.note || ""}</textarea>
      <button id="edit-save">保存修改</button>
      <button id="edit-delete" class="danger">删除打卡</button>
      <button id="edit-cancel" class="secondary">取消</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
  document.getElementById("edit-delete").onclick = async () => {
    const ok = confirm("确定删除这次打卡吗？图片也会一起删除。");
    if(!ok) return;
  
    const sb = window.__sb;
    const user = window.__user;
    if(!sb || !user){
      alert("请先登录");
      return;
    }
  
    const btn = document.getElementById("edit-delete");
    btn.disabled = true;
    btn.textContent = "删除中...";
  
    const deleted = await deleteCheckinWithImages(sb, item.id, user.id);
  
    if(!deleted){
      btn.disabled = false;
      btn.textContent = "删除这次打卡";
      return;
    }
  
    const freshCheckins = await loadCheckins(sb);
    if(window.setState){
      window.setState({ checkins: freshCheckins });
    }
  
    modal.remove();
    alert("已删除");
  };

  const localTags = imgs.map(img => [...(img.tags||[])]);
  modal.querySelectorAll(".preset-tag").forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.img);
      const t = btn.dataset.tag;
      if(localTags[idx].includes(t)) localTags[idx] = localTags[idx].filter(x=>x!==t);
      else localTags[idx].push(t);
      btn.classList.toggle("on");
    };
  });

  document.getElementById("edit-save").onclick = async () => {
    const sb = window.__sb;
    const note = document.getElementById("edit-note").value.trim();
    await updateCheckinNote(sb, item.id, note);
    for(let i=0;i<imgs.length;i++){
      await updateImageTags(sb, imgs[i].id, localTags[i]);
    }
    modal.remove();
    window.dispatchEvent(new CustomEvent("checkin-submitted"));
  };
}
