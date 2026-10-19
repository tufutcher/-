import { loadWeeklyReports } from "../api/weekly_report.js";

const WEEKDAYS = ["一","二","三","四","五","六","日"];

// 汇总区间内的 XP；同一成员同一天只计算一次同类型行为。
export function summarizeXp(reports, start, end){
  const persons = new Map();

  for(const report of reports || []){
    const multiplier = Math.max(1, Math.min(3, Number(report.challenge_multiplier) || 1));

    for(const item of report.weekly_report_items || []){
      const key = item.member_id || item.display_name;
      if(!key) continue;

      if(!persons.has(key)){
        persons.set(key, {id:key, name:item.display_name || "匿名", dates:new Map()});
      }

      const person = persons.get(key);
      if((!person.name || person.name === "匿名") && item.display_name){
        person.name = item.display_name;
      }

      const write = (field, setter) => {
        for(const date of new Set(normalizeDates(item[field]))){
          if(date < start || date > end) continue;
          const row = person.dates.get(date) || {
            date, checkin:false, reflection:0, challenge:0
          };
          setter(row);
          person.dates.set(date, row);
        }
      };

      write("checkin_dates", row => { row.checkin = true; });
      write("reflection_dates", row => { row.reflection = Math.max(row.reflection, 10); });
      write("deep_reflection_dates", row => { row.reflection = 20; });
      write("challenge_dates", row => { row.challenge = Math.max(row.challenge, 10 * multiplier); });
    }
  }

  return Array.from(persons.values()).map(person => {
    const dates = Array.from(person.dates.values()).sort((a,b) => a.date.localeCompare(b.date));
    return {
      id:person.id,
      name:person.name,
      dates,
      draw:dates.filter(day => day.checkin).length,
      reflect:dates.filter(day => day.reflection === 10).length,
      deep:dates.filter(day => day.reflection === 20).length,
      challenge:dates.filter(day => day.challenge > 0).length,
      xp:dates.reduce((total, day) => total + (day.checkin ? 10 : 0) + day.reflection + day.challenge, 0)
    };
  }).filter(person => person.dates.length)
    .sort((a,b) => b.xp - a.xp || b.draw - a.draw || a.name.localeCompare(b.name, "zh-CN"));
}

