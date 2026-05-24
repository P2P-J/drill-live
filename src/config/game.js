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
  baseDrillSpeed: 60,           // 기본 수직 낙하 속도 px/s
  bounceSpeed: 180,             // 기본 좌우 이동 속도 px/s (= baseDrillSpeed * 3)
  minePerTileSeconds: 0.4,
};

export const SURFACE_PADDING_TILES = 4;
