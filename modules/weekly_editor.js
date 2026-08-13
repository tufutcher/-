import {
  saveWeeklyReportItems,
  uploadWeeklyCover,
  findOrCreateMember,
  updateWeeklyReport
} from "../api/weekly_report.js";

import {
  renderWeeklyPoster,
  setPosterNameFontSize,
  setPosterCardFontSize,
  setPosterEventFontSize
} from "./weekly_poster.js";

let editorColumns = 9;
let editorNameFont = 28;
let editorCardFont = 16;
let editorEventFont = 10;

export function openWeeklyEditor(report){
  const old = document.getElementById("weekly-editor");
  if(old){
    old.remove();
  }

  if(!report.start_date){
    report.start_date = formatDate(new Date());
  }

  if(!report.end_date){
    report.end_date = addDays(report.start_date, 6);
  }

  report.title = report.title || "本周创作报告";
  report.theme_color = normalizeColor(report.theme_color);

  editorColumns = Number(report.poster_columns) || 9;
  editorNameFont = Number(report.poster_name_font) || 28;
  editorCardFont = Number(report.poster_card_font) || 16;
  editorEventFont = Number(report.poster_event_font) || 10;

  report.poster_columns = editorColumns;
  report.poster_name_font = editorNameFont;
  report.poster_card_font = editorCardFont;
  report.poster_event_font = editorEventFont;

  setPosterNameFontSize(editorNameFont);
  setPosterCardFontSize(editorCardFont);
  setPosterEventFontSize(editorEventFont);

  const modal = document.createElement("div");
  modal.id = "weekly-editor";
  modal.className = "modal-bg";

  modal.onclick = e => {
    if(e.target === modal){
      closeEditor(modal, escHandler);
    }
  };

  const escHandler = e => {
    if(e.key === "Escape"){
      closeEditor(modal, escHandler);
    }
  };

  document.addEventListener("keydown", escHandler);

  modal.innerHTML = `
<div class="weekly-editor-layout">

  <aside class="weekly-editor-sidebar">
    <div class="weekly-editor-sidebar-head">
      <h2>编辑成员</h2>
      <p>修改打卡日期、代表图、总结和称号。</p>
    </div>

    <div id="editor-member-list"></div>

    <button
      id="editor-add-member"
      class="editor-add-member"
      type="button"
    >
      ＋ 添加成员
    </button>
  </aside>

  <main class="weekly-editor-main">

    <div class="weekly-editor-toolbar">
      <div class="weekly-toolbar-controls">
        <label>
          <span>每行人数</span>
          <select id="editor-columns">
            ${renderColumnOptions(editorColumns)}
          </select>
        </label>

        <label>
          <span>名字字号</span>
          <input
            type="range"
            id="editor-name-font"
            min="16"
            max="48"
            value="${editorNameFont}"
          >
          <em id="editor-name-font-value">${editorNameFont}</em>
        </label>

        <label>
          <span>卡片正文</span>
          <input
            type="range"
            id="editor-card-font"
            min="10"
            max="20"
            value="${editorCardFont}"
          >
          <em id="editor-card-font-value">${editorCardFont}</em>
        </label>

        <label>
          <span>事件字体</span>
          <input
            type="range"
            id="editor-event-font"
            min="1"
            max="20"
            value="${editorEventFont}"
          >
          <em id="editor-event-font-value">${editorEventFont}</em>
        </label>
      </div>

      <div class="weekly-toolbar-actions">
        <button
          id="editor-save"
          class="editor-save"
          type="button"
        >
          保存周报
        </button>

        <button
          id="editor-export"
          class="editor-export"
          type="button"
        >
          导出图片
        </button>
      </div>
    </div>

    <div class="weekly-editor-report-panel">
      <div class="weekly-report-fields">
        <label>
          <span>标题</span>
          <input
            id="editor-title"
            value="${escapeHtml(report.title)}"
          >
        </label>

        <label>
          <span>开始日期</span>
          <input
            id="editor-start"
            type="date"
            value="${escapeHtml(report.start_date)}"
          >
        </label>

        <label>
          <span>结束日期</span>
          <input
            id="editor-end"
            type="date"
            value="${escapeHtml(report.end_date)}"
          >
        </label>

        <label class="weekly-color-field">
          <span>主题色</span>
          <input
            id="editor-theme-color"
            type="color"
            value="${escapeHtml(report.theme_color)}"
          >
        </label>
      </div>

      <div class="weekly-event-editor">
        <div class="weekly-event-editor-head">
          <strong>本周事件</strong>
          <span>按日期填写；空日期不会显示在海报里。</span>
        </div>

        <div id="editor-event-list"></div>
      </div>
    </div>

    <div class="weekly-editor-preview">
      <div id="editor-poster"></div>
    </div>

  </main>

</div>
`;

  document.body.appendChild(modal);

  renderEditorEvents(report, modal);
  renderEditorMembers(report);
  renderEditorPoster(report);
  bindEditorEvents(report, modal);
}

