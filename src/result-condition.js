export function resultCondition(hp, maxHp) {
  const ratio = hp / maxHp;
  if (ratio <= 1 / 3) return 'hurt';
  if (ratio >= 2 / 3) return 'healthy';
  return 'steady';
}
