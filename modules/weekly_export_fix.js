// 周报导出补丁：不用 html2canvas 重画 DOM，改用原生 Canvas 直接绘制海报。
// 原因：html2canvas 对 writing-mode、object-fit、transform、emoji 的还原一直不稳定。
// 这个版本从当前预览 DOM 读取位置和内容，再自己画到 canvas，优先保证日期、代表图和卡片比例稳定。

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
    clone.classList.add("is-exporting", "weekly-export-clone", "weekly-export-native-clone");
    normalizeExportPoster(source, clone);

    stage.appendChild(clone);
    document.body.appendChild(stage);

    await inlineImages(clone);
    await waitForFonts();
    await waitForImages(clone);
    await nextFrame();

    btn.textContent = "生成图片中...";

    const canvas = await renderPosterCanvas(clone);
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
    console.error("weekly native export failed", error);
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
        img.removeAttribute("sizes");
        img.crossOrigin = "anonymous";
        img.src = dataUrl;
      }
    }catch(error){
      console.warn("weekly native export image inline failed", src, error);
    }
  }));
}

async function renderPosterCanvas(root){
  const width = Math.ceil(readPixelValue(root.style.width) || root.scrollWidth || root.offsetWidth);
  const height = Math.ceil(readPixelValue(root.style.height) || root.scrollHeight || root.offsetHeight);
  const scale = chooseExportScale(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const ctx = canvas.getContext("2d");
  if(!ctx) throw new Error("canvas context unavailable");

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const theme = readThemeColor(root);
  ctx.fillStyle = theme;
  ctx.fillRect(0, 0, width, height);

  drawLeftPanel(ctx, root, theme);
  await drawPosterCards(ctx, root, theme);
  drawRightSignature(ctx, root);

  return canvas;
}

function drawLeftPanel(ctx, root){
  const dateNode = root.querySelector(".weekly-poster-date-vertical");
  const titleNode = root.querySelector(".weekly-poster-title-vertical");
  const eventBox = root.querySelector(".weekly-poster-event-box");
  const leftPanel = root.querySelector(".weekly-poster-left");

  if(dateNode){
    const box = relRect(root, dateNode);
    const style = getComputedStyle(dateNode);
    drawVerticalText(ctx, dateNode.textContent || "", box.x + box.w / 2, box.y, {
      fontSize: px(style.fontSize, 12),
      weight: style.fontWeight || 900,
      color: "#fff",
      gap: 1.2,
      align: "center"
    });
  }

  if(titleNode){
    const box = relRect(root, titleNode);
    const style = getComputedStyle(titleNode);
    const text = (titleNode.textContent || "").replace(/\s+/g, "");
    drawVerticalText(ctx, text, box.x + box.w / 2, box.y, {
      fontSize: px(style.fontSize, 44),
      weight: style.fontWeight || 1000,
      color: "#fff",
      gap: 0,
      align: "center"
    });
  }

  if(eventBox){
    drawEventBox(ctx, root, eventBox);
  }else if(leftPanel){
    // 没有事件时，标题区域不再额外绘制空框，留出紧凑左栏。
  }
}

function drawEventBox(ctx, root, eventBox){
  const box = relRect(root, eventBox);
  const style = getComputedStyle(eventBox);

  ctx.save();
  drawRoundedRect(ctx, box.x, box.y, box.w, box.h, px(style.borderRadius, 8));
  ctx.strokeStyle = "rgba(255,255,255,.92)";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const content = eventBox.querySelector(".weekly-poster-event-content");
  if(content){
    const cbox = relRect(root, content);
    const cstyle = getComputedStyle(content);
    drawWrappedText(ctx, content.textContent || "", cbox.x, cbox.y + px(cstyle.fontSize, 10), cbox.w, {
      fontSize: px(cstyle.fontSize, 10),
      weight: cstyle.fontWeight || 400,
      color: "#fff",
      lineHeight: px(cstyle.lineHeight, px(cstyle.fontSize, 10) * 1.45)
    });
  }
  ctx.restore();
}

async function drawPosterCards(ctx, root, theme){
  const cards = Array.from(root.querySelectorAll(".weekly-poster-card"));

  for(const card of cards){
    const cardBox = relRect(root, card);
    const cardStyle = getComputedStyle(card);

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(cardBox.x, cardBox.y, cardBox.w, cardBox.h);
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardBox.x, cardBox.y, cardBox.w, cardBox.h);
    ctx.restore();

    const imgBox = card.querySelector(".weekly-poster-img");
    if(imgBox){
      await drawCardImage(ctx, root, imgBox);
      drawImageMask(ctx, root, imgBox);
      drawCardOverlayText(ctx, root, card, theme);
    }

    const textBox = card.querySelector(".weekly-poster-card-text");
    if(textBox){
      drawCardText(ctx, root, textBox, theme);
    }

    const dateLine = card.querySelector(".weekly-poster-date-line");
    if(dateLine){
      drawDateLine(ctx, root, dateLine, theme);
    }
  }
}

