export async function loadCheckins(sb){

  const { data } = await sb
    .from("checkins")
    .select("*, checkin_images(*)")
    .order("created_at",{ascending:false});

  return data || [];
}

export async function createCheckin(sb, userId, note){

  return await sb.from("checkins").insert({
    user_id: userId,
    note
  }).select().single();
}
