import { checkInvite, consumeInvite } from "./invite.js";
import {
  findOrCreateMember
} from "./weekly_report.js";

// 把任意昵称转换成邮箱安全字符串，同一个昵称结果一致
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

  const result = await sb.auth.signInWithPassword({
    email,
    password
  });

  if(result.error){
    return {
      user: null,
      error: result.error.message
    };
  }

  return {
    user: result.data.user,
    error: null
  };
}

export async function signUp(sb, username, password, invite){
  const inviteCheck = await checkInvite(sb, invite);

  if(!inviteCheck.ok){
    return {
      user: null,
      error: inviteCheck.error || "邀请码不正确"
    };
  }

  const email = usernameToEmail(username);

  const result = await sb.auth.signUp({
    email,
    password
  });

  if(result.error){
    return {
      user: null,
      error: result.error.message
    };
  }

  const user = result.data.user;

  if(!user){
    return {
      user: null,
      error: "注册失败，请重试"
    };
  }

  const member = await findOrCreateMember(sb, username);

  if(!member){
    return {
      user: null,
      error: "成员档案创建失败，请联系管理员"
    };
  }
  
  const profileResult =
    await sb
    .from("profiles")
    .insert({
  
      id:user.id,
  
      username:username,
  
      member_id:
        member?.id || null
  
    });

  if(profileResult.error){
    return {
      user: null,
      error: "用户名可能已被占用：" + profileResult.error.message
    };
  }

  const inviteConsume = await consumeInvite(sb, invite);

  if(!inviteConsume.ok){
    return {
      user: null,
      error: "邀请码使用失败：" + inviteConsume.error
    };
  }

  return {
    user,
    error: null
  };
}

export async function getCurrentUser(sb){
  const result = await sb.auth.getUser();
  return (result.data && result.data.user) ? result.data.user : null;
}
