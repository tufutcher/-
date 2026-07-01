import { TAG_CATEGORIES } from "./checkin_modal.js";
import { state } from "../core/state.js";
import {
  updateCheckinNote,
  updateCheckinDate,
  updateImageTags,
  deleteCheckinWithImages,
  adminDeleteCheckinWithImages,
  loadCheckins
} from "../api/checkin.js";
import { uploadImage } from "../api/storage.js";

const PIE_COLORS = ["#1a1a1a", "#5b8def", "#f0a13c", "#4cb38f"];
let profileCalendarDate = new Date();
let profileDataMode = "month";

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

function csvCell(value){
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

function downloadTextFile(filename, content, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();
  URL.revokeObjectURL(url);
}

function getTagSummary(items){
  const tagCount = {};

  items.forEach(item => {
    (item.checkin_images || []).forEach(img => {
      (img.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
  });

  return Object.entries(tagCount)
    .sort((a,b) => b[1] - a[1])
    .map(([tag, count]) => `${tag}×${count}`)
    .join(" / ");
}

function getProfileExportRows(state){
  const profiles = state.profiles || [];
  const checkins = state.checkins || [];

  return profiles.map(profile => {
    const items = checkins.filter(i => i.user_id === profile.id);
    const stats = computeStats(items);
    const badges = computeBadges(items);

    return {
      user_id: profile.id,
      username: profile.username || "",
      avatar_url: profile.avatar_url || "",
      checkin_count: items.length,
      week_days: stats.weekDays,
      week_images: stats.weekImages,
      month_days: stats.monthDays,
      month_images: stats.monthImages,
      max_streak: stats.maxStreak,
      total_images: stats.totalImages,
      badge_star: badges.star,
      badge_fire: badges.fire,
      badge_palette: badges.palette,
      top_tags: getTagSummary(items)
    };
  });
}

function exportAllProfilesCSV(state){
  const rows = getProfileExportRows(state);

  const headers = [
    "user_id",
    "username",
    "avatar_url",
    "checkin_count",
    "week_days",
    "week_images",
    "month_days",
    "month_images",
    "max_streak",
    "total_images",
    "badge_star",
    "badge_fire",
    "badge_palette",
    "top_tags"
  ];

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(","))
  ].join("\n");

  downloadTextFile(
    "drawclub_profiles_export.csv",
    "\ufeff" + csv,
    "text/csv;charset=utf-8"
  );
}

function exportAllProfilesJSON(state){
  const profiles = state.profiles || [];
  const checkins = state.checkins || [];

  const data = profiles.map(profile => {
    const items = checkins.filter(i => i.user_id === profile.id);
    const stats = computeStats(items);
    const badges = computeBadges(items);

    return {
      profile,
      stats,
      badges,
      top_tags: getTagSummary(items),
      checkins: items
    };
  });

  downloadTextFile(
    "drawclub_profiles_export.json",
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8"
  );
}

function renderAdminPanel(state){
  const profiles = state.profiles || [];
  const checkins = state.checkins || [];

  const totalImages = checkins.reduce((sum, item) => {
    return sum + (item.checkin_images?.length || 0);
  }, 0);

  return `
    <div class="card admin-card">
      <div class="admin-head">
        <div>
          <div class="glabel">管理员通道</div>
          <div class="admin-title">社群数据导出</div>
          <div class="admin-subtitle">
            当前成员 ${profiles.length} 人，打卡 ${checkins.length} 次，作品 ${totalImages} 张。
          </div>
        </div>
      </div>

      <div class="admin-actions">
        <button id="admin-export-csv">导出 Profile CSV</button>
        <button id="admin-export-json" class="secondary">导出完整 JSON</button>
        <button id="admin-manage-checkins" class="secondary">批量管理打卡</button>
      </div>
    </div>
  `;
}
function openAdminCheckinManager(state){
  const old = document.getElementById("admin-checkin-manager");
  if(old) old.remove();

  let checkins = [...(state.checkins || [])];
  const profiles = state.profiles || [];

  let selectedUserId = "all";
  let selectedDate = "";
  let searchText = "";

  const modal = document.createElement("div");
  modal.id = "admin-checkin-manager";
  modal.className = "modal-bg detail-viewer-bg";

  function userNameById(userId){
    const profile = profiles.find(p => p.id === userId);
    return profile?.username || "匿名";
  }

  function getFilteredCheckins(){
    return checkins.filter(item => {
      const imgs = item.checkin_images || [];
      const username = item.username || userNameById(item.user_id);
      const note = item.note || "";
      const day = dateKey(item.created_at);

      const matchUser = selectedUserId === "all" || item.user_id === selectedUserId;
      const matchDate = !selectedDate || day === selectedDate;
      const matchSearch = !searchText ||
        username.toLowerCase().includes(searchText.toLowerCase()) ||
        note.toLowerCase().includes(searchText.toLowerCase()) ||
        imgs.some(img => (img.tags || []).join(" ").toLowerCase().includes(searchText.toLowerCase()));

      return matchUser && matchDate && matchSearch;
    });
  }

  function renderRows(){
    const filtered = getFilteredCheckins();

    const rowsHtml = filtered.map(item => {
      const imgs = item.checkin_images || [];
      const cover = imgs[0];

      return `
        <div class="admin-checkin-row compact" data-checkin-id="${item.id}">
          <div class="admin-checkin-cover">
            ${cover ? `<img src="${cover.image_url}">` : ""}
          </div>

          <div class="admin-checkin-info">
            <div class="admin-checkin-line">
              <b>${item.username || userNameById(item.user_id)}</b>
              <span>${fmtDate(item.created_at)}</span>
              <em>${imgs.length} 张</em>
            </div>
          </div>

          <button class="admin-checkin-delete danger" data-checkin-id="${item.id}" type="button">
            删除
          </button>
        </div>
      `;
    }).join("");

    const list = modal.querySelector(".admin-checkin-list");
    const count = modal.querySelector("#admin-checkin-count");

    if(count){
      count.textContent = `筛选后 ${filtered.length} / 全部 ${checkins.length} 次打卡`;
    }

    if(list){
      list.innerHTML = rowsHtml || `<div class="empty">没有符合条件的打卡记录</div>`;
    }

    bindDeleteEvents();
  }

  function bindDeleteEvents(){
    modal.querySelectorAll(".admin-checkin-delete").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();

        const checkinId = btn.dataset.checkinId;
        const item = checkins.find(x => x.id === checkinId);

        const ok = await window.showConfirm?.({
          title: "删除这次打卡？",
          message: `将删除 ${item?.username || "匿名"} 的这次打卡和所有图片。这个动作不能撤回。`,
          confirmText: "删除",
          cancelText: "取消",
          danger: true
        });

        if(!ok) return;

        const sb = window.__sb;
        if(!sb){
          window.showToast?.("数据库连接失败，请刷新后重试。", "删除失败", "error");
          return;
        }

        btn.disabled = true;
        btn.textContent = "删除中...";

        const deleted = await adminDeleteCheckinWithImages(sb, checkinId);

        if(!deleted){
          btn.disabled = false;
          btn.textContent = "删除";
          return;
        }

        const freshCheckins = await loadCheckins(sb);

        checkins = [...freshCheckins];

        if(window.setState){
          window.setState({ checkins: freshCheckins });
        }

        renderRows();

        window.showToast?.("这次打卡已经删除。", "已删除", "success");
      };
    });
  }

  const userOptions = [
    `<option value="all">全部成员</option>`,
    ...profiles.map(profile => {
      const count = checkins.filter(item => item.user_id === profile.id).length;
      return `<option value="${profile.id}">${profile.username || "匿名"}（${count}）</option>`;
    })
  ].join("");

  modal.innerHTML = `
    <div class="detail-viewer-card admin-checkin-card compact">
      <button id="admin-checkin-close" class="detail-x" type="button">×</button>

      <div class="detail-viewer-head admin-manager-head">
        <div>
          <div class="detail-author">批量管理打卡</div>
          <div class="detail-date" id="admin-checkin-count">共 ${checkins.length} 次打卡</div>
        </div>
      </div>

      <div class="admin-filter-bar">
        <select id="admin-user-filter" class="admin-user-filter">
          ${userOptions}
        </select>

        <input type="date" id="admin-date-filter" class="admin-date-filter">

        <input
          type="search"
          id="admin-search-filter"
          class="admin-search-filter"
          placeholder="搜用户名 / 感想 / 标签"
        >

        <button id="admin-clear-filter" class="secondary" type="button">清空</button>
      </div>

      <div class="admin-checkin-list"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  document.getElementById("admin-checkin-close").onclick = () => {
    modal.remove();
  };

  const userFilter = document.getElementById("admin-user-filter");
  const dateFilter = document.getElementById("admin-date-filter");
  const searchFilter = document.getElementById("admin-search-filter");
  const clearBtn = document.getElementById("admin-clear-filter");

  if(userFilter){
    userFilter.onchange = () => {
      selectedUserId = userFilter.value;
      renderRows();
    };
  }

  if(dateFilter){
    dateFilter.onchange = () => {
      selectedDate = dateFilter.value;
      renderRows();
    };
  }

  if(searchFilter){
    searchFilter.oninput = () => {
      searchText = searchFilter.value.trim();
      renderRows();
    };
  }

  if(clearBtn){
    clearBtn.onclick = () => {
      selectedUserId = "all";
      selectedDate = "";
      searchText = "";

      if(userFilter) userFilter.value = "all";
      if(dateFilter) dateFilter.value = "";
      if(searchFilter) searchFilter.value = "";

      renderRows();
    };
  }

  renderRows();
}

export function renderProfile(state, options = {}){
  const targetUserId = options.userId || state.user?.id;
  const readonly = !!options.readonly;

  const mine = state.checkins.filter(i => i.user_id === targetUserId);
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

  setTimeout(() => bindProfileEvents(state, mine, { readonly }), 0);

  return html;
}

function openCalendarDayModal(dayKey, mine, readonly){
  const old = document.getElementById("calendar-day-modal");
  if(old) old.remove();

  const items = mine.filter(item => dateKey(item.created_at) === dayKey);
  if(!items.length) return;

  const modal = document.createElement("div");
  modal.id = "calendar-day-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const totalImages = items.reduce((sum, item) => {
    return sum + (item.checkin_images?.length || 0);
  }, 0);

  const galleryHtml = items.map(item => {
    const imgs = item.checkin_images || [];

    return imgs.map(img => {
      return (
        '<button class="calendar-gallery-tile" data-checkin-id="' + item.id + '" type="button">' +
          '<img src="' + img.image_url + '">' +
          (item.note ? '<span class="calendar-gallery-note">' + item.note + '</span>' : '') +
        '</button>'
      );
    }).join("");
  }).join("");

  modal.innerHTML =
    '<div class="detail-viewer-card calendar-gallery-card">' +
      '<button id="calendar-day-close" class="detail-x" type="button">×</button>' +

      '<div class="detail-viewer-head">' +
        '<div>' +
          '<div class="detail-author">' + fmtDate(items[0].created_at) + '</div>' +
          '<div class="detail-date">' + items.length + ' 次打卡 / ' + totalImages + ' 张作品</div>' +
        '</div>' +
      '</div>' +

      '<div class="calendar-gallery-board">' +
        galleryHtml +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal) modal.remove();
  };

  document.getElementById("calendar-day-close").onclick = () => modal.remove();

  modal.querySelectorAll("[data-checkin-id]").forEach(tile => {
    tile.onclick = () => {
      const item = items.find(x => x.id === tile.dataset.checkinId);
      if(!item) return;

      modal.remove();
      openProfileCheckinDetail(item, readonly);
    };
  });
}

function openProfileCheckinDetail(item, readonly = false){
  const old = document.getElementById("profile-detail-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "profile-detail-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const imgs = item.checkin_images || [];
  const profile = state.profiles.find(p => p.id === item.user_id);
  const avatarUrl = profile?.avatar_url;
  const username = item.username || profile?.username || "匿名";
  const avatarLetter = username.trim().slice(0, 1) || "匿";
  
  const authorAvatarHtml = avatarUrl
    ? '<img class="detail-avatar" src="' + avatarUrl + '">'
    : '<div class="detail-avatar detail-avatar-fallback">' + avatarLetter + '</div>';

  const imagesHtml = imgs.map(img => {
    const tagsHtml = img.tags?.length
      ? (
        '<div class="tags detail-tags">' +
          img.tags.map(t => '<span>#' + t + '</span>').join("") +
        '</div>'
      )
      : "";

    return (
      '<div class="detail-art-block">' +
        '<img src="' + img.image_url + '">' +
        tagsHtml +
      '</div>'
    );
  }).join("");

  modal.innerHTML =
    '<div class="detail-viewer-card">' +

    '<div class="detail-viewer-head">' +
      '<button class="detail-author-card" data-profile-user-id="' + item.user_id + '" type="button">' +
        authorAvatarHtml +
        '<div>' +
          '<div class="detail-author">' + username + '</div>' +
          '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
        '</div>' +
      '</button>' +
    '</div>' +

      '<div class="detail-art-list">' +
        imagesHtml +
      '</div>' +

      (item.note ? '<div class="note detail-note">' + item.note + '</div>' : '') +

      (!readonly ? (
        '<div class="detail-actions">' +
          '<button id="profile-detail-edit">编辑</button>' +
        '</div>'
      ) : '') +
    '</div>';

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal) modal.remove();
  };

  const authorCard = modal.querySelector(".detail-author-card");
  if(authorCard){
    authorCard.onclick = () => {
      const userId = authorCard.dataset.profileUserId;
      if(!userId) return;
  
      modal.remove();
      openReadonlyProfileModal(userId);
    };
  }
  
  const editBtn = document.getElementById("profile-detail-edit");
  if(editBtn){
    editBtn.onclick = () => {
      modal.remove();
      openEditModal(item);
    };
  }
}

function openReadOnlyCheckinDetail(item){
  openProfileCheckinDetail(item, true);
}

function bindProfileEvents(state, mine, options = {}){
  const readonly = !!options.readonly;

  const backWallBtn = document.getElementById("back-wall-btn");
  if(backWallBtn){
    backWallBtn.onclick = () => {
      if(window.setState){
        window.setState({ view: "wall", viewUserId: null });
      }
    };
  }

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
    const avatarTrigger = document.getElementById("avatar-trigger");
    const link = document.getElementById("avatar-upload-link");
    const avatarInput = document.getElementById("avatar-input");

    if(avatarTrigger && link){
      avatarTrigger.onclick = () => {
        link.classList.toggle("show");
      };
    }

    if(link && avatarInput){
      link.onclick = () => avatarInput.click();

      avatarInput.onchange = async (e) => {
        const f = e.target.files[0];
        if(!f) return;

        const sb = window.__sb;
        const safeName = f.name.replace(/[^\w.\-]/g, "_");
        const path = "avatars/" + state.user.id + "_" + Date.now() + "_" + safeName;
        const url = await uploadImage(sb, f, path);

        if(url){
          await sb.from("profiles").update({ avatar_url: url }).eq("id", state.user.id);

          if(state.profile){
            state.profile.avatar_url = url;
          }

          const img = document.getElementById("avatar-img");
          if(img){
            img.src = url;
            img.style.background = "transparent";
          }

          link.classList.remove("show");
        }
      };
    }
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
      '<button id="readonly-profile-close" class="detail-x" type="button">×</button>' +
      '<div class="readonly-profile-content">' +
        renderProfile(state, {
          userId,
          readonly: true
        }) +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  document.getElementById("readonly-profile-close").onclick = () => {
    modal.remove();
  };
}
export function openEditModal(item){
  const old = document.getElementById("edit-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const imgs = item.checkin_images || [];

  let editImages = imgs.map((img, index) => ({
    id: img.id,
    image_url: img.image_url,
    tags: [...(img.tags || [])],
    customTags: false,
    index
  }));

  let globalTags = editImages[0] ? [...editImages[0].tags] : [];
  let selectedImageId = null;
  let noteValue = item.note || "";
  let dateValue = new Date(item.created_at).toISOString().slice(0, 10);

  function selectedImage(){
    return editImages.find(img => img.id === selectedImageId);
  }

  function renderTagGroups(activeTags, mode){
    return Object.keys(TAG_CATEGORIES).map(cat => {
      const opts = TAG_CATEGORIES[cat].map(tag => {
        const onClass = activeTags.includes(tag) ? " on" : "";

        return (
          '<span class="preset-tag' + onClass + '" data-mode="' + mode + '" data-tag="' + tag + '">' +
            tag +
          '</span>'
        );
      }).join("");

      return (
        '<div class="ci-tag-row">' +
          '<div class="ci-tag-label">' + cat + '</div>' +
          '<div class="ci-tag-options">' + opts + '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderEditor(){
    const isSingleMode = !!selectedImageId;
    const selected = selectedImage();

    const thumbsHtml = editImages.map((img, idx) => {
      const selectedClass = img.id === selectedImageId ? " selected" : "";
      const customMark = img.customTags ? '<span class="ci-custom-mark">单独</span>' : "";
      const pointer = img.id === selectedImageId ? '<span class="ci-thumb-pointer"></span>' : "";

      return (
        '<button class="ci-thumb edit-thumb' + selectedClass + '" data-img-id="' + img.id + '" type="button">' +
          '<img src="' + img.image_url + '">' +
          '<span class="ci-thumb-num">' + (idx + 1) + '</span>' +
          customMark +
          pointer +
        '</button>'
      );
    }).join("");

    const tagPanelHtml = isSingleMode && selected
      ? (
        '<div class="ci-tag-box single edit-tag-panel">' +
          '<div class="ci-section-title">单张标签</div>' +
          renderTagGroups(selected.tags, "single") +
          '<div class="ci-single-actions">' +
            '<button id="edit-back-global" class="ci-icon-btn" type="button" title="返回套用标签">×</button>' +
            '<button id="edit-reset-tags" class="ci-icon-btn" type="button" title="恢复统一标签">↻</button>' +
          '</div>' +
        '</div>'
      )
      : (
        '<div class="ci-tag-box edit-tag-panel">' +
          '<div class="ci-section-title">套用标签</div>' +
          '<div class="hint-text ci-tag-hint">选择的标签会套用到所有图片。点击图片可单独修改。</div>' +
          renderTagGroups(globalTags, "global") +
        '</div>'
      );

    modal.innerHTML =
      '<div class="detail-viewer-card edit-checkin-card">' +
        '<button id="edit-close" class="detail-x" type="button">×</button>' +

        '<div class="detail-viewer-head">' +
          '<div>' +
            '<div class="detail-author">编辑这次打卡</div>' +
            '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="edit-checkin-body">' +
          '<div class="ci-date-row edit-date-row">' +
            '<label for="edit-date">打卡日期</label>' +
            '<input type="date" id="edit-date" value="' + dateValue + '">' +
          '</div>' +
        
          '<div class="ci-thumb-grid edit-thumb-grid">' +
            thumbsHtml +
          '</div>' +

          tagPanelHtml +

          '<div class="edit-note-box">' +
            '<label>感想</label>' +
            '<textarea id="edit-note">' + noteValue + '</textarea>' +
          '</div>' +

          '<div class="detail-actions edit-actions">' +
            '<button id="edit-save">保存修改</button>' +
            '<button id="edit-delete" class="danger">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindEditorEvents();
  }

  function saveCurrentForm(){
    const noteInput = document.getElementById("edit-note");
    if(noteInput){
      noteValue = noteInput.value;
    }
  
    const dateInput = document.getElementById("edit-date");
    if(dateInput){
      dateValue = dateInput.value;
    }
  }

  function bindEditorEvents(){
    const closeBtn = document.getElementById("edit-close");
    if(closeBtn){
      closeBtn.onclick = () => modal.remove();
    }

    modal.onclick = (e) => {
      if(e.target === modal) modal.remove();
    };

    modal.querySelectorAll(".edit-thumb").forEach(btn => {
      btn.onclick = () => {
        saveCurrentForm();
        selectedImageId = btn.dataset.imgId;
        renderEditor();
      };
    });

    modal.querySelectorAll('.preset-tag[data-mode="global"]').forEach(btn => {
      btn.onclick = () => {
        const tag = btn.dataset.tag;

        if(globalTags.includes(tag)){
          globalTags = globalTags.filter(x => x !== tag);
        } else {
          globalTags.push(tag);
        }

        editImages = editImages.map(img => {
          if(img.customTags) return img;

          return {
            ...img,
            tags: [...globalTags]
          };
        });

        saveCurrentForm();
        renderEditor();
      };
    });

    modal.querySelectorAll('.preset-tag[data-mode="single"]').forEach(btn => {
      btn.onclick = () => {
        const selected = selectedImage();
        if(!selected) return;

        const tag = btn.dataset.tag;

        if(selected.tags.includes(tag)){
          selected.tags = selected.tags.filter(x => x !== tag);
        } else {
          selected.tags.push(tag);
        }

        selected.customTags = true;

        saveCurrentForm();
        renderEditor();
      };
    });

    const backBtn = document.getElementById("edit-back-global");
    if(backBtn){
      backBtn.onclick = () => {
        saveCurrentForm();
        selectedImageId = null;
        renderEditor();
      };
    }

    const resetBtn = document.getElementById("edit-reset-tags");
    if(resetBtn){
      resetBtn.onclick = () => {
        const selected = selectedImage();
        if(!selected) return;

        selected.tags = [...globalTags];
        selected.customTags = false;

        saveCurrentForm();
        renderEditor();
      };
    }

    const saveBtn = document.getElementById("edit-save");
    if(saveBtn){
      saveBtn.onclick = async () => {
        const sb = window.__sb;
        const noteInput = document.getElementById("edit-note");
        const note = noteInput ? noteInput.value.trim() : noteValue.trim();
        
        const dateInput = document.getElementById("edit-date");
        const pickedDate = dateInput?.value || dateValue || new Date(item.created_at).toISOString().slice(0, 10);
        const createdAt = pickedDate + "T12:00:00";

        if(!sb){
          window.showToast?.("数据库连接失败，请刷新后重试。", "保存失败", "error");
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "保存中...";

        await updateCheckinNote(sb, item.id, note);
        await updateCheckinDate(sb, item.id, createdAt);

        for(const img of editImages){
          await updateImageTags(sb, img.id, img.tags);
        }

        const freshCheckins = await loadCheckins(sb);

        if(window.setState){
          window.setState({ checkins: freshCheckins });
        }

        modal.remove();
        window.showToast?.("这次打卡已经更新。", "保存成功", "success");
      };
    }

    const deleteBtn = document.getElementById("edit-delete");
    if(deleteBtn){
      deleteBtn.onclick = async () => {
        const ok = await window.showConfirm?.({
          title: "删除这次打卡？",
          message: "图片也会一起删除。这个动作不能撤回。",
          confirmText: "删除",
          cancelText: "取消",
          danger: true
        });

        if(!ok) return;

        const sb = window.__sb;
        const user = window.__user;

        if(!sb || !user){
          window.showToast?.("请先登录后再操作。", "还不能操作", "error");
          return;
        }

        deleteBtn.disabled = true;
        deleteBtn.textContent = "删除中...";

        const deleted = await deleteCheckinWithImages(sb, item.id, user.id);

        if(!deleted){
          deleteBtn.disabled = false;
          deleteBtn.textContent = "删除";
          return;
        }

        const freshCheckins = await loadCheckins(sb);

        if(window.setState){
          window.setState({ checkins: freshCheckins });
        }

        modal.remove();
        window.showToast?.("这次打卡已经删除。", "已删除", "success");
      };
    }
  }

  document.body.appendChild(modal);
  renderEditor();
}
