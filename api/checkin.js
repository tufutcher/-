export async function loadCheckins(sb){
  const { data, error } = await sb
    .from("checkins")
    .select("*, checkin_images(*)")
    .order("created_at", { ascending: false });
  if(error){ console.error("loadCheckins error:", error); return []; }
  return data || [];
}

export async function createCheckin(sb, userId, username, note){
  const { data, error } = await sb
    .from("checkins")
    .insert({ user_id: userId, username, note })
    .select()
    .single();
  if(error){ alert("打卡失败：" + error.message); return null; }
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
