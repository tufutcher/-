let weeklyPosterFontScale = 1.4;
let weeklyPosterNameFontSize = 28;
let weeklyPosterCardFontSize = 16;
let weeklyPosterEventFontSize = 10;

export function setPosterFontScale(value){
  weeklyPosterFontScale = Number(value) || 1;
}

export function setPosterNameFontSize(value){
  weeklyPosterNameFontSize = Number(value) || 28;
}

export function setPosterCardFontSize(value){
  weeklyPosterCardFontSize = Number(value) || 16;
}

export function setPosterEventFontSize(value){
  weeklyPosterEventFontSize = Number(value) || 10;
}

export function renderWeeklyPoster(report, wrap, options = {}){
  if(!wrap) return;

  ensureMultiWeekPosterStyles();

  const items = report.weekly_report_items || [];
  const dates = getDateRange(report.start_date, report.end_date);
  const isMultiWeek = dates.length > 14;
  const weekCount = Math.max(1, Math.ceil((dates.length || 7) / 7));
  const columns = Math.max(1, Math.min(Number(report.poster_columns || options.columns || 9), items.length || 1));
  const cardWidth = 88;
  const cardHeight = isMultiWeek ? 220 + weekCount * 18 : 318;
  const gap = 7;
  const rows = Math.ceil(items.length / columns);
  const posterWidth = 260 + columns * cardWidth + (columns - 1) * gap + 80;
  const posterHeight = Math.max(720, rows * cardHeight + 80);
  const eventNotes = String(report.event_notes || "").trim();

  const cards = items.map(item => {
    const checkedDates = item.checkin_dates || [];
    const days = checkedDates.length;
    const badgeHtml = isMultiWeek
      ? renderMultiWeekBadgeRow(report, item)
      : renderSingleWeekBadge(days);
    const dayClass = isMultiWeek
      ? getMultiWeekDayClass(report, item)
      : getWeeklyDayClass(days);
    const cardText = isMultiWeek
      ? ""
      : `
      <div class="weekly-poster-card-text">
        <p>${escapeHtml(item.summary || "本周继续创作")}</p>
        <strong>获得称号</strong>
        <b>「${escapeHtml(item.nickname_title || "继续创作中")}」</b>
      </div>`;

    return `
    <div class="weekly-poster-card ${isMultiWeek ? "weekly-poster-card-multiweek" : ""}">
      <div class="weekly-poster-img">
        ${item.cover_image_url ? `<img src="${escapeAttr(item.cover_image_url)}" crossorigin="anonymous" loading="eager">` : `<div class="weekly-poster-empty-img">暂无图片</div>`}
        <div class="weekly-poster-img-mask"></div>
        <div class="weekly-poster-card-info">
          ${badgeHtml}
          ${days > 0 ? `<div class="weekly-poster-days ${dayClass}">打卡${days}天</div>` : ""}
          <div class="weekly-poster-name">${escapeHtml(item.display_name || "匿名")}</div>
        </div>
      </div>
      ${cardText}
      <div class="weekly-poster-date-line">${renderMiniDateLine(dates, item)}</div>
    </div>`;
  }).join("");

  wrap.innerHTML = `
  <div class="weekly-poster-canvas ${isMultiWeek ? "weekly-poster-multiweek" : ""}"
    style="--weekly-theme:${report.theme_color || "#ff6a16"};--poster-cols:${columns};--poster-card-width:${cardWidth}px;--poster-card-height:${cardHeight}px;--poster-card-gap:${gap}px;--poster-font:${weeklyPosterFontScale};--poster-name-font:${report.poster_name_font || weeklyPosterNameFontSize}px;--poster-card-font:${report.poster_card_font || weeklyPosterCardFontSize}px;--poster-event-font:${report.poster_event_font || weeklyPosterEventFontSize}px;width:${posterWidth}px;height:${posterHeight}px;">
    <div class="weekly-poster-left">
      <div class="weekly-poster-date-vertical">${formatPosterDate(report.start_date, report.end_date)}</div>
      <div class="weekly-poster-title-vertical">本<br>周<br>创<br>作<br>报<br>告</div>
      ${eventNotes ? `
      <div class="weekly-poster-event-box">
        <div class="weekly-poster-event-title" aria-label="这周群里发生了啥？！">
          <span>这周群里</span><span>发生了</span><span>啥？！</span>
        </div>
        <div class="weekly-poster-event-content">${formatEventText(eventNotes)}</div>
      </div>` : ""}
    </div>
    <div class="weekly-poster-main"><div class="weekly-poster-grid">${cards}</div></div>
    <div class="poster-right">不<br>画<br>画<br>真<br>的<br>要<br>完<br>了</div>
  </div>`;
}

