import {
  loadWeeklyReports,
  createWeeklyReport,
  deleteWeeklyReport
} from "../api/weekly_report.js";

import { openWeeklyEditor } from "./weekly_editor.js";

let weeklyReportsCache = [];

export async function openWeeklyReportManager(){
  const old = document.getElementById("weekly-report-manager");

  if(old){
    old.remove();
  }

  const modal = document.createElement("div");
  modal.id = "weekly-report-manager";
  modal.className = "modal-bg detail-viewer-bg";

  modal.innerHTML = `
<div class="weekly-manager-card">

  <div class="weekly-manager-head">
    <div>
      <h2>周报生成器</h2>
      <p>创建周报、录入成员打卡日期，并生成周报海报。</p>
    </div>

    <button id="weekly-close" type="button">
      关闭
    </button>
  </div>

  <div class="weekly-create-box">

    <label>
      标题
      <input
        id="weekly-title"
        value="本周创作报告"
      >
    </label>

    <label>
      开始日期
      <input
        id="weekly-start"
        type="date"
      >
    </label>

    <label>
      结束日期
      <input
        id="weekly-end"
        type="date"
      >
    </label>

    <label>
      主题色
      <input
        id="weekly-color"
        type="color"
        value="#ff6a16"
      >
    </label>

    <label>
      本周事件
      <textarea
        id="weekly-events"
        placeholder="写这周群里发生了什么。"
      ></textarea>
    </label>

    <label>
      贡献者
      <input
        id="weekly-contributors"
        placeholder="例如：安夏、古鸟"
      >
    </label>

    <button id="weekly-create" type="button">
      新建周报
    </button>

  </div>

  <div class="weekly-list-head">
    <h3>已有周报</h3>

    <button id="weekly-refresh" type="button">
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
  const close = modal.querySelector("#weekly-close");
  const refresh = modal.querySelector("#weekly-refresh");
  const create = modal.querySelector("#weekly-create");

  if(close){
    close.onclick = () => modal.remove();
  }

  modal.onclick = e => {
    if(e.target === modal){
      modal.remove();
    }
  };

  if(refresh){
    refresh.onclick = async () => {
      await renderWeeklyReportList();
    };
  }

  if(create){
    create.onclick = async () => {
      await handleCreateWeeklyReport();
    };
  }
}

async function renderWeeklyReportList(){
  const list = document.getElementById("weekly-report-list");

  if(!list){
    return;
  }

  weeklyReportsCache = await loadWeeklyReports(window.__sb);

  if(!weeklyReportsCache.length){
    list.innerHTML = `
<div class="weekly-empty">
  还没有周报。
</div>
`;
    return;
  }

  list.innerHTML = weeklyReportsCache.map(report => {
    const count = report.weekly_report_items?.length || 0;

    return `
<div class="weekly-report-row">

  <div>
    <strong>${escapeHtml(report.title)}</strong>
    <p>${report.start_date} - ${report.end_date} · ${count} 人</p>
  </div>

  <div class="weekly-row-actions">
    <button
      data-weekly-open="${report.id}"
      type="button"
    >
      编辑
    </button>

    <button
      data-weekly-delete="${report.id}"
      type="button"
    >
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
    .forEach(btn => {
      btn.onclick = () => {
        const report = weeklyReportsCache.find(
          item => item.id === btn.dataset.weeklyOpen
        );

        if(report){
          openWeeklyEditor(report);
        }
      };
    });

  document
    .querySelectorAll("[data-weekly-delete]")
    .forEach(btn => {
      btn.onclick = async () => {
        const reportId = btn.dataset.weeklyDelete;

        const ok = await window.showConfirm?.({
          title: "删除周报？",
          message: "删除这一期周报。",
          confirmText: "删除",
          cancelText: "取消"
        });

        if(!ok){
          return;
        }

        const success = await deleteWeeklyReport(
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
        }else{
          window.showToast?.(
            "删除失败",
            "错误",
            "error"
          );
        }
      };
    });
}

async function handleCreateWeeklyReport(){
  const title =
    document.getElementById("weekly-title").value.trim() ||
    "本周创作报告";

  const startDate =
    document.getElementById("weekly-start").value;

  const endDate =
    document.getElementById("weekly-end").value;

  const themeColor =
    document.getElementById("weekly-color").value;

  const eventNotes =
    document.getElementById("weekly-events").value;

  const contributors =
    document.getElementById("weekly-contributors").value;

  if(!startDate || !endDate){
    window.showToast?.(
      "请选择日期",
      "失败",
      "error"
    );
    return;
  }

  if(startDate > endDate){
    window.showToast?.(
      "开始日期不能晚于结束日期",
      "失败",
      "error"
    );
    return;
  }

  const result = await createWeeklyReport(
    window.__sb,
    {
      title,
      start_date: startDate,
      end_date: endDate,
      theme_color: themeColor,
      event_notes: eventNotes,
      contributors,

      poster_columns: 9,
      poster_name_font: 28,
      poster_card_font: 16,
      poster_event_font: 10
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

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
