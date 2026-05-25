// PRD 3-2 기준. 깊이는 km 단위. transitionTo가 있는 레이어는 layer 안에서
// color → transitionTo 로 선형 블렌딩된다.

export const BIOMES = [
  {
    id: 'earth',
    name: 'Earth',
    emoji: '🌍',
    hardness: 1.0,   // 채굴 속도 분모 — 깊은 바이옴일수록 1보다 커서 더 오래 걸림
    startKm: 0,
    endKm: 9999,
    layers: [
      { name: '1-1 표토층',       startKm: 0,    endKm: 500,   color: 0xA0522D, oreProbabilities: { coal: 0.15, copper: 0.05 } },
      { name: '1-2 점토층',       startKm: 500,  endKm: 1500,  color: 0x8B4513, oreProbabilities: { coal: 0.12, copper: 0.10, iron: 0.03 } },
      { name: '1-3 자갈층',       startKm: 1500, endKm: 3000,  color: 0x6B3A2A, oreProbabilities: { coal: 0.05, copper: 0.10, iron: 0.10 } },
      { name: '1-4 연암층',       startKm: 3000, endKm: 5000,  color: 0x4A3728, oreProbabilities: { copper: 0.05, iron: 0.12, gold: 0.05 } },
      { name: '1-5 경암층',       startKm: 5000, endKm: 7000,  color: 0x3D2B1F, oreProbabilities: { iron: 0.10, gold: 0.08, copper: 0.03 } },
      { name: '1-6 심층 암반',    startKm: 7000, endKm: 9500,  color: 0x2A1E14, oreProbabilities: { iron: 0.08, gold: 0.10, crystal: 0.02 } },
      { name: '1-7 전환 구간',    startKm: 9500, endKm: 9999,  color: 0x2A1E14, transitionTo: 0x9B72CF, oreProbabilities: { iron: 0.05, gold: 0.05, crystal: 0.05, amethyst: 0.02 } },
    ],
  },
  {
    id: 'crystal',
    hardness: 1.5,
    name: 'Crystal Cave',
    emoji: '🔮',
    startKm: 9999,
    endKm: 49999,
    layers: [
      { name: '2-1 보라 입구',    startKm: 9999,  endKm: 15000, color: 0x9B72CF, oreProbabilities: { crystal: 0.15, amethyst: 0.03 } },
      { name: '2-2 수정층',       startKm: 15000, endKm: 22000, color: 0x7B4FA6, oreProbabilities: { crystal: 0.12, amethyst: 0.08 } },
      { name: '2-3 심수정층',     startKm: 22000, endKm: 32000, color: 0x5B3080, oreProbabilities: { crystal: 0.08, amethyst: 0.12, sapphire: 0.02 } },
      { name: '2-4 암흑수정층',   startKm: 32000, endKm: 42000, color: 0x3D1A5C, oreProbabilities: { amethyst: 0.10, sapphire: 0.05 } },
      { name: '2-5 전환 구간',    startKm: 42000, endKm: 49999, color: 0x3D1A5C, transitionTo: 0x1A8A9A, oreProbabilities: { amethyst: 0.05, sapphire: 0.10 } },
    ],
  },
  {
    id: 'abyssal',
    hardness: 2.2,
    name: 'Abyssal Sea',
    emoji: '🌊',
    startKm: 49999,
    endKm: 99999,
    layers: [
      { name: '3-1 얕은 해저',    startKm: 49999, endKm: 58000, color: 0x1A8A9A, oreProbabilities: { crystal: 0.05, sapphire: 0.15 } },
      { name: '3-2 중층 해저',    startKm: 58000, endKm: 67000, color: 0x0F6B7A, oreProbabilities: { sapphire: 0.12, emerald: 0.03 } },
      { name: '3-3 심층 해저',    startKm: 67000, endKm: 78000, color: 0x0A4A5C, oreProbabilities: { sapphire: 0.08, emerald: 0.08 } },
      { name: '3-4 암흑해저',     startKm: 78000, endKm: 90000, color: 0x051A2E, oreProbabilities: { sapphire: 0.05, emerald: 0.10, diamond: 0.02 } },
      { name: '3-5 전환 구간',    startKm: 90000, endKm: 99999, color: 0x051A2E, transitionTo: 0x4CAF50, oreProbabilities: { emerald: 0.10, diamond: 0.03 } },
    ],
  },
  {
    id: 'forest',
    hardness: 3.0,
    name: 'Ancient Forest',
    emoji: '🌿',
    startKm: 99999,
    endKm: 499999,
    layers: [
      { name: '4-1 이끼층',       startKm: 99999,  endKm: 150000, color: 0x4CAF50, oreProbabilities: { sapphire: 0.03, emerald: 0.15 } },
      { name: '4-2 뿌리층',       startKm: 150000, endKm: 220000, color: 0x2E7D32, oreProbabilities: { emerald: 0.12, diamond: 0.03 } },
      { name: '4-3 고대 암석층',  startKm: 220000, endKm: 320000, color: 0x1B5E20, oreProbabilities: { emerald: 0.10, diamond: 0.05 } },
      { name: '4-4 심층 정글',    startKm: 320000, endKm: 420000, color: 0x0D3B10, oreProbabilities: { emerald: 0.08, diamond: 0.08, ruby: 0.02 } },
      { name: '4-5 전환 구간',    startKm: 420000, endKm: 499999, color: 0x0D3B10, transitionTo: 0xBF360C, oreProbabilities: { diamond: 0.08, ruby: 0.05 } },
    ],
  },
  {
    id: 'magma',
    hardness: 4.0,
    name: 'Magma Core',
    emoji: '🔥',
    startKm: 499999,
    endKm: 999999,
    layers: [
      { name: '5-1 열암층',       startKm: 499999, endKm: 600000, color: 0xBF360C, oreProbabilities: { diamond: 0.10, ruby: 0.10 } },
      { name: '5-2 용암 균열층',  startKm: 600000, endKm: 720000, color: 0xE64A19, oreProbabilities: { diamond: 0.08, ruby: 0.12, lavaCrystal: 0.02 } },
      { name: '5-3 마그마층',     startKm: 720000, endKm: 850000, color: 0xFF5722, oreProbabilities: { ruby: 0.10, diamond: 0.10, lavaCrystal: 0.05 } },
      { name: '5-4 핵심층',       startKm: 850000, endKm: 960000, color: 0x7B1A00, oreProbabilities: { diamond: 0.12, ruby: 0.12, lavaCrystal: 0.08 } },
      { name: '5-5 전환 구간',    startKm: 960000, endKm: 999999, color: 0x7B1A00, transitionTo: 0x1A1A2E, oreProbabilities: { lavaCrystal: 0.10, voidStone: 0.02 } },
    ],
  },
  {
    id: 'void',
    hardness: 5.0,
    name: 'Void',
    emoji: '⭐',
    startKm: 999999,
    endKm: Infinity,
    isInfinite: true,
    layers: [
      { name: '6-1 공허 입구',    startKm: 999999,  endKm: 1100000, color: 0x1A1A2E, oreProbabilities: { voidStone: 0.05, diamond: 0.03, ruby: 0.03, emerald: 0.03 } },
      { name: '6-2 심공허',       startKm: 1100000, endKm: 1200000, color: 0x0D0D1A, oreProbabilities: { voidStone: 0.07, diamond: 0.04, ruby: 0.04, emerald: 0.03, lavaCrystal: 0.03 } },
      { name: '6-3 혼돈의 공허',  startKm: 1200000, endKm: Infinity, color: 0x0D0D1A, isCycle: true,
        cycleColors: [0xA0522D, 0x7B4FA6, 0x0F6B7A, 0x2E7D32, 0xBF360C],
        cycleKm: 100000,
        oreProbabilities: { voidStone: 0.08, diamond: 0.05, ruby: 0.05, emerald: 0.04, lavaCrystal: 0.04, amethyst: 0.02 } },
    ],
  },
];

// 평탄화: BiomeManager의 O(1)-ish 검색용
export const ALL_LAYERS = BIOMES.flatMap(b =>
  b.layers.map(l => ({ ...l, biomeId: b.id, biomeName: b.name, biomeEmoji: b.emoji }))
);
