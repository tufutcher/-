import { TAG_CATEGORIES } from "./checkin_modal.js";
import { updateCheckinNote, updateImageTags, deleteCheckinWithImages, loadCheckins } from "../api/checkin.js";
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

  let sizeClass = "gallery-size-3";

  if(images.length > 24){
    sizeClass = "gallery-size-6";
  } else if(images.length > 14){
    sizeClass = "gallery-size-5";
  } else if(images.length > 8){
    sizeClass = "gallery-size-4";
  }

  const modeClass = profileDataMode === "all"
    ? "gallery-board-scroll"
    : "gallery-board-fixed";

  return (
    '<div class="gallery-board ' + modeClass + ' ' + sizeClass + '">' +
      images.map(img =>
        '<button class="gallery-tile" data-checkin-id="' + img.checkin_id + '" type="button">' +
          '<img src="' + img.image_url + '">' +
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
      </div>
    </div>
  `;
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

  const backBtnHtml = readonly
    ? '<button class="back-wall-btn" id="back-wall-btn">← 返回打卡墙</button>'
    : "";

  const avatarActionHtml = readonly
    ? ""
    : '<div class="link-text avatar-action" id="avatar-upload-link">上传/更换头像</div>';

  const avatarInputHtml = readonly
    ? ""
    : '<input type="file" id="avatar-input" accept="image/*" style="display:none;">';

  const html =
    backBtnHtml +

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
      '<button id="profile-detail-close" class="detail-x" type="button">×</button>' +

      '<div class="detail-viewer-head">' +
        '<div>' +
          '<div class="detail-author">' + (item.username || "匿名") + '</div>' +
          '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
        '</div>' +
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

  document.getElementById("profile-detail-close").onclick = () => modal.remove();

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

export function openEditModal(item){
  const old = document.getElementById("edit-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const imgs = item.checkin_images || [];
  const localTags = imgs.map(img => [...(img.tags || [])]);

  function renderTagGroups(imgIndex){
    return Object.keys(TAG_CATEGORIES).map(cat => {
      const opts = TAG_CATEGORIES[cat].map(tag => {
        const onClass = localTags[imgIndex].includes(tag) ? " on" : "";

        return (
          '<span class="preset-tag' + onClass + '" data-img="' + imgIndex + '" data-tag="' + tag + '">' +
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

  const imagesHtml = imgs.map((img, idx) => {
    return (
      '<div class="edit-art-block">' +
        '<img src="' + img.image_url + '">' +
        '<div class="edit-tag-box">' +
          '<div class="ci-section-title">第 ' + (idx + 1) + ' 张标签</div>' +
          renderTagGroups(idx) +
        '</div>' +
      '</div>'
    );
  }).join("");

  modal.innerHTML =
    '<div class="detail-viewer-card edit-viewer-card">' +
      '<button id="edit-close" class="detail-x" type="button">×</button>' +

      '<div class="detail-viewer-head">' +
        '<div>' +
          '<div class="detail-author">编辑这次打卡</div>' +
          '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="edit-art-list">' +
        imagesHtml +
      '</div>' +

      '<div class="edit-note-box">' +
        '<label>感想</label>' +
        '<textarea id="edit-note">' + (item.note || "") + '</textarea>' +
      '</div>' +

      '<div class="detail-actions">' +
        '<button id="edit-save">保存修改</button>' +
        '<button id="edit-delete" class="danger">删除</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal) modal.remove();
  };

  document.getElementById("edit-close").onclick = () => modal.remove();

  modal.querySelectorAll(".preset-tag").forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.img);
      const tag = btn.dataset.tag;

      if(localTags[idx].includes(tag)){
        localTags[idx] = localTags[idx].filter(x => x !== tag);
      } else {
        localTags[idx].push(tag);
      }

      btn.classList.toggle("on");
    };
  });

  const saveBtn = document.getElementById("edit-save");
  saveBtn.onclick = async () => {
    const sb = window.__sb;
    const noteInput = document.getElementById("edit-note");
    const note = noteInput ? noteInput.value.trim() : "";

    if(!sb){
      window.showToast?.("数据库连接失败，请刷新后重试。", "保存失败", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    await updateCheckinNote(sb, item.id, note);

    for(let i = 0; i < imgs.length; i++){
      await updateImageTags(sb, imgs[i].id, localTags[i]);
    }

    const freshCheckins = await loadCheckins(sb);

    if(window.setState){
      window.setState({ checkins: freshCheckins });
    }

    modal.remove();
    window.showToast?.("这次打卡已经更新。", "保存成功", "success");
  };

  const deleteBtn = document.getElementById("edit-delete");
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
