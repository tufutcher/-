export function renderWall(items){

  return `
    <div>
      <div class="topbar">
        <button onclick="switchView('wall')">墙</button>
        <button onclick="switchView('me')">我的</button>
      </div>

      ${items.map(i=>`
        <div class="card">
          <b>${i.username}</b>
          <div>${i.note || ""}</div>

          ${i.checkin_images?.map(img=>`
            <img src="${img.image_url}" />
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}
