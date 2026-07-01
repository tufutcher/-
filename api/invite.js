export async function checkInvite(sb, code){
  const { data, error } = await sb
    .from("invite_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if(error){
    return {
      ok: false,
      error: error.message
    };
  }

  if(!data){
    return {
      ok: false,
      error: "邀请码不存在或已失效"
    };
  }

  if((data.used_count || 0) >= (data.max_uses || 1)){
    return {
      ok: false,
      error: "这个邀请码已经被使用"
    };
  }

  return {
    ok: true,
    invite: data
  };
}

export async function consumeInvite(sb, code){
  const { error } = await sb.rpc("consume_invite", {
    invite_code: code
  });

  if(error){
    return {
      ok: false,
      error: error.message
    };
  }

  return {
    ok: true
  };
}
