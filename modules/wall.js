export function renderWall(items){
  return `
    <div>
      <div class="topbar">
        <button onclick="switchView('wall')">墙</button>
        <button onclick="switchView('me')">我的</button>
      </div>
      ${
        items.length
          ? items.map(i => `
            <div class="card">
              <b>${i.username || "匿名"}</b>
              <div>${i.note || ""}</div>
              ${(i.checkin_images || []).map(img => `
                <img src="${img.image_url}" />
              `).join("")}
            </div>
          `).join("")
          : `<div class="card">还没有人打卡，点右下角"＋"第一个来！</div>`
      }
    </div>
  `;
}
