import { checkInvite } from "/api/invite.js";

export async function auth(sb){
  const username = prompt("用户名");
  if(!username) return null;
  const password = prompt("密码");
  if(!password) return null;
  const email = username + "@x.com";

  // 先尝试登录（老用户走这条路）
  const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if(!signInError && signInData?.user){
    return signInData.user;
  }

  // 登录失败 -> 走注册流程，注册需要邀请码
  const invite = prompt("首次使用需要邀请码");
  const ok = await checkInvite(sb, invite);
  if(!ok){
    alert("邀请码错误，或该用户名密码不正确");
    return null;
  }

  const { data: signUpData, error: signUpError } = await sb.auth.signUp({
    email,
    password
  });
  if(signUpError){
    alert(signUpError.message);
    return null;
  }

  const user = signUpData?.user;
  if(!user){
    alert("注册失败，请重试");
    return null;
  }

  // 同步写入 profiles 表，否则 username 没有归属、个人主页查不到人
  const { error: profileError } = await sb.from("profiles").insert({
    id: user.id,
    username: username
  });
  if(profileError){
    // 常见原因：username 已被占用（unique 约束）
    alert("用户名可能已被占用：" + profileError.message);
  }

  return user;
}