function closeEditor(modal, escHandler){
  modal.remove();
  document.removeEventListener("keydown", escHandler);
}

function bindEditorEvents(report, modal){
  bindReportMetaEvents(report, modal);

  const columns = modal.querySelector("#editor-columns");
  if(columns){
    columns.onchange = () => {
      const value = Number(columns.value) || 9;
      editorColumns = value;
      report.poster_columns = value;
      renderEditorPoster(report);
    };
  }

  const nameFont = modal.querySelector("#editor-name-font");
  if(nameFont){
    nameFont.oninput = () => {
      const value = Number(nameFont.value) || 28;
      editorNameFont = value;
      report.poster_name_font = value;
      setPosterNameFontSize(value);
      setText("editor-name-font-value", value);
      renderEditorPoster(report);
    };
  }

  const cardFont = modal.querySelector("#editor-card-font");
  if(cardFont){
    cardFont.oninput = () => {
      const value = Number(cardFont.value) || 16;
      editorCardFont = value;
      report.poster_card_font = value;
      setPosterCardFontSize(value);
      setText("editor-card-font-value", value);
      renderEditorPoster(report);
    };
  }

  const eventFont = modal.querySelector("#editor-event-font");
  if(eventFont){
    eventFont.oninput = () => {
      const value = Number(eventFont.value) || 10;
      editorEventFont = value;
      report.poster_event_font = value;
      setPosterEventFontSize(value);
      setText("editor-event-font-value", value);
      renderEditorPoster(report);
    };
  }

  const exportBtn = modal.querySelector("#editor-export");
  if(exportBtn){
    exportBtn.onclick = async () => {
      report.event_notes = collectEditorEvents(report, modal);
      renderEditorPoster(report);
      await exportEditorPoster(report, modal, exportBtn);
    };
  }

  const add = modal.querySelector("#editor-add-member");
  if(add){
    add.onclick = async () => {
      const name = prompt("请输入成员名字");

      if(!name || !name.trim()){
        return;
      }

      const member = await findOrCreateMember(
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

      report.weekly_report_items = report.weekly_report_items || [];
      report.weekly_report_items.push({
        member_id: member.id,
        display_name: member.display_name,
        checkin_dates: [],
        cover_image_url: "",
        cover_storage_path: "",
        summary: "",
        nickname_title: "",
        sort_order: report.weekly_report_items.length
      });

      sortItems(report);
      renderEditorMembers(report);
      renderEditorPoster(report);
    };
  }

  const save = modal.querySelector("#editor-save");
  if(save){
    save.onclick = async () => {
      await saveEditorReport(report, modal, save);
    };
  }
}

function bindReportMetaEvents(report, modal){
  const titleInput = modal.querySelector("#editor-title");
  const startInput = modal.querySelector("#editor-start");
  const endInput = modal.querySelector("#editor-end");
  const colorInput = modal.querySelector("#editor-theme-color");
  const eventList = modal.querySelector("#editor-event-list");

  if(titleInput){
    titleInput.oninput = () => {
      report.title = titleInput.value.trim() || "本周创作报告";
    };
  }

  if(startInput){
    startInput.onchange = () => {
      report.event_notes = collectEditorEvents(report, modal);
      report.start_date = startInput.value;

      if(report.end_date && report.start_date > report.end_date){
        report.end_date = report.start_date;
        if(endInput){
          endInput.value = report.end_date;
        }
      }

      renderEditorEvents(report, modal);
      renderEditorMembers(report);
      renderEditorPoster(report);
    };
  }

  if(endInput){
    endInput.onchange = () => {
      report.event_notes = collectEditorEvents(report, modal);
      report.end_date = endInput.value;

      if(report.start_date && report.start_date > report.end_date){
        report.start_date = report.end_date;
        if(startInput){
          startInput.value = report.start_date;
        }
      }

      renderEditorEvents(report, modal);
      renderEditorMembers(report);
      renderEditorPoster(report);
    };
  }

  if(colorInput){
    colorInput.oninput = () => {
      report.theme_color = normalizeColor(colorInput.value);
      renderEditorPoster(report);
    };
  }

  if(eventList){
    eventList.oninput = e => {
      if(e.target.matches("[data-event-date]")){
        report.event_notes = collectEditorEvents(report, modal);
        renderEditorPoster(report);
      }
    };
  }
}

async function saveEditorReport(report, modal, save){
  report.event_notes = collectEditorEvents(report, modal);
  report.theme_color = normalizeColor(report.theme_color);

  if(!report.start_date || !report.end_date){
    window.showToast?.(
      "请选择开始日期和结束日期",
      "失败",
      "error"
    );
    return;
  }

  if(report.start_date > report.end_date){
    window.showToast?.(
      "开始日期不能晚于结束日期",
      "失败",
      "error"
    );
    return;
  }

  save.disabled = true;
  save.textContent = "保存中...";

  try{
    sortItems(report);

    const settingsResult = await updateWeeklyReport(
      window.__sb,
      report.id,
      {
        title: report.title || "本周创作报告",
        start_date: report.start_date,
        end_date: report.end_date,
        theme_color: report.theme_color,
        event_notes: report.event_notes,
        poster_columns: editorColumns,
        poster_name_font: editorNameFont,
        poster_card_font: editorCardFont,
        poster_event_font: editorEventFont
      }
    );

    if(settingsResult.error){
      window.showToast?.(
        "周报设置保存失败",
        "错误",
        "error"
      );
      return;
    }

    if(settingsResult.data){
      Object.assign(report, settingsResult.data);
    }

    const result = await saveWeeklyReportItems(
      window.__sb,
      report.id,
      report.weekly_report_items || []
    );

    if(result){
      report.weekly_report_items = result;

      window.showToast?.(
        "周报保存成功",
        "完成",
        "success"
      );

      renderEditorEvents(report, modal);
      renderEditorMembers(report);
      renderEditorPoster(report);
    }else{
      window.showToast?.(
        "保存失败",
        "错误",
        "error"
      );
    }
  }finally{
    save.disabled = false;
    save.textContent = "保存周报";
  }
}

async function exportEditorPoster(report, modal, exportBtn){
  const poster = modal.querySelector(".weekly-poster-canvas");

  if(!poster){
    return;
  }

  if(typeof html2canvas === "undefined"){
    window.showToast?.(
      "缺少图片导出组件",
      "失败",
      "error"
    );
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = "生成中...";

  const stage = document.createElement("div");
  stage.className = "weekly-export-stage";

  const clone = poster.cloneNode(true);
  clone.classList.add("is-exporting");

  stage.appendChild(clone);
  document.body.appendChild(stage);

  try{
    await waitForPosterImages(clone);

    const canvas = await html2canvas(
      clone,
      {
        scale: 2,
        backgroundColor: report.theme_color || "#ff6a16",
        useCORS: true,
        logging: false
      }
    );

    const link = document.createElement("a");
    link.download = "weekly-report.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    window.showToast?.(
      "周报图片已生成",
      "完成",
      "success"
    );
  }catch(err){
    console.error("export weekly poster error:", err);

    window.showToast?.(
      "图片生成失败",
      "错误",
      "error"
    );
  }finally{
    stage.remove();
    exportBtn.disabled = false;
    exportBtn.textContent = "导出图片";
  }
}

function waitForPosterImages(root){
  const images = Array.from(root.querySelectorAll("img"));

  if(!images.length){
    return Promise.resolve();
  }

  return Promise.all(
    images.map(img => {
      if(img.complete){
        return Promise.resolve();
      }

      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );
}

function renderEditorEvents(report, modal){
  const box = modal.querySelector("#editor-event-list");

  if(!box){
    return;
  }

  const dates = getDateRange(report.start_date, report.end_date);

  if(!dates.length){
    box.innerHTML = `
      <div class="weekly-empty">
        请先选择开始日期和结束日期。
      </div>
    `;
    return;
  }

  const eventMap = parseEventNotes(report.event_notes, report);

  box.innerHTML = dates.map(date => {
    return `
<label class="editor-event-item">
  <span>${formatChineseDate(date)}</span>
  <textarea
    data-event-date="${date}"
    placeholder="这一天发生了什么"
  >${escapeHtml(eventMap[date] || "")}</textarea>
</label>
`;
  }).join("");
}

function collectEditorEvents(report, modal){
  const dates = getDateRange(report.start_date, report.end_date);
  const inputs = Array.from(
    modal.querySelectorAll("[data-event-date]")
  );

  if(!dates.length || !inputs.length){
    return "";
  }

  const lines = [];

  dates.forEach(date => {
    const input = inputs.find(
      item => item.dataset.eventDate === date
    );

    if(!input){
      return;
    }

    const value = input.value.trim();

    if(value){
      lines.push(`${formatChineseDate(date)}\n${value}`);
    }
  });

  return lines.join("\n\n");
}

function parseEventNotes(text, report){
  const raw = String(text || "").trim();
  const result = {};

  if(!raw){
    return result;
  }

  const year = getReportYear(report);
  const lines = raw.split(/\r?\n/);
  let currentDate = "";
  let foundDateHeading = false;

  lines.forEach(line => {
    const match = line.trim().match(/^(\d{1,2})月(\d{1,2})日$/);

    if(match){
      const month = String(match[1]).padStart(2, "0");
      const day = String(match[2]).padStart(2, "0");
      currentDate = `${year}-${month}-${day}`;
      foundDateHeading = true;

      if(!result[currentDate]){
        result[currentDate] = [];
      }

      return;
    }

    if(currentDate){
      result[currentDate].push(line);
    }
  });

  Object.keys(result).forEach(date => {
    result[date] = result[date].join("\n").trim();
  });

  if(!foundDateHeading){
    const dates = getDateRange(report.start_date, report.end_date);
    if(dates[0]){
      result[dates[0]] = raw;
    }
  }

  return result;
}

function renderEditorMembers(report){
  const box = document.getElementById("editor-member-list");

  if(!box){
    return;
  }

  sortItems(report);

  const items = report.weekly_report_items || [];

  if(!items.length){
    box.innerHTML = `
      <div class="weekly-empty">
        暂无成员
      </div>
    `;
    return;
  }

  box.innerHTML = items.map((item, index) => {
    return `
<div class="editor-member-card">

  <div class="editor-member-title">
    <strong>${escapeHtml(item.display_name || "匿名")}</strong>

    <button
      class="editor-remove-member"
      data-index="${index}"
      type="button"
    >
      删除
    </button>
  </div>

  <label>
    打卡日期
    <div class="editor-date-list">
      ${renderEditorDates(report, item, index)}
    </div>
  </label>

  <label>
    代表图
    <div class="editor-cover-box">
      ${
        item.cover_image_url
          ? `<img src="${item.cover_image_url}">`
          : `<div>暂无图片</div>`
      }

      <button
        data-upload-index="${index}"
        type="button"
      >
        上传
      </button>
    </div>
  </label>

  <label>
    总结
    <textarea data-summary-index="${index}">${escapeHtml(item.summary || "")}</textarea>
  </label>

  <label>
    称号
    <input
      data-title-index="${index}"
      value="${escapeHtml(item.nickname_title || "")}"
    >
  </label>

</div>
`;
  }).join("");

  bindEditorMemberEvents(report);
}

function renderEditorDates(report, item, index){
  const dates = getDateRange(
    report.start_date,
    report.end_date
  );

  return dates.map(date => {
    const checked = item.checkin_dates?.includes(date);

    return `
<label class="editor-date-item">
  <input
    type="checkbox"
    data-date-index="${index}"
    value="${date}"
    ${checked ? "checked" : ""}
  >
  ${date.slice(5)}
</label>
`;
  }).join("");
}

function bindEditorMemberEvents(report){
  document
    .querySelectorAll(".editor-remove-member")
    .forEach(btn => {
      btn.onclick = () => {
        const index = Number(btn.dataset.index);
        report.weekly_report_items.splice(index, 1);
        renderEditorMembers(report);
        renderEditorPoster(report);
      };
    });

  document
    .querySelectorAll("[data-date-index]")
    .forEach(input => {
      input.onchange = () => {
        const index = Number(input.dataset.dateIndex);
        const dates = Array.from(
          document.querySelectorAll(
            `[data-date-index="${index}"]:checked`
          )
        ).map(x => x.value);

        report.weekly_report_items[index].checkin_dates = dates;
        renderEditorPoster(report);
      };
    });

  document
    .querySelectorAll("[data-summary-index]")
    .forEach(input => {
      input.oninput = () => {
        const index = Number(input.dataset.summaryIndex);
        report.weekly_report_items[index].summary = input.value;
        renderEditorPoster(report);
      };
    });

  document
    .querySelectorAll("[data-title-index]")
    .forEach(input => {
      input.oninput = () => {
        const index = Number(input.dataset.titleIndex);
        report.weekly_report_items[index].nickname_title = input.value;
        renderEditorPoster(report);
      };
    });

  document
    .querySelectorAll("[data-upload-index]")
    .forEach(btn => {
      btn.onclick = () => {
        const index = Number(btn.dataset.uploadIndex);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        input.onchange = async e => {
          const file = e.target.files[0];

          if(!file){
            return;
          }

          btn.textContent = "上传中...";
          const url = await uploadWeeklyCover(window.__sb, file);

          if(url){
            report.weekly_report_items[index].cover_image_url = url;
            renderEditorMembers(report);
            renderEditorPoster(report);
          }else{
            btn.textContent = "上传";
          }
        };

        input.click();
      };
    });
}

function renderEditorPoster(report){
  const box = document.getElementById("editor-poster");

  if(!box){
    return;
  }

  renderWeeklyPoster(
    report,
    box,
    {
      columns: report.poster_columns || editorColumns
    }
  );
}

function renderColumnOptions(selected){
  let html = "";

  for(let i = 6; i <= 18; i++){
    html += `
      <option
        value="${i}"
        ${Number(selected) === i ? "selected" : ""}
      >
        ${i}
      </option>
    `;
  }

  return html;
}

function sortItems(report){
  report.weekly_report_items =
    (report.weekly_report_items || []).sort((a, b) => {
      return (a.display_name || "")
        .localeCompare(
          b.display_name || "",
          "zh-CN"
        );
    });
}

function setText(id, value){
  const el = document.getElementById(id);

  if(el){
    el.textContent = value;
  }
}

function getDateRange(start, end){
  const result = [];

  if(!start || !end){
    return result;
  }

  let d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");

  if(Number.isNaN(d.getTime()) || Number.isNaN(last.getTime()) || d > last){
    return result;
  }

  while(d <= last){
    result.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }

  return result;
}

function addDays(dateString, amount){
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + amount);
  return formatDate(date);
}

function formatDate(date){
  return date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0");
}

function formatChineseDate(dateString){
  const date = new Date(dateString + "T00:00:00");

  return (date.getMonth() + 1) +
    "月" +
    date.getDate() +
    "日";
}

function getReportYear(report){
  const date = new Date((report.start_date || formatDate(new Date())) + "T00:00:00");
  return date.getFullYear();
}

function normalizeColor(value){
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ff6a16";
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
