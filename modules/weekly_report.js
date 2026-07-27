import {
  loadWeeklyReports,
  createWeeklyReport,
  deleteWeeklyReport
} from "../api/weekly_report.js";

import { openWeeklyEditor } from "./weekly_editor.js";


let weeklyReportsCache = [];


// 海报配置
let weeklyPosterColumns = 9;
let weeklyPosterImageFit = "cover";
let weeklyPosterImagePosition = "center";
let weeklyPosterFontScale = 1.4;



export async function openWeeklyReportManager(){

  const old =
    document.getElementById(
      "weekly-report-manager"
    );

  if(old){
    old.remove();
  }


  const modal =
    document.createElement("div");


  modal.id =
    "weekly-report-manager";


  modal.className =
    "modal-bg detail-viewer-bg";



  modal.innerHTML = `

<div class="weekly-manager-card">


<div class="weekly-manager-head">

<div>

<h2>
周报生成器
</h2>

<p>
创建周报、录入成员打卡日期，并生成周报海报。
</p>

</div>


<button id="weekly-close">
关闭
</button>


</div>



<div class="weekly-create-box">


<label>
标题

<input id="weekly-title"
value="本周创作报告">

</label>



<label>
开始日期

<input id="weekly-start"
type="date">

</label>



<label>
结束日期

<input id="weekly-end"
type="date">

</label>



<label>
主题色

<input id="weekly-color"
type="color"
value="#ff6a16">

</label>



<label>
本周事件

<textarea id="weekly-events"></textarea>

</label>



<label>
贡献者

<input id="weekly-contributors">

</label>



<button id="weekly-create">
新建周报
</button>


</div>




<div class="weekly-list-head">

<h3>
已有周报
</h3>


<button id="weekly-refresh">
刷新
</button>


</div>



<div id="weekly-report-list">

</div>



</div>

`;



document.body.appendChild(modal);


bindWeeklyBaseEvents(modal);


await renderWeeklyReportList();

}



function bindWeeklyBaseEvents(modal){


const close =
modal.querySelector(
"#weekly-close"
);


if(close){

close.onclick =
()=>modal.remove();

}



modal.onclick =
e=>{

if(e.target===modal){

modal.remove();

}

};



const refresh =
modal.querySelector(
"#weekly-refresh"
);



if(refresh){

refresh.onclick =
async()=>{

await renderWeeklyReportList();

};

}



const create =
modal.querySelector(
"#weekly-create"
);



if(create){

create.onclick =
async()=>{

await handleCreateWeeklyReport();

};

}


}




async function renderWeeklyReportList(){


const list =
document.getElementById(
"weekly-report-list"
);


if(!list)return;



weeklyReportsCache =
await loadWeeklyReports(
window.__sb
);



if(!weeklyReportsCache.length){

list.innerHTML =
`
<div class="weekly-empty">
还没有周报。
</div>
`;

return;

}



list.innerHTML =
weeklyReportsCache.map(report=>{


const count =
report.weekly_report_items?.length || 0;



return `

<div class="weekly-report-row">


<div>

<strong>
${escapeHtml(report.title)}
</strong>


<p>
${report.start_date}
-
${report.end_date}

·

${count} 人

</p>


</div>



<div class="weekly-row-actions">


<button
data-weekly-open="${report.id}">
编辑
</button>



<button
data-weekly-preview="${report.id}">
预览
</button>



<button
data-weekly-delete="${report.id}">
删除
</button>


</div>


</div>

`;



}).join("");



bindWeeklyListEvents();


}



function bindWeeklyListEvents(){


document
.querySelectorAll("[data-weekly-open]")
.forEach(btn=>{


btn.onclick=()=>{


const report =
weeklyReportsCache.find(
x=>x.id===btn.dataset.weeklyOpen
);



if(report){

openWeeklyEditor(report);

}


};


});



document
.querySelectorAll("[data-weekly-preview]")
.forEach(btn=>{


btn.onclick=()=>{

openWeeklyPreview(
btn.dataset.weeklyPreview
);

};


});



document
.querySelectorAll("[data-weekly-delete]")
.forEach(btn=>{


btn.onclick=async()=>{


const id =
btn.dataset.weeklyDelete;



const ok =
await window.showConfirm?.({

title:"删除周报？",

message:
"删除这一期周报。",

confirmText:"删除",

cancelText:"取消"

});



if(!ok)return;



const success =
await deleteWeeklyReport(
window.__sb,
id
);



if(success){

window.showToast?.(
"周报已删除",
"完成",
"success"
);


await renderWeeklyReportList();


}


};


});


}




