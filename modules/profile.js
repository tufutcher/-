import { TAG_CATEGORIES } from "./checkin_modal.js";
import { updateCheckinNote, updateImageTags, deleteCheckinWithImages, loadCheckins } from "../api/checkin.js";
import { uploadImage } from "../api/storage.js";

const PIE_COLORS = ["#1a1a1a", "#5b8def", "#f0a13c", "#4cb38f"];
let profileCalendarDate = new Date();
let profileDataMode = "month";
let profileArchiveMode = "gallery";

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

function calKey(date){
  const d = new Date(date);
  return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
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

function renderDataFilter(){
  return `
    <div class="card data-filter-card">
      <div class="data-filter-head">
        <div>
          <div class="glabel">数据视图</div>
          <div class="data-filter-title">${dataModeTitle()}创作分析</div>
        </div>

        <div class="data-filter" id="profile-data-filter">
          <span data-mode="week" class="${profileDataMode === 'week' ? 'on' : ''}">本周</span>
          <span data-mode="month" class="${profileDataMode === 'month' ? 'on' : ''}">本月</span>
          <span data-mode="all" class="${profileDataMode === 'all' ? 'on' : ''}">总览</span>
        </div>
      </div>
    </div>
  `;
}

function getGalleryImages(items){
  const images = [];

  items.forEach(item => {
    (item.checkin_images || []).forEach(img => {
      images.push({
        id: img.id,
        image_url: img.image_url,
        created_at: item.created_at,
        checkin_id: item.id,
        item
      });
    });
  });

  return images;
}

function renderArchiveModeSwitch(){
  return `
    <div class="archive-mode-switch" id="archive-mode-switch">
      <span data-mode="gallery" class="${profileArchiveMode === 'gallery' ? 'on' : ''}">画廊</span>
      <span data-mode="checkin" class="${profileArchiveMode === 'checkin' ? 'on' : ''}">打卡</span>
    </div>
  `;
}

function renderGalleryView(items){
  const images = getGalleryImages(items);

  if(!images.length){
    return `<div class="empty archive-empty">这个范围内还没有作品</div>`;
  }

  return `
    <div class="gallery-board">
      ${images.map(img => `
        <button class="gallery-tile" data-checkin-id="${img.checkin_id}" type="button">
          <img src="${img.image_url}">
          <span>${fmtDate(img.created_at)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderCheckinArchiveView(items){
  if(!items.length){
    return `<div class="empty archive-empty">这个范围内还没有打卡</div>`;
  }

  return `
    <div class="archive-checkin-list">
      ${items.map(item => {
        const imgs = item.checkin_images || [];
        const cover = imgs[0];

        return `
          <button class="archive-checkin-card" data-checkin-id="${item.id}" type="button">
            <div class="archive-checkin-cover">
              ${cover ? `<img src="${cover.image_url}">` : ""}
            </div>

            <div class="archive-checkin-meta">
              <span>${fmtDate(item.created_at)}</span>
              <b>${imgs.length} 张</b>
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderArchiveContent(items){
  return profileArchiveMode === "gallery"
    ? renderGalleryView(items)
    : renderCheckinArchiveView(items);
}

function renderArchiveCard(tagCount, topTags, visibleMine){
  return `
    <div class="card archive-card">
      <div class="archive-top">
        <div>
          <div class="glabel">创作档案</div>
          <div class="archive-title">${dataModeTitle()}创作分析</div>
        </div>

        <div class="data-filter" id="profile-data-filter">
          <span data-mode="week" class="${profileDataMode === 'week' ? 'on' : ''}">本周</span>
          <span data-mode="month" class="${profileDataMode === 'month' ? 'on' : ''}">本月</span>
          <span data-mode="all" class="${profileDataMode === 'all' ? 'on' : ''}">总览</span>
        </div>
      </div>

      <div class="archive-section">
        <div class="glabel">创作分布</div>
        <div class="pie-grid archive-pie-grid">
          <div class="pie-panel"><div class="pie-title">内容</div>${pieSvg(tagCount,'内容')}</div>
          <div class="pie-panel"><div class="pie-title">类型</div>${pieSvg(tagCount,'类型')}</div>
          <div class="pie-panel"><div class="pie-title">完成度</div>${pieSvg(tagCount,'完成度')}</div>
        </div>
      </div>

      <div class="archive-section">
        <div class="glabel">常画标签</div>
        <div class="pillbar archive-pillbar">
          ${topTags.length ? topTags.map(t => `<span>${t[0]} ×${t[1]}</span>`).join("") : '<span class="muted">这个范围内还没有标签记录</span>'}
        </div>
      </div>

      <div class="archive-section">
        <div class="archive-view-head">
          <div>
            <div class="glabel">作品视图</div>
            <div class="archive-view-subtitle">${profileArchiveMode === "gallery" ? "展示这个范围内上传过的全部图片" : "按每一次打卡查看记录"}</div>
          </div>

          ${renderArchiveModeSwitch()}
        </div>

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

    const key = calKey(d);
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
    const key = calKey(d);
    const info = dayMap[key];
    const today = calKey(new Date()) === key;
    const cls = ["cal-cell", info ? "has-checkin" : "", today ? "today" : ""].join(" ");

    cells.push(`
      <div class="${cls}">
        <div class="cal-day">${day}</div>
        ${info ? `<div class="cal-count">${info.images}张</div>` : ""}
      </div>
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

  const subtitle = readonly
    ? `留下了 ${mine.length} 次打卡，${stats.totalImages} 张作品。`
    : "今天也留下了一点创作的证据。";

  const greeting = readonly
    ? username
    : `你好，${username}！`;

  const historyCount = visibleMine.length;
  const historyTitle = readonly
    ? `${dataModeTitle()}打卡（共 ${historyCount} 次，点击查看）`
    : `${dataModeTitle()}打卡（共 ${historyCount} 次，点击编辑）`;

  const html = `
      ${readonly ? `
        <button class="back-wall-btn" id="back-wall-btn">← 返回打卡墙</button>
      ` : ''}
  
      <div class="card profile-hero-card ${readonly ? 'readonly-profile' : ''}">
      <div class="profile-hero-left">
        <button id="avatar-trigger" class="avatar-trigger" type="button">
          <img class="avatar-lg" id="avatar-img" src="${avatarUrl || ''}" style="background:${avatarUrl ? 'transparent' : '#ddd'};">
        </button>

        <div class="profile-copy">
          <div class="profile-greeting">${greeting}</div>
          <div class="profile-subtitle">${subtitle}</div>

          ${readonly ? '' : `
            <div class="link-text avatar-action" id="avatar-upload-link">上传/更换头像</div>
          `}
        </div>

        ${readonly ? '' : `
          <input type="file" id="avatar-input" accept="image/*" style="display:none;">
        `}
      </div>

      <div class="profile-hero-calendar">
        ${renderMiniCalendar(mine)}
      </div>
    </div>

    <div class="stats-row">
      <div class="stat stat-block"><div class="stat-title">本周打卡</div><div class="stat-main">${stats.weekDays}天 | ${stats.weekImages}张</div></div>
      <div class="stat stat-block"><div class="stat-title">本月打卡</div><div class="stat-main">${stats.monthDays}天 | ${stats.monthImages}张</div></div>
      <div class="stat stat-block"><div class="stat-title">总计</div><div class="stat-main">连续${stats.maxStreak}天 | 共${stats.totalImages}张</div></div>
    </div>

    ${(!readonly && state.profile?.is_admin) ? renderAdminPanel(state) : ''}

    <div class="card">
      <div class="glabel">我的徽章</div>
      <div class="badge-row">
        <div class="badge-item ${badges.star ? 'unlocked' : 'locked'}">
          <span class="badge-emoji">⭐</span>
          <span class="badge-count">×${badges.star}</span>
          <span class="badge-desc">单周3-4天</span>
        </div>

        <div class="badge-item ${badges.fire ? 'unlocked' : 'locked'}">
          <span class="badge-emoji">🔥</span>
          <span class="badge-count">×${badges.fire}</span>
          <span class="badge-desc">单周5-6天</span>
        </div>

        <div class="badge-item ${badges.palette ? 'unlocked' : 'locked'}">
          <span class="badge-emoji">🎨</span>
          <span class="badge-count">×${badges.palette}</span>
          <span class="badge-desc">单周满勤</span>
        </div>
      </div>
    </div>

${renderArchiveCard(tagCount, topTags, visibleMine)}  

  setTimeout(() => bindProfileEvents(state, mine, { readonly }), 0);
  return html;
}

function openReadOnlyCheckinDetail(item){
  const old = document.getElementById("readonly-detail-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "readonly-detail-modal";
  modal.className = "modal-bg";

  const imgs = item.checkin_images || [];

  let imgsHtml = "";

  imgs.forEach(img => {
    const tagsHtml = (img.tags && img.tags.length)
      ? '<div class="tags">' + img.tags.map(t => "#" + t).join(" ") + '</div>'
      : "";

    imgsHtml +=
      '<div class="detail-img-block">' +
        '<img src="' + img.image_url + '">' +
        tagsHtml +
      '</div>';
  });

  const noteHtml = item.note
    ? '<div class="note" style="margin-top:10px;">' + item.note + '</div>'
    : "";

  modal.innerHTML =
    '<div class="modal-card">' +
      '<div class="who-row">' +
        '<b>' + (item.username || "匿名") + '</b>' +
        '<span class="when">' + fmtDate(item.created_at) + '</span>' +
      '</div>' +
      imgsHtml +
      noteHtml +
      '<button id="readonly-detail-close" class="secondary">关闭</button>' +
    '</div>';

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  const closeBtn = document.getElementById("readonly-detail-close");
  if(closeBtn){
    closeBtn.onclick = () => {
      modal.remove();
    };
  }
}

function bindProfileEvents(state, mine, options = {}){
  const readonly = !!options.readonly;
  
  const backWallBtn = document.getElementById("back-wall-btn");
  if(backWallBtn){
    backWallBtn.onclick = () => {
      if(window.setState){
        window.setState({
          view: "wall",
          viewUserId: null
        });
      }
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

  document.querySelectorAll(".mini-calendar").forEach((cal, index) => {
    if(index > 0){
      const card = cal.closest(".card");
      if(card) card.remove();
      else cal.remove();
    }
  });

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
        const path = "avatars/" + state.user.id + "_" + Date.now() + "_" + f.name;
        const url = await uploadImage(sb, f, path);

        if(url){
          await sb.from("profiles").update({ avatar_url: url }).eq("id", state.user.id);

          if(state.profile) state.profile.avatar_url = url;

          document.getElementById("avatar-img").src = url;
          document.getElementById("avatar-img").style.background = "transparent";

          link.classList.remove("show");
        }
      };
    }
  }

  const archiveModeSwitch = document.getElementById("archive-mode-switch");
  if(archiveModeSwitch){
    archiveModeSwitch.querySelectorAll("span").forEach(btn => {
      btn.onclick = () => {
        profileArchiveMode = btn.dataset.mode || "gallery";
        if(window.setState) window.setState({});
      };
    });
  }
  
  document.querySelectorAll("[data-checkin-id]").forEach(el => {
    el.onclick = () => {
      const item = mine.find(x => x.id === el.dataset.checkinId);
      if(!item) return;
  
      if(readonly){
        openReadOnlyCheckinDetail(item);
      } else {
        openEditModal(item);
      }
    };
  });

export function openEditModal(item){
  const old = document.getElementById("edit-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.className = "modal-bg";

  const imgs = item.checkin_images || [];
  let imgsHtml = "";

  imgs.forEach((img, idx) => {
    let groupsHtml = "";

    Object.keys(TAG_CATEGORIES).forEach(cat => {
      let optsHtml = "";

      TAG_CATEGORIES[cat].forEach(t => {
        const onClass = (img.tags || []).includes(t) ? " on" : "";

        optsHtml +=
          '<span class="preset-tag' + onClass + '" data-img="' + idx + '" data-tag="' + t + '">' +
            t +
          '</span>';
      });

      groupsHtml +=
        '<div class="tag-group">' +
          '<div class="glabel">' + cat + '</div>' +
          '<div class="preset-tags">' + optsHtml + '</div>' +
        '</div>';
    });

    imgsHtml +=
      '<div class="img-card">' +
        '<img src="' + img.image_url + '">' +
        '<div class="img-card-body">' + groupsHtml + '</div>' +
      '</div>';
  });

  modal.innerHTML =
    '<div class="modal-card">' +
      '<h3>编辑这次打卡</h3>' +
      imgsHtml +
      '<label>感想</label>' +
      '<textarea id="edit-note">' + (item.note || "") + '</textarea>' +
      '<button id="edit-save">保存修改</button>' +
      '<button id="edit-delete" class="danger">删除这次打卡</button>' +
      '<button id="edit-cancel" class="secondary">取消</button>' +
    '</div>';

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if(e.target === modal){
      modal.remove();
    }
  });

  const cancelBtn = modal.querySelector("#edit-cancel");
  if(cancelBtn){
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      modal.remove();
    };
  }

  const localTags = imgs.map(img => [...(img.tags || [])]);

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

  const saveBtn = modal.querySelector("#edit-save");
  if(saveBtn){
    saveBtn.onclick = async () => {
      const sb = window.__sb;
      const noteInput = modal.querySelector("#edit-note");
      const note = noteInput ? noteInput.value.trim() : "";

      if(!sb){
        alert("数据库连接失败，请刷新后重试");
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
    };
  }

  const deleteBtn = modal.querySelector("#edit-delete");
  if(deleteBtn){
    deleteBtn.onclick = async () => {
      const ok = confirm("确定删除这次打卡吗？图片也会一起删除。");
      if(!ok) return;

      const sb = window.__sb;
      const user = window.__user;

      if(!sb || !user){
        alert("请先登录");
        return;
      }

      deleteBtn.disabled = true;
      deleteBtn.textContent = "删除中...";

      const deleted = await deleteCheckinWithImages(sb, item.id, user.id);

      if(!deleted){
        deleteBtn.disabled = false;
        deleteBtn.textContent = "删除这次打卡";
        return;
      }

      const freshCheckins = await loadCheckins(sb);

      if(window.setState){
        window.setState({ checkins: freshCheckins });
      }

      modal.remove();
      alert("已删除");
    };
  }
}
