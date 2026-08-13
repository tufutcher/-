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
let editorPanel = "members";

export function openWeeklyEditor(report){
  ensureWeeklyEditorPatchCss();
  document.getElementById("weekly-editor")?.remove();

  report.title = report.title || "本周创作报告";
  report.start_date = report.start_date || formatDate(new Date());
  report.end_date = report.end_date || addDays(report.start_date, 6);
  report.theme_color = normalizeColor(report.theme_color);

  editorColumns = Number(report.poster_columns) || 9;
  editorNameFont = Number(report.poster_name_font) || 28;
  editorCardFont = Number(report.poster_card_font) || 16;
  editorEventFont = Number(report.poster_event_font) || 10;

  Object.assign(report, {
    poster_columns: editorColumns,
    poster_name_font: editorNameFont,
    poster_card_font: editorCardFont,
    poster_event_font: editorEventFont
  });

  setPosterNameFontSize(editorNameFont);
  setPosterCardFontSize(editorCardFont);
  setPosterEventFontSize(editorEventFont);

  const modal = document.createElement("div");
  modal.id = "weekly-editor";
  modal.className = "modal-bg";

  const escHandler = e => {
    if(e.key === "Escape") closeEditor(modal, escHandler);
  };

  modal.onclick = e => {
    if(e.target === modal) closeEditor(modal, escHandler);
  };

  document.addEventListener("keydown", escHandler);

  modal.innerHTML = `
<div class="weekly-editor-layout">
  <aside class="weekly-editor-sidebar">
    <div class="weekly-editor-sidebar-head">
      <h2>编辑内容</h2>
      <p>切换编辑成员或本周事件。</p>
    </div>

    <div class="weekly-editor-panel-switch">
      <button class="editor-panel-toggle ${editorPanel === "members" ? "is-active" : ""}" data-editor-panel="members" type="button">成员</button>
      <button class="editor-panel-toggle ${editorPanel === "events" ? "is-active" : ""}" data-editor-panel="events" type="button">事件</button>
    </div>

    <div class="weekly-editor-side-panel ${editorPanel === "members" ? "is-active" : ""}" data-panel-name="members">
      <div id="editor-member-list"></div>
      <button id="editor-add-member" class="editor-add-member" type="button">＋ 添加成员</button>
    </div>

    <div class="weekly-editor-side-panel ${editorPanel === "events" ? "is-active" : ""}" data-panel-name="events">
      <div class="weekly-event-editor">
        <div class="weekly-event-editor-head">
          <strong>本周事件</strong>
          <span>空日期不会显示。</span>
        </div>
        <div id="editor-event-list"></div>
      </div>
    </div>
  </aside>

  <main class="weekly-editor-main">
    <div class="weekly-editor-settings-panel">
      <div class="weekly-settings-fields">
        <label><span>开始</span><input id="editor-start" type="date" value="${escapeHtml(report.start_date)}"></label>
        <label><span>结束</span><input id="editor-end" type="date" value="${escapeHtml(report.end_date)}"></label>
        <label class="weekly-color-field"><span>主题色</span><input id="editor-theme-color" type="color" value="${escapeHtml(report.theme_color)}"></label>
        <label><span>每行</span><select id="editor-columns">${renderColumnOptions(editorColumns)}</select></label>
        <label><span>名字</span><input type="range" id="editor-name-font" min="16" max="48" value="${editorNameFont}"><em id="editor-name-font-value">${editorNameFont}</em></label>
        <label><span>正文</span><input type="range" id="editor-card-font" min="10" max="20" value="${editorCardFont}"><em id="editor-card-font-value">${editorCardFont}</em></label>
        <label><span>事件字</span><input type="range" id="editor-event-font" min="1" max="20" value="${editorEventFont}"><em id="editor-event-font-value">${editorEventFont}</em></label>
      </div>
      <div class="weekly-settings-actions">
        <button id="editor-save" class="editor-save" type="button">保存周报</button>
        <button id="editor-export" class="editor-export" type="button">导出图片</button>
      </div>
    </div>

    <div class="weekly-editor-preview">
      <div id="editor-poster"></div>
    </div>
  </main>
</div>`;

  document.body.appendChild(modal);
  renderEditorEvents(report, modal);
  renderEditorMembers(report);
  renderEditorPoster(report);
  bindEditorEvents(report, modal);
}

