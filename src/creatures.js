// The encyclopedia: every creature a fish silhouette on the map can turn out to be. Bigger
// silhouettes draw from a rarer pool, and their creatures are riskier for the explorer.
export const SIZES = ['large', 'medium', 'small'];
export const SIZE_LABELS = { large: '大', medium: '中', small: '小' };
export const CREATURES = [
  { id: 'shark', name: 'サメ', size: 'large', stars: 4, risk: 3 },
  { id: 'mermaid', name: '人魚', size: 'large', stars: 5, risk: 3 },
  { id: 'squid', name: 'ダイオウイカ', size: 'large', stars: 4, risk: 3 },
  { id: 'turtle', name: 'ウミガメ', size: 'medium', stars: 3, risk: 1 },
  { id: 'octopus', name: 'タコ', size: 'medium', stars: 3, risk: 2 },
  { id: 'lionfish', name: 'ハナミノカサゴ', size: 'medium', stars: 3, risk: 3 },
  { id: 'butterflyfish', name: 'チョウチョウウオ', size: 'medium', stars: 3, risk: 1 },
  { id: 'clownfish', name: 'カクレクマノミ', size: 'small', stars: 1, risk: 1 },
  { id: 'shrimp', name: 'エビ', size: 'small', stars: 1, risk: 1 },
  { id: 'jellyfish', name: 'クラゲ', size: 'small', stars: 2, risk: 2 },
  { id: 'seahorse', name: 'タツノオトシゴ', size: 'small', stars: 3, risk: 1 },
  { id: 'stonefish', name: 'オニダルマオコゼ', size: 'small', stars: 3, risk: 3 },
];
export const creature = id => CREATURES.find(c => c.id === id);
export const RISK_LABELS = { 1: '低リスク', 2: '中リスク', 3: '高リスク' };

// Twelve fish per maze: a few large ones worth chasing, plenty of small ones.
export const SIZE_MIX = ['large', 'large', 'large', 'medium', 'medium', 'medium', 'medium', 'small', 'small', 'small', 'small', 'small'];
// Rarer creatures turn up less often within their size.
const WEIGHT = { 1: 6, 2: 4, 3: 3, 4: 2, 5: 1 };
export function pickCreature(size, random) {
  const pool = CREATURES.filter(c => c.size === size), total = pool.reduce((sum, c) => sum + WEIGHT[c.stars], 0);
  let roll = random() * total;
  for (const c of pool) if ((roll -= WEIGHT[c.stars]) < 0) return c;
  return pool.at(-1);
}

// The explorer's HP is shown only to the navigator, to make them uneasy. Contact never empties it,
// and a low-risk creature may cost nothing or even heal.
export const HP_MAX = 16;
const DAMAGE = { 1: [-1, 0, 0, 1], 2: [1, 2, 2, 3], 3: [3, 4, 4, 5] };
export const rollDamage = (risk, random) => { const options = DAMAGE[risk] || DAMAGE[1]; return options[Math.floor(random() * options.length)]; };
export const applyDamage = (hp, damage) => Math.max(1, Math.min(HP_MAX, hp - damage));
