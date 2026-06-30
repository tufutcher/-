export async function uploadImage(sb, file, path){
  const { error } = await sb.storage.from("art").upload(path, file);
  if(error){
    alert("图片上传失败：" + error.message);
    return null;
  }
  const { data } = sb.storage.from("art").getPublicUrl(path);
  return data.publicUrl;
}
