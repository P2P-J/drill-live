import { GAME } from '../config/game.js';
import {
  ensureDirtTexture,
  ensureWallTexture,
  ensureGemTexture,
  tileHash,
} from './TileArt.js';

export class TileMap {
  constructor(scene, biomeManager, oreLayer = null) {
    this.scene = scene;
    this.biomeManager = biomeManager;
    this.oreLayer = oreLayer;
    this.chunks = new Map();
    this.tileGrid = new Map();
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * GAME.tileSize) / 2);
  }

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
        const isWall = tileX === GAME.wallLeftX || tileX === GAME.wallRightX;
        const worldX = this.xOffset + tileX * GAME.tileSize;
        const cx = worldX + GAME.tileSize / 2;
        const cyPx = worldY + GAME.tileSize / 2;

        const variant = tileHash(tileX, tileY) % 4;
        let sprite;
        if (isWall) {
          const key = ensureWallTexture(this.scene, variant);
          sprite = this.scene.add.image(cx, cyPx, key);
        } else {
          const baseColor = this.biomeManager.getColorAt(km);
          const key = ensureDirtTexture(this.scene, baseColor, variant);
          sprite = this.scene.add.image(cx, cyPx, key);
        }
        sprite.setDepth(0);

        // 광물
        let ore = null;
        let gemSprite = null;
        if (!isWall && this.oreLayer) {
          ore = this.oreLayer.rollOreAt(km);
          if (ore) {
            const gemKey = ensureGemTexture(this.scene, ore.id, ore.color);
            gemSprite = this.scene.add.image(cx, cyPx, gemKey);
            gemSprite.setDepth(5);
            // 살짝 떠 있는 듯한 반짝임 트윈
            this.scene.tweens.add({
              targets: gemSprite,
              scaleX: 1.05,
              scaleY: 1.05,
              duration: 1200 + (variant * 100),
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
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

  worldXToTileX(worldX) {
    return Math.floor((worldX - this.xOffset) / GAME.tileSize);
  }

  worldYToTileY(worldY) {
    return Math.floor(worldY / GAME.tileSize);
  }

  destroyTile(tileX, tileY) {
    const tile = this.getTileAt(tileX, tileY);
    if (!tile || tile.destroyed || tile.isWall) return null;
    tile.destroyed = true;
    tile.sprite?.destroy();
    tile.sprite = null;
    tile.gemSprite?.destroy();
    tile.gemSprite = null;
    return tile.ore;
  }

  _key(tileX, tileY) {
    return `${tileX},${tileY}`;
  }
}
