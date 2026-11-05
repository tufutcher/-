// 可编辑、可导出的个人创作月报。独立于个人主页渲染，不修改数据库。
// 评语及代表作品选择仅保存在当前浏览器本地。
import { loadProfileCheckins } from "../api/checkin.js";
import {
  buildPersonalMonthlyData, personalMonthKey, personalReportDataText
} from "./personal_report_data.js";

const PAPER_WIDTH=1120;
const DEFAULT_MAX_MONTH=()=>personalMonthKey(new Date());

function escapeHtml(value){
  return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function safeImageUrl(url){
  const value=String(url || "");
  return /^https?:\/\//i.test(value)?escapeHtml(value):"";
}
function formatMonthTitle(month){
  const [year, m]=month.split("-");
  return year+" 年 "+Number(m)+" 月";
}
function moveMonth(month, direction){
  const [y,m]=month.split("-").map(Number);
  return personalMonthKey(new Date(y,m-1+direction,1,12));
}
function saveLocal(key,data){
  try{localStorage.setItem(key,JSON.stringify(data));return true;}
  catch(error){console.warn("report local save unavailable",error);return false;}
}
function loadLocal(key,fallback){
  try{const val=localStorage.getItem(key);return val===null?fallback:JSON.parse(val);}
  catch(error){return fallback;}
}
function draftKey(profileId,month){return "creative-report-note-v1:"+profileId+":"+month;}
function artKey(profileId,month){return "creative-report-art-v1:"+profileId+":"+month;}

function sectionHeading(num,title,caption){
  return '<div class="analysis-section-heading"><span class="analysis-section-num">'+num+
    '</span><h2>'+title+'</h2><p>'+caption+'</p></div>';
}
function statusChange(change,unit=""){
  return change>0?"+"+change+unit:change<0?String(change)+unit:"持平";
}
function calendarMarkup(data){
  const blanks=Array.from({length:data.calendarOffset},()=>'<span class="analysis-day is-blank"></span>').join("");
  const days=data.days.map(day=>{
    const points=[
      day.reflection===10?'<i class="reflect"></i>':"",
      day.reflection===20?'<i class="deep"></i>':"",
      day.hasChallenge?'<i class="challenge"></i>':""
    ].join("");
    const description=[day.date,day.checkin?"打卡":"",day.reflection===10?"有效反思":"",
      day.reflection===20?"深度反思":"",day.hasChallenge?"主题挑战":""].filter(Boolean).join(" · ");
    return '<span class="analysis-day'+(day.checkin?" is-checkin":"")+
      (day.future?" is-future":"")+'" title="'+escapeHtml(description)+'"><b>'+day.day+
      '</b><span class="analysis-day-points">'+points+'</span></span>';
  }).join("");
  return '<div class="analysis-calendar"><div class="analysis-weekdays">'+
    ["一","二","三","四","五","六","日"].map(d=>'<span>'+d+'</span>').join("")+
    '</div><div class="analysis-calendar-grid">'+blanks+days+'</div></div>';
}
function weekGraph(data){
  const max=Math.max(1,...data.current.weeks.map(w=>w.days));
  return '<div class="analysis-week-chart">'+data.current.weeks.map((w)=>{
    const pct=w.days?Math.round(w.draw/w.days*100):0;
    return '<div class="analysis-week-row"><strong>'+w.label+'</strong>'+
      '<div class="analysis-week-track"><div class="analysis-week-fill" style="width:'+pct+'%"></div></div>'+
      '<b>'+w.draw+' / '+w.days+' 天</b></div>';
  }).join("")+'</div>';
}
function reportScore(data){
  return data.reportsLinked?data.current.xp.toLocaleString("zh-CN"):"—";
}
function reportValue(data,key,unit){
  return data.reportsLinked?data.current[key]+' '+unit:"—";
}
function featuredArt(data,selection){
  const selected=data.current.arts.filter(a=>selection.includes(a.id))
    .sort((a,b)=>selection.indexOf(a.id)-selection.indexOf(b.id)).slice(0,3);
  const cards=selected.map((a,i)=>
    '<div class="analysis-art"><img crossorigin="anonymous" src="'+safeImageUrl(a.url)+'" alt="代表作品 '+(i+1)+'">'+
    '<div class="analysis-art-label">作品记录 '+String(i+1).padStart(2,"0")+'</div></div>'
  );
  while(cards.length<3){
    cards.push('<div class="analysis-art is-empty"><div class="analysis-art-placeholder">＋<span>代表作品</span></div></div>');
  }
  return '<div class="analysis-art-grid">'+cards.join("")+'</div>';
}
function reportPaper(data,note,selection){
  const c=data.current;
  const tags=c.topTags.map(([tag,n])=>'<span>'+escapeHtml(tag)+'</span>').join("");
  const hasReport=data.reportsLinked;
  const reflectValue=hasReport?String(c.reflectDays):"—";
  const title=escapeHtml(data.name);
  const avatar=safeImageUrl(data.avatarUrl)
    ?'<img crossorigin="anonymous" src="'+safeImageUrl(data.avatarUrl)+'" alt="">'
    :'<span>'+title.slice(0,1)+'</span>';
  const rateChange=(data.difference>0?"↑ ":"")+(data.difference<0?"↓ ":"")+
    Math.abs(data.difference)+" 个百分点";
  const reflectionChange=hasReport?statusChange(c.reflectDays-data.previous.reflectDays," 天"):"—";
  const xpChange=hasReport?statusChange(c.xp-data.previous.xp," XP"):"—";
  const xpTotal=hasReport?c.xp:0;
  const xpSegments=[
    {title:"打卡",value:c.scoreParts.draw,colour:"#0CC0DF"},
    {title:"反思",value:c.scoreParts.reflection,colour:"#398CE6"},
    {title:"挑战",value:c.scoreParts.challenge,colour:"#ED5555"}
  ];
  const bar=hasReport&&xpTotal>0?xpSegments.map(x=>'<span style="width:'+
    (x.value/xpTotal*100).toFixed(3)+'%;background:'+x.colour+'"></span>').join(""):"";
  return '<article class="analysis-report-paper" id="analysis-report-paper">'+
    '<header class="analysis-report-header">'+
      '<div class="analysis-topline"><span>CREATIVE ACTIVITY REPORT</span><span>'+escapeHtml(data.month)+' / MONTHLY</span></div>'+
      '<div class="analysis-identity"><div class="analysis-avatar">'+avatar+'</div>'+
        '<div class="analysis-identity-copy"><p>PERSONAL CREATIVE REPORT</p>'+
          '<h1>'+title+'</h1><div class="analysis-identity-caption">'+formatMonthTitle(data.month)+
          ' · '+escapeHtml(data.periodCaption)+'</div></div></div>'+
      '<div class="analysis-summary-grid">'+
        '<div><span>打卡记录</span><strong>'+c.drawCount+'<small> / '+data.availableDays+' 天</small></strong>'+
          '<em>'+data.rate+'% 的已统计日期</em></div>'+
        '<div><span>本期最长连续</span><strong>'+c.maxStreak+'<small> 天</small></strong><em>按自然日连续计算</em></div>'+
        '<div><span>反思记录</span><strong>'+reflectValue+'<small>'+(hasReport?' 天':'')+'</small></strong><em>'+(hasReport?'包括深度反思':'周报记录尚不可用')+'</em></div>'+
        '<div><span>累计经验值</span><strong>'+reportScore(data)+'<small>'+(hasReport?' XP':'')+'</small></strong><em>依据已保存的周报</em></div>'+
      '</div>'+
    '</header>'+
    '<section class="analysis-report-section">'+sectionHeading("01","创作节奏","什么时候在画？记录是否连续？")+
      '<div class="analysis-rhythm-grid"><div>'+calendarMarkup(data)+'</div>'+
        '<div class="analysis-rhythm-sidebar"><div class="analysis-sidebar-title">每周打卡分布</div>'+
          weekGraph(data)+
          '<div class="analysis-cal-legend"><span><i class="draw"></i>打卡日期底色</span>'+
          '<span><i class="reflect"></i>有效反思</span>'+
          '<span><i class="deep"></i>深度反思</span>'+
          '<span><i class="challenge"></i>挑战</span></div></div></div>'+
      '<p class="analysis-observation">'+escapeHtml(data.observations.rhythm)+'</p>'+
    '</section>'+
    '<section class="analysis-report-section">'+sectionHeading("02","创作参与方式","除打卡外，还进行了多少反思与挑战？")+
      '<div class="analysis-engagement-grid">'+
        '<div><span>有效反思</span><strong>'+reportValue(data,"normalDays","天")+'</strong></div>'+
        '<div><span>深度反思</span><strong>'+reportValue(data,"deepDays","天")+'</strong></div>'+
        '<div><span>主题挑战</span><strong>'+reportValue(data,"challengeDays","次")+'</strong></div>'+
      '</div>'+
      '<div class="analysis-xp-composition"><div class="analysis-xp-head"><b>经验值来源</b><span>'+(hasReport?xpTotal+' XP':"尚未关联周报数据")+'</span></div>'+
      '<div class="analysis-xp-bar">'+bar+'</div>'+
      (hasReport?'<div class="analysis-xp-legend">'+xpSegments.map(x=>
        '<span><i style="background:'+x.colour+'"></i>'+x.title+' '+x.value+'</span>').join("")+'</div>':"")+
      '</div>'+
      '<p class="analysis-observation">'+escapeHtml(data.observations.engagement)+'</p>'+
    '</section>'+
    '<section class="analysis-report-section">'+sectionHeading("03","阶段变化与作品记录","相比上个周期，记录发生了哪些变化？")+
      '<div class="analysis-change-grid">'+
        '<div><span>打卡率变化</span><strong>'+rateChange+'</strong><small>'+data.previousRate+'% → '+data.rate+'%</small></div>'+
        '<div><span>反思天数变化</span><strong>'+reflectionChange+'</strong><small>'+(hasReport?data.previous.reflectDays+' → '+c.reflectDays+' 天':"无周报数据")+'</small></div>'+
        '<div><span>经验值变化</span><strong>'+xpChange+'</strong><small>'+(hasReport?data.previous.xp+' → '+c.xp+' XP':"无周报数据")+'</small></div>'+
      '</div>'+
      '<p class="analysis-compare-caption">比较对象：'+escapeHtml(data.previousMonth)+(data.month===DEFAULT_MAX_MONTH()?" 同期":" 全月")+
        '。仅对记录数量作比较，不推断绘画能力。</p>'+
      '<div class="analysis-works-title"><strong>本期作品记录</strong><span>上传图片 '+c.imageCount+' 张 · 自选最多 3 张代表作品</span></div>'+
      featuredArt(data,selection)+
      (tags?'<div class="analysis-top-tags"><span>常见标签</span>'+tags+'</div>':'')+
    '</section>'+
    '<section class="analysis-report-section is-commentary">'+
      sectionHeading("04","创作观察与评语","在这里粘贴并编辑 AI 生成的评语")+
      '<div id="analysis-note" class="analysis-note" contenteditable="true" role="textbox" aria-multiline="true" '+
      'data-placeholder="点击这里粘贴评语。可以分析本期创作节奏、实际作品表现与下一阶段计划。"></div>'+
      '<p class="analysis-privacy-hint">评语由你编辑；仅保存在此浏览器，不会自动提交给 AI。</p>'+
    '</section>'+
    '<footer class="analysis-report-footer"><b>不画画真的要完了</b><span>创作参与记录 · 非能力测评</span></footer>'+
  '</article>';
}

function pickerMarkup(data,selection){
  const list=data.current.arts.slice(0,80);
  if(!list.length)return '<p class="analysis-no-art">本月没有可选择的作品图片。</p>';
  return '<p>点击作品选择或取消，最多选择三张；只影响这份报告。</p>'+
    '<div class="analysis-picker-grid">'+list.map(a=>{
      const on=selection.includes(a.id);
      return '<button type="button" data-analysis-art="'+escapeHtml(a.id)+'" class="'+(on?"is-selected":"")+
        '" aria-pressed="'+on+'" title="'+escapeHtml(a.date)+'"><img loading="lazy" src="'+safeImageUrl(a.url)+'" alt="">'+
        '<span>'+(on?"已选":"选择")+'</span></button>';
    }).join("")+'</div>';
}
function attachCss(){
  if(document.getElementById("personal-report-css"))return;
  const link=document.createElement("link");link.id="personal-report-css";link.rel="stylesheet";
  link.href="styles/personal_report.css";document.head.appendChild(link);
}
async function exportPng(paper,button,data){
  if(typeof window.html2canvas!=="function")throw new Error("图片导出组件尚未加载，请刷新页面重试。");
  button.disabled=true;
  const original=button.textContent;
  button.textContent="生成长图中…";
  let stage=null,blobUrl="";
  try{
    stage=document.createElement("div");
    stage.className="analysis-export-stage";
    const clone=paper.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("is-exporting");
    clone.style.transform="none";
    clone.style.width=PAPER_WIDTH+"px";
    clone.style.minWidth=PAPER_WIDTH+"px";
    clone.style.maxWidth="none";
    const originalNote=paper.querySelector("#analysis-note");
    const cloneNote=clone.querySelector("#analysis-note");
    if(cloneNote){
      cloneNote.removeAttribute("contenteditable");
      cloneNote.removeAttribute("id");
      cloneNote.textContent=originalNote?.innerText || "";
    }
    stage.appendChild(clone);
    document.body.appendChild(stage);
    if(document.fonts?.ready)await document.fonts.ready;
    const images=Array.from(clone.querySelectorAll("img"));
    await Promise.all(images.map(img=>img.complete?Promise.resolve():
      new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const height=Math.ceil(clone.getBoundingClientRect().height);
    if(height<300)throw new Error("报告尺寸异常，无法导出。");
    const scale=Math.min(2,16000/height,Math.sqrt(45000000/(PAPER_WIDTH*height)));
    if(scale<.5)throw new Error("评语内容过长，超出浏览器单张图片限制。");
    const canvas=await window.html2canvas(clone,{
      backgroundColor:"#fff",scale,width:PAPER_WIDTH,height,windowWidth:1400,
      windowHeight:Math.max(900,height+40),scrollX:0,scrollY:0,useCORS:true,logging:false
    });
    const blob=await new Promise((resolve,reject)=>{
      canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG 编码失败")),"image/png");
    });
    blobUrl=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=blobUrl;
    a.download="个人创作分析_"+data.name.replace(/[\\/:*?"<>|]/g,"_")+"_"+data.month+".png";
    document.body.appendChild(a);a.click();a.remove();
    window.showToast?.("个人分析长图已导出","导出完成","success");
  }finally{
    stage?.remove();
    button.disabled=false;
    button.textContent=original;
    if(blobUrl)setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
  }
}

export async function openPersonalAnalysisReport(profile,fallbackCheckins=[]){
  if(!profile?.id){
    window.showToast?.("无法确定个人主页对应的成员","报告无法生成","error");
    return;
  }
  attachCss();
  document.getElementById("personal-analysis-overlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="personal-analysis-overlay";
  overlay.className="analysis-overlay";
  overlay.innerHTML='<div class="analysis-dialog">'+
    '<div class="analysis-toolbar"><div class="analysis-toolbar-title"><b>个人创作分析</b><span>数据自动整理 · 评语手动填写</span></div>'+
    '<div class="analysis-toolbar-actions"><button type="button" id="analysis-prev" title="上个月">‹</button>'+
    '<input type="month" id="analysis-month" aria-label="统计月份">'+
    '<button type="button" id="analysis-next" title="下个月">›</button>'+
    '<button type="button" id="analysis-pick">选择代表作品</button>'+
    '<button type="button" id="analysis-copy">复制分析数据</button>'+
    '<button type="button" id="analysis-export" class="is-primary">导出 PNG 长图</button>'+
    '<button type="button" id="analysis-close" aria-label="关闭分析报告">×</button></div></div>'+
    '<div class="analysis-picker" id="analysis-picker" hidden></div>'+
    '<div class="analysis-preview" id="analysis-preview"><p class="analysis-loading">正在整合个人打卡与周报数据…</p></div>'+
    '</div>';
  document.body.appendChild(overlay);

  let closed=false;
  const close=()=>{
    if(closed)return;
    closed=true;
    resizeObs?.disconnect();
    overlay.remove();
    document.removeEventListener("keydown",onKey);
  };
  function onKey(event){if(event.key==="Escape")close();}
  document.addEventListener("keydown",onKey);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
  overlay.querySelector("#analysis-close").onclick=close;

  const monthInput=overlay.querySelector("#analysis-month");
  monthInput.max=DEFAULT_MAX_MONTH();
  monthInput.value=DEFAULT_MAX_MONTH();
  let checkins=fallbackCheckins;
  let reports=[],reportsAvailable=false;
  let resizeObs=null;
  let data=null;
  let selection=[];
  let pickerOpen=false;

  function saveNote(){
    if(!data)return;
    const editor=overlay.querySelector("#analysis-note");
    if(!editor)return;
    saveLocal(draftKey(data.id,data.month),{text:editor.innerText || ""});
  }
  function syncScale(){
    const preview=overlay.querySelector("#analysis-preview");
    const wrap=preview.querySelector(".analysis-paper-wrap");
    const paper=wrap?.querySelector(".analysis-report-paper");
    if(!paper)return;
    const scale=Math.min(1,Math.max(.25,(preview.clientWidth-28)/PAPER_WIDTH));
    paper.style.transform="scale("+scale+")";
    wrap.style.width=Math.ceil(PAPER_WIDTH*scale)+"px";
    wrap.style.height=Math.ceil(paper.offsetHeight*scale)+"px";
  }
  function renderPicker(){
    const picker=overlay.querySelector("#analysis-picker");
    picker.hidden=!pickerOpen;
    if(!pickerOpen || !data)return;
    picker.innerHTML=pickerMarkup(data,selection);
    picker.querySelectorAll("[data-analysis-art]").forEach(button=>{
      button.onclick=()=>{
        const id=button.dataset.analysisArt;
        if(selection.includes(id))selection=selection.filter(x=>x!==id);
        else if(selection.length<3)selection=[...selection,id];
        else {
          window.showToast?.("最多选择三张代表作品","提示");return;
        }
        saveLocal(artKey(data.id,data.month),selection);
        saveNote();
        renderPaper(false);
        renderPicker();
      };
    });
  }
  function renderPaper(loadDraft=true){
    const preview=overlay.querySelector("#analysis-preview");
    if(loadDraft){
      const stored=loadLocal(artKey(data.id,data.month),null);
      const valid=new Set(data.current.arts.map(a=>a.id));
      selection=(Array.isArray(stored)?stored:data.current.arts.slice(0,3).map(a=>a.id))
        .filter(id=>valid.has(id)).slice(0,3);
    }
    const note=loadLocal(draftKey(data.id,data.month),{text:""});
    // When only changing artwork selection, keep the existing unsaved editor content.
    const existingNote=loadDraft?String(note?.text||""):
      String(preview.querySelector("#analysis-note")?.innerText??note?.text??"");
    preview.innerHTML='<div class="analysis-paper-wrap">'+reportPaper(data,existingNote,selection)+'</div>';
    const editor=preview.querySelector("#analysis-note");
    editor.textContent=existingNote;
    // AI 评语粘贴为纯文本，避免富文本样式破坏固定宽度的长图排版。
    editor.addEventListener("paste",event=>{
      event.preventDefault();
      const text=event.clipboardData?.getData("text/plain") || "";
      if(document.execCommand("insertText",false,text))return;
      const selection=window.getSelection();
      if(!selection?.rangeCount)return;
      const range=selection.getRangeAt(0);
      range.deleteContents();
      const node=document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      saveNote();
      requestAnimationFrame(syncScale);
    });
    editor.addEventListener("input",()=>{
      saveNote();
      requestAnimationFrame(syncScale);
    });
    resizeObs?.disconnect();
    if(typeof ResizeObserver!=="undefined"){
      resizeObs=new ResizeObserver(syncScale);
      resizeObs.observe(preview);
      resizeObs.observe(preview.querySelector(".analysis-report-paper"));
    }
    requestAnimationFrame(syncScale);
  }
  function rerenderMonth(){
    if(!monthInput.value)return;
    const month=monthInput.value>DEFAULT_MAX_MONTH()?DEFAULT_MAX_MONTH():monthInput.value;
    monthInput.value=month;
    try{
      data=buildPersonalMonthlyData({profile,checkins,reports,month,reportsAvailable});
      renderPaper(true);
      renderPicker();
      overlay.querySelector("#analysis-next").disabled=month>=DEFAULT_MAX_MONTH();
    }catch(error){
      console.error("monthly report error",error);
      overlay.querySelector("#analysis-preview").innerHTML='<p class="analysis-loading">无法生成该月份报告。</p>';
    }
  }
  monthInput.onchange=()=>{saveNote();rerenderMonth();};
  overlay.querySelector("#analysis-prev").onclick=()=>{
    saveNote();monthInput.value=moveMonth(monthInput.value,-1);rerenderMonth();
  };
  overlay.querySelector("#analysis-next").onclick=()=>{
    const next=moveMonth(monthInput.value,1);
    if(next>DEFAULT_MAX_MONTH())return;
    saveNote();monthInput.value=next;rerenderMonth();
  };
  overlay.querySelector("#analysis-pick").onclick=()=>{
    pickerOpen=!pickerOpen;renderPicker();
  };
  overlay.querySelector("#analysis-copy").onclick=async()=>{
    if(!data)return;
    const text=personalReportDataText(data);
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const input=document.createElement("textarea");input.value=text;
        input.style.position="fixed";input.style.opacity="0";
        document.body.appendChild(input);input.select();
        if(!document.execCommand("copy"))throw new Error("复制失败");
        input.remove();
      }
      window.showToast?.("统计资料已复制，可粘贴给 AI 生成评语","完成","success");
    }catch(error){window.showToast?.("复制失败，请检查浏览器剪贴板权限","错误","error");}
  };
  overlay.querySelector("#analysis-export").onclick=async e=>{
    if(!data)return;
    saveNote();
    try{await exportPng(overlay.querySelector("#analysis-report-paper"),e.currentTarget,data);}
    catch(error){
      console.error("personal report export failed",error);
      window.showToast?.("导出失败："+(error.message||"未知错误"),"错误","error");
    }
  };

  try{
    const sb=window.__sb;
    if(sb){
      const responses=await Promise.all([
        loadProfileCheckins(sb,profile),
        sb.from("weekly_reports").select("*,weekly_report_items(*)")
      ]);
      checkins=responses[0] || fallbackCheckins;
      const result=responses[1];
      if(!result.error){
        reports=result.data||[];reportsAvailable=true;
      }else{
        console.warn("personal report weekly records unavailable",result.error);
      }
    }
  }catch(error){
    console.warn("personal report data fetch failed",error);
  }
  if(closed)return;
  rerenderMonth();
}
