import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { gameState } from '../systems/GameState.js';

const BODY_COLOR = 0xFFC107;
const HELMET_COLOR = 0xFF6F00;
const DRILL_COLOR = 0xCFD8DC;
const SHADOW_COLOR = 0x000000;

export class Driller {
  constructor(scene, tileX, worldY, tileMap, upgradeSystem = null) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.upgradeSystem = upgradeSystem;
    this.tileX = tileX;
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * this.tileSize) / 2);

    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    this.container = scene.add.container(this.worldX, this.y);
    this.container.setDepth(50);

    this.body = scene.add.rectangle(0, 0, this.tileSize * 0.92, this.tileSize * 0.78, BODY_COLOR);
    this.body.setStrokeStyle(2, SHADOW_COLOR);

    this.helmet = scene.add.rectangle(0, -this.tileSize * 0.32, this.tileSize * 0.5, this.tileSize * 0.18, HELMET_COLOR);
    this.helmet.setStrokeStyle(2, SHADOW_COLOR);

    const t = this.tileSize;
    this.drillBit = scene.add.triangle(0, t * 0.42, -t * 0.32, 0, t * 0.32, 0, 0, t * 0.25, DRILL_COLOR);
    this.drillBit.setStrokeStyle(2, SHADOW_COLOR);

    this.container.add([this.body, this.helmet, this.drillBit]);

    // 속도 / 채굴력 / 범위 — Task 8 UpgradeSystem이 동적으로 갱신
    this.speed = GAME.baseDrillSpeed;
    this.drillSpeedMult = 1.0;     // Drill Power 단계 효과 (1.0 ~ 3.0)
    this.engineMult = 1.0;          // Engine 단계 효과 (1.0 ~ 1.5)
    this.drillRange = 1;            // Drill Range 단계 효과 (1, 3, 5)

    this.mineProgress = 0;
    this.isMining = false;
  }

  _syncUpgrades() {
    if (!this.upgradeSystem) return;
    // speed는 base 상수 유지. drillSpeedMult, engineMult, drillRange만 업데이트.
    this.drillSpeedMult = this.upgradeSystem.getDrillSpeedMult();
    this.engineMult = this.upgradeSystem.getEngineMult();
    this.drillRange = this.upgradeSystem.getDrillRange();
  }

  update(delta) {
    this._syncUpgrades();
    const dt = delta / 1000;
    const halfH = this.tileSize / 2;
    const drillerBottom = this.y + halfH;
    const epsilon = 1;
    const nextTileY = Math.floor((drillerBottom + epsilon) / this.tileSize);

    const blockingTile = this.tileMap.getTileAt(this.tileX, nextTileY);

    if (blockingTile && !blockingTile.destroyed && !blockingTile.isWall && nextTileY >= 0) {
      // 채굴 중
      this.isMining = true;
      this.mineProgress += dt * this.drillSpeedMult;

      // 드릴 비트 회전 애니메이션
      this.drillBit.rotation += dt * 12;

      if (this.mineProgress >= GAME.minePerTileSeconds) {
        this._mineRow(nextTileY);
        this.mineProgress = 0;
      } else {
        // 차단 타일 윗변에 driller 바닥 스냅
        const snapY = nextTileY * this.tileSize - halfH;
        this.y = Math.min(this.y, snapY);
      }
    } else {
      // 차단 없음 → 자유 낙하
      this.isMining = false;
      this.drillBit.rotation += dt * 4;
      this.y += this.speed * this.engineMult * dt;
    }

    this.container.y = this.y;
  }

  _mineRow(tileY) {
    const halfRange = Math.floor(this.drillRange / 2);
    let totalGold = 0;
    let oresCount = 0;

    for (let dx = -halfRange; dx <= halfRange; dx++) {
      const tx = this.tileX + dx;
      const tile = this.tileMap.getTileAt(tx, tileY);
      if (!tile || tile.destroyed || tile.isWall) continue;

      // 파티클은 destroy 직전에 원본 위치를 사용
      const px = tile.worldX + this.tileSize / 2;
      const py = tile.worldY + this.tileSize / 2;

      const ore = this.tileMap.destroyTile(tx, tileY);
      this._spawnParticles(px, py, ore ? ore.color : 0xffffff);

      if (ore) {
        totalGold += ore.value;
        oresCount += 1;
      }
    }

    if (totalGold > 0) {
      gameState.addGold(totalGold);
    }
    return { totalGold, oresCount };
  }

  _spawnParticles(x, y, color = 0xffffff) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const p = this.scene.add.rectangle(x, y, 6, 6, color);
      p.setDepth(60);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 30 + Math.random() * 30;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 10,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 280 + Math.random() * 120,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  getTileY() {
    return Math.floor(this.y / this.tileSize);
  }
}
