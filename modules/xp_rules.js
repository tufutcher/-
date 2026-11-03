// 经验值规则：每个成员、每个挑战日期默认 +5，可分别修改。
// 历史报告尚未迁移时，旧倍率保留为每次 10/20/30 经验值。
export const DEFAULT_CHALLENGE_XP = 5;

export function normalizeChallengeXp(value, fallback = DEFAULT_CHALLENGE_XP){
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) && number >= 0 && number <= 1000
    ? number : fallback;
}

export function resolveChallengeXp(report){
  if(report && report.challenge_xp !== null && report.challenge_xp !== undefined){
    return normalizeChallengeXp(report.challenge_xp);
  }
  const legacy = Number(report?.challenge_multiplier);
  return [1, 2, 3].includes(legacy) ? legacy * 10 : DEFAULT_CHALLENGE_XP;
}

/** 单次挑战积分：优先使用该成员该日期的显式设置；默认 +5。 */
export function getChallengeXpForDate(item, date, report){
  const overrides = item?.challenge_xp_overrides;
  if(overrides && typeof overrides === "object" &&
     Object.prototype.hasOwnProperty.call(overrides, date)){
    return normalizeChallengeXp(overrides[date]);
  }
  // 只在旧数据尚未添加 overrides 字段时采用旧的整期计分，以免迁移前篡改历史。
  if(item && !Object.prototype.hasOwnProperty.call(item, "challenge_xp_overrides")){
    return resolveChallengeXp(report);
  }
  return DEFAULT_CHALLENGE_XP;
}
