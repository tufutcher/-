-- supabase-schema.sql

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  username text not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.checkin_images (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid references public.checkins(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  storage_path text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_images enable row level security;

create policy "profiles are public readable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "checkins public readable"
on public.checkins for select
to anon, authenticated
using (true);

create policy "users insert own checkins"
on public.checkins for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own checkins"
on public.checkins for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users delete own checkins"
on public.checkins for delete
to authenticated
using (user_id = auth.uid());

create policy "images public readable"
on public.checkin_images for select
to anon, authenticated
using (true);

create policy "users insert own images"
on public.checkin_images for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own images"
on public.checkin_images for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users delete own images"
on public.checkin_images for delete
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('art', 'art', true)
on conflict (id) do update set public = true;

create policy "authenticated users upload art files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'art');

create policy "public read art files"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'art');

create policy "users update own art files"
on storage.objects for update
to authenticated
using (bucket_id = 'art' and owner = auth.uid())
with check (bucket_id = 'art' and owner = auth.uid());

create policy "users delete own art files"
on storage.objects for delete
to authenticated
using (bucket_id = 'art' and owner = auth.uid());
