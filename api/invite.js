export async function checkInvite(sb, code){

  const { data, error } = await sb
    .from("invite_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .limit(1);

  if(error) return false;

  return data && data.length > 0;
}
