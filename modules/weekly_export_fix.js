// 更稳的周报导出补丁。
// 直接从当前预览 DOM 克隆导出，避免重新渲染导致预览和导出不一致。
// 用捕获阶段拦截 #editor-export，阻止 weekly_editor.js 里旧的导出逻辑继续执行。

let weeklyExportPatchBound = false;

bindWeeklyExportPatch();

function bindWeeklyExportPatch(){
  if(weeklyExportPatchBound) return;
  weeklyExportPatchBound = true;

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest?.("#editor-export");
    if(!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    await exportCurrentWeeklyPoster(btn);
  }, true);
}

async function exportCurrentWeeklyPoster(btn){
  if(typeof html2canvas === "undefined"){
    window.showToast?.("缺少图片导出组件 html2canvas。", "导出失败", "error");
    return;
  }

  const source = document.querySelector("#editor-poster .weekly-poster-canvas");
  if(!source){
    window.showToast?.("没有找到周报预览，请重新打开编辑器。", "导出失败", "error");
    return;
  }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "整理图片中...";

  let stage = null;
  let blobUrl = "";

  try{
    stage = createExportStage();
    const clone = source.cloneNode(true);

    clone.classList.add("is-exporting", "weekly-export-clone");
    normalizeExportPoster(source, clone);

    stage.appendChild(clone);
    document.body.appendChild(stage);

    await inlineImages(clone);
    await waitForFonts();
    await waitForImages(clone);
    await nextFrame();

    btn.textContent = "生成图片中...";

    const width = Math.ceil(clone.scrollWidth || clone.offsetWidth || source.scrollWidth);
    const height = Math.ceil(clone.scrollHeight || clone.offsetHeight || source.scrollHeight);
    const scale = chooseExportScale(width, height);

    const canvas = await html2canvas(clone, {
      scale,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: getCanvasBackground(clone),
      useCORS: true,
      allowTaint: false,
      imageTimeout: 30000,
      logging: false,
      removeContainer: true
    });

    const blob = await canvasToBlob(canvas);
    blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.download = buildExportFilename();
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.showToast?.("周报图片已导出。", "导出成功", "success");
  }catch(error){
    console.error("weekly export patch failed", error);
    window.showToast?.("导出失败：" + (error?.message || "未知错误"), "导出失败", "error");
  }finally{
    if(blobUrl) URL.revokeObjectURL(blobUrl);
    if(stage) stage.remove();
    btn.disabled = false;
    btn.textContent = oldText || "导出图片";
  }
}

function createExportStage(){
  const stage = document.createElement("div");
  stage.id = "weekly-export-stage-live";

  Object.assign(stage.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "-1",
    width: "max-content",
    height: "max-content",
    overflow: "visible",
    pointerEvents: "none",
    opacity: "1",
    background: "transparent"
  });

  return stage;
}

function normalizeExportPoster(source, clone){
  const sourceStyle = source.getAttribute("style") || "";
  clone.setAttribute("style", sourceStyle);

  clone.style.setProperty("transform", "none", "important");
  clone.style.setProperty("transform-origin", "top left", "important");
  clone.style.setProperty("margin", "0", "important");
  clone.style.setProperty("max-width", "none", "important");
  clone.style.setProperty("max-height", "none", "important");
  clone.style.setProperty("position", "relative", "important");
  clone.style.setProperty("left", "0", "important");
  clone.style.setProperty("top", "0", "important");

  const sourceWidth = source.style.width || `${Math.ceil(source.scrollWidth || source.offsetWidth)}px`;
  const sourceHeight = source.style.height || `${Math.ceil(source.scrollHeight || source.offsetHeight)}px`;

  if(sourceWidth) clone.style.setProperty("width", sourceWidth, "important");
  if(sourceHeight) clone.style.setProperty("height", sourceHeight, "important");

  // 预览里无事件时会用 JS 运行时改窄左栏；clone 时把最终计算结果固化下来。
  const computed = getComputedStyle(source);
  clone.style.setProperty("grid-template-columns", computed.gridTemplateColumns, "important");
  clone.style.setProperty("padding", computed.padding, "important");
  clone.style.setProperty("column-gap", computed.columnGap, "important");
}

async function inlineImages(root){
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(images.map(async img => {
    const src = img.currentSrc || img.src;
    if(!src || src.startsWith("data:")) return;

    try{
      const dataUrl = await imageToDataUrl(src);
      if(dataUrl){
        img.removeAttribute("srcset");
        img.crossOrigin = "anonymous";
        img.src = dataUrl;
      }
    }catch(error){
      console.warn("weekly export image inline failed", src, error);
    }
  }));
}

async function imageToDataUrl(url){
  const response = await fetch(url, { mode: "cors", cache: "force-cache" });
  if(!response.ok) return "";

  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function waitForFonts(){
  if(document.fonts?.ready){
    return document.fonts.ready.catch(() => undefined);
  }

  return Promise.resolve();
}

function waitForImages(root){
  const images = Array.from(root.querySelectorAll("img"));

  return Promise.all(images.map(img => {
    if(img.complete && img.naturalWidth > 0) return Promise.resolve();

    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

function nextFrame(){
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function chooseExportScale(width, height){
  const maxPixels = 14000000;
  const baseScale = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
  const estimated = width * height * baseScale * baseScale;

  if(estimated <= maxPixels) return baseScale;

  return Math.max(1.5, Math.sqrt(maxPixels / Math.max(1, width * height)));
}

function getCanvasBackground(node){
  const bg = getComputedStyle(node).backgroundColor;
  return bg && bg !== "rgba(0, 0, 0, 0)" ? bg : null;
}

function canvasToBlob(canvas){
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if(blob) resolve(blob);
      else reject(new Error("canvas toBlob failed"));
    }, "image/png", 1);
  });
}

function buildExportFilename(){
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join("");

  return `weekly-report-${stamp}.png`;
}
