// 周报编辑器体验补丁：
// 1. 新增全屏查看，方便直接截图当前预览。
// 2. 添加成员按钮固定到成员面板顶部。
// 3. 新增成员后自动滚到该成员。
// 4. 点击右侧海报卡片时，自动跳到左侧对应成员编辑卡。

let helperBound = false;
let mutationObserver = null;
let pendingAddSnapshot = null;
let enhanceQueued = false;

bindWeeklyEditorHelper();

function bindWeeklyEditorHelper(){
  if(helperBound) return;
  helperBound = true;

  injectHelperStyles();

  document.addEventListener("click", (event) => {
    const fullscreenBtn = event.target.closest?.("#editor-fullscreen-view");
    if(fullscreenBtn){
      event.preventDefault();
      event.stopPropagation();
      openWeeklyFullscreenView();
      return;
    }

    const addBtn = event.target.closest?.("#editor-add-member");
    if(addBtn){
      pendingAddSnapshot = snapshotMemberCards();
      return;
    }

    const posterCard = event.target.closest?.("#editor-poster .weekly-poster-card");
    if(posterCard){
      const cards = Array.from(document.querySelectorAll("#editor-poster .weekly-poster-card"));
      const index = cards.indexOf(posterCard);
      if(index >= 0){
        event.preventDefault();
        scrollToMemberIndex(index);
      }
    }
  }, true);

  mutationObserver = new MutationObserver(scheduleEnhanceEditor);
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  scheduleEnhanceEditor();
}

function scheduleEnhanceEditor(){
  if(enhanceQueued) return;
  enhanceQueued = true;

  requestAnimationFrame(() => {
    enhanceQueued = false;
    enhanceWeeklyEditor();
  });
}

function enhanceWeeklyEditor(){
  const editor = document.getElementById("weekly-editor");
  if(!editor) return;

  ensureFullscreenButton(editor);
  moveAddMemberButton(editor);
  annotatePreviewCards();

  if(pendingAddSnapshot){
    const target = findNewMemberCard(pendingAddSnapshot);
    if(target){
      pendingAddSnapshot = null;
      scrollToMemberCard(target);
    }
  }
}

function ensureFullscreenButton(editor){
  const actions = editor.querySelector(".weekly-settings-actions");
  if(!actions || editor.querySelector("#editor-fullscreen-view")) return;

  const btn = document.createElement("button");
  btn.id = "editor-fullscreen-view";
  btn.className = "editor-fullscreen-view";
  btn.type = "button";
  btn.textContent = "全屏查看";

  const exportBtn = actions.querySelector("#editor-export");
  actions.insertBefore(btn, exportBtn || null);
}

function moveAddMemberButton(editor){
  const panel = editor.querySelector('[data-panel-name="members"]');
  const list = editor.querySelector("#editor-member-list");
  const addBtn = editor.querySelector("#editor-add-member");

  if(!panel || !list || !addBtn) return;

  addBtn.classList.add("editor-add-member-sticky");

  if(addBtn.nextElementSibling !== list){
    panel.insertBefore(addBtn, list);
  }
}

function annotatePreviewCards(){
  const cards = Array.from(document.querySelectorAll("#editor-poster .weekly-poster-card"));

  cards.forEach((card, index) => {
    card.dataset.weeklyMemberIndex = String(index);
    card.classList.add("weekly-poster-card-clickable");
    card.title = "点击跳到左侧成员编辑";
  });
}

function snapshotMemberCards(){
  const map = new Map();

  getMemberCards().forEach(card => {
    const key = getMemberCardKey(card);
    map.set(key, (map.get(key) || 0) + 1);
  });

  return map;
}

function findNewMemberCard(snapshot){
  const seen = new Map();

  for(const card of getMemberCards()){
    const key = getMemberCardKey(card);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);

    if(count > (snapshot.get(key) || 0)){
      return card;
    }
  }

  return null;
}

function getMemberCards(){
  return Array.from(document.querySelectorAll("#editor-member-list .editor-member-card"));
}

function getMemberCardKey(card){
  return card.querySelector(".editor-member-title strong")?.textContent?.trim() || "__unknown__";
}

function activateMembersPanel(){
  const membersBtn = document.querySelector('[data-editor-panel="members"]');
  if(!membersBtn?.classList.contains("is-active")){
    membersBtn?.click();
  }
}

