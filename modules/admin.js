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
