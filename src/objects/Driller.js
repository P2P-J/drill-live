import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { gameState } from '../systems/GameState.js';
import { ensureDrillerTexture } from './DrillerArt.js';

export class Driller {
  constructor(scene, tileX, worldY, tileMap, upgradeSystem = null) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.upgradeSystem = upgradeSystem;
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * this.tileSize) / 2);

    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    const drillerKey = ensureDrillerTexture(scene);

    // 컨테이너 안에 통합 텍스처 하나만 (본체 + 비트 + 헬멧 + 트랙이 한 이미지)
    this.container = scene.add.container(this.worldX, this.y);
    this.container.setDepth(50);

    // 텍스처는 64x96. 본체 중심이 텍스처 y=32, 비트 끝이 텍스처 y=94.
    // 컨테이너 회전 기준점이 텍스처 중심이 되도록 이미지 origin을 본체 중심으로 이동.
    this.sprite = scene.add.image(0, this.tileSize * 0.25, drillerKey);
    this.sprite.setOrigin(0.5, 0.333);  // 텍스처의 y=32 지점 (96 * 0.333) = body 중심

    this.container.add(this.sprite);

    // 업그레이드 효과치
    this.speed = GAME.baseDrillSpeed;
    this.drillSpeedMult = 1.0;
    this.engineMult = 1.0;
    this.drillRange = 1;

    // 좌우 통통 튀기 (미미한 드리프트)
    this.leftBound = this.xOffset + (GAME.wallLeftX + 1) * this.tileSize + this.tileSize * 0.46;
    this.rightBound = this.xOffset + GAME.wallRightX * this.tileSize - this.tileSize * 0.46;
    this.vx = GAME.bounceSpeed * (Math.random() < 0.5 ? -1 : 1);

    this.mineProgress = 0;
    this.isMining = false;
    this._wobble = 0;
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

    // 좌우 + 벽 반사
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

    // ── 회전: 본체+비트 한 덩어리 ──
    // 1) 이동 방향 따른 미세 기울기 (-0.15 ~ +0.15 rad)
    const tiltTarget = (this.vx / GAME.bounceSpeed) * 0.18;
    let rotation = tiltTarget;

    // 2) 채굴 중 흔들림 (드릴이 박는 진동감)
    if (this.isMining) {
      this._wobble += dt * 18;
      rotation += Math.sin(this._wobble) * 0.05;
    }

    this.container.rotation = rotation;

    // 아래쪽 타일 검사
    const currentTileX = Math.floor((this.worldX - this.xOffset) / this.tileSize);
    const halfH = this.tileSize / 2;
    const drillerBottom = this.y + halfH;
    const epsilon = 1;
    const nextTileY = Math.floor((drillerBottom + epsilon) / this.tileSize);

    const blocker = this.tileMap.getTileAt(currentTileX, nextTileY);

    if (blocker && !blocker.destroyed && !blocker.isWall && nextTileY >= 0) {
      this.isMining = true;
      this.mineProgress += dt * this.drillSpeedMult;

      if (this.mineProgress >= GAME.minePerTileSeconds) {
        this._mineSemicircle(nextTileY, currentTileX);
        this.mineProgress = 0;
      } else {
        const snapY = nextTileY * this.tileSize - halfH;
        this.y = Math.min(this.y, snapY);
      }
    } else {
      this.isMining = false;
      this.y += this.speed * this.engineMult * dt;
    }

    this.container.x = this.worldX;
    this.container.y = this.y;
  }

  // 반원 범위 채굴 (drillRange 1=1.8, 2=3.0, 3=4.5 타일 반경)
  _mineSemicircle(tileY, centerTileX) {
    const radiusMap = [1.8, 3.0, 4.5];
    const r = radiusMap[Math.min(this.drillRange, radiusMap.length) - 1] ?? 1.8;
    const r2 = r * r;
    const ir = Math.ceil(r);
    let totalGold = 0;

    for (let dy = 0; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const tx = centerTileX + dx;
        const ty = tileY + dy;
        const tile = this.tileMap.getTileAt(tx, ty);
        if (!tile || tile.destroyed || tile.isWall) continue;

        const px = tile.worldX + this.tileSize / 2;
        const py = tile.worldY + this.tileSize / 2;
        const ore = this.tileMap.destroyTile(tx, ty);
        this._spawnParticles(px, py, ore ? ore.color : 0x8B5A2B);

        if (ore) {
          totalGold += ore.value;
          gameState.addOre(ore.id);
        }
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
    this.container.scaleX = 0.82;
    this.container.scaleY = 1.12;
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