function ensureWeeklyEditorPatchCss(){
  if(document.getElementById("weekly-editor-patch-css")) return;
  const link = document.createElement("link");
  link.id = "weekly-editor-patch-css";
  link.rel = "stylesheet";
  link.href = "styles/weekly_editor_patch.css";
  document.head.appendChild(link);
}

function closeEditor(modal, escHandler){
  modal.remove();
  document.removeEventListener("keydown", escHandler);
}

function bindEditorEvents(report, modal){
  bindPanelTabs(modal);
  bindMeta(report, modal);

  bindControl(modal, "#editor-columns", "change", value => {
    editorColumns = Number(value) || 9;
    report.poster_columns = editorColumns;
    renderEditorPoster(report);
  });

  bindControl(modal, "#editor-name-font", "input", value => {
    editorNameFont = Number(value) || 28;
    report.poster_name_font = editorNameFont;
    setPosterNameFontSize(editorNameFont);
    setText("editor-name-font-value", editorNameFont);
    renderEditorPoster(report);
  });

  bindControl(modal, "#editor-card-font", "input", value => {
    editorCardFont = Number(value) || 16;
    report.poster_card_font = editorCardFont;
    setPosterCardFontSize(editorCardFont);
    setText("editor-card-font-value", editorCardFont);
    renderEditorPoster(report);
  });

  bindControl(modal, "#editor-event-font", "input", value => {
    editorEventFont = Number(value) || 10;
    report.poster_event_font = editorEventFont;
    setPosterEventFontSize(editorEventFont);
    setText("editor-event-font-value", editorEventFont);
    renderEditorPoster(report);
  });

  modal.querySelector("#editor-export")?.addEventListener("click", async e => {
    report.event_notes = collectEditorEvents(report, modal);
    renderEditorPoster(report);
    await exportEditorPoster(report, e.currentTarget);
  });

  modal.querySelector("#editor-save")?.addEventListener("click", async e => {
    await saveEditorReport(report, modal, e.currentTarget);
  });

  modal.querySelector("#editor-add-member")?.addEventListener("click", async () => {
    const name = prompt("请输入成员名字");
    if(!name?.trim()) return;

    const member = await findOrCreateMember(window.__sb, name.trim());
    if(!member){
      window.showToast?.("成员创建失败", "错误", "error");
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
  });
}

function bindPanelTabs(modal){
  modal.querySelectorAll("[data-editor-panel]").forEach(btn => {
    btn.onclick = () => {
      editorPanel = btn.dataset.editorPanel || "members";
      modal.querySelectorAll("[data-editor-panel]").forEach(item => {
        item.classList.toggle("is-active", item.dataset.editorPanel === editorPanel);
      });
      modal.querySelectorAll("[data-panel-name]").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.panelName === editorPanel);
      });
    };
  });
}

function bindControl(modal, selector, eventName, apply){
  const el = modal.querySelector(selector);
  if(!el) return;
  el.addEventListener(eventName, () => apply(el.value));
}

function bindMeta(report, modal){
  const start = modal.querySelector("#editor-start");
  const end = modal.querySelector("#editor-end");
  const color = modal.querySelector("#editor-theme-color");
  const events = modal.querySelector("#editor-event-list");

  if(start) start.onchange = () => updateDateRange(report, modal, start, end);
  if(end) end.onchange = () => updateDateRange(report, modal, start, end);

  if(color){
    color.oninput = () => {
      report.theme_color = normalizeColor(color.value);
      renderEditorPoster(report);
    };
  }

  if(events){
    events.oninput = e => {
      if(e.target.matches("[data-event-date]")){
        report.event_notes = collectEditorEvents(report, modal);
        renderEditorPoster(report);
      }
    };
  }
}

function updateDateRange(report, modal, startInput, endInput){
  report.event_notes = collectEditorEvents(report, modal);
  report.start_date = startInput?.value || report.start_date;
  report.end_date = endInput?.value || report.end_date;

  if(report.start_date && report.end_date && report.start_date > report.end_date){
    report.end_date = report.start_date;
    if(endInput) endInput.value = report.end_date;
  }

  renderEditorEvents(report, modal);
  renderEditorMembers(report);
  renderEditorPoster(report);
}

