// 经验值规则：主题挑战每次默认 +5，可在每份周报中自定义。
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
