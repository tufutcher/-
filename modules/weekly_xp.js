import { loadWeeklyReports } from "../api/weekly_report.js";

// 只读汇总：历史周报作为 XP 数据源，按成员+自然日去重，跨周/月不会重复加分。
export function summarizeXp(reports, month){
  const persons = new Map();
  for(const report of reports || []){
    const multiplier = Math.max(1, Math.min(3, Number(report.challenge_multiplier) || 1));
    for(const item of report.weekly_report_items || []){
      const key = item.member_id || item.display_name;
      if(!key) continue;
      if(!persons.has(key)) persons.set(key, { id:key, name:item.display_name || "匿名", dates:new Map() });
      const person = persons.get(key);
      person.name = item.display_name || person.name;
      const write = (field, setter) => {
        for(const date of new Set(item[field] || [])){
          if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month)) continue;
          const row = person.dates.get(date) || {date,checkin:false,reflection:0,challenge:0};
          setter(row);
          person.dates.set(date,row);
        }
      };
      write("checkin_dates", d => { d.checkin = true; });
      write("reflection_dates", d => { d.reflection = Math.max(d.reflection, 10); });
      write("deep_reflection_dates", d => { d.reflection = 20; });
      write("challenge_dates", d => { d.challenge = Math.max(d.challenge, 10 * multiplier); });
    }
  }
  return Array.from(persons.values()).map(person => {
    const dates = Array.from(person.dates.values()).sort((a,b)=>a.date.localeCompare(b.date));
    return {
      id:person.id, name:person.name, dates,
      draw:dates.filter(d=>d.checkin).length,
      reflect:dates.filter(d=>d.reflection>0).length,
      deep:dates.filter(d=>d.reflection===20).length,
      challenge:dates.filter(d=>d.challenge>0).length,
      xp:dates.reduce((n,d)=>n+(d.checkin?10:0)+d.reflection+d.challenge,0)
    };
  }).filter(p=>p.dates.length).sort((a,b)=>b.xp-a.xp||a.name.localeCompare(b.name,"zh-CN"));
}

export async function openWeeklyXpOverview(){
  if(!document.getElementById("weekly-xp-styles")){
    const css = document.createElement("link");
    css.id = "weekly-xp-styles";
    css.rel = "stylesheet";
    css.href = "styles/weekly_xp.css";
    document.head.appendChild(css);
  }
  document.getElementById("weekly-xp-overview")?.remove();
  const modal = document.createElement("div");
  modal.id = "weekly-xp-overview";
  modal.className = "modal-bg";
  modal.innerHTML = `<div class="weekly-xp-dialog">
    <header><div><h2>月度 XP 统计</h2><p>读取已保存的周报，按成员及日期去重。XP 只是创作参与记录。</p></div>
    <button id="weekly-xp-close" type="button">关闭</button></header>
    <div class="weekly-xp-tools">
      <label>月份 <input id="weekly-xp-month" type="month"></label>
      <label>成员 <select id="weekly-xp-person"><option value="">全部成员</option></select></label>
      <button id="weekly-xp-reload" type="button">刷新数据</button>
    </div>
    <div id="weekly-xp-content"><p>正在读取…</p></div>
    <p class="weekly-xp-caution">历史周报中尚未录入的反思和挑战不会凭空补齐。本视图只统计已保存的数据。</p>
  </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => {if(e.target === modal) modal.remove();};
  modal.querySelector("#weekly-xp-close").onclick = ()=>modal.remove();
  const monthEl=modal.querySelector("#weekly-xp-month");
  const personEl=modal.querySelector("#weekly-xp-person");
  const now = new Date();
  monthEl.value = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  let reports=[];
  const display=()=>{
    const summary=summarizeXp(reports,monthEl.value);
    const oldChoice=personEl.value;
    personEl.innerHTML='<option value="">全部成员</option>'+summary.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join("");
    if(summary.some(p=>p.id===oldChoice)) personEl.value=oldChoice;
    const chosen=summary.filter(p=>!personEl.value || p.id===personEl.value);
    const wrap=modal.querySelector("#weekly-xp-content");
    if(!chosen.length){wrap.innerHTML='<p class="weekly-xp-empty">这个月份还没有 XP 记录。</p>';return;}
    wrap.innerHTML = `<div class="weekly-xp-rows">
      ${chosen.map((p,i)=>`<article class="weekly-xp-person">
        <div class="weekly-xp-rank"><span>${personEl.value?"":i+1+"."} ${escape(p.name)}</span><b>${p.xp} XP</b></div>
        <div class="weekly-xp-stats">绘画 ${p.draw} 天 · 反思 ${p.reflect} 天（深度 ${p.deep} 天） · 挑战 ${p.challenge} 天</div>
        <div class="weekly-xp-date-tags">${p.dates.map(d=>`<span title="${escape(d.date)}" class="${d.reflection===20?"weekly-xp-deep":""}">${Number(d.date.slice(8))}日 ${d.checkin?"画":""}${d.reflection===10?" 反":d.reflection===20?" 深":""}${d.challenge?" 挑":""}</span>`).join("")}</div>
      </article>`).join("")}
    </div>`;
  };
  const refresh=async()=>{
    modal.querySelector("#weekly-xp-content").innerHTML="<p>正在读取…</p>";
    try{reports=await loadWeeklyReports(window.__sb);display();}
    catch(err){console.error(err);modal.querySelector("#weekly-xp-content").textContent="统计失败，请确认数据库迁移已执行。";}
  };
  monthEl.onchange=display;
  personEl.onchange=display;
  modal.querySelector("#weekly-xp-reload").onclick=refresh;
  await refresh();
}
function escape(str){
  return String(str??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