export async function openWeeklyXpOverview(initialMode = "month"){
  ensureStyles();
  document.getElementById("weekly-xp-overview")?.remove();

  const modal = document.createElement("div");
  modal.id = "weekly-xp-overview";
  modal.className = "modal-bg weekly-xp-overlay";
  modal.innerHTML = `
    <div class="weekly-xp-dialog">
      <div class="weekly-xp-controls">
        <header class="weekly-xp-toolbar-head">
          <div>
            <p class="weekly-xp-eyebrow">CREATIVE PARTICIPATION</p>
            <h2>XP 排行榜</h2>
            <p>按已保存的周报日期统计；不评价绘画水平，只记录创作参与。</p>
          </div>
          <button id="weekly-xp-close" type="button" class="weekly-xp-quiet-button">关闭</button>
        </header>
        <div class="weekly-xp-toolbar">
          <div class="weekly-xp-mode-switch">
            <button id="weekly-xp-mode-week" type="button">周度 XP</button>
            <button id="weekly-xp-mode-month" type="button">月度 XP</button>
          </div>
          <label id="weekly-xp-week-control">选择本周日期 <input id="weekly-xp-date" type="date"></label>
          <label id="weekly-xp-month-control">统计月份 <input id="weekly-xp-month" type="month"></label>
          <label>成员 <select id="weekly-xp-person"><option value="">全部成员</option></select></label>
          <div class="weekly-xp-toolbar-actions">
            <button id="weekly-xp-prev" type="button" aria-label="上一期">‹</button>
            <button id="weekly-xp-next" type="button" aria-label="下一期">›</button>
            <button id="weekly-xp-reload" type="button">刷新</button>
            <button id="weekly-xp-poster-toggle" type="button" class="weekly-xp-primary-button">全图海报模式</button>
          </div>
        </div>
      </div>
      <div id="weekly-xp-poster-wrap"><p class="weekly-xp-loading">正在读取 XP 记录…</p></div>
      <button id="weekly-xp-exit-poster" type="button">退出海报模式（Esc）</button>
    </div>`;

  document.body.appendChild(modal);

  const weekInput = modal.querySelector("#weekly-xp-date");
  const monthInput = modal.querySelector("#weekly-xp-month");
  const personInput = modal.querySelector("#weekly-xp-person");
  const weekButton = modal.querySelector("#weekly-xp-mode-week");
  const monthButton = modal.querySelector("#weekly-xp-mode-month");
  const weekControl = modal.querySelector("#weekly-xp-week-control");
  const monthControl = modal.querySelector("#weekly-xp-month-control");
  const posterToggle = modal.querySelector("#weekly-xp-poster-toggle");
  const exitPoster = modal.querySelector("#weekly-xp-exit-poster");

  const now = new Date();
  weekInput.value = formatDate(now);
  monthInput.value = formatMonth(now);
  let mode = initialMode === "week" ? "week" : "month";
  let reports = [];
  let currentSummary = [];

  const close = () => {
    document.removeEventListener("keydown", keyHandler);
    modal.remove();
  };

  const keyHandler = event => {
    if(event.key === "Escape"){
      if(modal.classList.contains("poster-mode")){
        setPosterMode(false);
      }else{
        close();
      }
    }
  };

  modal.querySelector("#weekly-xp-close").onclick = close;
  modal.onclick = event => {
    if(event.target === modal && !modal.classList.contains("poster-mode")) close();
  };
  document.addEventListener("keydown", keyHandler);

  function setPosterMode(enabled){
    modal.classList.toggle("poster-mode", enabled);
    posterToggle.textContent = enabled ? "海报模式已开启" : "全图海报模式";
    exitPoster.style.display = enabled ? "block" : "none";
    if(enabled) modal.scrollTop = 0;
  }

  function setMode(nextMode){
    mode = nextMode;
    weekButton.classList.toggle("is-active", mode === "week");
    monthButton.classList.toggle("is-active", mode === "month");
    weekControl.style.display = mode === "week" ? "flex" : "none";
    monthControl.style.display = mode === "month" ? "flex" : "none";
    render();
  }

  function getPeriod(){
    if(mode === "week"){
      const range = getWeekRange(weekInput.value || formatDate(new Date()));
      return {
        start:range.start,
        end:range.end,
        title:"周度创作 XP 排行榜",
        subtitle:`${formatDotDate(range.start)} — ${formatDotDate(range.end)}`,
        label:"本周统计"
      };
    }

    const month = monthInput.value || formatMonth(new Date());
    const [year, monthNumber] = month.split("-").map(Number);
    const start = `${month}-01`;
    const end = formatDate(new Date(year, monthNumber, 0, 12));
    return {
      start,
      end,
      title:"月度创作 XP 排行榜",
      subtitle:`${year} 年 ${String(monthNumber).padStart(2,"0")} 月`,
      label:"本月统计"
    };
  }

  function render(){
    const period = getPeriod();
    const summary = summarizeXp(reports, period.start, period.end);

    // 周榜按本周 XP 排名，同时展示本月此前累计 + 本周新增。
    if(mode === "week"){
      const selectedDate = parseLocalDate(weekInput.value || formatDate(new Date()));
      const monthStart = `${formatMonth(selectedDate)}-01`;
      const priorEndDate = parseLocalDate(period.start);
      priorEndDate.setDate(priorEndDate.getDate() - 1);
      const priorEnd = formatDate(priorEndDate);
      const priorById = new Map(
        summarizeXp(reports, monthStart, priorEnd).map(person => [person.id, person.xp])
      );
      summary.forEach(person => {
        person.xpBeforeWeek = priorById.get(person.id) || 0;
        person.weekXp = person.xp;
      });
    }else{
      summary.forEach(person => {
        person.xpBeforeWeek = 0;
        person.weekXp = person.xp;
      });
    }
    currentSummary = summary;

    const previousMember = personInput.value;
    personInput.innerHTML = '<option value="">全部成员</option>' +
      summary.map(person => `<option value="${escapeAttr(person.id)}">${escapeHtml(person.name)}</option>`).join("");
    if(summary.some(person => person.id === previousMember)) personInput.value = previousMember;

    const chosen = summary.filter(person => !personInput.value || person.id === personInput.value);
    const wrap = modal.querySelector("#weekly-xp-poster-wrap");

    if(!chosen.length){
      wrap.innerHTML = `
        <section class="weekly-xp-poster weekly-xp-poster-empty">
          <div class="weekly-xp-poster-brand">不画画真的要完了 · 创作参与记录</div>
          <h1>${escapeHtml(period.title)}</h1>
          <p>${escapeHtml(period.subtitle)}</p>
          <div class="weekly-xp-empty-state">这个统计周期还没有 XP 记录。</div>
        </section>`;
      return;
    }

    const metrics = {
      people:chosen.length,
      xp:chosen.reduce((total, person) => total + person.xp, 0),
      draw:chosen.reduce((total, person) => total + person.draw, 0),
      reflect:chosen.reduce((total, person) => total + person.reflect + person.deep, 0),
      challenge:chosen.reduce((total, person) => total + person.challenge, 0)
    };

    wrap.innerHTML = `
      <section class="weekly-xp-poster" id="weekly-xp-poster">
        <div class="weekly-xp-poster-header">
          <div>
            <div class="weekly-xp-poster-brand">不画画真的要完了 <span>CREATIVE LOG · XP</span></div>
            <h1>${escapeHtml(period.title)}</h1>
            <p class="weekly-xp-period">${escapeHtml(period.subtitle)}</p>
          </div>
          <div class="weekly-xp-poster-mark">XP<br><span>RANKING</span></div>
        </div>

        <div class="weekly-xp-overview-metrics">
          ${metricCard("参与成员", metrics.people, "人")}
          ${metricCard(mode === "week" ? "本周 XP" : "累计 XP", metrics.xp, "XP")}
          ${metricCard("绘画打卡", metrics.draw, "人·天")}
          ${metricCard("反思记录", metrics.reflect, "人·天")}
        </div>

        <div class="weekly-xp-ranking-list">
          ${chosen.map((person, index) => renderPersonRow(person, index, period, mode)).join("")}
        </div>

        <footer class="weekly-xp-poster-footer">
          <div class="weekly-xp-legend">
            <span><i class="draw"></i>打卡 +10</span>
            <span><i class="reflect"></i>有效反思 +10</span>
            <span><i class="deep"></i>深度反思 +20</span>
            <span><i class="challenge"></i>主题挑战 +10 × 倍率</span>
          </div>
          <p>XP 仅记录创作参与，不代表绘画水平。每月重新累计，历史记录保留。</p>
        </footer>
      </section>`;
  }

  weekButton.onclick = () => setMode("week");
  monthButton.onclick = () => setMode("month");
  weekInput.onchange = render;
  monthInput.onchange = render;
  personInput.onchange = render;
  modal.querySelector("#weekly-xp-prev").onclick = () => movePeriod(-1);
  modal.querySelector("#weekly-xp-next").onclick = () => movePeriod(1);
  modal.querySelector("#weekly-xp-reload").onclick = refresh;
  posterToggle.onclick = () => setPosterMode(!modal.classList.contains("poster-mode"));
  exitPoster.onclick = () => setPosterMode(false);

  function movePeriod(direction){
    if(mode === "week"){
      const date = parseLocalDate(weekInput.value || formatDate(new Date()));
      date.setDate(date.getDate() + direction * 7);
      weekInput.value = formatDate(date);
    }else{
      const [year, month] = (monthInput.value || formatMonth(new Date())).split("-").map(Number);
      monthInput.value = formatMonth(new Date(year, month - 1 + direction, 1, 12));
    }
    render();
  }

  async function refresh(){
    modal.querySelector("#weekly-xp-poster-wrap").innerHTML = '<p class="weekly-xp-loading">正在读取 XP 记录…</p>';
    try{
      reports = await loadWeeklyReports(window.__sb);
      render();
    }catch(error){
      console.error("load XP report data error:", error);
      modal.querySelector("#weekly-xp-poster-wrap").innerHTML = '<p class="weekly-xp-error">统计失败，请检查数据库迁移和访问权限。</p>';
    }
  }

  setMode(mode);
  await refresh();
}

