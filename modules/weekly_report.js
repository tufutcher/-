import {
  loadWeeklyReports,
  createWeeklyReport,
  deleteWeeklyReport,
  findOrCreateMember,
  saveWeeklyReportItems,
  uploadWeeklyCover
} from "../api/weekly_report.js";

let weeklyReportsCache = [];

export async function openWeeklyReportManager(){
  const old = document.getElementById("weekly-report-manager");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "weekly-report-manager";
  modal.className = "modal-bg detail-viewer-bg";

  modal.innerHTML =
    '<div class="weekly-manager-card">' +
      '<div class="weekly-manager-head">' +
        '<div>' +
          '<h2>周报生成器</h2>' +
          '<p>创建周报、录入成员打卡日期，并生成周报海报。</p>' +
        '</div>' +
        '<button id="weekly-close" type="button">关闭</button>' +
      '</div>' +

      '<div class="weekly-create-box">' +
        '<div class="weekly-form-grid">' +
          '<label>标题<input id="weekly-title" value="本周创作报告"></label>' +
          '<label>开始日期<input id="weekly-start" type="date"></label>' +
          '<label>结束日期<input id="weekly-end" type="date"></label>' +
          '<label>主题色<input id="weekly-color" type="color" value="#ff6a16"></label>' +
        '</div>' +

        '<label class="weekly-full-label">本周事件<textarea id="weekly-events" placeholder="写这周群里发生了什么。"></textarea></label>' +
        '<label class="weekly-full-label">本周贡献者<input id="weekly-contributors" placeholder="例如：安夏、古鸟、夜哭"></label>' +

        '<button id="weekly-create" type="button">新建周报</button>' +
      '</div>' +

      '<div class="weekly-list-head">' +
        '<h3>已有周报</h3>' +
        '<button id="weekly-refresh" type="button">刷新</button>' +
      '</div>' +

      '<div id="weekly-report-list" class="weekly-report-list"></div>' +
    '</div>';

  document.body.appendChild(modal);
  bindWeeklyBaseEvents(modal);
  await renderWeeklyReportList();
}

function bindWeeklyBaseEvents(modal){

  const closeBtn = modal.querySelector("#weekly-close");

  if(closeBtn){
    closeBtn.onclick = () => modal.remove();
  }


  modal.onclick = e => {
    if(e.target === modal){
      modal.remove();
    }
  };


  const refreshBtn = modal.querySelector("#weekly-refresh");

  if(refreshBtn){
    refreshBtn.onclick = async () => {
      await renderWeeklyReportList();
    };
  }


  const createBtn = modal.querySelector("#weekly-create");

  if(createBtn){
    createBtn.onclick = async () => {
      await handleCreateWeeklyReport();
    };
  }

}

