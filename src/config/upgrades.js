// 5대 업그레이드. Phase 1에서는 Drill Power / Range / Engine 효과만 활성.
// Fuel Tank / Cargo 는 UI 슬롯만 잡고 효과는 noop (Phase 2+에서 사용 예정)

// 업그레이드 비용 — 10시간 라이브 동안 점진적으로 만렙에 도달하도록 설계.
// 베이스 골드 채굴 페이스 + 가끔 후원(GOLD_RUSH/DIAMOND 등) 받았을 때 균형.
export const UPGRADES = {
  drillPower: {
    id: 'drillPower',
    name: 'Drill Power',
    maxLevel: 5,
    cost:       [0, 800, 4000, 18000, 80000],
    multiplier: [1.0, 1.3, 1.7, 2.2, 3.0],
  },
  drillRange: {
    id: 'drillRange',
    name: 'Drill Range',
    maxLevel: 3,
    cost:  [0, 5000, 50000],
    tiles: [1, 3, 5],
  },
  engine: {
    id: 'engine',
    name: 'Engine',
    maxLevel: 3,
    cost:       [0, 2500, 22000],
    multiplier: [1.0, 1.2, 1.5],
  },
  fuelTank: {
    id: 'fuelTank',
    name: 'Fuel Tank',
    maxLevel: 5,
    cost: [0, 1500, 5000, 18000, 60000],
  },
  cargo: {
    id: 'cargo',
    name: 'Cargo',
    maxLevel: 5,
    cost: [0, 1500, 5000, 18000, 60000],
  },
};

export const UPGRADE_ORDER = ['drillPower', 'drillRange', 'engine', 'fuelTank', 'cargo'];