function renderPersonRow(person, index, period, mode){
  const calendar = renderMiniCalendar(person, period.start, period.end, mode);
  const badges = renderXpBadges(person, period.start, period.end, mode);
  const score = mode === "week"
    ? `<span class="weekly-xp-score-breakdown"><span>${person.xpBeforeWeek || 0}</span><span class="weekly-xp-score-plus">+</span><b>${person.weekXp ?? person.xp}</b><small>XP</small></span>`
    : `<span class="weekly-xp-score-breakdown"><b>${person.xp}</b><small>XP</small></span>`;
  return `
    <article class="weekly-xp-person-row">
      <div class="weekly-xp-rank-marker" aria-hidden="true"></div>
      <div class="weekly-xp-member">
        <div class="weekly-xp-member-heading">
          <strong>${escapeHtml(person.name)}</strong>
          <div class="weekly-xp-badges" aria-label="${mode === "week" ? "本周打卡徽章" : "本月打卡徽章"}">${badges}</div>
        </div>
      </div>
      <div class="weekly-xp-counts">
        <span class="weekly-xp-count-draw">打卡 <b>${person.draw}</b> 天</span>
        <span><i class="reflect"></i>有效反思 <b>${person.reflect}</b> 天</span>
        <span><i class="deep"></i>深度反思 <b>${person.deep}</b> 天</span>
        <span><i class="challenge"></i>挑战 <b>${person.challenge}</b> 天</span>
      </div>
      <div class="weekly-xp-calendar-wrap">${calendar}</div>
      <div class="weekly-xp-score">${score}</div>
    </article>`;
}
function renderXpBadges(person, start, end, mode){
  const checkins = new Set(person.dates.filter(day => day.checkin && day.date >= start && day.date <= end).map(day => day.date));
  const dates = getDateRange(start, end);
  const groups = [];

  if(mode === "week"){
    groups.push(dates);
  }else{
    const firstOffset = (parseLocalDate(start).getDay() + 6) % 7;
    const grouped = new Map();
    dates.forEach((date, index) => {
      const weekIndex = Math.floor((firstOffset + index) / 7);
      if(!grouped.has(weekIndex)) grouped.set(weekIndex, []);
      grouped.get(weekIndex).push(date);
    });
    groups.push(...grouped.values());
  }

  return groups.map(weekDates => {
    const count = weekDates.filter(date => checkins.has(date)).length;
    return getCheckinBadge(count);
  }).filter(Boolean).map(badge => {
    const content = badge.dot ? '<i class="weekly-xp-badge-dot"></i>' : badge.icon;
    return `<span class="weekly-xp-badge is-${badge.tone}" title="${badge.label}">${content}</span>`;
  }).join("");
}

