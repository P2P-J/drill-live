// 5대 업그레이드. Phase 1에서는 Drill Power / Range / Engine 효과만 활성.
// Fuel Tank / Cargo 는 UI 슬롯만 잡고 효과는 noop (Phase 2+에서 사용 예정)

export const UPGRADES = {
  drillPower: {
    id: 'drillPower',
    name: 'Drill Power',
    maxLevel: 5,
    cost:       [0, 100, 400, 1500, 6000],
    multiplier: [1.0, 1.3, 1.7, 2.2, 3.0],
  },
  drillRange: {
    id: 'drillRange',
    name: 'Drill Range',
    maxLevel: 3,
    cost:  [0, 500, 5000],
    tiles: [1, 3, 5],
  },
  engine: {
    id: 'engine',
    name: 'Engine',
    maxLevel: 3,
    cost:       [0, 200, 2000],
    multiplier: [1.0, 1.2, 1.5],
  },
  fuelTank: {
    id: 'fuelTank',
    name: 'Fuel Tank',
    maxLevel: 5,
    cost: [0, 100, 300, 1000, 3000],
  },
  cargo: {
    id: 'cargo',
    name: 'Cargo',
    maxLevel: 5,
    cost: [0, 100, 300, 1000, 3000],
  },
};

export const UPGRADE_ORDER = ['drillPower', 'drillRange', 'engine', 'fuelTank', 'cargo'];
