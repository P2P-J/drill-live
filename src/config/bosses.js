// 보스 등장 깊이 + 스탯. PRD 3-3 기준.
// PRD 단위는 km였으나 우리는 m 단위 사용 (1타일 = 1m).

export const BOSSES = [
  {
    id: 'megaMole',
    name: 'Mega Mole',
    biomeId: 'earth',
    depthM: 9000,
    hp: 1500,
    timeLimitMs: 60000,   // 60초
    rewardOre: 'gold',
    rewardCount: 30,
    failPenalty: { speedMult: 0.5, durationMs: 30000 },
  },
  {
    id: 'crystalGolem',
    name: 'Crystal Golem',
    biomeId: 'crystal',
    depthM: 45000,
    hp: 2500,
    timeLimitMs: 75000,
    rewardOre: 'amethyst',
    rewardCount: 25,
    failPenalty: { speedMult: 0.5, durationMs: 30000 },
  },
  {
    id: 'abyssKraken',
    name: 'Abyss Kraken',
    biomeId: 'abyssal',
    depthM: 90000,
    hp: 4000,
    timeLimitMs: 90000,
    rewardOre: 'sapphire',
    rewardCount: 25,
    failPenalty: { speedMult: 0.5, durationMs: 30000 },
  },
  {
    id: 'ancientTreant',
    name: 'Ancient Treant',
    biomeId: 'forest',
    depthM: 450000,
    hp: 6000,
    timeLimitMs: 90000,
    rewardOre: 'emerald',
    rewardCount: 22,
    failPenalty: { speedMult: 0.5, durationMs: 30000 },
  },
  {
    id: 'magmaDragon',
    name: 'Magma Dragon',
    biomeId: 'magma',
    depthM: 950000,
    hp: 10000,
    timeLimitMs: 120000,
    rewardOre: 'ruby',
    rewardCount: 25,
    failPenalty: { speedMult: 0.5, durationMs: 60000 },
  },
];

export function bossByDepth(m) {
  return BOSSES.find(b => b.depthM <= m && !b._spawnedDepthMet);
}

// 경고 단계 (남은 거리 기준)
export const BOSS_WARNING_STEPS = [
  { remainingM: 1000, label: 'BOSS INCOMING',   color: 0xFF9800, flash: false },
  { remainingM: 500,  label: 'BOSS IN 500m',    color: 0xFF5722, flash: true  },
  { remainingM: 100,  label: 'BOSS APPROACHING',color: 0xF44336, flash: true  },
];
