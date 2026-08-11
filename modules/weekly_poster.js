let weeklyPosterFontScale = 1.4;

export function setPosterFontScale(value){
  weeklyPosterFontScale = Number(value) || 1;
}

export function renderWeeklyPoster(report, wrap, options = {}){
  if(!wrap) return;

  const items = report.weekly_report_items || [];
  const columns = Math.max(1, Math.min(options.columns || 9, items.length || 1));

  const cardWidth = 118;
  const cardHeight = 340;
  const gap = 10;
  const rows = Math.max(1, Math.ceil(items.length / columns));

  const posterWidth = 280 + columns * cardWidth + (columns - 1) * gap + 70;
  const posterHeight = 80 + rows * cardHeight + (rows - 1) * gap + 80;

  const cards = items.map(item => {
    const days = item.checkin_dates?.length || 0;

    return `
    <div class="poster-member-card">
      <div class="poster-image">
        ${item.cover_image_url
          ? `<img src="${item.cover_image_url}" crossorigin="anonymous">`
          : `<div class="empty-img">暂无图片</div>`}
        <div class="poster-image-mask"></div>
        <div class="poster-info">
          <div class="poster-badge">${getWeeklyBadge(days)}</div>
          <div class="poster-days-count">打卡${days}天</div>
          <div class="poster-name">${escapeHtml(item.display_name || "匿名")}</div>
        </div>
      </div>
      <div class="poster-text">
        <div class="poster-summary">${escapeHtml(item.summary || "本周继续创作")}</div>
        <div class="poster-title-tag">「${escapeHtml(item.nickname_title || "继续创作中")}」</div>
      </div>
      <div class="poster-date-line">${renderMiniDateLine(report,item)}</div>
    </div>`;
  }).join("");

  wrap.innerHTML = `
  <div class="weekly-poster-canvas"
    style="
      --poster-columns:${columns};
      --poster-card-width:${cardWidth}px;
      --poster-card-height:${cardHeight}px;
      --poster-gap:${gap}px;
      --poster-font:${weeklyPosterFontScale};
      width:${posterWidth}px;
      height:${posterHeight}px;
    ">
    <div class="poster-left">
      <div class="poster-date">${formatPosterDate(report.start_date, report.end_date)}</div>
      <div class="poster-title">本<br>周<br>创<br>作<br>报<br>告</div>
      <div class="poster-event">
        <div class="poster-event-title">这周群里发生了啥</div>
        <div class="poster-event-text">${formatEventText(report.event_notes || "暂无事件记录")}</div>
      </div>
    </div>
    <div class="poster-members">${cards}</div>
    <div class="poster-right">不<br>画<br>画<br>真<br>的<br>要<br>完<br>了</div>
  </div>`;
}

function renderMiniDateLine(report,item){
  const dates = getDateRange(report.start_date, report.end_date);
  const checked = item.checkin_dates || [];
  return dates.map(date => `<span class="${checked.includes(date) ? "active" : ""}">${new Date(date).getDate()}</span>`).join("");
}

function getDateRange(start,end){
  const result=[];
  let current=new Date(start);
  const last=new Date(end);
  while(current<=last){
    result.push(`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,"0")}-${String(current.getDate()).padStart(2,"0")}`);
    current.setDate(current.getDate()+1);
  }
  return result;
}

function getWeeklyBadge(days){
  if(days>=6) return "🔥";
  if(days>=4) return "⭐";
  if(days>=2) return "🎨";
  return "★";
}

function formatPosterDate(start,end){
  return `${start.replaceAll("-",".")} - ${end.replaceAll("-",".")}`;
}

function formatEventText(text){
  return escapeHtml(text).replaceAll("\n","<br>");
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
