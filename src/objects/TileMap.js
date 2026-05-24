import { GAME } from '../config/game.js';

const WALL_COLOR = 0x2a2a2a;

export class TileMap {
  constructor(scene, biomeManager, oreLayer = null) {
    this.scene = scene;
    this.biomeManager = biomeManager;
    this.oreLayer = oreLayer;
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
        const cx = worldX + GAME.tileSize / 2;
        const cy_ = worldY + GAME.tileSize / 2;

        const sprite = this.scene.add.rectangle(
          cx, cy_,
          GAME.tileSize - 1,
          GAME.tileSize - 1,
          color
        );
        sprite.setDepth(0);

        // 광물 굴림 (벽 제외)
        let ore = null;
        let gemSprite = null;
        if (!isWall && this.oreLayer) {
          ore = this.oreLayer.rollOreAt(km);
          if (ore) {
            const gemSize = GAME.tileSize * 0.6;
            gemSprite = this.scene.add.rectangle(cx, cy_, gemSize, gemSize, ore.color);
            gemSprite.setStrokeStyle(3, 0xffffff, 0.85);
            gemSprite.setAngle(45);
            gemSprite.setDepth(5);
          }
        }

        const tile = {
          tileX,
          tileY,
          worldX,
          worldY,
          km,
          isWall,
          ore,
          destroyed: false,
          sprite,
          gemSprite,
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
      tile.gemSprite?.destroy();
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

  // 채굴: 타일 시각 제거 + 광물이면 광물 정보 반환 ({ id, name, value, color })
  destroyTile(tileX, tileY) {
    const tile = this.getTileAt(tileX, tileY);
    if (!tile || tile.destroyed || tile.isWall) return null;
    tile.destroyed = true;
    tile.sprite?.destroy();
    tile.sprite = null;
    tile.gemSprite?.destroy();
    tile.gemSprite = null;
    return tile.ore;  // null 또는 광물 객체. Task 7에서 광물 분포 적용.
  }

  _key(tileX, tileY) {
    return `${tileX},${tileY}`;
  }
}
