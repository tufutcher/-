import {
  saveWeeklyReportItems,
  uploadWeeklyCover,
  findOrCreateMember
} from "../api/weekly_report.js";


let weeklyPosterColumns = 9;
let weeklyPosterFontScale = 1.4;
let weeklyPosterImageFit = "cover";
let weeklyPosterImagePosition = "center";



export function openWeeklyEditor(report){

  const old =
    document.getElementById("weekly-editor");

  if(old){
    old.remove();
  }


  const modal =
    document.createElement("div");


  modal.id = "weekly-editor";

  modal.className =
    "modal-bg detail-viewer-bg";



  modal.innerHTML = `

<div class="weekly-editor-layout">


<!-- 左侧 -->

<div class="weekly-editor-sidebar">


<h2>
编辑周报
</h2>



<section class="editor-section">

<h3>
海报设置
</h3>


<label>
主题色

<input
id="editor-color"
type="color"
value="${report.theme_color || "#ff6a16"}"
>

</label>



<label>
每行人数

<select id="editor-columns">

<option value="6">6</option>
<option value="7">7</option>
<option value="8">8</option>
<option value="9" selected>9</option>
<option value="10">10</option>

</select>

</label>



<label>
字体大小

<select id="editor-font">

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


</section>





<section class="editor-section">


<div class="editor-section-title">

成员管理

<button
id="editor-add-member"
type="button">
+
</button>


</div>



<div id="editor-member-list">

</div>



</section>





<div class="editor-actions">


<button
id="editor-save"
type="button">
保存周报
</button>



<button
id="editor-export"
type="button">
导出图片
</button>



<button
id="editor-close"
type="button">
关闭
</button>


</div>



</div>





<!-- 右侧 -->


<div class="weekly-editor-preview">


<div id="editor-poster">

</div>


</div>



</div>


`;



document.body.appendChild(modal);



renderEditorMembers(report);

renderEditorPoster(report);


bindEditorEvents(report, modal);


}









function bindEditorEvents(report, modal){



// 关闭

const closeBtn =
modal.querySelector("#editor-close");


if(closeBtn){

closeBtn.onclick = ()=>{

modal.remove();

};

}






// 主题色

const color =
modal.querySelector("#editor-color");


if(color){

color.onchange = ()=>{

report.theme_color =
color.value;


renderEditorPoster(report);

};

}







// 每行人数

const columns =
modal.querySelector("#editor-columns");


if(columns){

columns.onchange = ()=>{


weeklyPosterColumns =
Number(columns.value);


renderEditorPoster(report);


};

}







// 字号

const font =
modal.querySelector("#editor-font");


if(font){

font.onchange = ()=>{


weeklyPosterFontScale =
Number(font.value);


renderEditorPoster(report);


};

}






// 添加成员

const add =
modal.querySelector("#editor-add-member");


if(add){

add.onclick = async()=>{


const name =
prompt(
"请输入成员名字"
);



if(!name || !name.trim()){

return;

}



const member =
await findOrCreateMember(
window.__sb,
name.trim()
);



if(!member){

window.showToast?.(
"成员创建失败",
"失败",
"error"
);

return;

}



report.weekly_report_items =
report.weekly_report_items || [];



report.weekly_report_items.push({

report_id:
report.id,

member_id:
member.id,

display_name:
member.display_name,

checkin_dates:[],

cover_image_url:"",

cover_storage_path:"",

summary:"",

nickname_title:"",

sort_order:
report.weekly_report_items.length

});



renderEditorMembers(report);

renderEditorPoster(report);


};



}






// 保存

const save =
modal.querySelector("#editor-save");


if(save){

save.onclick = async()=>{


save.disabled=true;

save.textContent =
"保存中...";



const result =
await saveWeeklyReportItems(
window.__sb,
report.id,
report.weekly_report_items || []
);



if(result){


report.weekly_report_items =
result;



window.showToast?.(
"周报保存成功",
"完成",
"success"
);



renderEditorMembers(report);

renderEditorPoster(report);



}else{


window.showToast?.(
"保存失败",
"错误",
"error"
);


}



save.disabled=false;

save.textContent =
"保存周报";


};

}



}









function renderEditorMembers(report){


const box =
document.getElementById(
"editor-member-list"
);



if(!box){
return;
}




const items =
report.weekly_report_items || [];



if(!items.length){


box.innerHTML =
`
<div class="editor-empty">
暂无成员
</div>
`;

return;

}





box.innerHTML =
items.map((item,index)=>{


return `


<div class="editor-member-card">


<div class="editor-member-title">

<strong>
${escapeHtml(item.display_name)}
</strong>


</div>




<div class="editor-field">


<label>
打卡日期
</label>



<div class="editor-date-grid">

${renderEditorDates(report,item,index)}

</div>


</div>






<div class="editor-field">


<label>
代表图
</label>



<div class="editor-cover">


${
item.cover_image_url

?

`
<img src="${item.cover_image_url}">
`

:

`
<div class="editor-cover-empty">
暂无图片
</div>
`

}



<button
class="editor-upload"
data-index="${index}">
上传
</button>



</div>


</div>








<div class="editor-field">


<label>
总结
</label>



<textarea
data-summary="${index}">
${escapeHtml(item.summary || "")}
</textarea>



</div>







<div class="editor-field">


<label>
称号
</label>



<input
data-title="${index}"
value="${escapeHtml(item.nickname_title || "")}"
>



</div>



</div>


`;



}).join("");



bindEditorMemberEvents(report);

}









