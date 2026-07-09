import { TAG_CATEGORIES } from "./checkin_modal.js";
import { state } from "../core/state.js";
import {
  exportAllProfilesCSV,
  exportAllProfilesJSON,
  renderAdminPanel,
  openAdminCheckinManager,
  openAdminPurgeUserModal
} from "./admin.js";
import { openEditModal } from "./edit_modal.js";
import { bindAvatarUpload } from "./avatar.js";
import {
  openCalendarDayModal,
  openProfileCheckinDetail
} from "./detail_modal.js";
import { loadProfileCheckins } from "../api/checkin.js";

const PIE_COLORS = ["#1a1a1a", "#5b8def", "#f0a13c", "#4cb38f"];
let profileCalendarDate = new Date();
let profileDataMode = "month";
let profileCheckinsCache = null;

// 日期与统计工具
function fmtDate(date){
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

async function getProfileCheckins(state){
  if(!state.profile) return [];

  if(profileCheckinsCache){
    return profileCheckinsCache;
  }

  const sb = window.__sb;

  if(!sb){
    return state.checkins || [];
  }

  profileCheckinsCache = await loadProfileCheckins(sb, state.profile);
  return profileCheckinsCache;
}

export function resetProfileCheckinsCache(){
  profileCheckinsCache = null;
}

function dateInputValue(date){
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function localTodayString(){
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function computeCurrentStreak(mine){
  const days = new Set(mine.map(item => dateKey(item.created_at)));

  let streak = 0;
  const d = new Date();
  d.setHours(0,0,0,0);

  while(days.has(dateKey(d))){
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function filterProfileItems(items){
  if(profileDataMode === "all") return items;

  if(profileDataMode === "week"){
    const start = startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return items.filter(item => {
      const d = new Date(item.created_at);
      return d >= start && d < end;
    });
  }

  if(profileDataMode === "month"){
    const start = startOfMonth(new Date());
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    return items.filter(item => {
      const d = new Date(item.created_at);
      return d >= start && d < end;
    });
  }

  return items;
}

function dataModeTitle(){
  if(profileDataMode === "week") return "本周";
  if(profileDataMode === "month") return "本月";
  return "全部";
}

// 个人页作品档案与创作分析
function getGalleryImages(items){
  return items.flatMap(item =>
    (item.checkin_images || []).map(img => ({
      id: img.id,
      image_url: img.image_url,
      created_at: item.created_at,
      checkin_id: item.id
    }))
  );
}

function renderGalleryView(items){
  const images = getGalleryImages(items);

  if(!images.length){
    return '<div class="empty archive-empty">这个范围内还没有作品</div>';
  }

  const boardClass = profileDataMode === "all"
    ? "gallery-board gallery-board-scroll"
    : "gallery-board gallery-board-fixed";

  return (
    '<div class="' + boardClass + '">' +
      images.map(img =>
        '<button class="gallery-tile" data-checkin-id="' + img.checkin_id + '" type="button">' +
          '<img src="' + img.image_url + '" alt="">' +
          '<span class="gallery-date">' + fmtDate(img.created_at) + '</span>' +
        '</button>'
      ).join("") +
    '</div>'
  );
}

function renderArchiveContent(items){
  return renderGalleryView(items);
}

function renderArchiveCard(tagCount, topTags, visibleMine){
  const tagsHtml = topTags.length
    ? topTags.map(t => '<span>' + t[0] + ' ×' + t[1] + '</span>').join("")
    : '<span class="muted">这个范围内还没有标签记录</span>';

  return `
    <div class="card archive-card">
      <div class="archive-top">
        <div class="archive-title">${dataModeTitle()}创作分析</div>

        <div class="data-filter" id="profile-data-filter">
          <span data-mode="week" class="${profileDataMode === "week" ? "on" : ""}">本周</span>
          <span data-mode="month" class="${profileDataMode === "month" ? "on" : ""}">本月</span>
          <span data-mode="all" class="${profileDataMode === "all" ? "on" : ""}">总览</span>
        </div>
      </div>

      <div class="archive-section archive-pie-section">
        <div class="pie-grid archive-pie-grid">
          <div class="pie-panel"><div class="pie-title">内容</div>${pieSvg(tagCount, "内容")}</div>
          <div class="pie-panel"><div class="pie-title">类型</div>${pieSvg(tagCount, "类型")}</div>
          <div class="pie-panel"><div class="pie-title">完成度</div>${pieSvg(tagCount, "完成度")}</div>
        </div>
      </div>

      <div class="archive-section archive-tags-section">
        <div class="pillbar archive-pillbar">${tagsHtml}</div>
      </div>

      <div class="archive-section archive-gallery-section">
        ${renderArchiveContent(visibleMine)}
      </div>
    </div>
  `;
}

function renderMiniCalendar(mine){
  const year = profileCalendarDate.getFullYear();
  const month = profileCalendarDate.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const firstDay = monthStart.getDay() === 0 ? 7 : monthStart.getDay();
  const startOffset = firstDay - 1;
  const totalDays = monthEnd.getDate();

  const dayMap = {};
  mine.forEach(item => {
    const d = new Date(item.created_at);
    if(d.getFullYear() !== year || d.getMonth() !== month) return;

    const key = dateKey(d);
    if(!dayMap[key]) dayMap[key] = { checkins:0, images:0 };
    dayMap[key].checkins += 1;
    dayMap[key].images += item.checkin_images?.length || 0;
  });

  const cells = [];

  for(let i=0; i<startOffset; i++){
    cells.push(`<div class="cal-cell empty"></div>`);
  }

  for(let day=1; day<=totalDays; day++){
    const d = new Date(year, month, day);
    const key = dateKey(d);
    const info = dayMap[key];
    const today = dateKey(new Date()) === key;
    const cls = ["cal-cell", info ? "has-checkin" : "", today ? "today" : ""].join(" ");

    cells.push(`
      <button class="${cls}" data-cal-date="${key}" type="button" ${info ? "" : "disabled"}>
        <div class="cal-day">${day}</div>
        ${info ? `<div class="cal-count">${info.images}张</div>` : ""}
      </button>
    `);
  }

  return `
    <div class="mini-calendar">
      <div class="cal-head">
        <button id="cal-prev" class="cal-nav">‹</button>
        <div class="cal-title">${year}年${month + 1}月</div>
        <button id="cal-next" class="cal-nav">›</button>
      </div>
      <div class="cal-week">
        <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
      </div>
      <div class="cal-grid">${cells.join("")}</div>
    </div>
  `;
}

function pieSvg(tagCount, catName){
  const opts = TAG_CATEGORIES[catName];
  const vals = opts.map(o => tagCount[o] || 0);
  const total = vals.reduce((a,b) => a + b, 0);

  const size = 120;
  const r = 50;
  const cx = 60;
  const cy = 60;

  if(!total){
    return `
      <div class="pie-wrap">
        <svg width="${size}" height="${size}" viewBox="0 0 120 120">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f1f1f1"/>
        </svg>
        <div class="pie-legend">
          <span class="muted">还没有数据</span>
        </div>
      </div>
    `;
  }

  const active = vals
    .map((v, i) => ({ value:v, label:opts[i], color:PIE_COLORS[i % PIE_COLORS.length] }))
    .filter(x => x.value > 0);

  if(active.length === 1){
    const one = active[0];

    return `
      <div class="pie-wrap">
        <svg width="${size}" height="${size}" viewBox="0 0 120 120">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${one.color}"/>
        </svg>
        <div class="pie-legend">
          <div><span class="dot" style="background:${one.color}"></span>${one.label} ×${one.value}</div>
        </div>
      </div>
    `;
  }

  let angle = -90;
  let paths = "";

  opts.forEach((o, i) => {
    const v = vals[i];
    if(!v) return;

    const slice = (v / total) * 360;
    const start = angle;
    const end = angle + slice;

    const x1 = cx + r * Math.cos(start * Math.PI / 180);
    const y1 = cy + r * Math.sin(start * Math.PI / 180);
    const x2 = cx + r * Math.cos(end * Math.PI / 180);
    const y2 = cy + r * Math.sin(end * Math.PI / 180);

    const largeArc = slice > 180 ? 1 : 0;

    paths += `
      <path
        d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z"
        fill="${PIE_COLORS[i % PIE_COLORS.length]}"
      />
    `;

    angle = end;
  });

  const legend = opts.map((o, i) => {
    if(!vals[i]) return "";

    return `
      <div>
        <span class="dot" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>${o} ×${vals[i]}
      </div>
    `;
  }).join("");

  return `
    <div class="pie-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 120 120">${paths}</svg>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}

// 渲染个人主页。readonly 用于别人主页弹窗，skipBind 用于避免重复绑定全局事件。
function getProfileItems(state, targetUserId){
  const all = state.profileCheckins || state.checkins || [];
  const targetProfile = getProfileByUserId(state, targetUserId);
  const targetMemberId = targetProfile?.member_id;

  return all.filter(item => {
    if(item.user_id === targetUserId) return true;
    if(targetMemberId && item.member_id === targetMemberId) return true;
    return false;
  });
}

function getProfileByUserId(state, userId){
  if(state.user?.id === userId && state.profile){
    return state.profile;
  }

  return (state.profiles || []).find(profile => profile.id === userId);
}

export function renderProfile(state, options = {}){
  const targetUserId = options.userId || state.user?.id;
  const readonly = !!options.readonly;
  const skipBind = !!options.skipBind;

  const mine = getProfileItems(state, targetUserId);
  const stats = computeStats(mine);
  const currentStreak = computeCurrentStreak(mine);
  const totalDays = new Set(mine.map(item => dateKey(item.created_at))).size;
  const badges = computeBadges(mine);
  const visibleMine = filterProfileItems(mine);

  const profileFromList = (state.profiles || []).find(p => p.id === targetUserId);
  const profile = readonly ? profileFromList : (state.profile || profileFromList);

  const tagCount = {};
  visibleMine.forEach(x => {
    (x.checkin_images || []).forEach(img => {
      (img.tags || []).forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });
  });

  const topTags = Object.entries(tagCount).sort((a,b) => b[1] - a[1]).slice(0,6);
  const avatarUrl = profile?.avatar_url;
  const username = profile?.username || "匿名";
  const avatarLetter = username.trim().slice(0, 1) || "匿";
  
  const profileAvatarHtml = avatarUrl
    ? '<img class="avatar-lg" id="avatar-img" src="' + avatarUrl + '" style="background:transparent;">'
    : '<div class="avatar-lg profile-avatar-fallback" id="avatar-img">' + avatarLetter + '</div>';

  const subtitle = readonly
    ? "留下了 " + mine.length + " 次打卡，" + stats.totalImages + " 张作品。"
    : "今天也留下了一点创作的证据。";

  const greeting = readonly
    ? username
    : "你好，" + username + "！";

  const adminPanelHtml = (!readonly && state.profile?.is_admin)
    ? renderAdminPanel(state)
    : "";

  const avatarActionHtml = readonly
    ? ""
    : '<div class="link-text avatar-action" id="avatar-upload-link">上传/更换头像</div>';

  const avatarInputHtml = readonly
    ? ""
    : '<input type="file" id="avatar-input" accept="image/*" style="display:none;">';

  const html =

    '<div class="card profile-hero-card ' + (readonly ? 'readonly-profile' : '') + '">' +
      (currentStreak ? '<div class="streak-corner"><span>连续打卡</span><b>' + currentStreak + '天</b></div>' : '') +
      '<div class="profile-hero-left">' +
        '<button id="avatar-trigger" class="avatar-trigger" type="button">' +
          profileAvatarHtml +
        '</button>' +

        '<div class="profile-copy">' +
          '<div class="profile-greeting">' + greeting + '</div>' +
          '<div class="profile-subtitle">' + subtitle + '</div>' +
          avatarActionHtml +
        '</div>' +

        avatarInputHtml +
      '</div>' +

      '<div class="profile-hero-calendar">' +
        renderMiniCalendar(mine) +
      '</div>' +
    '</div>' +

    '<div class="stats-row profile-simple-stats">' +
      '<div class="stat stat-block"><div class="stat-main">' + stats.weekDays + '天</div><div class="stat-title">本周</div></div>' +
      '<div class="stat stat-block"><div class="stat-main">' + stats.monthDays + '天</div><div class="stat-title">本月</div></div>' +
      '<div class="stat stat-block"><div class="stat-main">' + totalDays + '天</div><div class="stat-title">总计</div></div>' +
    '</div>' +

    adminPanelHtml +

    '<div class="card">' +
      '<div class="glabel">我的徽章</div>' +
      '<div class="badge-row">' +

        '<div class="badge-item ' + (badges.star ? 'unlocked' : 'locked') + '">' +
          '<span class="badge-emoji">⭐</span>' +
          '<span class="badge-count">×' + badges.star + '</span>' +
          '<span class="badge-desc">单周3-4天</span>' +
        '</div>' +

        '<div class="badge-item ' + (badges.fire ? 'unlocked' : 'locked') + '">' +
          '<span class="badge-emoji">🔥</span>' +
          '<span class="badge-count">×' + badges.fire + '</span>' +
          '<span class="badge-desc">单周5-6天</span>' +
        '</div>' +

        '<div class="badge-item ' + (badges.palette ? 'unlocked' : 'locked') + '">' +
          '<span class="badge-emoji">🎨</span>' +
          '<span class="badge-count">×' + badges.palette + '</span>' +
          '<span class="badge-desc">单周满勤</span>' +
        '</div>' +

      '</div>' +
    '</div>' +

    renderArchiveCard(tagCount, topTags, visibleMine);

  if(!skipBind){
    setTimeout(() => bindProfileEvents(state, mine, { readonly }), 0);
  }

  return html;
}

function bindProfileEvents(state, mine, options = {}){
  const readonly = !!options.readonly;

  const exportCsvBtn = document.getElementById("admin-export-csv");
  if(exportCsvBtn){
    exportCsvBtn.onclick = () => {
      exportAllProfilesCSV(state);
    };
  }

  const exportJsonBtn = document.getElementById("admin-export-json");
  if(exportJsonBtn){
    exportJsonBtn.onclick = () => {
      exportAllProfilesJSON(state);
    };
  }
  const manageCheckinsBtn = document.getElementById("admin-manage-checkins");
  if(manageCheckinsBtn){
    manageCheckinsBtn.onclick = () => {
      openAdminCheckinManager(state);
    };
  }
  
  const purgeUserBtn = document.getElementById("admin-purge-user");
  if(purgeUserBtn){
    purgeUserBtn.onclick = () => {
      openAdminPurgeUserModal(state);
    };
  }

  const weeklyBtn = document.getElementById("admin-weekly-report");
  if(weeklyBtn){
    weeklyBtn.onclick = () => openWeeklyReportManager();
  }

  const dataFilter = document.getElementById("profile-data-filter");
  if(dataFilter){
    dataFilter.querySelectorAll("span").forEach(btn => {
      btn.onclick = () => {
        profileDataMode = btn.dataset.mode || "month";
        if(window.setState) window.setState({});
      };
    });
  }

  const prevCal = document.getElementById("cal-prev");
  const nextCal = document.getElementById("cal-next");

  if(prevCal){
    prevCal.onclick = () => {
      profileCalendarDate.setMonth(profileCalendarDate.getMonth() - 1);
      if(window.setState) window.setState({});
    };
  }

  if(nextCal){
    nextCal.onclick = () => {
      profileCalendarDate.setMonth(profileCalendarDate.getMonth() + 1);
      if(window.setState) window.setState({});
    };
  }

  document.querySelectorAll("[data-cal-date]").forEach(btn => {
  btn.onclick = () => {
    openCalendarDayModal(btn.dataset.calDate, mine, readonly);
    };
  });

if(!readonly){
  bindAvatarUpload(state);
}

  document.querySelectorAll("[data-checkin-id]").forEach(el => {
    el.onclick = () => {
      const item = mine.find(x => x.id === el.dataset.checkinId);
      if(!item) return;
  
      openProfileCheckinDetail(item, readonly);
    };
  });
}

export function openReadonlyProfileModal(userId){
  const old = document.getElementById("readonly-profile-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "readonly-profile-modal";
  modal.className = "modal-bg detail-viewer-bg";

  modal.innerHTML =
    '<div class="detail-viewer-card readonly-profile-card">' +
      '<div class="readonly-profile-content"></div>' +
    '</div>';

  document.body.appendChild(modal);

  function renderReadonlyContent(){
    const content = modal.querySelector(".readonly-profile-content");
    if(!content) return;

    content.innerHTML = renderProfile(state, {
      userId,
      readonly: true,
      skipBind: true
    });

    bindReadonlyProfileEvents();
  }

  function bindReadonlyProfileEvents(){
    const mine = (state.checkins || []).filter(item => item.user_id === userId);

    const dataFilter = modal.querySelector("#profile-data-filter");
    if(dataFilter){
      dataFilter.querySelectorAll("span").forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          profileDataMode = btn.dataset.mode || "month";
          renderReadonlyContent();
        };
      });
    }

    const prevCal = modal.querySelector("#cal-prev");
    if(prevCal){
      prevCal.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        profileCalendarDate.setMonth(profileCalendarDate.getMonth() - 1);
        renderReadonlyContent();
      };
    }

    const nextCal = modal.querySelector("#cal-next");
    if(nextCal){
      nextCal.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        profileCalendarDate.setMonth(profileCalendarDate.getMonth() + 1);
        renderReadonlyContent();
      };
    }

    modal.querySelectorAll("[data-cal-date]").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        openCalendarDayModal(btn.dataset.calDate, mine, true);
      };
    });

    modal.querySelectorAll("[data-checkin-id]").forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const item = mine.find(x => x.id === el.dataset.checkinId);
        if(!item) return;

        openProfileCheckinDetail(item, true);
      };
    });
  }

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  const escClose = (e) => {
    if(e.key === "Escape"){
      modal.remove();
      document.removeEventListener("keydown", escClose);
    }
  };

  document.addEventListener("keydown", escClose);

  renderReadonlyContent();
}
