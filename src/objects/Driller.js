import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { gameState } from '../systems/GameState.js';
import { ensureDrillerTexture } from './DrillerArt.js';

export class Driller {
  constructor(scene, tileX, worldY, tileMap, upgradeSystem = null, buffSystem = null) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.upgradeSystem = upgradeSystem;
    this.buffSystem = buffSystem;
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * this.tileSize) / 2);

    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    const drillerKey = ensureDrillerTexture(scene);

    // 컨테이너 안에 통합 텍스처 하나만 (본체 + 비트 + 헬멧 + 트랙이 한 이미지)
    this.container = scene.add.container(this.worldX, this.y);
    this.container.setDepth(50);

    // 텍스처 64x96. 본체 중심이 텍스처 y=32 (96 * 0.333).
    // sprite 위치 (0, 0) + origin (0.5, 0.333) = 본체 중심이 컨테이너 원점에 정확히 일치.
    // (이전 코드는 추가 16px 오프셋이 있어서 collision 위치와 비주얼 어긋났음 → 깜빡임 원인)
    this.sprite = scene.add.image(0, 0, drillerKey);
    this.sprite.setOrigin(0.5, 0.333);

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
    this._displayedRange = 1;  // 마지막으로 시각 갱신한 range
  }

  _syncUpgrades() {
    if (!this.upgradeSystem) return;
    let drillSpeedMult = this.upgradeSystem.getDrillSpeedMult();
    let engineMult = this.upgradeSystem.getEngineMult();

    // drillPowerUp 버프 (DRILL UP / TURBO / OVERDRIVE / !fast)
    if (this.buffSystem) {
      const powerBuff = this.buffSystem.get('drillPowerUp');
      if (powerBuff) {
        drillSpeedMult *= powerBuff.params.mult;
        engineMult *= powerBuff.params.mult;
      }
    }

    this.drillSpeedMult = drillSpeedMult;
    this.engineMult = engineMult;

    // 업그레이드 단계 + drillRangeUp 버프 = 효과 range
    const baseRange = this.upgradeSystem.getDrillRange();
    let bonus = 0;
    if (this.buffSystem) {
      const buff = this.buffSystem.get('drillRangeUp');
      if (buff) bonus = buff.params.bonus;
    }
    const newRange = baseRange + bonus;

    if (newRange !== this._displayedRange) {
      this._displayedRange = newRange;
      this._tweenScaleForRange(newRange);
    }
    this.drillRange = newRange;
  }

  // 현재 드릴이 위치한 tileX (트리거 시스템에서 사용)
  getCurrentTileX() {
    return Math.floor((this.worldX - this.xOffset) / this.tileSize);
  }

  // 드릴 크기가 채굴 반경에 맞춰 확연히 커짐 (범위 = 드릴 크기 일치감)
  // mining radius = 1.8 + (range-1) * 1.5 (tile)
  // drill scale ≈ mining radius (1 tile = scale 1.0 기준)
  _tweenScaleForRange(range) {
    const targetScale = 1.0 + (range - 1) * 1.7;
    // range 1: 1.0 (드릴 1 타일)
    // range 2: 2.7
    // range 3: 4.4 (버프 활성 시 — 드릴이 4타일 이상)
    // range 5: 7.8
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: 350,
      ease: 'Back.easeOut',
    });
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
    // 낙하 중에는 회전 없음 (이전 ±0.18 rad 상시 기울기는 깜빡임으로 보였음).
    // 채굴 중에만 작은 진동 (드릴이 박는 느낌).
    let rotation = 0;
    if (this.isMining) {
      this._wobble += dt * 22;
      rotation = Math.sin(this._wobble) * 0.04;
    } else {
      this._wobble = 0;
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

  // 반원 범위 채굴 — drillRange가 커질수록 반지름이 늘어남.
  // (기본 1=1.8, 2=3.0, 3=4.5, 4=6.0, 5=7.5, 6=9.0 타일 반경)
  _mineSemicircle(tileY, centerTileX) {
    const r = 1.8 + (Math.max(1, this.drillRange) - 1) * 1.5;
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
    // 너무 강한 squash는 큰 드릴이 출렁임 → 부드럽게.
    this.scene.tweens.killTweensOf(this.container);
    this.container.scaleX = 0.92;
    this.container.scaleY = 1.06;
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  getTileY() {
    return Math.floor(this.y / this.tileSize);
  }
}
