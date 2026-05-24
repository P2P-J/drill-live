import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { gameState } from '../systems/GameState.js';
import { ensureBodyTexture, ensureDrillBitTexture } from './DrillerArt.js';

export class Driller {
  constructor(scene, tileX, worldY, tileMap, upgradeSystem = null) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.upgradeSystem = upgradeSystem;
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * this.tileSize) / 2);

    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    // 텍스처 보장
    const bodyKey = ensureBodyTexture(scene);
    const bitKey = ensureDrillBitTexture(scene);

    this.container = scene.add.container(this.worldX, this.y);
    this.container.setDepth(50);

    // 드릴 비트 (몸 아래쪽, 회전 가능)
    this.drillBit = scene.add.image(0, this.tileSize * 0.55, bitKey);
    this.drillBit.setOrigin(0.5, 0.15);  // 위쪽 기준 회전

    // 본체
    this.body = scene.add.image(0, 0, bodyKey);
    this.body.setOrigin(0.5, 0.5);

    this.container.add([this.drillBit, this.body]);

    // 업그레이드 효과치
    this.speed = GAME.baseDrillSpeed;
    this.drillSpeedMult = 1.0;
    this.engineMult = 1.0;
    this.drillRange = 1;

    // 좌우 통통 튀기
    this.leftBound = this.xOffset + (GAME.wallLeftX + 1) * this.tileSize + this.tileSize * 0.46;
    this.rightBound = this.xOffset + GAME.wallRightX * this.tileSize - this.tileSize * 0.46;
    this.vx = GAME.bounceSpeed * (Math.random() < 0.5 ? -1 : 1);

    this.mineProgress = 0;
    this.isMining = false;
  }

  _syncUpgrades() {
    if (!this.upgradeSystem) return;
    this.drillSpeedMult = this.upgradeSystem.getDrillSpeedMult();
    this.engineMult = this.upgradeSystem.getEngineMult();
    this.drillRange = this.upgradeSystem.getDrillRange();
  }

  update(delta) {
    this._syncUpgrades();
    const dt = delta / 1000;

    // 1) 좌우 + 벽 반사
    let newX = this.worldX + this.vx * dt * this.engineMult;
    if (newX <= this.leftBound) {
      newX = this.leftBound;
      this.vx = Math.abs(this.vx);
      this._spawnBounceParticles(newX, this.y, -1);
      this._squashBounce();
    } else if (newX >= this.rightBound) {
      newX = this.rightBound;
      this.vx = -Math.abs(this.vx);
      this._spawnBounceParticles(newX, this.y, +1);
      this._squashBounce();
    }
    this.worldX = newX;

    // 드릴 전체가 굴러가는 효과 — 컨테이너 회전 (휠 회전 공식)
    const wheelRadius = this.tileSize * 0.45;
    this.container.rotation += (this.vx * dt) / wheelRadius;

    // 2) 현재 X 컬럼
    const currentTileX = Math.floor((this.worldX - this.xOffset) / this.tileSize);
    const halfH = this.tileSize / 2;
    const drillerBottom = this.y + halfH;
    const epsilon = 1;
    const nextTileY = Math.floor((drillerBottom + epsilon) / this.tileSize);

    // 3) 아래 타일 검사
    const blocker = this.tileMap.getTileAt(currentTileX, nextTileY);

    if (blocker && !blocker.destroyed && !blocker.isWall && nextTileY >= 0) {
      this.isMining = true;
      this.mineProgress += dt * this.drillSpeedMult;
      // 드릴 비트 빠르게 회전
      this.drillBit.rotation += dt * 20;

      if (this.mineProgress >= GAME.minePerTileSeconds) {
        this._mineRow(nextTileY, currentTileX);
        this.mineProgress = 0;
      } else {
        const snapY = nextTileY * this.tileSize - halfH;
        this.y = Math.min(this.y, snapY);
      }
    } else {
      this.isMining = false;
      this.drillBit.rotation += dt * 6;
      this.y += this.speed * this.engineMult * dt;
    }

    this.container.x = this.worldX;
    this.container.y = this.y;
  }

  _mineRow(tileY, centerTileX) {
    const halfRange = Math.floor(this.drillRange / 2);
    let totalGold = 0;

    for (let dx = -halfRange; dx <= halfRange; dx++) {
      const tx = centerTileX + dx;
      const tile = this.tileMap.getTileAt(tx, tileY);
      if (!tile || tile.destroyed || tile.isWall) continue;

      const px = tile.worldX + this.tileSize / 2;
      const py = tile.worldY + this.tileSize / 2;
      const ore = this.tileMap.destroyTile(tx, tileY);
      this._spawnParticles(px, py, ore ? ore.color : 0x8B5A2B);

      if (ore) {
        totalGold += ore.value;
        gameState.addOre(ore.id);
      }
    }

    if (totalGold > 0) gameState.addGold(totalGold);
  }

  _spawnParticles(x, y, color = 0x8B5A2B) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const p = this.scene.add.rectangle(x, y, 8, 8, color);
      p.setStrokeStyle(1, 0x000000, 0.8);
      p.setDepth(60);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 30 + Math.random() * 36;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 14,
        alpha: 0,
        angle: 360 * (Math.random() < 0.5 ? -1 : 1),
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 320 + Math.random() * 180,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  _spawnBounceParticles(x, y, dirX) {
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.circle(x, y + (Math.random() - 0.5) * 20, 4, 0xFFEB3B);
      p.setStrokeStyle(1, 0xff6f00, 1);
      p.setDepth(60);
      const angle = (-Math.PI / 4) + (i / 4) * (Math.PI / 2);
      const dist = 22 + Math.random() * 18;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist * dirX,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  _squashBounce() {
    this.scene.tweens.killTweensOf(this.container);
    this.container.scaleX = 0.78;
    this.container.scaleY = 1.15;
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  getTileY() {
    return Math.floor(this.y / this.tileSize);
  }
}
