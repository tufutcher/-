-- supabase-artwork-migration.sql
-- 用于把现有 checkin_images 升级为“作品 / 进度”结构。
-- 在 Supabase SQL Editor 里执行一次即可。

alter table public.checkin_images
  add column if not exists artwork_id uuid,
  add column if not exists progress_label text default '作品',
  add column if not exists progress_order integer default 0,
  add column if not exists progress_date timestamptz,
  add column if not exists is_artwork_cover boolean default true;

-- 旧数据兼容：每一张旧图先作为独立作品。
update public.checkin_images
set artwork_id = id
where artwork_id is null;

-- 旧数据兼容：进度日期默认沿用所属打卡日期。
update public.checkin_images img
set progress_date = coalesce(img.progress_date, c.created_at)
from public.checkins c
where img.checkin_id = c.id
  and img.progress_date is null;

update public.checkin_images
set progress_label = coalesce(progress_label, '作品'),
    progress_order = coalesce(progress_order, 0),
    is_artwork_cover = coalesce(is_artwork_cover, true);

create index if not exists checkin_images_artwork_id_idx
on public.checkin_images(artwork_id);

create index if not exists checkin_images_progress_date_idx
on public.checkin_images(progress_date);
