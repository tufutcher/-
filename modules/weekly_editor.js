import {
  saveWeeklyReportItems,
  uploadWeeklyCover,
  findOrCreateMember
} from "../api/weekly_report.js";

import {
  renderWeeklyPoster,
  setPosterFontScale
} from "./weekly_poster.js";


let editorColumns = 9;



export function openWeeklyEditor(report){

  const old =
    document.getElementById(
      "weekly-editor"
    );


  if(old){
    old.remove();
  }



  const modal =
    document.createElement("div");


  modal.id =
    "weekly-editor";


  modal.className =
    "modal-bg";



  modal.innerHTML = `


<div class="weekly-editor-layout">



<div class="weekly-editor-sidebar">


<h2>
编辑周报
</h2>



<section>

<h3>
海报设置
</h3>



<label>
每行人数

<select id="editor-columns">

<option>6</option>
<option>7</option>
<option>8</option>
<option selected>9</option>
<option>10</option>

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





<section>

<h3>
成员管理
</h3>


<div id="editor-member-list">

</div>



<button id="editor-add-member">

＋ 添加成员

</button>



</section>





<button id="editor-save">

保存周报

</button>



</div>





<div class="weekly-editor-preview">


<div id="editor-poster">

</div>


</div>



</div>


`;



  document.body.appendChild(modal);



  renderEditorMembers(report);


  renderEditorPoster(report);



  bindEditorEvents(
    report,
    modal
  );


}





function bindEditorEvents(
  report,
  modal
){



const columns =
modal.querySelector(
"#editor-columns"
);



if(columns){

columns.onchange = ()=>{


editorColumns =
Number(columns.value)
|| 9;


renderEditorPoster(report);


};


}






const font =
modal.querySelector(
"#editor-font"
);



if(font){

font.onchange = ()=>{


setPosterFontScale(
Number(font.value)
);


renderEditorPoster(report);


};


}







const add =
modal.querySelector(
"#editor-add-member"
);



if(add){

add.onclick = async()=>{


const name =
prompt(
"请输入成员名字"
);



if(!name){
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
"错误",
"error"
);

return;

}





report.weekly_report_items =
report.weekly_report_items || [];



report.weekly_report_items.push({

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







const save =
modal.querySelector(
"#editor-save"
);



if(save){

save.onclick = async()=>{


save.disabled=true;

save.textContent=
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



renderEditorPoster(report);



}else{


window.showToast?.(
"保存失败",
"错误",
"error"
);


}



save.disabled=false;

save.textContent=
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

<div class="weekly-empty">

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

${escapeHtml(
item.display_name || "匿名"
)}

</strong>



<button
class="editor-remove-member"
data-index="${index}"
>

删除

</button>


</div>





<label>

打卡日期


<div class="editor-date-list">


${renderEditorDates(
report,
item,
index
)}


</div>


</label>







<label>

代表图


<div class="editor-cover-box">


${
item.cover_image_url

?

`
<img src="${item.cover_image_url}">
`

:

`
<div>
暂无图片
</div>
`

}



<button
data-upload-index="${index}"
>

上传

</button>


</div>


</label>







<label>

总结


<textarea
data-summary-index="${index}"
>${escapeHtml(
item.summary || ""
)}</textarea>


</label>







<label>

称号


<input
data-title-index="${index}"
value="${escapeHtml(
item.nickname_title || ""
)}"
>


</label>



</div>


`;



}).join("");



bindEditorMemberEvents(
report
);



}





function renderEditorDates(
report,
item,
index
){


const dates =
getDateRange(
report.start_date,
report.end_date
);



return dates.map(date=>{


const checked =
item.checkin_dates?.includes(date);



return `


<label class="editor-date-item">


<input

type="checkbox"

data-date-index="${index}"

value="${date}"

${checked ? "checked":""}

>


${date.slice(5)}

</label>


`;



}).join("");

}





function bindEditorMemberEvents(report){



document
.querySelectorAll(".editor-remove-member")
.forEach(btn=>{


btn.onclick = ()=>{


const index =
Number(
btn.dataset.index
);



report.weekly_report_items.splice(
index,
1
);



renderEditorMembers(report);

renderEditorPoster(report);


};


});







document
.querySelectorAll("[data-date-index]")
.forEach(input=>{


input.onchange = ()=>{


const index =
Number(
input.dataset.dateIndex
);



const dates =
Array.from(
document.querySelectorAll(
`[data-date-index="${index}"]:checked`
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
.querySelectorAll("[data-summary-index]")
.forEach(input=>{


input.oninput = ()=>{


const index =
Number(
input.dataset.summaryIndex
);



report.weekly_report_items[index]
.summary =
input.value;



renderEditorPoster(report);


};


});







document
.querySelectorAll("[data-title-index]")
.forEach(input=>{


input.oninput = ()=>{


const index =
Number(
input.dataset.titleIndex
);



report.weekly_report_items[index]
.nickname_title =
input.value;



renderEditorPoster(report);


};


});







document
.querySelectorAll("[data-upload-index]")
.forEach(btn=>{


btn.onclick = ()=>{


const index =
Number(
btn.dataset.uploadIndex
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



btn.textContent=
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



if(!box){
return;
}



renderWeeklyPoster(
report,
box,
{
columns:
editorColumns
}
);


}







function getDateRange(start,end){


const result=[];


let d =
new Date(start);


const last =
new Date(end);



while(d<=last){


result.push(

d.getFullYear()
+
"-"
+
String(
d.getMonth()+1
).padStart(2,"0")
+
"-"
+
String(
d.getDate()
).padStart(2,"0")

);



d.setDate(
d.getDate()+1
);


}



return result;

}





function escapeHtml(value){

return String(value || "")

.replaceAll("&","&amp;")

.replaceAll("<","&lt;")

.replaceAll(">","&gt;")

.replaceAll('"',"&quot;")

.replaceAll("'","&#039;");

}
