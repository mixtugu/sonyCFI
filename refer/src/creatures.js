export const CREATURES = Object.freeze({
  shark: { name: 'サメ', size: 'large', risk: 3, rarity: 4 },
  mermaid: { name: '人魚', size: 'large', risk: 3, rarity: 5 },
  squid: { name: 'ダイオウイカ', size: 'large', risk: 3, rarity: 4 },
  turtle: { name: 'ウミガメ', size: 'medium', risk: 1, rarity: 3 },
  octopus: { name: 'タコ', size: 'medium', risk: 2, rarity: 3 },
  lionfish: { name: 'ハナミノカサゴ', size: 'medium', risk: 3, rarity: 3 },
  butterflyfish: { name: 'チョウチョウウオ', size: 'medium', risk: 1, rarity: 3 },
  clownfish: { name: 'カクレクマノミ', size: 'small', risk: 1, rarity: 1 },
  shrimp: { name: 'エビ', size: 'small', risk: 1, rarity: 1 },
  jellyfish: { name: 'クラゲ', size: 'small', risk: 2, rarity: 2 },
  seahorse: { name: 'タツノオトシゴ', size: 'small', risk: 1, rarity: 3 },
  stonefish: { name: 'オニダルマオコゼ', size: 'small', risk: 3, rarity: 3 },
});

export function creatureCandidates(size, risk) {
  return Object.keys(CREATURES).filter(id => CREATURES[id].size === size && CREATURES[id].risk <= risk);
}
