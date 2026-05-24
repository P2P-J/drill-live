import { GAME } from '../config/game.js';

const WALL_COLOR = 0x2a2a2a;

export class TileMap {
  constructor(scene, biomeManager) {
    this.scene = scene;
    this.biomeManager = biomeManager;
    this.chunks = new Map();      // cy -> { cy, tiles: Map }
    this.tileGrid = new Map();    // "x,y" -> tile
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * GAME.tileSize) / 2);
  }

  // Driller의 현재 world y(px) 기준으로 필요한 청크 로드, 너무 멀어진 청크 해제
  update(drillerY) {
    const chunkPx = GAME.chunkTilesY * GAME.tileSize;
    const currentCy = Math.floor(drillerY / chunkPx);
    const minCy = Math.max(0, currentCy - 1);
    const maxCy = currentCy + 2;

    for (let cy = minCy; cy <= maxCy; cy++) {
      if (!this.chunks.has(cy)) this.createChunk(cy);
    }

    for (const cy of this.chunks.keys()) {
      if (cy < minCy - 1 || cy > maxCy + 1) this.destroyChunk(cy);
    }
  }

  createChunk(cy) {
    const startTileY = cy * GAME.chunkTilesY;
    const chunk = { cy, tiles: new Map() };

    for (let dy = 0; dy < GAME.chunkTilesY; dy++) {
      const tileY = startTileY + dy;
      const worldY = tileY * GAME.tileSize;
      const km = this.biomeManager.yToKm(worldY);

      for (let tileX = 0; tileX < GAME.chunkTilesX; tileX++) {
        const isWall = tileX === 0 || tileX === GAME.chunkTilesX - 1;
        const baseColor = this.biomeManager.getColorAt(km);
        const color = isWall ? WALL_COLOR : baseColor;

        const worldX = this.xOffset + tileX * GAME.tileSize;
        const sprite = this.scene.add.rectangle(
          worldX + GAME.tileSize / 2,
          worldY + GAME.tileSize / 2,
          GAME.tileSize - 1,
          GAME.tileSize - 1,
          color
        );
        sprite.setDepth(0);

        const tile = {
          tileX,
          tileY,
          worldX,
          worldY,
          km,
          isWall,
          ore: null,            // Task 7에서 설정
          destroyed: false,
          sprite,
        };

        const key = this._key(tileX, tileY);
        this.tileGrid.set(key, tile);
        chunk.tiles.set(key, tile);
      }
    }

    this.chunks.set(cy, chunk);
  }

  destroyChunk(cy) {
    const chunk = this.chunks.get(cy);
    if (!chunk) return;
    for (const tile of chunk.tiles.values()) {
      tile.sprite?.destroy();
      this.tileGrid.delete(this._key(tile.tileX, tile.tileY));
    }
    this.chunks.delete(cy);
  }

  getTileAt(tileX, tileY) {
    return this.tileGrid.get(this._key(tileX, tileY));
  }

  // worldX 좌표에 해당하는 tileX 인덱스
  worldXToTileX(worldX) {
    return Math.floor((worldX - this.xOffset) / GAME.tileSize);
  }

  worldYToTileY(worldY) {
    return Math.floor(worldY / GAME.tileSize);
  }

  // 채굴: 타일 시각 제거 + 광물이면 광물 정보 반환
  destroyTile(tileX, tileY) {
    const tile = this.getTileAt(tileX, tileY);
    if (!tile || tile.destroyed || tile.isWall) return null;
    tile.destroyed = true;
    tile.sprite?.destroy();
    tile.sprite = null;
    return tile.ore;
  }

  _key(tileX, tileY) {
    return `${tileX},${tileY}`;
  }
}
