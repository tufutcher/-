import { checkInvite } from "api/invite.js";

export async function auth(sb){

  const username = prompt("用户名");
  const password = prompt("密码");
  const invite = prompt("邀请码");

  const ok = await checkInvite(sb, invite);

  if(!ok){
    alert("邀请码错误");
    return null;
  }

  const email = username + "@x.com";

  const { data, error } = await sb.auth.signUp({
    email,
    password
  });

  if(error){
    alert(error.message);
    return null;
  }

  const { data: userData } = await sb.auth.getUser();

  return userData?.user || null;
}
