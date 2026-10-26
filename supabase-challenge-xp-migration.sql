-- 将主题挑战从“10 XP × 倍率”改为每次固定经验值（默认 5），支持每份周报自定义。
-- 在 Supabase SQL Editor 执行一次；重复执行不会覆盖已经设置好的 challenge_xp。
-- 为已有周报保留原来的挑战分值：旧倍率 1/2/3 对应每次 10/20/30 经验值。

alter table public.weekly_reports
  add column if not exists challenge_xp integer;

update public.weekly_reports
set challenge_xp = greatest(1, least(3, coalesce(challenge_multiplier, 1))) * 10
where challenge_xp is null;

alter table public.weekly_reports
  alter column challenge_xp set default 5,
  alter column challenge_xp set not null;

alter table public.weekly_reports
  drop constraint if exists weekly_reports_challenge_xp_check;

alter table public.weekly_reports
  add constraint weekly_reports_challenge_xp_check
  check (challenge_xp between 0 and 1000);

-- 旧 challenge_multiplier 列仅用于兼容旧数据，不再用于新报告的计分。
