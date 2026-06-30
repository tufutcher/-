cat > /home/claude/auth.js << 'EOF'
import { checkInvite } from "./invite.js";

// 把任意昵称（含中文）转换成邮箱安全的英文字符串，同一个昵称每次转换结果一致
export function usernameToEmail(username){
  const encoded = btoa(unescape(encodeURIComponent(username)))
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 30);
  return encoded + "@x.com";
}

export async function signIn(sb, username, password){
  const email = usernameToEmail(username);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    return { user: null, error: error.message };
  }
  return { user: data.user, error: null };
}

export async function signUp(sb, username, password, invite){
  const ok = await checkInvite(sb, invite);
  if(!ok){
    return { user: null, error: "邀请码不正确" };
  }

  const email = usernameToEmail(username);
  const { data, error } = await sb.auth.signUp({ email, password });
  if(error){
    return { user: null, error: error.message };
  }
  const user = data.user;
  if(!user){
    return { user: null, error: "注册失败，请重试" };
  }

  const { error: profileError } = await sb.from("profiles").insert({
    id: user.id,
    username: username
  });
  if(profileError){
    return { user: null, error: "用户名可能已被占用：" + profileError.message };
  }

  return { user, error: null };
}

// 获取当前已登录用户（如果浏览器里有持久化的登录态）
export async function getCurrentUser(sb){
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}
EOF
echo done
