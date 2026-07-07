import {
  adminDeleteCheckinWithImages,
  adminPurgeUserData,
  loadCheckins
} from "../api/checkin.js";

function csvCell(value){
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

function downloadTextFile(filename, content, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();
  URL.revokeObjectURL(url);
}

function imageCount(item){
  return item.checkin_images?.length || 0;
}

function dateKey(date){
  const d = new Date(date);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function fmtDate(date){
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function startOfWeek(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

  return d;
}

function startOfMonth(date){
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);

  return d;
}

function getWeekKey(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;

  d.setUTCDate(d.getUTCDate() - dayNum);

  return d.getUTCFullYear() + "-" + d.getUTCMonth() + "-" + d.getUTCDate();
}

function computeStats(items){
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const weekDays = new Set();
  const monthDays = new Set();

  let weekImages = 0;
  let monthImages = 0;
  let totalImages = 0;

  items.forEach(item => {
    const d = new Date(item.created_at);
    const imgs = imageCount(item);

    totalImages += imgs;

    if(d >= weekStart){
      weekDays.add(dateKey(d));
      weekImages += imgs;
    }

    if(d >= monthStart){
      monthDays.add(dateKey(d));
      monthImages += imgs;
    }
  });

  return {
    weekDays: weekDays.size,
    weekImages,
    monthDays: monthDays.size,
    monthImages,
    totalImages
  };
}

function computeBadges(items){
  const byWeek = {};

  items.forEach(item => {
    const d = new Date(item.created_at);
    const key = getWeekKey(d);

    if(!byWeek[key]){
      byWeek[key] = new Set();
    }

    byWeek[key].add(d.toDateString());
  });

  let star = 0;
  let fire = 0;
  let palette = 0;

  Object.values(byWeek).forEach(daySet => {
    const days = daySet.size;

    if(days >= 7) palette++;
    else if(days >= 5) fire++;
    else if(days >= 3) star++;
  });

  return { star, fire, palette };
}

function getTagSummary(items){
  const tagCount = {};

  items.forEach(item => {
    (item.checkin_images || []).forEach(img => {
      (img.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
  });

  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag}×${count}`)
    .join(" / ");
}

function getProfileExportRows(state){
  const profiles = state.profiles || [];
  const checkins = state.checkins || [];

  return profiles.map(profile => {
    const items = checkins.filter(i => i.user_id === profile.id);
    const stats = computeStats(items);
    const badges = computeBadges(items);

    return {
      user_id: profile.id,
      username: profile.username || "",
      avatar_url: profile.avatar_url || "",
      checkin_count: items.length,
      week_days: stats.weekDays,
      week_images: stats.weekImages,
      month_days: stats.monthDays,
      month_images: stats.monthImages,
      total_images: stats.totalImages,
      badge_star: badges.star,
      badge_fire: badges.fire,
      badge_palette: badges.palette,
      top_tags: getTagSummary(items)
    };
  });
}

// 管理员导出：成员统计 CSV
export function exportAllProfilesCSV(state){
  const rows = getProfileExportRows(state);

  const headers = [
    "user_id",
    "username",
    "avatar_url",
    "checkin_count",
    "week_days",
    "week_images",
    "month_days",
    "month_images",
    "total_images",
    "badge_star",
    "badge_fire",
    "badge_palette",
    "top_tags"
  ];

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(","))
  ].join("\n");

  downloadTextFile(
    "drawclub_profiles_export.csv",
    "\ufeff" + csv,
    "text/csv;charset=utf-8"
  );
}

// 管理员导出：完整 JSON
export function exportAllProfilesJSON(state){
  const profiles = state.profiles || [];
  const checkins = state.checkins || [];

  const data = profiles.map(profile => {
    const items = checkins.filter(i => i.user_id === profile.id);
    const stats = computeStats(items);
    const badges = computeBadges(items);

    return {
      profile,
      stats,
      badges,
      top_tags: getTagSummary(items),
      checkins: items
    };
  });

  downloadTextFile(
    "drawclub_profiles_export.json",
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8"
  );
}

// 管理员通道入口卡片
export function renderAdminPanel(state){
  const profiles = state.profiles || [];
  const checkins = state.checkins || [];

  const totalImages = checkins.reduce((sum, item) => {
    return sum + (item.checkin_images?.length || 0);
  }, 0);

  return `
    <div class="card admin-card">
      <div class="admin-head">
        <div>
          <div class="glabel">管理员通道</div>
          <div class="admin-title">社群数据导出</div>
          <div class="admin-subtitle">
            当前成员 ${profiles.length} 人，打卡 ${checkins.length} 次，作品 ${totalImages} 张。
          </div>
        </div>
      </div>

      <div class="admin-actions">
        <button id="admin-export-csv">导出 Profile CSV</button>
        <button id="admin-export-json" class="secondary">导出完整 JSON</button>
        <button id="admin-manage-checkins" class="secondary">批量管理打卡</button>
        <button id="admin-purge-user" class="danger">清理用户痕迹</button>
      </div>
    </div>
  `;
}

// 管理员：批量管理和删除打卡
export function openAdminCheckinManager(state){
  const old = document.getElementById("admin-checkin-manager");
  if(old) old.remove();

  let checkins = [...(state.checkins || [])];
  const profiles = state.profiles || [];

  let selectedUserId = "all";
  let selectedDate = "";
  let searchText = "";

  const modal = document.createElement("div");
  modal.id = "admin-checkin-manager";
  modal.className = "modal-bg detail-viewer-bg";

  function userNameById(userId){
    const profile = profiles.find(p => p.id === userId);
    return profile?.username || "匿名";
  }

  function getFilteredCheckins(){
    return checkins.filter(item => {
      const imgs = item.checkin_images || [];
      const username = item.username || userNameById(item.user_id);
      const note = item.note || "";
      const day = dateKey(item.created_at);

      const matchUser = selectedUserId === "all" || item.user_id === selectedUserId;
      const matchDate = !selectedDate || day === selectedDate;
      const matchSearch = !searchText ||
        username.toLowerCase().includes(searchText.toLowerCase()) ||
        note.toLowerCase().includes(searchText.toLowerCase()) ||
        imgs.some(img => (img.tags || []).join(" ").toLowerCase().includes(searchText.toLowerCase()));

      return matchUser && matchDate && matchSearch;
    });
  }

  function renderRows(){
    const filtered = getFilteredCheckins();

    const rowsHtml = filtered.map(item => {
      const imgs = item.checkin_images || [];
      const cover = imgs[0];

      return `
        <div class="admin-checkin-row compact" data-checkin-id="${item.id}">
          <div class="admin-checkin-cover">
            ${cover ? `<img src="${cover.image_url}">` : ""}
          </div>

          <div class="admin-checkin-info">
            <div class="admin-checkin-line">
              <b>${item.username || userNameById(item.user_id)}</b>
              <span>${fmtDate(item.created_at)}</span>
              <em>${imgs.length} 张</em>
            </div>
          </div>

          <button class="admin-checkin-delete danger" data-checkin-id="${item.id}" type="button">
            删除
          </button>
        </div>
      `;
    }).join("");

    const list = modal.querySelector(".admin-checkin-list");
    const count = modal.querySelector("#admin-checkin-count");

    if(count){
      count.textContent = `筛选后 ${filtered.length} / 全部 ${checkins.length} 次打卡`;
    }

    if(list){
      list.innerHTML = rowsHtml || `<div class="empty">没有符合条件的打卡记录</div>`;
    }

    bindDeleteEvents();
  }

  function bindDeleteEvents(){
    modal.querySelectorAll(".admin-checkin-delete").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();

        const checkinId = btn.dataset.checkinId;
        const item = checkins.find(x => x.id === checkinId);

        const ok = await window.showConfirm?.({
          title: "删除这次打卡？",
          message: `将删除 ${item?.username || "匿名"} 的这次打卡和所有图片。这个动作不能撤回。`,
          confirmText: "删除",
          cancelText: "取消",
          danger: true
        });

        if(!ok) return;

        const sb = window.__sb;
        if(!sb){
          window.showToast?.("数据库连接失败，请刷新后重试。", "删除失败", "error");
          return;
        }

        btn.disabled = true;
        btn.textContent = "删除中...";

        const deleted = await adminDeleteCheckinWithImages(sb, checkinId);

        if(!deleted){
          btn.disabled = false;
          btn.textContent = "删除";
          return;
        }

        const freshCheckins = await loadCheckins(sb);

        checkins = [...freshCheckins];
        renderRows();

        if(window.setState){
          window.setState({ checkins: freshCheckins });
        }

        window.showToast?.("这次打卡已经删除。", "已删除", "success");
      };
    });
  }

  const userOptions = [
    `<option value="all">全部成员</option>`,
    ...profiles.map(profile => {
      const count = checkins.filter(item => item.user_id === profile.id).length;
      return `<option value="${profile.id}">${profile.username || "匿名"}（${count}）</option>`;
    })
  ].join("");

  modal.innerHTML = `
    <div class="detail-viewer-card admin-checkin-card compact">
      <button id="admin-checkin-close" class="detail-x" type="button">×</button>

      <div class="detail-viewer-head admin-manager-head">
        <div>
          <div class="detail-author">批量管理打卡</div>
          <div class="detail-date" id="admin-checkin-count">共 ${checkins.length} 次打卡</div>
        </div>
      </div>

      <div class="admin-filter-bar">
        <select id="admin-user-filter" class="admin-user-filter">
          ${userOptions}
        </select>

        <input type="date" id="admin-date-filter" class="admin-date-filter">

        <input
          type="search"
          id="admin-search-filter"
          class="admin-search-filter"
          placeholder="搜用户名 / 感想 / 标签"
        >

        <button id="admin-clear-filter" class="secondary" type="button">清空</button>
      </div>

      <div class="admin-checkin-list"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  const closeBtn = document.getElementById("admin-checkin-close");
  if(closeBtn){
    closeBtn.onclick = () => modal.remove();
  }

  const userFilter = document.getElementById("admin-user-filter");
  const dateFilter = document.getElementById("admin-date-filter");
  const searchFilter = document.getElementById("admin-search-filter");
  const clearBtn = document.getElementById("admin-clear-filter");

  if(userFilter){
    userFilter.onchange = () => {
      selectedUserId = userFilter.value;
      renderRows();
    };
  }

  if(dateFilter){
    dateFilter.onchange = () => {
      selectedDate = dateFilter.value;
      renderRows();
    };
  }

  if(searchFilter){
    searchFilter.oninput = () => {
      searchText = searchFilter.value.trim();
      renderRows();
    };
  }

  if(clearBtn){
    clearBtn.onclick = () => {
      selectedUserId = "all";
      selectedDate = "";
      searchText = "";

      userFilter.value = "all";
      dateFilter.value = "";
      searchFilter.value = "";

      renderRows();
    };
  }

  renderRows();
}

// 管理员：清理某个用户在网站内的公开数据
export function openAdminPurgeUserModal(state){
  const old = document.getElementById("admin-purge-user-modal");
  if(old) old.remove();

  const profiles = (state.profiles || []).filter(p => p.id !== state.user?.id);

  const modal = document.createElement("div");
  modal.id = "admin-purge-user-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const options = profiles.map(profile => {
    const count = (state.checkins || []).filter(item => item.user_id === profile.id).length;

    return '<option value="' + profile.id + '">' +
      (profile.username || "匿名") + '（' + count + ' 次打卡）' +
    '</option>';
  }).join("");

  modal.innerHTML =
    '<div class="detail-viewer-card admin-purge-card">' +
      '<div class="detail-viewer-head">' +
        '<div>' +
          '<div class="detail-author">清理用户痕迹</div>' +
          '<div class="detail-date">删除作品、头像、打卡记录和个人资料。Auth 用户需要之后去 Supabase 后台删除。</div>' +
        '</div>' +
      '</div>' +

      '<div class="admin-purge-box">' +
        '<label>选择用户</label>' +
        '<select id="admin-purge-user-select">' +
          '<option value="">请选择用户</option>' +
          options +
        '</select>' +

        '<div class="admin-purge-warning">' +
          '这个操作会删除该用户在网站里的公开痕迹，但不会删除 Supabase Authentication 里的登录账号。' +
        '</div>' +

        '<button id="admin-purge-confirm" class="danger" type="button">清理这个用户</button>' +
        '<button id="admin-purge-cancel" class="secondary" type="button">取消</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };

  document.getElementById("admin-purge-cancel").onclick = () => {
    modal.remove();
  };

  document.getElementById("admin-purge-confirm").onclick = async () => {
    const select = document.getElementById("admin-purge-user-select");
    const userId = select?.value;

    if(!userId){
      window.showToast?.("请先选择一个用户。", "还不能清理", "error");
      return;
    }

    const profile = profiles.find(p => p.id === userId);
    const username = profile?.username || "匿名";
    const count = (state.checkins || []).filter(item => item.user_id === userId).length;

    const ok = await window.showConfirm?.({
      title: "清理这个用户？",
      message: "将删除「" + username + "」的头像、" + count + " 次打卡、所有作品图片和个人资料。这个动作不能撤回。",
      confirmText: "确认清理",
      cancelText: "取消",
      danger: true
    });

    if(!ok) return;

    const sb = window.__sb;

    if(!sb){
      window.showToast?.("数据库连接失败，请刷新后重试。", "清理失败", "error");
      return;
    }

    const btn = document.getElementById("admin-purge-confirm");
    btn.disabled = true;
    btn.textContent = "清理中...";

    const cleaned = await adminPurgeUserData(sb, userId);

    if(!cleaned){
      btn.disabled = false;
      btn.textContent = "清理这个用户";
      return;
    }

    const freshCheckins = await loadCheckins(sb);

    if(window.setState){
      window.setState({
        checkins: freshCheckins,
        profiles: (state.profiles || []).filter(p => p.id !== userId)
      });
    }

    modal.remove();

    window.showToast?.(
      "网站内数据已清理。现在可以去 Supabase Authentication 删除这个用户账号。",
      "清理完成",
      "success"
    );
  };
}
