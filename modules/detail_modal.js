import { state } from "../core/state.js";
import { openReadonlyProfileModal } from "./profile.js";
import { openEditModal } from "./edit_modal.js";

function fmtDate(date){
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function dateKey(date){
  const d = new Date(date);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

// 月历某一天的作品弹窗
export function openCalendarDayModal(dayKey, mine, readonly){
  const old = document.getElementById("calendar-day-modal");
  if(old) old.remove();

  const items = mine.filter(item => dateKey(item.created_at) === dayKey);
  if(!items.length) return;

  const modal = document.createElement("div");
  modal.id = "calendar-day-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const totalImages = items.reduce((sum, item) => {
    return sum + (item.checkin_images?.length || 0);
  }, 0);

  const galleryHtml = items.map(item => {
    const imgs = item.checkin_images || [];

    return imgs.map(img => {
      return (
        '<button class="calendar-gallery-tile" data-checkin-id="' + item.id + '" type="button">' +
          '<img src="' + img.image_url + '">' +
          (item.note ? '<span class="calendar-gallery-note">' + item.note + '</span>' : '') +
        '</button>'
      );
    }).join("");
  }).join("");

  modal.innerHTML =
    '<div class="detail-viewer-card calendar-gallery-card">' +
      '<div class="detail-viewer-head">' +
        '<div>' +
          '<div class="detail-author">' + fmtDate(items[0].created_at) + '</div>' +
          '<div class="detail-date">' + items.length + ' 次打卡 / ' + totalImages + ' 张作品</div>' +
        '</div>' +
      '</div>' +

      '<div class="calendar-gallery-board">' +
        galleryHtml +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  bindBaseModalClose(modal);

  modal.querySelectorAll("[data-checkin-id]").forEach(tile => {
    tile.onclick = () => {
      const item = items.find(x => x.id === tile.dataset.checkinId);
      if(!item) return;

      modal.remove();
      openProfileCheckinDetail(item, readonly);
    };
  });
}

// 个人页 / 他人主页里的打卡详情弹窗
export function openProfileCheckinDetail(item, readonly = false){
  const old = document.getElementById("profile-detail-modal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "profile-detail-modal";
  modal.className = "modal-bg detail-viewer-bg";

  const imgs = item.checkin_images || [];
  const profile = state.profiles.find(p => p.id === item.user_id);
  const avatarUrl = profile?.avatar_url;
  const username = item.username || profile?.username || "匿名";
  const avatarLetter = username.trim().slice(0, 1) || "匿";

  const authorAvatarHtml = avatarUrl
    ? '<img class="detail-avatar" src="' + avatarUrl + '">'
    : '<div class="detail-avatar detail-avatar-fallback">' + avatarLetter + '</div>';

  const imagesHtml = imgs.map(img => {
    const tagsHtml = img.tags?.length
      ? (
        '<div class="tags detail-tags">' +
          img.tags.map(t => '<span>#' + t + '</span>').join("") +
        '</div>'
      )
      : "";

    return (
      '<div class="detail-art-block">' +
        '<img src="' + img.image_url + '">' +
        tagsHtml +
      '</div>'
    );
  }).join("");

  modal.innerHTML =
    '<div class="detail-viewer-card">' +

      '<div class="detail-viewer-head">' +
        '<button class="detail-author-card" data-profile-user-id="' + item.user_id + '" type="button">' +
          authorAvatarHtml +
          '<div>' +
            '<div class="detail-author">' + username + '</div>' +
            '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
          '</div>' +
        '</button>' +
      '</div>' +

      '<div class="detail-art-list">' +
        imagesHtml +
      '</div>' +

      (item.note ? '<div class="note detail-note">' + item.note + '</div>' : '') +

      (!readonly ? (
        '<div class="detail-actions">' +
          '<button id="profile-detail-edit">编辑</button>' +
        '</div>'
      ) : '') +

    '</div>';

  document.body.appendChild(modal);
  bindBaseModalClose(modal);

  const authorCard = modal.querySelector(".detail-author-card");
  if(authorCard){
    authorCard.onclick = () => {
      const userId = authorCard.dataset.profileUserId;
      if(!userId) return;

      modal.remove();
      openReadonlyProfileModal(userId);
    };
  }

  const editBtn = document.getElementById("profile-detail-edit");
  if(editBtn){
    editBtn.onclick = () => {
      modal.remove();
      openEditModal(item);
    };
  }
}

function bindBaseModalClose(modal){
  modal.onclick = (e) => {
    if(e.target === modal){
      modal.remove();
      document.removeEventListener("keydown", escClose);
    }
  };

  const escClose = (e) => {
    if(e.key === "Escape"){
      modal.remove();
      document.removeEventListener("keydown", escClose);
    }
  };

  document.addEventListener("keydown", escClose);
}
