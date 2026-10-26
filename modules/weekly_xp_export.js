// 固定桌面排版宽度的 XP 排行榜 PNG 长图导出。
// 不依赖旧周报 Canvas 重绘器：只截排行榜自身，随人数自动延长高度。
const EXPORT_CSS_WIDTH = 1120;
const EXPORT_PIXEL_SCALE = 2;
const DESKTOP_ROW_COLUMNS = "36px minmax(150px,.9fr) minmax(195px,.9fr) minmax(250px,1.15fr) minmax(125px,.55fr)";

export async function exportXpLeaderboardPng(modal, button, filename){
  const source = modal?.querySelector("#weekly-xp-poster");
  if(!source) throw new Error("当前没有可导出的 XP 排行榜。");
  if(typeof window.html2canvas !== "function"){
    throw new Error("图片组件尚未加载，请刷新页面后重试。");
  }

  const previousLabel = button.textContent;
  let stage = null;
  let objectUrl = "";
  button.disabled = true;
  button.textContent = "正在生成长图…";

  try{
    stage = document.createElement("div");
    stage.className = "weekly-xp-export-stage";
    Object.assign(stage.style, {
      position:"fixed", left:"0", top:"0", zIndex:"-1",
      width:EXPORT_CSS_WIDTH + "px", height:"max-content",
      overflow:"visible", pointerEvents:"none", background:"#fff"
    });

    const poster = source.cloneNode(true);
    poster.removeAttribute("id");
    poster.classList.remove("weekly-xp-poster-empty");
    poster.style.setProperty("width", EXPORT_CSS_WIDTH + "px", "important");
    poster.style.setProperty("min-width", EXPORT_CSS_WIDTH + "px", "important");
    poster.style.setProperty("max-width", "none", "important");
    poster.style.setProperty("margin", "0", "important");
    poster.style.setProperty("border-radius", "0", "important");
    poster.style.setProperty("box-shadow", "none", "important");

    // 无论当前浏览器宽度如何，按桌面版最小宽度排版后再截长图。
    poster.querySelectorAll(".weekly-xp-person-row").forEach(row => {
      row.style.setProperty("grid-template-columns", DESKTOP_ROW_COLUMNS, "important");
      row.style.setProperty("gap", "12px", "important");
    });
    poster.querySelectorAll(".weekly-xp-counts,.weekly-xp-calendar-wrap,.weekly-xp-score").forEach(el => {
      el.style.setProperty("grid-column", "auto", "important");
      el.style.setProperty("grid-row", "auto", "important");
    });
    const metrics = poster.querySelector(".weekly-xp-overview-metrics");
    metrics?.style.setProperty("grid-template-columns", "repeat(4,minmax(0,1fr))", "important");

    stage.appendChild(poster);
    modal.appendChild(stage);

    if(document.fonts?.ready) await document.fonts.ready;
    // 等两个绘制帧，确保真实长图尺寸及字体布局已经稳定。
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const posterHeight = Math.ceil(poster.getBoundingClientRect().height);
    if(!posterHeight || posterHeight < 80) throw new Error("排行榜尺寸异常，请重新打开统计页。");

    // 大群体时降低倍率以防画布尺寸超过浏览器限制；CSS 宽度始终固定。
    const scale = Math.min(
      EXPORT_PIXEL_SCALE,
      16000 / posterHeight,
      Math.sqrt(48000000 / (EXPORT_CSS_WIDTH * posterHeight))
    );
    if(scale < 0.5) throw new Error("本次榜单过长，浏览器无法生成单张 PNG。请减少统计成员数量后重试。");

    const canvas = await window.html2canvas(poster, {
      backgroundColor:"#ffffff",
      scale,
      width:EXPORT_CSS_WIDTH,
      height:posterHeight,
      windowWidth:Math.max(1400, window.innerWidth),
      windowHeight:Math.max(900, posterHeight + 40),
      scrollX:0, scrollY:0,
      useCORS:true, allowTaint:false,
      logging:false
    });

    const blob = await new Promise((resolve,reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG 编码失败")), "image/png");
    });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = (filename || "经验值排行榜") + ".png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.showToast?.("排行榜长图已生成。", "导出成功", "success");
  }catch(error){
    console.error("export XP leaderboard PNG failed", error);
    window.showToast?.("长图导出失败：" + (error?.message || "未知错误"), "导出失败", "error");
    throw error;
  }finally{
    stage?.remove();
    button.disabled = false;
    button.textContent = previousLabel;
    if(objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}
