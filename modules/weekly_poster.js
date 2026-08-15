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

  const items = report.weekly_report_items || [];
  const dates = getDateRange(report.start_date, report.end_date);
  const dateCount = dates.length;
  const isLongRange = dateCount > 7;
  const eventNotes = String(report.event_notes || "").trim();
  const hasEvents = !!eventNotes;
  const columns = Math.max(1, Math.min(Number(report.poster_columns || options.columns || 9), items.length || 1));
  const cardWidth = 88;
  const gap = 7;
  const dateRows = isLongRange ? Math.max(1, Math.ceil(dateCount / 7)) : 1;
  const imageHeight = 220;
  const dateLineHeight = dateRows * 16;
  const maxTextHeight = items.some(hasPosterText) ? 82 : 0;
  const maxCardHeight = imageHeight + maxTextHeight + dateLineHeight;
  const rows = Math.ceil(items.length / columns);
  const leftWidth = hasEvents ? 205 : 118;
  const posterWidth = (hasEvents ? 260 : 170) + columns * cardWidth + (columns - 1) * gap + 80;
  const posterHeight = Math.max(720, rows * maxCardHeight + 80);
  const posterTitle = isLongRange ? "多<br>周<br>创<br>作<br>报<br>告" : "本<br>周<br>创<br>作<br>报<br>告";

  const itemModels = items.map(item => {
    const days = item.checkin_dates?.length || 0;
    const badges = isLongRange ? getMultiWeekBadges(report, item, dates) : asBadgeList(getWeeklyBadge(days));

    return {
      item,
      days,
      badges,
      dayClass: getWeeklyDayClass(days),
      textHtml: renderCardText(item)
    };
  });

  const maxBadgeCount = itemModels.reduce((max, model) => Math.max(max, model.badges.length), 0);
  const badgeFontSize = maxBadgeCount
    ? Math.max(9, Math.min(16, Math.floor(74 / maxBadgeCount)))
    : 16;
  const badgeLetterSpacing = maxBadgeCount >= 6 ? -2 : (maxBadgeCount >= 4 ? -1 : 0);

  const cards = itemModels.map(model => {
    const item = model.item;
    const textHeight = model.textHtml ? 82 : 0;
    const itemCardHeight = imageHeight + textHeight + dateLineHeight;
    const cardStyle = `grid-template-rows:${imageHeight}px ${textHeight}px ${dateLineHeight}px;height:${itemCardHeight}px;`;
    const dateLineStyle = `grid-template-columns:repeat(7,1fr);grid-auto-rows:16px;height:${dateLineHeight}px;`;
    const badgeText = model.badges.join("");
    const asciiNameClass = hasAscii(item.display_name) ? " weekly-poster-name-ascii" : "";

    return `
    <div class="weekly-poster-card ${isLongRange ? "weekly-poster-card-multi" : ""}" style="${cardStyle}">
      <div class="weekly-poster-img">
        ${item.cover_image_url ? `<img src="${escapeAttr(item.cover_image_url)}" crossorigin="anonymous" loading="eager">` : `<div class="weekly-poster-empty-img">暂无图片</div>`}
        <div class="weekly-poster-img-mask"></div>
        <div class="weekly-poster-card-info">
          ${badgeText ? `<div class="weekly-poster-badge"><span class="weekly-poster-badge-icon">${badgeText}</span></div>` : ""}
          ${model.days > 0 ? `<div class="weekly-poster-days ${model.dayClass}">打卡${model.days}天</div>` : ""}
          <div class="weekly-poster-name${asciiNameClass}">${escapeHtml(item.display_name || "匿名")}</div>
        </div>
      </div>
      ${model.textHtml}
      <div class="weekly-poster-date-line ${isLongRange ? "weekly-poster-date-line-multi" : ""}" style="${dateLineStyle}">${renderMiniDateLine(report, item, dates)}</div>
    </div>`;
  }).join("");

  wrap.innerHTML = `
  <div class="weekly-poster-canvas ${hasEvents ? "" : "weekly-poster-no-events"} ${isLongRange ? "weekly-poster-long-range" : ""}"
    style="--weekly-theme:${report.theme_color || "#ff6a16"};--poster-cols:${columns};--poster-card-width:${cardWidth}px;--poster-card-height:${maxCardHeight}px;--poster-card-gap:${gap}px;--poster-font:${weeklyPosterFontScale};--poster-name-font:${report.poster_name_font || weeklyPosterNameFontSize}px;--poster-card-font:${report.poster_card_font || weeklyPosterCardFontSize}px;--poster-event-font:${report.poster_event_font || weeklyPosterEventFontSize}px;--poster-left-width:${leftWidth}px;--poster-badge-font:${badgeFontSize}px;--poster-badge-letter:${badgeLetterSpacing}px;width:${posterWidth}px;height:${posterHeight}px;">
    <div class="weekly-poster-left">
      <div class="weekly-poster-date-vertical">${formatPosterDate(report.start_date, report.end_date)}</div>
      <div class="weekly-poster-title-vertical">${posterTitle}</div>
      ${hasEvents ? `
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

function hasPosterText(item){
  return !!(String(item.summary || "").trim() || String(item.nickname_title || "").trim());
}

function renderCardText(item){
  const summary = String(item.summary || "").trim();
  const title = String(item.nickname_title || "").trim();

  if(!summary && !title){
    return "";
  }

  return `
      <div class="weekly-poster-card-text">
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
        ${title ? `<strong>获得称号</strong><b>「${escapeHtml(title)}」</b>` : ""}
      </div>`;
}

function renderMiniDateLine(report, item, dates = null){
  const dateList = dates || getDateRange(report.start_date, report.end_date);
  const checked = item.checkin_dates || [];
  return dateList.map(date => `<span class="${checked.includes(date) ? "active" : ""}">${Number(date.slice(-2))}</span>`).join("");
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

function getMultiWeekBadges(report, item, dates = null){
  const dateList = dates || getDateRange(report.start_date, report.end_date);
  const checked = new Set(item.checkin_dates || []);
  const badges = [];

  for(let i = 0; i < dateList.length; i += 7){
    const weekDates = dateList.slice(i, i + 7);
    const days = weekDates.filter(date => checked.has(date)).length;
    const badge = getWeeklyBadge(days);
    if(badge) badges.push(badge);
  }

  return badges;
}

function asBadgeList(badge){
  return badge ? [badge] : [];
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

function hasAscii(value){
  return /[A-Za-z0-9]/.test(String(value || ""));
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