function getCheckinBadge(days){
  if(days === 7) return {icon:"🎨", label:"打卡 7 天", tone:"purple"};
  if(days >= 5) return {icon:"🔥", label:`打卡 ${days} 天`, tone:"red"};
  if(days >= 3) return {icon:"⭐", label:`打卡 ${days} 天`, tone:"yellow"};
  if(days >= 1) return {icon:"", label:`打卡 ${days} 天`, tone:"muted", dot:true};
  return null;
}

function renderMiniCalendar(person, start, end, mode){
  const dates = getDateRange(start, end);
  const records = new Map(person.dates.map(day => [day.date, day]));
  const first = parseLocalDate(start);
  const leading = mode === "month" ? (first.getDay() + 6) % 7 : 0;
  const blanks = Array.from({length:leading}, () => '<span class="weekly-xp-day is-blank"></span>').join("");
  const cells = dates.map(date => {
    const day = records.get(date);
    const dots = day ? [
      day.checkin ? '<i class="draw"></i>' : "",
      day.reflection === 10 ? '<i class="reflect"></i>' : "",
      day.reflection === 20 ? '<i class="deep"></i>' : "",
      day.challenge ? '<i class="challenge"></i>' : ""
    ].join("") : "";
    const active = day && (day.checkin || day.reflection || day.challenge);
    const title = [
      date,
      day?.checkin ? "绘画打卡" : "",
      day?.reflection === 10 ? "有效反思" : "",
      day?.reflection === 20 ? "深度反思" : "",
      day?.challenge ? "主题挑战" : ""
    ].filter(Boolean).join(" · ");
    return `<span class="weekly-xp-day ${active ? "is-active" : ""}" title="${escapeAttr(title)}"><b>${Number(date.slice(-2))}</b><span>${dots}</span></span>`;
  }).join("");

  return `
    <div class="weekly-xp-mini-calendar ${mode === "week" ? "is-week" : "is-month"}">
      <div class="weekly-xp-weekdays">${WEEKDAYS.map(day => `<span>${day}</span>`).join("")}</div>
      <div class="weekly-xp-calendar-grid">${blanks}${cells}</div>
    </div>`;
}

function metricCard(label, value, unit){
  return `<div class="weekly-xp-metric"><span>${label}</span><strong>${Number(value).toLocaleString("zh-CN")}</strong><small>${unit}</small></div>`;
}

function getWeekRange(value){
  const start = parseLocalDate(value);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {start:formatDate(start), end:formatDate(end)};
}

function getDateRange(start, end){
  const dates = [];
  if(!start || !end) return dates;
  const current = parseLocalDate(start);
  const last = parseLocalDate(end);
  while(current <= last){
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function normalizeDates(values){
  if(!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value || "").slice(0,10)).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)))];
}

function parseLocalDate(value){
  const parts = String(value || "").split("-").map(Number);
  return new Date(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1, 12);
}

function formatDate(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function formatMonth(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}

function formatDotDate(date){
  return String(date || "").replaceAll("-", ".");
}

function ensureStyles(){
  if(document.getElementById("weekly-xp-styles")) return;
  const link = document.createElement("link");
  link.id = "weekly-xp-styles";
  link.rel = "stylesheet";
  link.href = "styles/weekly_xp.css";
  document.head.appendChild(link);
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

function escapeAttr(value){
  return escapeHtml(value).replaceAll("`","&#096;");
}