function scrollToMemberIndex(index){
  activateMembersPanel();

  requestAnimationFrame(() => {
    const cards = getMemberCards();
    const target = cards[index];
    if(target) scrollToMemberCard(target);
  });
}

function scrollToMemberCard(card){
  if(!card) return;

  card.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  card.classList.add("weekly-member-card-focus");
  setTimeout(() => {
    card.classList.remove("weekly-member-card-focus");
  }, 1200);
}

function openWeeklyFullscreenView(){
  const source = document.querySelector("#editor-poster .weekly-poster-canvas");
  if(!source){
    window.showToast?.("没有找到周报预览。", "无法全屏", "error");
    return;
  }

  document.getElementById("weekly-fullscreen-viewer")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "weekly-fullscreen-viewer";
  overlay.className = "weekly-fullscreen-viewer";

  const toolbar = document.createElement("div");
  toolbar.className = "weekly-fullscreen-toolbar";
  toolbar.innerHTML = `
    <div>
      <strong>全屏查看</strong>
      <span>直接截图这个页面即可</span>
    </div>
    <button type="button" id="weekly-fullscreen-close">关闭</button>
  `;

  const stage = document.createElement("div");
  stage.className = "weekly-fullscreen-stage";

  const clone = source.cloneNode(true);
  clone.classList.add("is-exporting", "weekly-fullscreen-poster");
  normalizeFullscreenClone(source, clone);

  stage.appendChild(clone);
  overlay.appendChild(toolbar);
  overlay.appendChild(stage);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", escClose);
  };

  const escClose = (event) => {
    if(event.key === "Escape") close();
  };

  document.addEventListener("keydown", escClose);
  overlay.querySelector("#weekly-fullscreen-close")?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if(event.target === overlay) close();
  });
}

function normalizeFullscreenClone(source, clone){
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

  const computed = getComputedStyle(source);
  clone.style.setProperty("grid-template-columns", computed.gridTemplateColumns, "important");
  clone.style.setProperty("padding", computed.padding, "important");
  clone.style.setProperty("column-gap", computed.columnGap, "important");
}

function injectHelperStyles(){
  if(document.getElementById("weekly-editor-helper-style")) return;

  const style = document.createElement("style");
  style.id = "weekly-editor-helper-style";
  style.textContent = `
    #weekly-editor .editor-add-member-sticky{
      position:sticky;
      top:0;
      z-index:20;
      margin:0 0 12px !important;
      box-shadow:0 10px 22px rgba(0,0,0,.08);
    }

    #weekly-editor .weekly-poster-card-clickable{
      cursor:pointer;
    }

    #weekly-editor .weekly-poster-card-clickable:hover{
      outline:2px solid rgba(255,255,255,.92);
      outline-offset:2px;
    }

    #weekly-editor .weekly-member-card-focus{
      outline:3px solid #0CC0DF;
      outline-offset:3px;
      animation:weekly-member-focus 1.2s ease-out;
    }

    @keyframes weekly-member-focus{
      0%{ transform:scale(.98); }
      35%{ transform:scale(1.015); }
      100%{ transform:scale(1); }
    }

    .weekly-fullscreen-viewer{
      position:fixed;
      inset:0;
      z-index:1000;
      overflow:auto;
      padding:70px 32px 32px;
      background:#111;
      box-sizing:border-box;
    }

    .weekly-fullscreen-toolbar{
      position:fixed;
      left:0;
      right:0;
      top:0;
      z-index:1001;
      height:54px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      padding:0 18px;
      box-sizing:border-box;
      background:rgba(17,17,17,.88);
      color:#fff;
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      border-bottom:1px solid rgba(255,255,255,.12);
    }

    .weekly-fullscreen-toolbar strong{
      display:block;
      font-size:15px;
      line-height:1.1;
    }

    .weekly-fullscreen-toolbar span{
      display:block;
      margin-top:2px;
      color:rgba(255,255,255,.58);
      font-size:12px;
    }

    .weekly-fullscreen-toolbar button{
      width:auto !important;
      margin:0 !important;
      padding:8px 14px !important;
      border-radius:999px !important;
      background:#fff !important;
      color:#111 !important;
      font-weight:850;
    }

    .weekly-fullscreen-stage{
      width:max-content;
      margin:0 auto;
      padding:18px;
      background:transparent;
      box-sizing:border-box;
    }

    .weekly-fullscreen-poster{
      box-shadow:0 24px 80px rgba(0,0,0,.45);
    }
  `;

  document.head.appendChild(style);
}
