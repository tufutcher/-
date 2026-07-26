import {
  loadWeeklyReports,
  createWeeklyReport,
  deleteWeeklyReport,
  findOrCreateMember,
  saveWeeklyReportItems,
  uploadWeeklyCover
} from "../api/weekly_report.js";

let weeklyReportsCache = [];
let weeklyPosterColumns = 9;
let weeklyPosterImageFit = "cover";
let weeklyPosterImagePosition = "center";
let weeklyPosterFontScale = 1.4;

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
  const refreshBtn = modal.querySelector("#weekly-refresh");
  const createBtn = modal.querySelector("#weekly-create");

  if(closeBtn){
    closeBtn.onclick = () => modal.remove();
  }

  modal.onclick = e => {
    if(e.target === modal){
      modal.remove();
    }
  };

  if(refreshBtn){
    refreshBtn.onclick = async () => {
      await renderWeeklyReportList();
    };
  }

  if(createBtn){
    createBtn.onclick = async () => {
      await handleCreateWeeklyReport();
    };
  }
}

async function renderWeeklyReportList(){
  const list = document.getElementById("weekly-report-list");
  if(!list) return;

  weeklyReportsCache = await loadWeeklyReports(window.__sb);

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

function bindWeeklyListEvents(){
  document.querySelectorAll("[data-weekly-open]").forEach(btn => {
    btn.onclick = () => {
      openWeeklyEditor(btn.dataset.weeklyOpen);
    };
  });

  document.querySelectorAll("[data-weekly-preview]").forEach(btn => {
    btn.onclick = () => {
      openWeeklyPreview(btn.dataset.weeklyPreview);
    };
  });

  document.querySelectorAll("[data-weekly-delete]").forEach(btn => {
    btn.onclick = async () => {
      const reportId = btn.dataset.weeklyDelete;

      const ok = await window.showConfirm?.({
        title: "删除周报？",
        message: "这会删除这期周报和周报卡片。已被用户补全的打卡不会删除。",
        confirmText: "删除",
        cancelText: "取消"
      });

      if(!ok) return;

      const success = await deleteWeeklyReport(window.__sb, reportId);

      if(success){
        window.showToast?.("周报已删除。", "删除成功", "success");
        await renderWeeklyReportList();
      }else{
        window.showToast?.("周报删除失败。", "删除失败", "error");
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

async function openWeeklyEditor(reportId){
  const report = weeklyReportsCache.find(x => x.id === reportId);

  if(!report){
    window.showToast?.("找不到这份周报。", "打开失败", "error");
    return;
  }

  const old = document.getElementById("weekly-editor");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "weekly-editor";
  modal.className = "modal-bg detail-viewer-bg";

  modal.innerHTML =
    '<div class="weekly-editor-card">' +

      '<div class="weekly-editor-head">' +
        '<div>' +
          '<h2>' + escapeHtml(report.title) + '</h2>' +
          '<p>' + report.start_date + ' - ' + report.end_date + '</p>' +
        '</div>' +
        '<button id="weekly-editor-close" type="button">关闭</button>' +
      '</div>' +

      '<div class="weekly-member-list" id="weekly-member-list"></div>' +

      '<div class="weekly-editor-actions">' +
        '<button id="weekly-add-member" type="button">+ 添加成员</button>' +
        '<button id="weekly-save" type="button">保存周报</button>' +
      '</div>' +

    '</div>';

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#weekly-editor-close");
  if(closeBtn){
    closeBtn.onclick = () => modal.remove();
  }

  modal.onclick = e => {
    if(e.target === modal){
      modal.remove();
    }
  };

  renderWeeklyMembers(report);
  bindWeeklyEditorEvents(report, modal);
}

function bindWeeklyEditorEvents(report, modal){
  const addBtn = modal.querySelector("#weekly-add-member");
  const saveBtn = modal.querySelector("#weekly-save");

  if(addBtn){
    addBtn.onclick = async () => {
      const name = prompt("请输入成员名字");

      if(!name || !name.trim()){
        return;
      }

      const member = await findOrCreateMember(window.__sb, name.trim());

      if(!member){
        window.showToast?.("成员创建失败", "失败", "error");
        return;
      }

      const items = report.weekly_report_items || [];

      items.push({
        report_id: report.id,
        member_id: member.id,
        display_name: member.display_name,
        checkin_dates: [],
        cover_image_url: "",
        cover_storage_path: "",
        summary: "",
        nickname_title: "",
        sort_order: items.length
      });

      report.weekly_report_items = items;
      renderWeeklyMembers(report);
      bindWeeklyEditorEvents(report, modal);
    };
  }

  if(saveBtn){
    saveBtn.onclick = async () => {
      const items = report.weekly_report_items || [];

      if(!items.length){
        window.showToast?.("请至少添加一个成员。", "无法保存", "error");
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "保存中...";

      const savedItems = await saveWeeklyReportItems(
        window.__sb,
        report.id,
        items
      );

      if(savedItems){
        report.weekly_report_items = savedItems;

        window.showToast?.(
          "周报已保存，成员打卡已同步。",
          "保存成功",
          "success"
        );

        weeklyReportsCache = await loadWeeklyReports(window.__sb);
        renderWeeklyMembers(report);
        bindWeeklyEditorEvents(report, modal);
        await renderWeeklyReportList();

      }else{
        window.showToast?.("保存失败。", "失败", "error");
      }

      saveBtn.disabled = false;
      saveBtn.textContent = "保存周报";
    };
  }

  bindWeeklyMemberInputs(report, modal);
}

function renderWeeklyMembers(report){
  const box = document.getElementById("weekly-member-list");
  if(!box) return;

  const items = report.weekly_report_items || [];

  if(!items.length){
    box.innerHTML =
      '<div class="weekly-empty">还没有成员，点击添加成员。</div>';
    return;
  }

  box.innerHTML = items.map((item, index) => {
    return (
      '<div class="weekly-member-card" data-index="' + index + '">' +

        '<div class="weekly-member-head">' +
          '<h3>' + escapeHtml(item.display_name || "匿名") + '</h3>' +
          '<span>周报成员</span>' +
        '</div>' +

        '<div class="weekly-field">' +
          '<label>打卡日期</label>' +
          '<div class="weekly-date-picker">' +
            renderDateChoices(report, item, index) +
          '</div>' +
        '</div>' +

        '<div class="weekly-field">' +
          '<label>代表图</label>' +
          '<div class="weekly-cover-area">' +
            renderCover(item) +
            '<button class="weekly-upload-cover" data-index="' + index + '" type="button">上传代表图</button>' +
          '</div>' +
        '</div>' +

        '<div class="weekly-field">' +
          '<label>总结</label>' +
          '<textarea class="weekly-summary-input" data-index="' + index + '" placeholder="本周创作总结">' +
            escapeHtml(item.summary || "") +
          '</textarea>' +
        '</div>' +

        '<div class="weekly-field">' +
          '<label>称号</label>' +
          '<input class="weekly-title-input" data-index="' + index + '" value="' +
            escapeHtml(item.nickname_title || "") +
            '" placeholder="例如：结构狂魔">' +
        '</div>' +

      '</div>'
    );
  }).join("");
}

function renderDateChoices(report, item, index){
  return getDateRange(report.start_date, report.end_date).map(date => {
    const checked = (item.checkin_dates || []).includes(date);

    return (
      '<label class="weekly-date-item">' +
        '<input type="checkbox" class="weekly-date-checkbox" data-index="' + index + '" value="' + date + '"' +
          (checked ? " checked" : "") +
        '>' +
        '<span>' + formatShortDate(date) + '</span>' +
      '</label>'
    );
  }).join("");
}

function renderCover(item){
  if(item.cover_image_url){
    return '<img class="weekly-cover-preview" src="' + item.cover_image_url + '">';
  }

  return '<div class="weekly-cover-empty">暂无图片</div>';
}

function bindWeeklyMemberInputs(report, modal){
  modal.querySelectorAll(".weekly-date-checkbox").forEach(input => {
    input.onchange = () => {
      const index = Number(input.dataset.index);

      const checkedDates = Array.from(
        modal.querySelectorAll(
          '.weekly-date-checkbox[data-index="' + index + '"]:checked'
        )
      ).map(x => x.value);

      report.weekly_report_items[index].checkin_dates = checkedDates;
    };
  });

  modal.querySelectorAll(".weekly-summary-input").forEach(input => {
    input.oninput = () => {
      const index = Number(input.dataset.index);
      report.weekly_report_items[index].summary = input.value;
    };
  });

  modal.querySelectorAll(".weekly-title-input").forEach(input => {
    input.oninput = () => {
      const index = Number(input.dataset.index);
      report.weekly_report_items[index].nickname_title = input.value;
    };
  });

  modal.querySelectorAll(".weekly-upload-cover").forEach(btn => {
    btn.onclick = () => {
      const index = Number(btn.dataset.index);
      const input = document.createElement("input");

      input.type = "file";
      input.accept = "image/*";

      input.onchange = async e => {
        const file = e.target.files[0];
        if(!file) return;

        btn.disabled = true;
        btn.textContent = "上传中...";

        const url = await uploadWeeklyCover(window.__sb, file);

        if(url){
          report.weekly_report_items[index].cover_image_url = url;

          renderWeeklyMembers(report);
          bindWeeklyEditorEvents(report, modal);

          window.showToast?.("代表图上传成功", "完成", "success");
        }else{
          window.showToast?.("图片上传失败", "失败", "error");
          btn.disabled = false;
          btn.textContent = "上传代表图";
        }
      };

      input.click();
    };
  });
}

export function openWeeklyPreview(reportId){
  const report = weeklyReportsCache.find(x => x.id === reportId);

  if(!report){
    window.showToast?.("找不到周报", "错误", "error");
    return;
  }

  const old = document.getElementById("weekly-preview");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "weekly-preview";
  modal.className = "modal-bg detail-viewer-bg";

  modal.innerHTML =
    '<div class="weekly-preview-card">' +

      '<div id="weekly-poster-wrap"></div>' +

      '<div class="weekly-preview-actions">' +

        '<label class="weekly-column-control">' +
          '<span>每行人数</span>' +
          '<select id="weekly-column-select">' +
            '<option value="6">6</option>' +
            '<option value="7">7</option>' +
            '<option value="8">8</option>' +
            '<option value="9">9</option>' +
            '<option value="10">10</option>' +
          '</select>' +
        '</label>' +
        
        '<label class="weekly-column-control">' +
          '<span>图片显示</span>' +
          '<select id="weekly-image-fit-select">' +
            '<option value="cover">裁切铺满</option>' +
            '<option value="contain">完整显示</option>' +
          '</select>' +
        '</label>' +
        
        '<label class="weekly-column-control">' +
          '<span>图片位置</span>' +
          '<select id="weekly-image-position-select">' +
            '<option value="center">居中</option>' +
            '<option value="top">靠上</option>' +
            '<option value="bottom">靠下</option>' +
          '</select>' +
        '</label>' +
        
        '<label class="weekly-column-control">' +
          '<span>字体大小</span>' +
          '<select id="weekly-font-scale-select">' +
            '<option value="0.8">小</option>' +
            '<option value="1">正常</option>' +
            '<option value="1.2">大</option>' +
            '<option value="1.4">特大</option>' +
          '</select>' +
        '</label>' +
        
        '<button id="weekly-export-image" type="button">导出图片</button>' +
        '<button id="weekly-preview-close" type="button">关闭</button>' +

      '</div>' +

    '</div>';

  document.body.appendChild(modal);

  renderWeeklyPoster(report, modal);

  const columnSelect = modal.querySelector("#weekly-column-select");

  if(columnSelect){
    columnSelect.value = String(weeklyPosterColumns);

    columnSelect.onchange = () => {
      weeklyPosterColumns = Number(columnSelect.value) || 6;
      renderWeeklyPoster(report, modal);
    };
  }

  const imageFitSelect = modal.querySelector("#weekly-image-fit-select");

if(imageFitSelect){
  imageFitSelect.value = weeklyPosterImageFit;

  imageFitSelect.onchange = () => {
    weeklyPosterImageFit = imageFitSelect.value || "cover";
    renderWeeklyPoster(report, modal);
  };
}


const imagePositionSelect = modal.querySelector("#weekly-image-position-select");

if(imagePositionSelect){
  imagePositionSelect.value = weeklyPosterImagePosition;

  imagePositionSelect.onchange = () => {
    weeklyPosterImagePosition = imagePositionSelect.value || "center";
    renderWeeklyPoster(report, modal);
  };
}

const fontScaleSelect = modal.querySelector("#weekly-font-scale-select");

if(fontScaleSelect){
  fontScaleSelect.value = String(weeklyPosterFontScale);

  fontScaleSelect.onchange = () => {
    weeklyPosterFontScale = Number(fontScaleSelect.value) || 1;
    renderWeeklyPoster(report, modal);
  };
}

  const exportBtn = modal.querySelector("#weekly-export-image");

  if(exportBtn){
    exportBtn.onclick = async () => {
      const poster = modal.querySelector(".weekly-poster-canvas");

      if(!poster){
        return;
      }

      if(typeof html2canvas === "undefined"){
        window.showToast?.(
          "html2canvas 没有加载，请检查 index.html。",
          "导出失败",
          "error"
        );
        return;
      }

      exportBtn.disabled = true;
      exportBtn.textContent = "生成中...";

      poster.classList.add("is-exporting");

      const themeColor = report.theme_color || "#ff6a16";

      const canvas = await html2canvas(poster, {
        scale: 2,
        backgroundColor: themeColor,
        useCORS: true
      });

      poster.classList.remove("is-exporting");

      const link = document.createElement("a");
      link.download = "weekly-report.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      exportBtn.disabled = false;
      exportBtn.textContent = "导出图片";

      window.showToast?.("周报图片已生成。", "完成", "success");
    };
  }

  const closeBtn = modal.querySelector("#weekly-preview-close");

  if(closeBtn){
    closeBtn.onclick = () => modal.remove();
  }

  modal.onclick = e => {
    if(e.target === modal){
      modal.remove();
    }
  };
}

function renderWeeklyPoster(report, modal){
  const wrap = modal.querySelector("#weekly-poster-wrap");
  if(!wrap) return;

  const themeColor = report.theme_color || "#ff6a16";
  const items = report.weekly_report_items || [];

  const selectedColumns = weeklyPosterColumns || 6;
  const actualColumns = Math.max(
    1,
    Math.min(selectedColumns, Math.max(items.length, 1))
  );

  const rows = Math.max(1, Math.ceil(items.length / actualColumns));

  const cardWidth = 106;
  const cardHeight = 318;
  const cardGap = 7;
  
  const leftWidth = 205;
  const sideWidth = 26;
  const paddingLeft = 42;
  const paddingRight = 22;
  const mainGap = 14;

  const posterWidth =
    paddingLeft +
    leftWidth +
    mainGap +
    actualColumns * cardWidth +
    Math.max(0, actualColumns - 1) * cardGap +
    mainGap +
    sideWidth +
    paddingRight;

  const posterHeight =
    42 +
    rows * cardHeight +
    Math.max(0, rows - 1) * cardGap +
    42;

  const cardsHtml = items.map(item => {
    const days = item.checkin_dates?.length || 0;
    const badge = getWeeklyBadge(days);
    const dates = renderMiniDateLine(report, item);

    const imageHtml = item.cover_image_url
      ? '<img src="' + item.cover_image_url + '" crossorigin="anonymous">'
      : '<div class="weekly-poster-empty-img">暂无图片</div>';

    return (
      '<div class="weekly-poster-card">' +

        '<div class="weekly-poster-img">' +
          imageHtml +
          '<div class="weekly-poster-img-mask"></div>' +

          '<div class="weekly-poster-card-info">' +
            '<div class="weekly-poster-badge">' +
              '<span class="weekly-poster-badge-icon">' + badge + '</span>' +
              '<span>打卡' + days + '天</span>' +
            '</div>' +

            '<div class="weekly-poster-name">' +
              escapeHtml(item.display_name || "匿名") +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="weekly-poster-card-text">' +
          '<p>' + escapeHtml(item.summary || "本周也在努力画画。") + '</p>' +
          '<strong>获得称号</strong>' +
          '<b>「' + escapeHtml(item.nickname_title || "继续创作中") + '」</b>' +
        '</div>' +

        '<div class="weekly-poster-date-line">' +
          dates +
        '</div>' +

      '</div>'
    );
  }).join("");

  wrap.innerHTML =
    '<div class="weekly-poster-canvas" style="' +
      '--weekly-theme:' + themeColor + ';' +
      '--poster-cols:' + actualColumns + ';' +
      '--poster-width:' + posterWidth + 'px;' +
      '--poster-height:' + posterHeight + 'px;' +
      '--poster-card-width:' + cardWidth + 'px;' +
      '--poster-card-height:' + cardHeight + 'px;' +
      '--poster-card-gap:' + cardGap + 'px;' +
      '--poster-image-fit:' + weeklyPosterImageFit + ';' +
      '--poster-image-position:' + weeklyPosterImagePosition + ';' +
      '--poster-font-scale:' + weeklyPosterFontScale + ';' +
    '">' +

      '<div class="weekly-poster-left">' +

        '<div class="weekly-poster-date-vertical">' +
          formatPosterDate(report.start_date, report.end_date) +
        '</div>' +

        '<div class="weekly-poster-title-vertical">' +
          '<span>本</span>' +
          '<span>周</span>' +
          '<span>创</span>' +
          '<span>作</span>' +
          '<span>报</span>' +
          '<span>告</span>' +
        '</div>' +

        '<div class="weekly-poster-event-box">' +
          '<div class="weekly-poster-event-title">' +
            '<span>这</span><span>周</span><span>群</span><span>里</span>' +
            '<br>' +
            '<span>发</span><span>生</span><span>了</span><span>啥</span>' +
          '</div>' +

          '<div class="weekly-poster-event-content ' + getEventTextClass(report.event_notes) + '">' +
            formatEventText(report.event_notes || "本周还没有填写群事件。") +
          '</div>' +
        '</div>' +

      '</div>' +

      '<div class="weekly-poster-main">' +
        '<div class="weekly-poster-grid">' +
          cardsHtml +
        '</div>' +
      '</div>' +

      '<div class="weekly-poster-side-text">' +
        '<span>不</span>' +
        '<span>画</span>' +
        '<span>画</span>' +
        '<span>真</span>' +
        '<span>的</span>' +
        '<span>要</span>' +
        '<span>完</span>' +
        '<span>了</span>' +
      '</div>' +

    '</div>';
}

function getDateRange(start, end){
  const dates = [];
  let current = new Date(start);
  const last = new Date(end);

  while(current <= last){
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");

    dates.push(y + "-" + m + "-" + d);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatShortDate(date){
  const d = new Date(date);
  return (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

function getEventTextClass(text){
  const length = String(text || "").length;

  if(length > 160){
    return "is-micro";
  }

  if(length > 100){
    return "is-tiny";
  }

  if(length > 55){
    return "is-small";
  }

  return "";
}

function getWeeklyBadge(days){
  if(days >= 6) return "🔥";
  if(days >= 4) return "⭐";
  if(days >= 2) return "🎨";
  return "★";
}

function formatPosterDate(start, end){
  return start.replaceAll("-", ".") + " - " + end.replaceAll("-", ".");
}

function formatEventText(text){
  return escapeHtml(text)
    .replaceAll("\n", "<br>");
}

function renderMiniDateLine(report, item){
  const allDates = getDateRange(report.start_date, report.end_date);
  const checkedDates = item.checkin_dates || [];

  return allDates.map(date => {
    const active = checkedDates.includes(date);

    return (
      '<span class="' + (active ? "active" : "") + '">' +
        new Date(date).getDate() +
      '</span>'
    );
  }).join("");
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
