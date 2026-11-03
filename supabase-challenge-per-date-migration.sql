-- 单次主题挑战经验值：默认每次 +5，支持成员在某个日期单独指定分值。
-- 在 Supabase SQL Editor 执行一次；可重复执行，已编辑的分值不会被覆盖。
-- 此迁移也兼容尚未执行 supabase-challenge-xp-migration.sql 的数据库。
-- 为旧报告按其当时的挑战倍率 / 整期分值保留历史挑战奖励。

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

-- 只在第一次新增逐日设置字段时，将老报告日期的旧分值写入该字段。
-- 以后新增的挑战日期不存覆盖值：自然使用新的 +5 默认值。
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weekly_report_items'
      and column_name = 'challenge_xp_overrides'
  ) then
    alter table public.weekly_report_items
      add column challenge_xp_overrides jsonb not null default '{}'::jsonb;

    update public.weekly_report_items as i
    set challenge_xp_overrides = (
      select coalesce(
        jsonb_object_agg(challenge_date.day::text, r.challenge_xp),
        '{}'::jsonb
      )
      from unnest(i.challenge_dates) as challenge_date(day)
    )
    from public.weekly_reports as r
    where r.id = i.report_id
      and cardinality(i.challenge_dates) > 0;
  end if;
end $$;

-- 字段结构示例：{"2026-11-03": 12, "2026-11-04": 7}
-- 没有出现的日期按 +5 计算；未勾选挑战的日期不会计分。
