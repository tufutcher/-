export async function uploadImage(sb,file,path){

  await sb.storage.from("art").upload(path,file);

  const { data } = sb.storage.from("art").getPublicUrl(path);

  return data.publicUrl;
}