function renderEditorDates(report,item,index){


const dates =
getDateRange(
report.start_date,
report.end_date
);



return dates.map(date=>{


const checked =
(item.checkin_dates || [])
.includes(date);



return `

<label class="editor-date">


<input

type="checkbox"

data-date-index="${index}"

value="${date}"

${checked ? "checked":""}

>


<span>

${date.slice(5)}

</span>


</label>

`;


}).join("");



}

function bindEditorMemberEvents(report){


document
.querySelectorAll(".editor-date input")
.forEach(input=>{


input.onchange = ()=>{


const index =
Number(
input.dataset.dateIndex
);



const dates =
Array.from(
document.querySelectorAll(
'.editor-date input[data-date-index="' + index + '"]:checked'
)
)
.map(x=>x.value);



report.weekly_report_items[index]
.checkin_dates =
dates;



renderEditorPoster(report);


};



});






document
.querySelectorAll("[data-summary]")
.forEach(input=>{


input.oninput = ()=>{


const index =
Number(
input.dataset.summary
);


report.weekly_report_items[index]
.summary =
input.value;



renderEditorPoster(report);


};


});






document
.querySelectorAll("[data-title]")
.forEach(input=>{


input.oninput = ()=>{


const index =
Number(
input.dataset.title
);


report.weekly_report_items[index]
.nickname_title =
input.value;



renderEditorPoster(report);


};


});







document
.querySelectorAll(".editor-upload")
.forEach(btn=>{


btn.onclick = ()=>{


const index =
Number(
btn.dataset.index
);



const input =
document.createElement("input");


input.type="file";

input.accept="image/*";



input.onchange =
async(e)=>{


const file =
e.target.files[0];


if(!file)return;



btn.textContent =
"上传中...";



const url =
await uploadWeeklyCover(
window.__sb,
file
);



if(url){


report.weekly_report_items[index]
.cover_image_url =
url;



renderEditorMembers(report);

renderEditorPoster(report);



window.showToast?.(
"代表图上传成功",
"完成",
"success"
);


}else{


window.showToast?.(
"上传失败",
"错误",
"error"
);


}



};



input.click();


};



});


}









function renderEditorPoster(report){


const box =
document.getElementById(
"editor-poster"
);



if(!box)return;



const items =
report.weekly_report_items || [];



const columns =
Math.min(
weeklyPosterColumns,
Math.max(items.length,1)
);



const rows =
Math.ceil(
items.length / columns
);



const cardWidth = 120;

const cardHeight = 340;

const gap = 10;



const width =
260 +
columns * cardWidth +
(columns-1)*gap +
60;



const height =
80 +
rows * cardHeight +
(rows-1)*gap;



box.innerHTML = `

<div

class="weekly-poster-canvas"

style="

--poster-columns:${columns};

--poster-card-width:${cardWidth}px;

--poster-card-height:${cardHeight}px;

--poster-gap:${gap}px;

--poster-font:${weeklyPosterFontScale};

--poster-fit:${weeklyPosterImageFit};

--poster-position:${weeklyPosterImagePosition};

--poster-theme:${report.theme_color || "#ff6a16"};

width:${width}px;

height:${height}px;

"

>



<div class="poster-left">


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
这周群里<br>
发生了啥
</h3>


<p>
${escapeHtml(
report.event_notes || "暂无记录"
)}
</p>


</div>


</div>





<div class="poster-members">


${
items.map(item=>{


return `


<div class="poster-member-card">


<div class="poster-image">


${
item.cover_image_url

?

`
<img src="${item.cover_image_url}">
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
${escapeHtml(item.display_name)}
</h3>



<p class="poster-summary">

${escapeHtml(
item.summary || ""
)}

</p>




<div class="poster-days">


${renderPosterDays(report,item)}


</div>



<div class="poster-title-tag">

${escapeHtml(
item.nickname_title || ""
)}

</div>



</div>


`;


}).join("")

}


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









function renderPosterDays(report,item){


return getDateRange(
report.start_date,
report.end_date
)
.map(date=>{


const active =
(item.checkin_dates || [])
.includes(date);



return `

<span class="${active ? "active":""}">

${date.slice(8)}

</span>

`;


})
.join("");



}









function exportPoster(){


const poster =
document.querySelector(
".weekly-poster-canvas"
);



if(!poster)return;



html2canvas(
poster,
{
scale:2,
backgroundColor:
getComputedStyle(poster)
.getPropertyValue("--poster-theme")
}
)
.then(canvas=>{


const link =
document.createElement("a");


link.download =
"weekly-report.png";


link.href =
canvas.toDataURL(
"image/png"
);


link.click();



});



}









function getDateRange(start,end){

const result=[];


let current =
new Date(start);


const last =
new Date(end);



while(current<=last){


const y =
current.getFullYear();


const m =
String(
current.getMonth()+1
)
.padStart(2,"0");


const d =
String(
current.getDate()
)
.padStart(2,"0");



result.push(
`${y}-${m}-${d}`
);



current.setDate(
current.getDate()+1
);


}


return result;


}







function formatShortDate(date){

const d =
new Date(date);


return (
d.getMonth()+1
)
+
"月"
+
d.getDate()
+
"日";

}







function escapeHtml(value){

return String(value || "")

.replaceAll("&","&amp;")

.replaceAll("<","&lt;")

.replaceAll(">","&gt;")

.replaceAll('"',"&quot;")

.replaceAll("'","&#039;");

}
