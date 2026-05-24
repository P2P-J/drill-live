export const GAME = {
  width: 1080,
  height: 1920,
  tileSize: 64,
  pxPerKm: 64,
  gameAreaHeight: 1400,
  hudY: 1400,
  hudHeight: 520,
  // 가로 13타일 = 벽1 + 채굴11 + 벽1
  chunkTilesX: 13,
  chunkTilesY: 32,
  mapTilesX: 11,
  wallLeftX: 0,    // 좌측 벽 타일 인덱스
  wallRightX: 12,  // 우측 벽 타일 인덱스
  baseDrillSpeed: 140,          // 수직 낙하 (메인 동작)
  bounceSpeed: 12,              // 좌우 모션 거의 0 (살짝만 흘러)
  minePerTileSeconds: 0.30,
};

export const SURFACE_PADDING_TILES = 4;
