-- XP / 周报增量迁移：只在现有数据库执行一次，不要重跑 supabase-schema.sql。
alter table public.weekly_report_items
  add column if not exists reflection_dates date[] not null default '{}',
  add column if not exists deep_reflection_dates date[] not null default '{}',
  add column if not exists challenge_dates date[] not null default '{}';
alter table public.weekly_reports
  add column if not exists challenge_multiplier integer not null default 1;
alter table public.weekly_reports
  drop constraint if exists weekly_reports_challenge_multiplier_check;
alter table public.weekly_reports
  add constraint weekly_reports_challenge_multiplier_check
    check (challenge_multiplier between 1 and 3);

-- 查询报告时可跨周去重，避免多周覆盖同一天重复计分。
-- 计算规则：每个成员、每个自然日，绘画一次 +10，反思最多一次(+10或+20)，
-- 主题挑战按日期计一次(+10乘活动倍率)，不重复奖励同一报告中的同一日期。

-- 成员补录正式图片打卡后，只允许该成员本人删除其尚未认领的对应周报占位。
-- 必须同时匹配成员身份和原占位记录；不会放开普通用户删除其他打卡。
drop policy if exists "members delete own unclaimed weekly proxies" on public.checkins;
create policy "members delete own unclaimed weekly proxies"
on public.checkins for delete to authenticated
using (
  source = 'weekly_report'
  and user_id is null
  and claimed_at is null
  and member_id = (
    select p.member_id from public.profiles p where p.id = auth.uid()
  )
);
