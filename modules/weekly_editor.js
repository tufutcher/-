import {
  loadWeeklyReports,
  saveWeeklyReportItems,
  uploadWeeklyCover,
  findOrCreateMember
} from "../api/weekly_report.js";


export function openWeeklyEditor(report){

  const old =
    document.getElementById("weekly-editor");

  if(old){
    old.remove();
  }


  const modal =
    document.createElement("div");


  modal.id="weekly-editor";

  modal.className=
    "modal-bg";


  modal.innerHTML=`

<div class="weekly-editor-layout">


<!-- 左侧控制 -->

<div class="weekly-editor-sidebar">


<h2>
编辑周报
</h2>


<section>

<h3>
周报设置
</h3>


<label>
主题色
<input 
id="editor-color"
type="color"
value="${report.theme_color || "#4338ca"}"
>
</label>


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

+ 添加成员

</button>


</section>


<button id="editor-save">

保存周报

</button>


<button id="editor-export">

导出图片

</button>



</div>




<!-- 右侧预览 -->


<div class="weekly-editor-preview">


<div id="editor-poster">

</div>


</div>



</div>


`;


document.body.appendChild(modal);



renderEditorMembers(report);

renderEditorPoster(report);


bindEditorEvents(report,modal);


}

function bindEditorEvents(report, modal){

  const color =
    modal.querySelector("#editor-color");

  if(color){

    color.onchange = ()=>{

      report.theme_color =
        color.value;

      renderEditorPoster(report);

    };

  }



  const columns =
    modal.querySelector("#editor-columns");


  if(columns){

    columns.onchange = ()=>{

      weeklyPosterColumns =
        Number(columns.value);

      renderEditorPoster(report);

    };

  }



  const font =
    modal.querySelector("#editor-font");


  if(font){

    font.onchange = ()=>{

      weeklyPosterFontScale =
        Number(font.value);

      renderEditorPoster(report);

    };

  }


}
