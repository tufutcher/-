export function initSupabase(){
  return supabase.createClient(
    "https://xxxx.supabase.co",
    "anon_key"
  );
}
