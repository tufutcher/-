export function showToast(message, title = "提示", type = "info"){
  const old = document.getElementById("app-toast-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "app-toast-modal";
  modal.className = "app-toast-bg";

  const icon = type === "error" ? "!" : type === "success" ? "✓" : "i";

  modal.innerHTML =
    '<div class="app-toast-card">' +
      '<button class="app-toast-close" id="app-toast-close" type="button">×</button>' +
      '<div class="app-toast-icon ' + type + '">' + icon + '</div>' +
      '<div class="app-toast-title">' + title + '</div>' +
      '<div class="app-toast-message">' + message + '</div>' +
    '</div>';

  document.body.appendChild(modal);

  const closeBtn = document.getElementById("app-toast-close");
  if(closeBtn){
    closeBtn.onclick = () => modal.remove();
  }

  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
    }
  };
}

export function showConfettiSuccess(message = "打卡成功！"){
  const old = document.getElementById("confetti-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "confetti-modal";
  modal.className = "confetti-bg";

  let pieces = "";
  for(let i = 0; i < 48; i++){
    const left = Math.random() * 100;
    const delay = Math.random() * 0.35;
    const size = 6 + Math.random() * 8;
    const rot = Math.random() * 360;

    pieces +=
      '<span class="confetti-piece" style="' +
        'left:' + left + '%;' +
        'width:' + size + 'px;' +
        'height:' + (size * 1.4) + 'px;' +
        'animation-delay:' + delay + 's;' +
        'transform:rotate(' + rot + 'deg);' +
      '"></span>';
  }

  modal.innerHTML =
    '<div class="confetti-field">' + pieces + '</div>' +
    '<div class="confetti-card">' +
      '<div class="confetti-emoji">🎉</div>' +
      '<div class="confetti-title">' + message + '</div>' +
      '<div class="confetti-subtitle">今天也留下了一点创作的证据。</div>' +
    '</div>';

  document.body.appendChild(modal);

  setTimeout(() => {
    modal.classList.add("show");
  }, 20);

  setTimeout(() => {
    modal.remove();
  }, 2300);
}