async function renderWeeklyReportList(){
  const list = document.getElementById("weekly-report-list");
  if(!list) return;

  const sb = window.__sb;
  weeklyReportsCache = await loadWeeklyReports(sb);

  if(!weeklyReportsCache.length){
    list.innerHTML = '<div class="weekly-empty">还没有周报。</div>';
    return;
  }

  list.innerHTML = weeklyReportsCache.map(report => {
    const count = report.weekly_report_items?.length || 0;

    return (
      '<div class="weekly-report-row" data-report-id="' + report.id + '">' +
        '<div>' +
          '<strong>' + escapeHtml(report.title) + '</strong>' +
          '<p>' + report.start_date + ' 至 ' + report.end_date + ' · ' + count + ' 人</p>' +
        '</div>' +
        '<div class="weekly-row-actions">' +
          '<button data-weekly-open="' + report.id + '" type="button">编辑</button>' +
          '<button data-weekly-preview="' + report.id + '" type="button">预览</button>' +
          '<button data-weekly-delete="' + report.id + '" type="button">删除</button>' +
        '</div>' +
      '</div>'
    );
  }).join("");

  bindWeeklyListEvents();
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


  modal.id="weekly-preview";

  modal.className=
    "modal-bg detail-viewer-bg";


  modal.innerHTML = `

<div class="weekly-poster">

  <div class="weekly-poster-head">

    <h1>
      ${report.title}
    </h1>


    <p>
      ${report.start_date}
      -
      ${report.end_date}
    </p>


  </div>



  <div class="weekly-event">

    ${report.event_notes || ""}

  </div>



  <div class="weekly-member-grid">

  ${
    (report.weekly_report_items || [])
    .map(item=>{


      return `

<div class="weekly-poster-member">


  <div class="weekly-cover">


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


  </div>



  <h3>
    ${item.display_name}
  </h3>



  <p>
    ${item.nickname_title || ""}
  </p>


  <span>

    ${item.summary || ""}

  </span>



</div>


`;

    }).join("")

  }


  </div>


<div class="weekly-preview-actions">

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



modal
.querySelector("#weekly-preview-close")
.onclick=()=>modal.remove();



modal.onclick=e=>{

if(e.target===modal){

modal.remove();

}

};


}

const exportBtn =
modal.querySelector("#weekly-export-image");


if(exportBtn){

  exportBtn.onclick = async()=>{


    const poster =
      modal.querySelector(".weekly-poster");


    if(!poster){
      return;
    }


    exportBtn.textContent =
      "生成中...";


    const canvas =
      await html2canvas(
        poster,
        {
          scale:2,
          backgroundColor:"#ffffff"
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


    exportBtn.textContent =
      "导出图片";


    window.showToast?.(
      "周报图片已生成。",
      "完成",
      "success"
    );


  };

}

function bindWeeklyListEvents(){
  // 编辑周报
  document
  .querySelectorAll("[data-weekly-open]")
  .forEach(btn=>{

    btn.onclick = ()=>{

      const reportId =
        btn.dataset.weeklyOpen;

      openWeeklyEditor(reportId);

    };

  });

  // 预览周报海报
  document
  .querySelectorAll("[data-weekly-preview]")
  .forEach(btn=>{

    btn.onclick = ()=>{

      const reportId =
        btn.dataset.weeklyPreview;

      openWeeklyPreview(reportId);

    };

  });

  // 删除周报
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
          "这会删除这期周报和周报卡片。已被用户补全的打卡不会删除。",

          confirmText:"删除",

          cancelText:"取消"

        });

      if(!ok){
        return;
      }

      const success =
        await deleteWeeklyReport(
          window.__sb,
          reportId
        );

      if(success){

        window.showToast?.(
          "周报已删除。",
          "删除成功",
          "success"
        );
        
        await renderWeeklyReportList();

      }else{
        window.showToast?.(
          "周报删除失败。",
          "删除失败",
          "error"
        );
      }
    };
  });
}

async function handleCreateWeeklyReport(){
  const title = document.getElementById("weekly-title").value.trim() || "本周创作报告";
  const startDate = document.getElementById("weekly-start").value;
  const endDate = document.getElementById("weekly-end").value;
  const themeColor = document.getElementById("weekly-color").value || "#ff6a16";
  const eventNotes = document.getElementById("weekly-events").value.trim();
  const contributors = document.getElementById("weekly-contributors").value.trim();

  if(!startDate || !endDate){
    window.showToast?.("请先选择开始日期和结束日期。", "无法创建", "error");
    return;
  }

  if(startDate > endDate){
    window.showToast?.("开始日期不能晚于结束日期。", "无法创建", "error");
    return;
  }

  const { data, error } = await createWeeklyReport(window.__sb, {
    title,
    start_date: startDate,
    end_date: endDate,
    theme_color: themeColor,
    event_notes: eventNotes,
    contributors
  });

  if(error || !data){
    window.showToast?.("周报创建失败。", "创建失败", "error");
    return;
  }

  window.showToast?.("周报已创建。", "创建成功", "success");
  await renderWeeklyReportList();
}

function getDateRange(start, end){

  const dates = [];

  let current = new Date(start);
  const last = new Date(end);


  while(current <= last){

    const y = current.getFullYear();
    const m = String(current.getMonth()+1).padStart(2,"0");
    const d = String(current.getDate()).padStart(2,"0");

    dates.push(
      `${y}-${m}-${d}`
    );


    current.setDate(
      current.getDate()+1
    );
  }


  return dates;
}


function formatShortDate(date){

  const d = new Date(date);

  return (
    (d.getMonth()+1)
    + "月"
    +
    d.getDate()
    + "日"
  );
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function openWeeklyEditor(reportId){

  const report = weeklyReportsCache.find(
    x => x.id === reportId
  );

  if(!report){
    window.showToast?.(
      "找不到这份周报。",
      "打开失败",
      "error"
    );
    return;
  }


  const old = document.getElementById("weekly-editor");

  if(old){
    old.remove();
  }


  const modal = document.createElement("div");

  modal.id = "weekly-editor";
  modal.className = "modal-bg detail-viewer-bg";


  modal.innerHTML = `

  <div class="weekly-editor-card">

    <div class="weekly-editor-head">

      <div>
        <h2>${report.title}</h2>

        <p>
          ${report.start_date}
          -
          ${report.end_date}
        </p>
      </div>


      <button id="weekly-editor-close">
        关闭
      </button>

    </div>



    <div class="weekly-member-list"
         id="weekly-member-list">

    </div>



    <button id="weekly-add-member">
      + 添加成员
    </button>


    <button id="weekly-save">
      保存周报
    </button>


  </div>

  `;


  document.body.appendChild(modal);

  modal.querySelector(
    "#weekly-editor-close"
  ).onclick = () => {
    modal.remove();
  };


  modal.onclick = e => {
    if(e.target === modal){
      modal.remove();
    }
  };


  renderWeeklyMembers(report);
  bindWeeklyMemberInputs(report);
  bindWeeklyEditorEvents(report, modal);
  const addBtn = modal.querySelector(
    "#weekly-add-member"
  );
  
  
  if(addBtn){
  
    addBtn.onclick = async()=>{
  
      const name = prompt(
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
  
  
      const items =
        report.weekly_report_items || [];
  
  
      items.push({
  
        report_id: report.id,
  
        member_id: member.id,
  
        display_name:
          member.display_name,
  
        checkin_dates: [],
  
        cover_image_url:"",
  
        summary:"",
  
        nickname_title:"",
  
        sort_order:
          items.length
  
      });
  
  
      report.weekly_report_items =
        items;
  
  
      renderWeeklyMembers(report);
  
  
    };
  
  }


}

function bindWeeklyMemberInputs(report){

  const items =
    report.weekly_report_items || [];



  document.querySelectorAll(".weekly-date-input")
  .forEach(input=>{


    input.onchange = ()=>{

      const index =
        Number(input.dataset.index);


      items[index].checkin_dates =
        input.value
        .split(",")
        .map(x=>x.trim())
        .filter(Boolean);


    };


  });



  document.querySelectorAll(".weekly-title-input")
  .forEach(input=>{


    input.oninput = ()=>{

      const index =
        Number(input.dataset.index);


      items[index].nickname_title =
        input.value;


    };


  });

  document
  .querySelectorAll(".weekly-date-checkbox")
  .forEach(input=>{
  
  
  input.onchange = ()=>{
  
  
  const index =
  Number(input.dataset.index);
  
  
  const checkedDates =
  Array.from(
  document.querySelectorAll(
  '.weekly-date-checkbox[data-index="'+index+'"]:checked'
  )
  )
  .map(x=>x.value);
  
  
  
  report.weekly_report_items[index]
  .checkin_dates =
  checkedDates;
  
  
  };
  
  
  });


}

function bindWeeklyEditorEvents(report, modal){


  // 保存按钮

  const saveBtn =
    modal.querySelector("#weekly-save");


  if(saveBtn){

    saveBtn.onclick = async()=>{


      saveBtn.disabled = true;

      saveBtn.textContent =
        "保存中...";


      const result =
        await saveWeeklyReportItems(
          window.__sb,
          report.id,
          report.weekly_report_items || []
        );


      if(result){

        window.showToast?.(
          "周报已保存，成员打卡已同步。",
          "保存成功",
          "success"
        );


        const reports =
          await loadWeeklyReports(
            window.__sb
          );


        weeklyReportsCache = reports;


      }else{

        window.showToast?.(
          "保存失败。",
          "失败",
          "error"
        );

      }


      saveBtn.disabled=false;

      saveBtn.textContent =
        "保存周报";

    };

  }




  // 上传代表图

  modal
  .querySelectorAll(".weekly-upload-cover")
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



      input.onchange = async(e)=>{


        const file =
          e.target.files[0];


        if(!file){
          return;
        }


        btn.textContent =
          "上传中...";


        const url =
          await uploadWeeklyCover(
            window.__sb,
            file
          );


        if(url){


          report
          .weekly_report_items[index]
          .cover_image_url = url;



          renderWeeklyMembers(report);


          bindWeeklyEditorEvents(
            report,
            modal
          );


          window.showToast?.(
            "代表图上传成功",
            "完成",
            "success"
          );


        }else{


          window.showToast?.(
            "图片上传失败",
            "失败",
            "error"
          );

        }


      };


      input.click();

    };


  });


}

function renderWeeklyMembers(report){

  const box =
    document.getElementById("weekly-member-list");


  if(!box) return;


  const items =
    report.weekly_report_items || [];


  if(!items.length){

    box.innerHTML = `
      <div class="weekly-empty">
        还没有成员，点击添加成员。
      </div>
    `;

    return;
  }


  box.innerHTML = items.map((item,index)=>{

    const dates =
      (item.checkin_dates || []).join(",");


    return `

<div class="weekly-member-card"
     data-index="${index}">


  <div class="weekly-member-head">

    <h3>
      ${item.display_name || "匿名"}
    </h3>

    <span>
      周报成员
    </span>

  </div>



  <div class="weekly-field">

    <label>
      打卡日期
    </label>

    <div class="weekly-date-picker">
    
    ${
    getDateRange(
      report.start_date,
      report.end_date
    )
    .map(date=>{
    
    const checked =
    (item.checkin_dates || [])
    .includes(date);
    
    
    return `
    
    <label class="weekly-date-item">
    
    <input
    type="checkbox"
    class="weekly-date-checkbox"
    data-index="${index}"
    value="${date}"
    ${checked ? "checked":""}
    >
    
    <span>
    ${formatShortDate(date)}
    </span>
    
    </label>
    
    `;
    
    }).join("")
    
    }
    
    </div>

  </div>



  <div class="weekly-field">

    <label>
      代表图
    </label>

    <div class="weekly-cover-area">

      ${
        item.cover_image_url
        ?
        `
        <img
        class="weekly-cover-preview"
        src="${item.cover_image_url}">
        `
        :
        `
        <div class="weekly-cover-empty">
          暂无图片
        </div>
        `
      }


      <button
      class="weekly-upload-cover"
      data-index="${index}"
      type="button">
        上传代表图
      </button>


    </div>

  </div>




  <div class="weekly-field">

    <label>
      总结
    </label>


    <textarea
    class="weekly-summary-input"
    data-index="${index}"
    placeholder="本周创作总结">${item.summary || ""}</textarea>


  </div>





  <div class="weekly-field">

    <label>
      称号
    </label>


    <input
    class="weekly-title-input"
    data-index="${index}"
    value="${item.nickname_title || ""}"
    placeholder="例如：结构狂魔">


  </div>



</div>

`;

  }).join("");

}

function bindWeeklyMemberEvents(report){


document
.querySelectorAll(".weekly-dates")
.forEach(input=>{

input.onchange=()=>{

const index =
Number(input.dataset.index);


report.weekly_report_items[index]
.checkin_dates =
input.value
.split(",")
.map(x=>x.trim())
.filter(Boolean);

};

});



document
.querySelectorAll(".weekly-summary")
.forEach(input=>{

input.onchange=()=>{

const index =
Number(input.dataset.index);


report.weekly_report_items[index]
.summary =
input.value;

};

});



document
.querySelectorAll(".weekly-title-input")
.forEach(input=>{

input.onchange=()=>{

const index =
Number(input.dataset.index);


report.weekly_report_items[index]
.nickname_title =
input.value;

};

});



document
.querySelectorAll(".weekly-cover-input")
.forEach(input=>{


input.onchange=async()=>{


const index =
Number(input.dataset.index);


const file =
input.files[0];


if(!file)return;


const url =
await uploadWeeklyCover(
window.__sb,
file
);



if(url){

report.weekly_report_items[index]
.cover_image_url=url;


renderWeeklyMembers(report);

}


};


});


}
