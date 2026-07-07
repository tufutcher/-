const ICONS = {
  error: "!",
  success: "✓",
  info: "i"
};

export function showToast(message, title = "提示", type = "info"){
  removeModal("app-toast-modal");

  const modal = createModal("app-toast-modal", "app-toast-bg");

  modal.innerHTML =
    '<div class="app-toast-card">' +
      '<button class="app-toast-close" id="app-toast-close" type="button">×</button>' +
      toastIcon(type) +
      '<div class="app-toast-title">' + title + '</div>' +
      '<div class="app-toast-message">' + message + '</div>' +
    '</div>';

  document.body.appendChild(modal);

  bindClose(modal, [
    modal.querySelector("#app-toast-close")
  ]);
}

// 成功礼花弹窗
export function showConfettiSuccess(message = "打卡成功！"){
  removeModal("confetti-modal");

  const modal = createModal("confetti-modal", "confetti-bg");

  modal.innerHTML =
    '<div class="confetti-field">' + confettiPieces(48) + '</div>' +
    '<div class="confetti-card">' +
      '<div class="confetti-emoji">🎉</div>' +
      '<div class="confetti-title">' + message + '</div>' +
    '</div>';

  document.body.appendChild(modal);

  setTimeout(() => modal.classList.add("show"), 20);
  setTimeout(() => modal.remove(), 2300);
}

export function showConfirm({
  title = "确认操作",
  message = "确定要继续吗？",
  confirmText = "确认",
  cancelText = "取消",
  danger = false
} = {}){
  return new Promise(resolve => {
    removeModal("app-confirm-modal");

    const modal = createModal("app-confirm-modal", "app-toast-bg");

    modal.innerHTML =
      '<div class="app-toast-card app-confirm-card">' +
        '<button class="app-toast-close" id="app-confirm-close" type="button">×</button>' +
        toastIcon(danger ? "error" : "info", "!") +
        '<div class="app-toast-title">' + title + '</div>' +
        '<div class="app-toast-message">' + message + '</div>' +
        '<div class="app-confirm-actions">' +
          '<button id="app-confirm-cancel" class="secondary" type="button">' + cancelText + '</button>' +
          '<button id="app-confirm-ok" class="' + (danger ? "danger" : "") + '" type="button">' + confirmText + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    const close = (value) => {
      modal.remove();
      resolve(value);
    };

    modal.querySelector("#app-confirm-close").onclick = () => close(false);
    modal.querySelector("#app-confirm-cancel").onclick = () => close(false);
    modal.querySelector("#app-confirm-ok").onclick = () => close(true);

    modal.onclick = (e) => {
      if(e.target === modal) close(false);
    };
  });
}

function createModal(id, className){
  const modal = document.createElement("div");
  modal.id = id;
  modal.className = className;
  return modal;
}

function removeModal(id){
  const old = document.getElementById(id);
  if(old) old.remove();
}

function bindClose(modal, buttons = []){
  buttons.forEach(btn => {
    if(btn){
      btn.onclick = () => modal.remove();
    }
  });
  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };
}

function toastIcon(type, fallback){
  const icon = fallback || ICONS[type] || ICONS.info;

  return '<div class="app-toast-icon ' + type + '">' + icon + '</div>';
}

function confettiPieces(count){
  let html = "";

  for(let i = 0; i < count; i++){
    html += confettiPiece();
  }
  return html;
}

function confettiPiece(){
  const left = Math.random() * 100;
  const delay = Math.random() * 0.35;
  const size = 6 + Math.random() * 8;
  const rot = Math.random() * 360;

  return (
    '<span class="confetti-piece" style="' +
      'left:' + left + '%;' +
      'width:' + size + 'px;' +
      'height:' + (size * 1.4) + 'px;' +
      'animation-delay:' + delay + 's;' +
      'transform:rotate(' + rot + 'deg);' +
    '"></span>'
  );
}
