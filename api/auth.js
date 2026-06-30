import { checkInvite } from "./invite.js";

// 把任意昵称（含中文）转换成邮箱安全的英文字符串，同一个昵称每次转换结果一致
export function usernameToEmail(username){
  const raw = btoa(unescape(encodeURIComponent(username)));
  let safe = "";
  for(let i = 0; i < raw.length && safe.length < 30; i++){
    const c = raw[i];
    const code = raw.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    if(isDigit || isUpper || isLower){
      safe += c.toLowerCase();
    }
  }
  return safe + "@drawclub.app";
}

export async function signIn(sb, username, password){
  const email = usernameToEmail(username);
  const result = await sb.auth.signInWithPassword({ email: email, password: password });
  if(result.error){
    return { user: null, error: result.error.message };
  }
  return { user: result.data.user, error: null };
}

export async function signUp(sb, username, password, invite){
  const ok = await checkInvite(sb, invite);
  if(!ok){
    return { user: null, error: "邀请码不正确" };
  }

  const email = usernameToEmail(username);
  const result = await sb.auth.signUp({ email: email, password: password });
  if(result.error){
    return { user: null, error: result.error.message };
  }
  const user = result.data.user;
  if(!user){
    return { user: null, error: "注册失败，请重试" };
  }

  const profileResult = await sb.from("profiles").insert({
    id: user.id,
    username: username
  });
  if(profileResult.error){
    return { user: null, error: "用户名可能已被占用：" + profileResult.error.message };
  }

  return { user: user, error: null };
}

export async function getCurrentUser(sb){
  const result = await sb.auth.getUser();
  return (result.data && result.data.user) ? result.data.user : null;
}
