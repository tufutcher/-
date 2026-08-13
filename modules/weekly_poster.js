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
  const columns = Math.max(1, Math.min(Number(options.columns) || 9, items.length || 1));
  const cardWidth = 88;
  const cardHeight = 318;
  const gap = 7;
  const rows = Math.ceil(items.length / columns);

  const posterWidth = 260 + columns * cardWidth + (columns - 1) * gap + 80;
  const posterHeight = Math.max(720, rows * cardHeight + 80);

  const cards = items.map(item=>{
    const days = item.checkin_dates?.length || 0;

    return `
    <div class="weekly-poster-card">
      <div class="weekly-poster-img">
        ${item.cover_image_url
          ? `<img src="${item.cover_image_url}" crossorigin="anonymous">`
          : `<div class="weekly-poster-empty-img">暂无图片</div>`}
        <div class="weekly-poster-img-mask"></div>
        <div class="weekly-poster-card-info">
          ${getWeeklyBadge(days) ? `<div class="weekly-poster-badge"><span class="weekly-poster-badge-icon">${getWeeklyBadge(days)}</span></div>` : ''}
          <div class="weekly-poster-name">${escapeHtml(item.display_name || '匿名')}</div>
        </div>
      </div>
      <div class="weekly-poster-card-text">
        <p>${escapeHtml(item.summary || '本周继续创作')}</p>
        <strong>获得称号</strong>
        <b>「${escapeHtml(item.nickname_title || '继续创作中')}」</b>
      </div>
      <div class="weekly-poster-date-line">
        ${renderMiniDateLine(report,item)}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
  <div class="weekly-poster-canvas"
    style="--poster-cols:${columns};--poster-card-width:${cardWidth}px;--poster-card-height:${cardHeight}px;--poster-card-gap:${gap}px;--poster-font:${weeklyPosterFontScale};--poster-name-font:${report.poster_name_font||weeklyPosterNameFontSize}px;--poster-card-font:${report.poster_card_font||weeklyPosterCardFontSize}px;--poster-event-font:${report.poster_event_font||weeklyPosterEventFontSize}px;width:${posterWidth}px;height:${posterHeight}px;">
    <div class="weekly-poster-left">
      <div class="weekly-poster-date-vertical">${formatPosterDate(report.start_date,report.end_date)}</div>
      <div class="weekly-poster-title-vertical">本<br>周<br>创<br>作<br>报<br>告</div>
      <div class="weekly-poster-event-box">
        <div class="weekly-poster-event-title">这周群里发生了啥</div>
        <div class="weekly-poster-event-content">${formatEventText(report.event_notes || '暂无事件记录')}</div>
      </div>
    </div>
    <div class="weekly-poster-main">
      <div class="weekly-poster-grid">${cards}</div>
    </div>
    <div class="poster-right">不<br>画<br>画<br>真<br>的<br>要<br>完<br>了</div>
  </div>`;
}

function renderMiniDateLine(report,item){
  const dates=getDateRange(report.start_date,report.end_date);
  const checked=item.checkin_dates||[];
  return dates.map(date=>`<span class="${checked.includes(date)?'active':''}">${new Date(date).getDate()}</span>`).join('');
}

function getDateRange(start,end){
  const result=[];
  let current=new Date(start);
  const last=new Date(end);
  while(current<=last){
    result.push(`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`);
    current.setDate(current.getDate()+1);
  }
  return result;
}

function getWeeklyBadge(days){
  if(days===7)return '🎨';
  if(days>=5)return '🔥';
  if(days>=3)return '⭐';
  return '';
}

function formatPosterDate(start,end){
  return `${start.replaceAll('-','.')}-${end.replaceAll('-','.')}`;
}

function formatEventText(text){
  return escapeHtml(text).replaceAll('\n','<br>');
}

function escapeHtml(value){
  return String(value||'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');
}