function renderMiniDateLine(dates, item){
  const checked = item.checkin_dates || [];
  return dates.map(date => `<span class="${checked.includes(date) ? "active" : ""}">${Number(date.slice(-2))}</span>`).join("");
}

function getDateRange(start, end){
  const result = [];
  if(!start || !end) return result;

  let current = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  if(Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return result;

  while(current <= last){
    result.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`);
    current.setDate(current.getDate() + 1);
  }
  return result;
}

function renderSingleWeekBadge(days){
  const badge = getWeeklyBadge(days);
  return badge ? `<div class="weekly-poster-badge"><span class="weekly-poster-badge-icon">${badge}</span></div>` : "";
}

function renderMultiWeekBadgeRow(report, item){
  const badges = getMultiWeekBadges(report, item);

  if(!badges.length){
    return "";
  }

  return `
    <div class="weekly-poster-badge weekly-poster-badge-row">
      ${badges.map(badge => `<span class="weekly-poster-badge-icon">${badge}</span>`).join("")}
    </div>
  `;
}

function getMultiWeekBadges(report, item){
  const dates = getDateRange(report.start_date, report.end_date);
  const checked = new Set(item.checkin_dates || []);
  const badges = [];

  for(let i = 0; i < dates.length; i += 7){
    const weekDates = dates.slice(i, i + 7);
    const days = weekDates.filter(date => checked.has(date)).length;
    const badge = getWeeklyBadge(days);

    if(badge){
      badges.push(badge);
    }
  }

  return badges;
}

function getMultiWeekDayClass(report, item){
  const dates = getDateRange(report.start_date, report.end_date);
  const checked = new Set(item.checkin_dates || []);
  let bestWeekDays = 0;

  for(let i = 0; i < dates.length; i += 7){
    const weekDates = dates.slice(i, i + 7);
    const days = weekDates.filter(date => checked.has(date)).length;
    bestWeekDays = Math.max(bestWeekDays, days);
  }

  return getWeeklyDayClass(bestWeekDays);
}

function getWeeklyBadge(days){
  if(days === 7) return "🎨";
  if(days >= 5) return "🔥";
  if(days >= 3) return "⭐";
  return "";
}

function getWeeklyDayClass(days){
  if(days === 7) return "weekly-days-perfect";
  if(days >= 5) return "weekly-days-fire";
  if(days >= 3) return "weekly-days-star";
  if(days >= 1) return "weekly-days-low";
  return "weekly-days-none";
}

function formatPosterDate(start, end){
  return `${formatDotDate(start)} - ${formatDotDate(end)}`;
}

function formatDotDate(date){
  return String(date || "").replaceAll("-", ".");
}

function formatEventText(text){
  return escapeHtml(text).replaceAll("\n", "<br>");
}

function ensureMultiWeekPosterStyles(){
  if(document.getElementById("weekly-multiweek-poster-style")) return;

  const style = document.createElement("style");
  style.id = "weekly-multiweek-poster-style";
  style.textContent = `
    .weekly-poster-multiweek .weekly-poster-grid{
      align-items:start;
    }

    .weekly-poster-card-multiweek{
      height:var(--poster-card-height,346px);
      grid-template-rows:220px minmax(18px,auto) !important;
    }

    .weekly-poster-card-multiweek .weekly-poster-img{
      height:220px;
    }

    .weekly-poster-card-multiweek .weekly-poster-card-info{
      bottom:6px;
    }

    .weekly-poster-card-multiweek .weekly-poster-badge-row{
      display:flex;
      flex-direction:row;
      align-items:center;
      justify-content:center;
      gap:2px;
      width:100%;
      max-width:100%;
      margin:0 0 3px;
      padding:0 4px;
      box-sizing:border-box;
      flex-wrap:wrap;
    }

    .weekly-poster-card-multiweek .weekly-poster-badge-row .weekly-poster-badge-icon{
      font-size:13px;
      line-height:1;
    }

    .weekly-poster-card-multiweek .weekly-poster-date-line{
      height:auto;
      min-height:18px;
      grid-template-columns:repeat(7,1fr);
      grid-auto-rows:18px;
      align-self:stretch;
      font-size:7px;
      line-height:1;
      overflow:visible;
      background:#fff;
    }

    .weekly-poster-card-multiweek .weekly-poster-date-line span{
      min-height:18px;
      border-top:1px solid rgba(0,0,0,.08);
    }

    .weekly-poster-card-multiweek .weekly-poster-date-line span:nth-child(7n+1){
      border-left:none;
    }
  `;
  document.head.appendChild(style);
}

function escapeAttr(value){
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}