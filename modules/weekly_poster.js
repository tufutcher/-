let weeklyPosterFontScale = 1.4;

export function setPosterFontScale(value){
  weeklyPosterFontScale = Number(value) || 1;
}

export function renderWeeklyPoster(report, wrap, options = {}){
  if(!wrap) return;

  const items = report.weekly_report_items || [];
  const columns = Math.max(1, Math.min(Number(options.columns) || 9, items.length || 1));
  const cardWidth = 106;
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
          <div class="weekly-poster-badge">
            <span class="weekly-poster-badge-icon">${getWeeklyBadge(days)}</span>
          </div>
          <div class="weekly-poster-name">${escapeHtml(item.display_name || '匿名')}</div>
        </div>
      </div>
      <div class="weekly-poster-card-text">
        <p>${escapeHtml(item.summary || '本周继续创作')}</p>
        <b>${escapeHtml(item.nickname_title || '继续创作中')}</b>
      </div>
      <div class="weekly-poster-date-line">
        ${renderMiniDateLine(report,item)}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
  <div class="weekly-poster-canvas"
    style="--poster-cols:${columns};--poster-card-width:${cardWidth}px;--poster-card-height:${cardHeight}px;--poster-card-gap:${gap}px;--poster-font:${weeklyPosterFontScale};width:${posterWidth}px;height:${posterHeight}px;">

    <div class="weekly-poster-left">
      <div class="weekly-poster-date-vertical">${formatPosterDate(report.start_date,report.end_date)}</div>
      <div class="weekly-poster-title-vertical">本<br>周<br>创<br>作<br>报<br>告</div>
      <div class="weekly-poster-event-box">
        <div class="weekly-poster-event-title">这周群里发生了啥</div>
        <div class="weekly-poster-event-content">${formatEventText(report.event_notes || '暂无事件记录')}</div>
      </div>
    </div>

    <div class="weekly-poster-main">
      <div class="weekly-poster-grid">
        ${cards}
      </div>
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
  if(days>=6)return '🔥';
  if(days>=4)return '⭐';
  if(days>=2)return '🎨';
  return '★';
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
