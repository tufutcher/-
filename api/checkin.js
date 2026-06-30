export async function loadCheckins(sb){
  const { data, error } = await sb
    .from("checkins")
    .select("*, checkin_images(*)")
    .order("created_at", { ascending: false });
  if(error){
    console.error("loadCheckins error:", error);
    return [];
  }
  return data || [];
}

export async function createCheckin(sb, userId, username, note){
  const { data, error } = await sb
    .from("checkins")
    .insert({ user_id: userId, username, note })
    .select()
    .single();
  if(error){
    alert("打卡失败：" + error.message);
    return null;
  }
  return data;
}

export async function addCheckinImage(sb, checkinId, userId, imageUrl, storagePath, tags){
  const { data, error } = await sb
    .from("checkin_images")
    .insert({
      checkin_id: checkinId,
      user_id: userId,
      image_url: imageUrl,
      storage_path: storagePath,
      tags: tags || []
    })
    .select()
    .single();
  if(error){
    alert("图片记录写入失败：" + error.message);
    return null;
  }
  return data;
}
