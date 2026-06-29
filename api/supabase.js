export function initSupabase(){
  return supabase.createClient(
    "YOUR_URL",
    "YOUR_KEY"
  );
}