async function drawCardImage(ctx, root, imgBox){
  const box = relRect(root, imgBox);
  const img = imgBox.querySelector("img");

  ctx.fillStyle = "#eee";
  ctx.fillRect(box.x, box.y, box.w, box.h);

  if(!img?.src) return;

  await ensureImageReady(img);
  drawImageObjectFit(ctx, img, box.x, box.y, box.w, box.h, getComputedStyle(img).objectFit || "cover");
}

function drawImageMask(ctx, root, imgBox){
  const box = relRect(root, imgBox);
  const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(.55, "rgba(0,0,0,.12)");
  gradient.addColorStop(1, "rgba(0,0,0,.92)");

  ctx.fillStyle = gradient;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

function drawCardOverlayText(ctx, root, card){
  const info = card.querySelector(".weekly-poster-card-info");
  if(!info) return;

  const badge = card.querySelector(".weekly-poster-badge-icon");
  if(badge && badge.textContent.trim()){
    const box = relRect(root, badge);
    const style = getComputedStyle(badge);
    drawCenteredText(ctx, badge.textContent.trim(), box.x + box.w / 2, box.y + box.h * .72, {
      fontSize: px(style.fontSize, 16),
      weight: style.fontWeight || 900,
      color: "#fff"
    });
  }

  const days = card.querySelector(".weekly-poster-days");
  if(days && days.textContent.trim()){
    const box = relRect(root, days);
    const style = getComputedStyle(days);
    drawCenteredText(ctx, days.textContent.trim(), box.x + box.w / 2, box.y + box.h * .78, {
      fontSize: px(style.fontSize, 9),
      weight: style.fontWeight || 1000,
      color: "#fff"
    });
  }

  const name = card.querySelector(".weekly-poster-name");
  if(name && name.textContent.trim()){
    const box = relRect(root, name);
    const style = getComputedStyle(name);
    drawFittedCenteredText(ctx, name.textContent.trim(), box.x + box.w / 2, box.y + box.h * .78, box.w + 6, {
      fontSize: px(style.fontSize, 30),
      weight: style.fontWeight || 1000,
      color: "#fff",
      strokeColor: "rgba(255,255,255,.92)",
      strokeWidth: .5
    });
  }
}

function drawCardText(ctx, root, textBox, theme){
  const box = relRect(root, textBox);
  const p = textBox.querySelector("p");
  const strong = textBox.querySelector("strong");
  const b = textBox.querySelector("b");

  if(p){
    const pbox = relRect(root, p);
    const style = getComputedStyle(p);
    drawWrappedText(ctx, p.textContent || "", pbox.x + 2, pbox.y + px(style.fontSize, 10), pbox.w - 4, {
      fontSize: px(style.fontSize, 10),
      weight: style.fontWeight || 400,
      color: theme,
      lineHeight: px(style.lineHeight, px(style.fontSize, 10) * 1.35),
      align: "center"
    });
  }

  if(strong){
    const sbox = relRect(root, strong);
    const style = getComputedStyle(strong);
    drawCenteredText(ctx, strong.textContent || "", sbox.x + sbox.w / 2, sbox.y + sbox.h * .82, {
      fontSize: px(style.fontSize, 8),
      weight: style.fontWeight || 400,
      color: withAlpha(theme, .62)
    });
  }

  if(b){
    const bbox = relRect(root, b);
    const style = getComputedStyle(b);
    drawCenteredText(ctx, b.textContent || "", bbox.x + bbox.w / 2, bbox.y + bbox.h * .78, {
      fontSize: px(style.fontSize, 11),
      weight: style.fontWeight || 900,
      color: theme
    });
  }
}

function drawDateLine(ctx, root, dateLine, theme){
  const box = relRect(root, dateLine);
  const spans = Array.from(dateLine.querySelectorAll("span"));
  const cols = 7;
  const cellW = box.w / cols;
  const rows = Math.max(1, Math.ceil(spans.length / cols));
  const cellH = box.h / rows;

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = "rgba(0,0,0,.08)";
  ctx.lineWidth = .8;

  for(let i = 0; i <= cols; i++){
    const x = box.x + i * cellW;
    ctx.beginPath();
    ctx.moveTo(x, box.y);
    ctx.lineTo(x, box.y + box.h);
    ctx.stroke();
  }

  for(let i = 0; i <= rows; i++){
    const y = box.y + i * cellH;
    ctx.beginPath();
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.w, y);
    ctx.stroke();
  }

  spans.forEach((span, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = box.x + col * cellW;
    const y = box.y + row * cellH;
    const active = span.classList.contains("active");

    ctx.fillStyle = active ? "#3a302b" : "rgba(58,48,43,.22)";
    ctx.font = `900 ${Math.max(5, Math.min(8, cellH * .58))}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(span.textContent || "", x + cellW / 2, y + cellH / 2 + .3);
  });

  ctx.restore();
}

function drawRightSignature(ctx, root){
  const node = root.querySelector(".poster-right");
  if(!node) return;

  const box = relRect(root, node);
  const style = getComputedStyle(node);
  const text = (node.textContent || "").replace(/\s+/g, "");

  drawVerticalText(ctx, text, box.x + box.w / 2, box.y, {
    fontSize: px(style.fontSize, 9),
    weight: style.fontWeight || 400,
    color: "rgba(255,255,255,.95)",
    gap: 3,
    align: "center"
  });
}

function drawImageObjectFit(ctx, img, x, y, w, h, fit){
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if(!iw || !ih || !w || !h) return;

  if(fit === "contain"){
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return;
  }

  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawVerticalText(ctx, text, x, y, opts = {}){
  const fontSize = opts.fontSize || 12;
  const gap = opts.gap ?? 2;
  const chars = Array.from(String(text || "").replace(/\s+/g, ""));

  ctx.save();
  ctx.font = `${opts.weight || 900} ${fontSize}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
  ctx.fillStyle = opts.color || "#fff";
  ctx.textAlign = opts.align || "center";
  ctx.textBaseline = "top";

  chars.forEach((char, index) => {
    ctx.fillText(char, x, y + index * (fontSize + gap));
  });

  ctx.restore();
}

function drawCenteredText(ctx, text, x, y, opts = {}){
  ctx.save();
  ctx.font = `${opts.weight || 800} ${opts.fontSize || 12}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
  ctx.fillStyle = opts.color || "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(text || ""), x, y);
  ctx.restore();
}

function drawFittedCenteredText(ctx, text, x, y, maxWidth, opts = {}){
  const value = String(text || "");
  let fontSize = opts.fontSize || 28;
  const minSize = Math.max(14, fontSize * .62);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  while(fontSize > minSize){
    ctx.font = `${opts.weight || 1000} ${fontSize}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
    if(ctx.measureText(value).width <= maxWidth) break;
    fontSize -= 1;
  }

  ctx.font = `${opts.weight || 1000} ${fontSize}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
  if(opts.strokeColor && opts.strokeWidth){
    ctx.strokeStyle = opts.strokeColor;
    ctx.lineWidth = opts.strokeWidth;
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = opts.color || "#fff";
  ctx.fillText(value, x, y);
  ctx.restore();
}

function drawWrappedText(ctx, text, x, y, maxWidth, opts = {}){
  const fontSize = opts.fontSize || 12;
  const lineHeight = opts.lineHeight || fontSize * 1.4;
  const chars = Array.from(String(text || ""));
  const lines = [];
  let line = "";

  ctx.save();
  ctx.font = `${opts.weight || 400} ${fontSize}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;

  chars.forEach(char => {
    const test = line + char;
    if(ctx.measureText(test).width > maxWidth && line){
      lines.push(line);
      line = char;
    }else{
      line = test;
    }
  });
  if(line) lines.push(line);

  ctx.fillStyle = opts.color || "#111";
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = "alphabetic";

  lines.slice(0, 3).forEach((item, index) => {
    const tx = opts.align === "center" ? x + maxWidth / 2 : x;
    ctx.fillText(item, tx, y + index * lineHeight);
  });

  ctx.restore();
}

function drawRoundedRect(ctx, x, y, w, h, radius){
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function relRect(root, node){
  const rootRect = root.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    w: rect.width,
    h: rect.height
  };
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

function ensureImageReady(img){
  if(img.complete && img.naturalWidth > 0) return Promise.resolve();

  return new Promise(resolve => {
    img.onload = resolve;
    img.onerror = resolve;
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
  return Promise.all(images.map(ensureImageReady));
}

function nextFrame(){
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function chooseExportScale(width, height){
  const maxPixels = 18000000;
  const baseScale = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
  const estimated = width * height * baseScale * baseScale;

  if(estimated <= maxPixels) return baseScale;

  return Math.max(1.4, Math.sqrt(maxPixels / Math.max(1, width * height)));
}

function readThemeColor(node){
  const style = getComputedStyle(node);
  const cssVar = style.getPropertyValue("--weekly-theme").trim();
  return cssVar || style.backgroundColor || "#ff6a16";
}

function readPixelValue(value){
  const match = String(value || "").match(/^([\d.]+)px$/);
  return match ? Number(match[1]) : 0;
}

function px(value, fallback){
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

function withAlpha(color, alpha){
  const hex = String(color || "").trim();
  if(/^#[0-9a-fA-F]{6}$/.test(hex)){
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
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
