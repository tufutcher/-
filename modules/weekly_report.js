import {
  loadWeeklyReports,
  createWeeklyReport,
  deleteWeeklyReport
} from "../api/weekly_report.js";

import { openWeeklyEditor } from "./weekly_editor.js";
import {
  renderWeeklyPoster,
  setPosterFontScale
} from "./weekly_poster.js";


let weeklyReportsCache = [];

let weeklyPosterColumns = 9;



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

<input
id="weekly-title"
value="本周创作报告">

</label>



<label>
开始日期

<input
id="weekly-start"
type="date">

</label>



<label>
结束日期

<input
id="weekly-end"
type="date">

</label>



<label>
主题色

<input
id="weekly-color"
type="color"
value="#ff6a16">

</label>



<label>
本周事件

<textarea
id="weekly-events"
placeholder="写这周群里发生了什么。">

</textarea>

</label>



<label>
贡献者

<input
id="weekly-contributors"
placeholder="例如：安夏、古鸟">

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




<div id="weekly-report-list"></div>



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

list.innerHTML = `

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

${count}

人

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


btn.onclick = ()=>{


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


btn.onclick = ()=>{


openWeeklyPreview(
btn.dataset.weeklyPreview
);


};


});







document
.querySelectorAll("[data-weekly-delete]")
.forEach(btn=>{


btn.onclick = async()=>{


const reportId =
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
reportId
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



const startDate =
document
.getElementById("weekly-start")
.value;



const endDate =
document
.getElementById("weekly-end")
.value;



if(!startDate || !endDate){

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

start_date:startDate,

end_date:endDate,

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



await renderWeeklyReportList();


}

export function openWeeklyPreview(reportId){


const report =
weeklyReportsCache.find(
x=>x.id===reportId
);


if(!report){

window.showToast?.(
"找不到周报",
"错误",
"error"
);

return;

}



const old =
document.getElementById(
"weekly-preview"
);


if(old){

old.remove();

}



const modal =
document.createElement("div");


modal.id =
"weekly-preview";


modal.className =
"modal-bg detail-viewer-bg";



modal.innerHTML = `

<div class="weekly-preview-card">


<div id="weekly-poster-wrap"></div>



<div class="weekly-preview-actions">


<label class="weekly-column-control">

每行人数


<select id="weekly-column-select">

<option value="6">6</option>

<option value="7">7</option>

<option value="8">8</option>

<option value="9" selected>9</option>

<option value="10">10</option>

</select>


</label>



<label class="weekly-column-control">

字体大小


<select id="weekly-font-scale-select">

<option value="1">
普通
</option>


<option value="1.2">
大
</option>


<option value="1.4" selected>
特大
</option>


</select>


</label>



<button id="weekly-export-image">

导出图片

</button>



<button id="weekly-preview-close">

关闭

</button>



</div>



</div>

`;



document.body.appendChild(modal);




renderPoster(modal,report);





const columnSelect =
modal.querySelector(
"#weekly-column-select"
);



if(columnSelect){


columnSelect.onchange = ()=>{


weeklyPosterColumns =
Number(columnSelect.value);


renderPoster(
modal,
report
);


};


}





const fontSelect =
modal.querySelector(
"#weekly-font-scale-select"
);



if(fontSelect){


fontSelect.onchange = ()=>{


setPosterFontScale(
Number(fontSelect.value)
);


renderPoster(
modal,
report
);


};


}







const exportBtn =
modal.querySelector(
"#weekly-export-image"
);



if(exportBtn){


exportBtn.onclick =
async()=>{


const poster =
modal.querySelector(
".weekly-poster-canvas"
);



if(!poster){

return;

}




if(
typeof html2canvas === "undefined"
){


window.showToast?.(
"缺少图片导出组件",
"失败",
"error"
);


return;


}





exportBtn.disabled=true;

exportBtn.textContent=
"生成中...";





try{


const canvas =
await html2canvas(
poster,
{

scale:2,

backgroundColor:
report.theme_color || "#ff6a16",

useCORS:true

}

);




const link =
document.createElement("a");



link.download =
"weekly-report.png";



link.href =
canvas.toDataURL(
"image/png"
);



link.click();



window.showToast?.(
"周报图片已生成",
"完成",
"success"
);



}

catch(err){


console.error(
"export weekly poster error:",
err
);



window.showToast?.(
"图片生成失败",
"错误",
"error"
);



}

finally{


exportBtn.disabled=false;

exportBtn.textContent=
"导出图片";


}


};


}






const close =
modal.querySelector(
"#weekly-preview-close"
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


}





function renderPoster(modal,report){


const wrap =
modal.querySelector(
"#weekly-poster-wrap"
);



if(!wrap)return;



renderWeeklyPoster(
report,
wrap,
{

columns:
weeklyPosterColumns

}

);


}






function escapeHtml(value){


return String(value || "")

.replaceAll(
"&",
"&amp;"
)

.replaceAll(
"<",
"&lt;"
)

.replaceAll(
">",
"&gt;"
)

.replaceAll(
'"',
"&quot;"
)

.replaceAll(
"'",
"&#039;"
);


}
