export function renderProfile(state){

  const mine = state.checkins.filter(i=>i.user_id === state.user.id);

  const week = mine.length;

  const star = Math.floor(week/3);
  const fire = Math.floor(week/5);
  const palette = Math.floor(week/7);

  return `
    <div class="card">
      <h3>我的主页</h3>

      <p>本周：${week}</p>

      <div>
        ⭐ ${star}
        🔥 ${fire}
        🎨 ${palette}
      </div>
    </div>
  `;
}
