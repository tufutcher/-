export async function loadCheckins(sb){
  const { data, error } = await sb
    .from("checkins")
    .select("*, checkin_images(*)")
    .order("created_at", { ascending: false });
  if(error){ console.error("loadCheckins error:", error); return []; }
  return data || [];
}

export async function createCheckin(sb, userId, username, note, createdAt){
  const payload = {
    user_id: userId,
    username,
    note
  };

  if(createdAt){
    payload.created_at = createdAt;
  }

  const { data, error } = await sb
    .from("checkins")
    .insert(payload)
    .select()
    .single();

  if(error){
    window.showToast?.("打卡失败：" + error.message, "提交失败", "error");
    return null;
  }

  return data;
}
export async function addCheckinImage(sb, checkinId, userId, imageUrl, storagePath, tags){
  const { data, error } = await sb
    .from("checkin_images")
    .insert({ checkin_id: checkinId, user_id: userId, image_url: imageUrl, storage_path: storagePath, tags: tags || [] })
    .select()
    .single();
  if(error){ alert("图片记录写入失败：" + error.message); return null; }
  return data;
}

export async function updateCheckinNote(sb, checkinId, note){
  const { error } = await sb.from("checkins").update({ note }).eq("id", checkinId);
  if(error){ alert("保存失败：" + error.message); return false; }
  return true;
}

export async function updateImageTags(sb, imageId, tags){
  const { error } = await sb.from("checkin_images").update({ tags }).eq("id", imageId);
  if(error){ alert("标签保存失败：" + error.message); return false; }
  return true;
}

export async function deleteCheckinWithImages(sb, checkinId, userId){
  const { data: imgs, error: imgErr } = await sb
    .from("checkin_images")
    .select("storage_path")
    .eq("checkin_id", checkinId)
    .eq("user_id", userId);

  if(imgErr){
    alert("读取图片失败：" + imgErr.message);
    return false;
  }

  const paths = (imgs || []).map(x => x.storage_path).filter(Boolean);

  if(paths.length){
    const { error: storageErr } = await sb.storage.from("art").remove(paths);

    if(storageErr){
      alert("图片文件删除失败，本次打卡没有删除。请稍后重试。\n" + storageErr.message);
      return false;
    }
  }

  const { error } = await sb
    .from("checkins")
    .delete()
    .eq("id", checkinId)
    .eq("user_id", userId);

  if(error){
    alert("删除打卡失败：" + error.message);
    return false;
  }

  return true;
}
export async function adminDeleteCheckinWithImages(sb, checkinId){
  const { data: imgs, error: imgErr } = await sb
    .from("checkin_images")
    .select("storage_path")
    .eq("checkin_id", checkinId);

  if(imgErr){
    window.showToast?.("读取图片失败：" + imgErr.message, "删除失败", "error");
    return false;
  }

  const paths = (imgs || []).map(x => x.storage_path).filter(Boolean);

  if(paths.length){
    const { error: storageErr } = await sb.storage.from("art").remove(paths);

    if(storageErr){
      window.showToast?.(
        "图片文件删除失败，本次打卡没有删除。\n" + storageErr.message,
        "删除失败",
        "error"
      );
      return false;
    }
  }

  const { error } = await sb.rpc("admin_delete_checkin", {
    target_checkin_id: checkinId
  });

  if(error){
    window.showToast?.("管理员删除失败：" + error.message, "删除失败", "error");
    return false;
  }

  return true;
}
