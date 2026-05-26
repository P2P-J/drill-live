// 업그레이드는 **임시 (30초)** — 채팅 트리거로만 살 수 있고, 30초 후 Lv 1로 복귀.
// 가격은 시청자 채팅 한 번에 골드를 소모. 자동 구매 없음.

export const UPGRADES = {
  drillPower: {
    id: 'drillPower',
    name: 'Drill',
    maxLevel: 5,
    // Lv별 채굴 속도 배율
    multiplier: [1.0, 1.2, 1.5, 1.75, 2.0],
    // Lv별 다음 단계 비용 (cost[N] = Lv N+1로 올리는 비용)
    cost:       [0, 16000, 80000, 360000, 1600000],
    // Lv별 드릴 이름 (UI에 표시)
    names:      ['Wood Drill', 'Stone Drill', 'Iron Drill', 'Gold Drill', 'Diamond Drill'],
  },
  drillRange: {
    id: 'drillRange',
    name: 'Range',
    maxLevel: 3,
    tiles: [1, 3, 5],
    cost:  [0, 100000, 1000000],
  },
  engine: {
    id: 'engine',
    name: 'Engine',
    maxLevel: 3,
    multiplier: [1.0, 1.2, 1.5],
    cost:       [0, 50000, 440000],
  },
};

export const UPGRADE_ORDER = ['drillPower', 'drillRange', 'engine'];

// 임시 업그레이드 지속 시간 (업그레이드 종류별)
// drillPower(!wood~!diamond)는 30초, drillRange/engine(!range/!engine)은 5초
export const TEMP_UPGRADE_MS = {
  drillPower: 30000,
  drillRange: 5000,
  engine:     5000,
};