async function handleCreateWeeklyReport(){


const title =
document
.getElementById("weekly-title")
.value
.trim()
||
"本周创作报告";



const start =
document
.getElementById("weekly-start")
.value;



const end =
document
.getElementById("weekly-end")
.value;



if(!start || !end){

window.showToast?.(
"请选择日期",
"失败",
"error"
);

return;

}



const result =
await createWeeklyReport(
window.__sb,
{

title,

start_date:start,

end_date:end,

theme_color:
document.getElementById("weekly-color").value,

event_notes:
document.getElementById("weekly-events").value,

contributors:
document.getElementById("weekly-contributors").value

}

);



if(result.error){

window.showToast?.(
"创建失败",
"错误",
"error"
);

return;

}



window.showToast?.(
"周报创建成功",
"完成",
"success"
);

function renderWeeklyPoster(report, modal){

  const wrap =
    modal.querySelector(
      "#weekly-poster-wrap"
    );


  if(!wrap)return;



  const items =
    report.weekly_report_items || [];



  const columns =
    Math.max(
      1,
      Math.min(
        weeklyPosterColumns,
        items.length || 1
      )
    );



  const rows =
    Math.ceil(
      items.length / columns
    );



  const cardWidth = 110;
  const cardHeight = 360;
  const gap = 8;



  const posterWidth =
    260 +
    columns *
    cardWidth +
    (columns - 1) *
    gap +
    80;



  const posterHeight =
    Math.max(
      900,
      rows *
      cardHeight +
      80
    );



  const cards =
    items.map(item=>{


      const days =
        item.checkin_dates?.length || 0;


      return `

<div class="poster-member-card">


<div class="poster-image">

${
item.cover_image_url

?

`
<img 
src="${item.cover_image_url}"
crossorigin="anonymous">
`

:

`
<div class="empty-img">
暂无图片
</div>
`

}


</div>



<h3>
${escapeHtml(item.display_name || "匿名")}
</h3>



<div class="poster-summary">

${escapeHtml(
item.summary ||
"本周继续创作"
)}

</div>



<div class="poster-days">

${
renderMiniDateLine(
report,
item
)
}

</div>



<div class="poster-title-tag">

「
${escapeHtml(
item.nickname_title ||
"继续创作中"
)}
」

</div>


</div>

`;



}).join("");





wrap.innerHTML = `


<div 
class="weekly-poster-canvas"

style="
--poster-columns:${columns};
--poster-card-width:${cardWidth}px;
--poster-card-height:${cardHeight}px;
--poster-gap:${gap}px;
--poster-fit:${weeklyPosterImageFit};
--poster-position:${weeklyPosterImagePosition};
--poster-font:${weeklyPosterFontScale};
width:${posterWidth}px;
height:${posterHeight}px;
">


<div class="poster-left">


<div class="poster-date">

${formatPosterDate(
report.start_date,
report.end_date
)}

</div>



<div class="poster-title">

本<br>
周<br>
创<br>
作<br>
报<br>
告

</div>



<div class="poster-event">


<h3>
这周群里发生了啥
</h3>


<p>
${formatEventText(
report.event_notes ||
"暂无事件记录"
)}

</p>


</div>



</div>




<div class="poster-members">

${cards}

</div>




<div class="poster-right">

不<br>
画<br>
画<br>
真<br>
的<br>
要<br>
完<br>
了


</div>



</div>


`;

}





function renderMiniDateLine(report,item){

  const dates =
    getDateRange(
      report.start_date,
      report.end_date
    );


  const checked =
    item.checkin_dates || [];



  return dates.map(date=>{


    const active =
      checked.includes(date);



    return `

<span class="${active ? "active" : ""}">
${new Date(date).getDate()}
</span>

`;



  }).join("");

}




function getDateRange(start,end){

  const result=[];


  let current =
    new Date(start);


  const last =
    new Date(end);



  while(current<=last){


    result.push(
      current.getFullYear()
      +
      "-"
      +
      String(
        current.getMonth()+1
      ).padStart(2,"0")
      +
      "-"
      +
      String(
        current.getDate()
      ).padStart(2,"0")
    );



    current.setDate(
      current.getDate()+1
    );


  }


  return result;

}





function formatPosterDate(start,end){

  return (
    start.replaceAll("-",".")
    +
    " - "
    +
    end.replaceAll("-",".")
  );

}



function formatEventText(text){

  return escapeHtml(text)
  .replaceAll(
    "\n",
    "<br>"
  );

}




function escapeHtml(value){

  return String(value || "")

  .replaceAll("&","&amp;")

  .replaceAll("<","&lt;")

  .replaceAll(">","&gt;")

  .replaceAll('"',"&quot;")

  .replaceAll("'","&#039;");

}

await renderWeeklyReportList();


}

