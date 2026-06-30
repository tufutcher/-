export function initSupabase(){
  return supabase.createClient(
    "https://jejjqydkfyacjxspesyh.supabase.co",
    "sb_publishable_qRW-sWNFzGuLJIYw4KWHlQ_COyRmj9B"
  );
}