async function saveEditorReport(report, modal, save){
  report.event_notes = collectEditorEvents(report, modal);
  report.theme_color = normalizeColor(report.theme_color);

  if(!report.start_date || !report.end_date){
    window.showToast?.("请选择开始日期和结束日期", "失败", "error");
    return;
  }

  save.disabled = true;
  save.textContent = "保存中...";

  try{
    sortItems(report);

    const settingsResult = await updateWeeklyReport(window.__sb, report.id, {
      title: report.title || "本周创作报告",
      start_date: report.start_date,
      end_date: report.end_date,
      theme_color: report.theme_color,
      event_notes: report.event_notes,
      poster_columns: editorColumns,
      poster_name_font: editorNameFont,
      poster_card_font: editorCardFont,
      poster_event_font: editorEventFont
    });

    if(settingsResult.error){
      window.showToast?.("周报设置保存失败", "错误", "error");
      return;
    }

    if(settingsResult.data) Object.assign(report, settingsResult.data);

    const result = await saveWeeklyReportItems(
      window.__sb,
      report.id,
      report.weekly_report_items || []
    );

    if(result){
      report.weekly_report_items = result;
      window.showToast?.("周报保存成功", "完成", "success");
      renderEditorEvents(report, modal);
      renderEditorMembers(report);
      renderEditorPoster(report);
    }else{
      window.showToast?.("保存失败", "错误", "error");
    }
  }finally{
    save.disabled = false;
    save.textContent = "保存周报";
  }
}

