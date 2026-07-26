import { state } from "../core/state.js";
import { openReadonlyProfileModal } from "./profile.js";
import { openEditModal } from "./edit_modal.js";
import { openCheckinModal } from "./checkin_modal.js";

function fmtDate(date){
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function dateKey(date){
  const d = new Date(date);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function toDateInputValue(date){
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function canClaimProxyCheckin(item){
  return (
    state.user &&
    state.profile &&
    item.source === "weekly_report" &&
    !item.user_id &&
    state.profile.member_id &&
    item.member_id === state.profile.member_id
  );
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

    if(!imgs.length){
      const isProxy = item.source === "weekly_report";

      return (
        '<button class="calendar-gallery-tile calendar-gallery-proxy" data-checkin-id="' + item.id + '" type="button">' +
          '<div class="calendar-proxy-placeholder">' +
            '<strong>' + (isProxy ? "周报代录" : "暂无图片") + '</strong>' +
            '<span>' + (item.note || item.proxy_note || "点击查看详情") + '</span>' +
          '</div>' +
        '</button>'
      );
    }

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

  const isProxy = item.source === "weekly_report";
  const canClaim = canClaimProxyCheckin(item);

  const authorAvatarHtml = avatarUrl
    ? '<img class="detail-avatar" src="' + avatarUrl + '">'
    : '<div class="detail-avatar detail-avatar-fallback">' + avatarLetter + '</div>';

  const imagesHtml = imgs.length
    ? imgs.map(img => {
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
      }).join("")
    : (
      '<div class="detail-art-block proxy-detail-empty">' +
        '<div class="proxy-detail-placeholder">' +
          '<strong>' + (isProxy ? "这是一条周报代录打卡" : "暂无图片") + '</strong>' +
          '<span>' + (isProxy ? "可以点击下方按钮补录图片和感想。" : "还没有上传作品。") + '</span>' +
        '</div>' +
      '</div>'
    );

  const noteHtml = item.note || item.proxy_note
    ? '<div class="note detail-note">' + (item.note || item.proxy_note) + '</div>'
    : '';

  const actionsHtml = getDetailActionsHtml(item, readonly, canClaim);

  modal.innerHTML =
    '<div class="detail-viewer-card">' +

      '<div class="detail-viewer-head">' +
        '<button class="detail-author-card" data-profile-user-id="' + (item.user_id || "") + '" type="button">' +
          authorAvatarHtml +
          '<div>' +
            '<div class="detail-author">' + username + '</div>' +
            '<div class="detail-date">' + fmtDate(item.created_at) + '</div>' +
          '</div>' +
        '</button>' +
      '</div>' +

      (isProxy
        ? '<div class="proxy-checkin-tip">周报代录打卡</div>'
        : ''
      ) +

      '<div class="detail-art-list">' +
        imagesHtml +
      '</div>' +

      noteHtml +

      actionsHtml +

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

  const claimBtn = document.getElementById("profile-detail-claim");
  if(claimBtn){
    claimBtn.onclick = async () => {
      claimBtn.disabled = true;
      claimBtn.textContent = "补录中...";

      const presetDate = toDateInputValue(item.created_at);

      modal.remove();

      openCheckinModal({
        presetDate,
        onSuccess: () => {
          // 不强制刷新，避免提交后跳回首页
        }
      });
    };
  }
}

function getDetailActionsHtml(item, readonly, canClaim){
  if(canClaim){
    return (
      '<div class="detail-actions">' +
        '<button id="profile-detail-claim" type="button">补录这天打卡</button>' +
      '</div>'
    );
  }

  if(!readonly && item.user_id === state.user?.id){
    return (
      '<div class="detail-actions">' +
        '<button id="profile-detail-edit" type="button">编辑</button>' +
      '</div>'
    );
  }

  return "";
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
