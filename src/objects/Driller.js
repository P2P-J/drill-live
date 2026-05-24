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
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * this.tileSize) / 2);

    // 시작 위치 — 채굴 채널의 가운데 타일
    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    // 컨테이너 (회전 + 위치 한방에 처리)
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

    // 업그레이드 효과치 (UpgradeSystem이 갱신)
    this.speed = GAME.baseDrillSpeed;
    this.drillSpeedMult = 1.0;
    this.engineMult = 1.0;
    this.drillRange = 1;

    // ── 통통 튀는 좌우 이동 ──
    // 좌측 채굴 영역의 픽셀 경계 (벽 타일 안쪽 가장자리)
    this.leftBound = this.xOffset + (GAME.wallLeftX + 1) * this.tileSize + this.tileSize * 0.46;
    this.rightBound = this.xOffset + GAME.wallRightX * this.tileSize - this.tileSize * 0.46;
    // 초기 방향: 무작위
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

    // ── 1) 좌우 이동 + 벽 반사 ──
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

    // ── 2) 현재 X에 해당하는 타일 컬럼 ──
    const currentTileX = Math.floor((this.worldX - this.xOffset) / this.tileSize);
    const halfH = this.tileSize / 2;
    const drillerBottom = this.y + halfH;
    const epsilon = 1;
    const nextTileY = Math.floor((drillerBottom + epsilon) / this.tileSize);

    // ── 3) 아래쪽 타일 검사 ──
    const blocker = this.tileMap.getTileAt(currentTileX, nextTileY);

    if (blocker && !blocker.destroyed && !blocker.isWall && nextTileY >= 0) {
      // 채굴 중 — Y 정지, 드릴 비트 회전 가속
      this.isMining = true;
      this.mineProgress += dt * this.drillSpeedMult;
      this.drillBit.rotation += dt * 12;

      if (this.mineProgress >= GAME.minePerTileSeconds) {
        this._mineRow(nextTileY, currentTileX);
        this.mineProgress = 0;
      } else {
        const snapY = nextTileY * this.tileSize - halfH;
        this.y = Math.min(this.y, snapY);
      }
    } else {
      // 자유 낙하
      this.isMining = false;
      this.drillBit.rotation += dt * 4;
      this.y += this.speed * this.engineMult * dt;
    }

    // 컨테이너 위치 갱신
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
      this._spawnParticles(px, py, ore ? ore.color : 0xffffff);

      if (ore) totalGold += ore.value;
    }

    if (totalGold > 0) gameState.addGold(totalGold);
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

  // 벽 반사 시 작은 노란 스파크 4개
  _spawnBounceParticles(x, y, dirX) {
    for (let i = 0; i < 4; i++) {
      const p = this.scene.add.rectangle(x, y, 5, 5, 0xFFEB3B);
      p.setDepth(60);
      const angle = (-Math.PI / 4) + (i / 3) * (Math.PI / 2);
      const dist = 20 + Math.random() * 15;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist * dirX,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  // 벽에 부딫혔을 때 컨테이너를 살짝 가로 압축 → 통통 느낌
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
