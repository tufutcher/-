import { uploadImage } from "../api/storage.js";

// 绑定头像上传：上传新头像，并尝试删除旧头像文件
export function bindAvatarUpload(state){
  const avatarTrigger = document.getElementById("avatar-trigger");
  const link = document.getElementById("avatar-upload-link");
  const avatarInput = document.getElementById("avatar-input");

  if(avatarTrigger && link){
    avatarTrigger.onclick = () => {
      link.classList.toggle("show");
    };
  }

  if(!link || !avatarInput) return;

  link.onclick = () => avatarInput.click();

  avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const sb = window.__sb;

    if(!sb || !state.user){
      window.showToast?.("登录状态异常，请刷新后重试。", "上传失败", "error");
      return;
    }

    const oldAvatarUrl = state.profile?.avatar_url || "";
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = "avatars/" + state.user.id + "_" + Date.now() + "_" + safeName;
    const url = await uploadImage(sb, file, path);

    if(!url){
      window.showToast?.("头像上传失败，请稍后重试。", "上传失败", "error");
      return;
    }

    const { error } = await sb
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", state.user.id);

    if(error){
      window.showToast?.("头像保存失败：" + error.message, "保存失败", "error");
      return;
    }

    await removeOldAvatar(sb, oldAvatarUrl);

    if(state.profile){
      state.profile.avatar_url = url;
    }

    updateAvatarPreview(url);

    link.classList.remove("show");
    window.showToast?.("头像已更新。", "保存成功", "success");
  };
}

async function removeOldAvatar(sb, oldAvatarUrl){
  const oldAvatar = getAvatarStorageInfoFromUrl(oldAvatarUrl);
  if(!oldAvatar) return;

  const { error } = await sb.storage
    .from(oldAvatar.bucket)
    .remove([oldAvatar.path]);

  if(error){
    console.warn("旧头像删除失败：", error);
  }
}

function updateAvatarPreview(url){
  const img = document.getElementById("avatar-img");

  if(img && img.tagName === "IMG"){
    img.src = url;
    img.style.background = "transparent";
  }
}

function getAvatarStorageInfoFromUrl(url){
  if(!url) return null;

  const marker = "/storage/v1/object/public/";
  const index = url.indexOf(marker);

  if(index === -1) return null;

  const rest = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  const parts = rest.split("/");
  const bucket = parts.shift();
  const path = parts.join("/");

  if(!bucket || !path) return null;

  return { bucket, path };
}