async function exportEditorPoster(report, exportBtn){
  if(typeof html2canvas === "undefined"){
    window.showToast?.("缺少图片导出组件", "失败", "error");
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = "生成中...";

  const stage = document.createElement("div");
  stage.className = "weekly-export-stage";
  document.body.appendChild(stage);

  try{
    renderWeeklyPoster(report, stage, { columns: report.poster_columns || editorColumns });

    const poster = stage.querySelector(".weekly-poster-canvas");
    if(!poster){
      throw new Error("poster not found");
    }

    poster.classList.add("is-exporting");
    await waitForPosterImages(poster);

    const canvas = await html2canvas(poster, {
      scale: 2,
      backgroundColor: report.theme_color || "#ff6a16",
      useCORS: true,
      logging: false
    });

    const link = document.createElement("a");
    link.download = "weekly-report.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    window.showToast?.("周报图片已生成", "完成", "success");
  }catch(err){
    console.error("export weekly poster error:", err);
    window.showToast?.("图片生成失败", "错误", "error");
  }finally{
    stage.remove();
    exportBtn.disabled = false;
    exportBtn.textContent = "导出图片";
  }
}

function waitForPosterImages(root){
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(images.map(img => {
    if(img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

function renderEditorEvents(report, modal){
  const box = modal.querySelector("#editor-event-list");
  if(!box) return;

  const dates = getDateRange(report.start_date, report.end_date);
  if(!dates.length){
    box.innerHTML = `<div class="weekly-empty">请先选择日期。</div>`;
    return;
  }

  const eventMap = parseEventNotes(report.event_notes, report);
  box.innerHTML = dates.map(date => `
<label class="editor-event-item">
  <span>${formatChineseDate(date)}</span>
  <textarea data-event-date="${date}" placeholder="这一天发生了什么">${escapeHtml(eventMap[date] || "")}</textarea>
</label>`).join("");
}

function collectEditorEvents(report, modal){
  const dates = getDateRange(report.start_date, report.end_date);
  const inputs = Array.from(modal.querySelectorAll("[data-event-date]"));
  const lines = [];

  dates.forEach(date => {
    const input = inputs.find(item => item.dataset.eventDate === date);
    const value = input?.value.trim() || "";
    if(value) lines.push(`${formatChineseDate(date)}\n${value}`);
  });

  return lines.join("\n\n");
}

function parseEventNotes(text, report){
  const raw = String(text || "").trim();
  const result = {};
  if(!raw) return result;

  const year = getReportYear(report);
  const lines = raw.split(/\r?\n/);
  let currentDate = "";
  let foundDateHeading = false;

  lines.forEach(line => {
    const match = line.trim().match(/^(\d{1,2})月(\d{1,2})日$/);
    if(match){
      currentDate = `${year}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
      foundDateHeading = true;
      result[currentDate] = result[currentDate] || [];
      return;
    }
    if(currentDate) result[currentDate].push(line);
  });

  Object.keys(result).forEach(date => {
    result[date] = result[date].join("\n").trim();
  });

  if(!foundDateHeading){
    const firstDate = getDateRange(report.start_date, report.end_date)[0];
    if(firstDate) result[firstDate] = raw;
  }

  return result;
}

function renderEditorMembers(report){
  const box = document.getElementById("editor-member-list");
  if(!box) return;

  sortItems(report);
  const items = report.weekly_report_items || [];

  if(!items.length){
    box.innerHTML = `<div class="weekly-empty">暂无成员</div>`;
    return;
  }

  box.innerHTML = items.map((item, index) => `
<div class="editor-member-card">
  <div class="editor-member-title">
    <strong>${escapeHtml(item.display_name || "匿名")}</strong>
    <button class="editor-remove-member" data-index="${index}" type="button">删除</button>
  </div>

  <label>打卡日期<div class="editor-date-list">${renderEditorDates(report, item, index)}</div></label>

  <label>代表图
    <div class="editor-cover-box">
      ${item.cover_image_url ? `<img src="${escapeAttr(item.cover_image_url)}">` : `<div>暂无图片</div>`}
      <button data-upload-index="${index}" type="button">上传</button>
    </div>
  </label>

  <label>总结<textarea data-summary-index="${index}">${escapeHtml(item.summary || "")}</textarea></label>
  <label>称号<input data-title-index="${index}" value="${escapeHtml(item.nickname_title || "")}"></label>
</div>`).join("");

  bindEditorMemberEvents(report);
}

function renderEditorDates(report, item, index){
  return getDateRange(report.start_date, report.end_date).map(date => `
<label class="editor-date-item">
  <input type="checkbox" data-date-index="${index}" value="${date}" ${(item.checkin_dates || []).includes(date) ? "checked" : ""}>
  ${date.slice(5)}
</label>`).join("");
}

function bindEditorMemberEvents(report){
  document.querySelectorAll(".editor-remove-member").forEach(btn => {
    btn.onclick = () => {
      report.weekly_report_items.splice(Number(btn.dataset.index), 1);
      renderEditorMembers(report);
      renderEditorPoster(report);
    };
  });

  document.querySelectorAll("[data-date-index]").forEach(input => {
    input.onchange = () => {
      const index = Number(input.dataset.dateIndex);
      report.weekly_report_items[index].checkin_dates = Array.from(
        document.querySelectorAll(`[data-date-index="${index}"]:checked`)
      ).map(x => x.value);
      renderEditorPoster(report);
    };
  });

  document.querySelectorAll("[data-summary-index]").forEach(input => {
    input.oninput = () => {
      report.weekly_report_items[Number(input.dataset.summaryIndex)].summary = input.value;
      renderEditorPoster(report);
    };
  });

  document.querySelectorAll("[data-title-index]").forEach(input => {
    input.oninput = () => {
      report.weekly_report_items[Number(input.dataset.titleIndex)].nickname_title = input.value;
      renderEditorPoster(report);
    };
  });

  document.querySelectorAll("[data-upload-index]").forEach(btn => {
    btn.onclick = () => {
      const index = Number(btn.dataset.uploadIndex);
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async e => {
        const file = e.target.files[0];
        if(!file) return;
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
  if(!box) return;
  renderWeeklyPoster(report, box, { columns: report.poster_columns || editorColumns });
}

function renderColumnOptions(selected){
  let html = "";
  for(let i = 6; i <= 18; i++){
    html += `<option value="${i}" ${Number(selected) === i ? "selected" : ""}>${i}</option>`;
  }
  return html;
}

function sortItems(report){
  report.weekly_report_items = (report.weekly_report_items || []).sort((a, b) => {
    return (a.display_name || "").localeCompare(b.display_name || "", "zh-CN");
  });
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function getDateRange(start, end){
  const result = [];
  if(!start || !end) return result;

  let d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  if(Number.isNaN(d.getTime()) || Number.isNaN(last.getTime()) || d > last) return result;

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatChineseDate(dateString){
  const date = new Date(dateString + "T00:00:00");
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getReportYear(report){
  const date = new Date((report.start_date || formatDate(new Date())) + "T00:00:00");
  return date.getFullYear();
}

function normalizeColor(value){
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ff6a16";
}

function escapeAttr(value){
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
