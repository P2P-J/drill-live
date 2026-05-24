import { ensureBossTexture, getBossArtSize } from './BossArt.js';
import { ORES } from '../config/ores.js';

const BOSS_COLOR_PALETTE = {
  megaMole:     { particle: 0x8B5A2B, glow: 0xFFAB91 },
  crystalGolem: { particle: 0xB39DDB, glow: 0xE1BEE7 },
  abyssKraken:  { particle: 0x4FC3F7, glow: 0x80DEEA },
  ancientTreant:{ particle: 0x66BB6A, glow: 0xCCFF90 },
  magmaDragon:  { particle: 0xFF5722, glow: 0xFFEB3B },
};

export class Boss {
  constructor(scene, def, x, y, opts = {}) {
    this.scene = scene;
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.tileMap = opts.tileMap;
    this.driller = opts.driller;  // 따라갈 대상
    this.onDefeated = opts.onDefeated;
    this.onFailed = opts.onFailed;
    this.onDamage = opts.onDamage;  // (amount) — UIScene 데미지 표시용
    this.x = x;
    this.y = y;
    this.alive = true;
    this._lastTintAt = 0;

    // 방향별 PNG가 둘 다 로드되어 있으면 방향별 텍스처 사용. 아니면 단일 텍스처 + flipX.
    const leftKey = `boss-${def.id}-left`;
    const rightKey = `boss-${def.id}-right`;
    const hasDirectional = this._hasRealImage(scene, leftKey) && this._hasRealImage(scene, rightKey);
    this._dirTextures = hasDirectional ? { left: leftKey, right: rightKey } : null;

    const tex = hasDirectional ? rightKey : ensureBossTexture(scene, def.id);
    // PNG가 로드되어 있으면 그 텍스처 사이즈 사용. 없으면 procedural 폴백 사이즈.
    let size = getBossArtSize(def.id);
    if (scene.textures.exists(tex)) {
      const src = scene.textures.get(tex).getSourceImage();
      if (src) size = { w: src.width, h: src.height };
    }
    this.size = size;

    // 아레나 바닥에 발이 닿도록 — 발(이미지 하단) 기준 위치 = boss.y
    this.arenaBounds = opts.arenaBounds ?? null;
    if (this.arenaBounds?.groundY) {
      this.y = this.arenaBounds.groundY - 6;  // 바닥 살짝 위 (벽과 안 겹치게)
    }

    this.container = scene.add.container(x, this.y);
    this.container.setDepth(45);

    this.sprite = scene.add.image(0, 0, tex);
    this.sprite.setOrigin(0.5, 1.0);   // 보스의 발/베이스 = sprite 하단 = container 원점
    this.container.add(this.sprite);

    // 좌우 이동 (아레나 안에서)
    this.vx = 110 * (Math.random() < 0.5 ? -1 : 1);
    // PNG 방향 — 진행 방향 따라 좌우 flip
    this._lastDir = this.vx > 0 ? 1 : -1;

    // 등장 연출
    this.sprite.setScale(0.1);
    this.sprite.setAlpha(0);
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.0, scaleY: 1.0, alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });
    const flash = scene.add.circle(x, y, Math.max(size.w, size.h) * 0.7, 0xffffff, 0.85);
    flash.setDepth(44);
    scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy(),
    });
    scene.cameras.main.shake(400, 0.02);

    this._startIdleAnim();
    this._startTimer();
  }

  _startIdleAnim() {
    this._idleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.04,
      scaleY: 0.96,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _startTimer() {
    this._startedAt = this.scene.time.now;
    this._timerEvent = this.scene.time.delayedCall(this.def.timeLimitMs, () => {
      if (this.alive) this._fail();
    });
  }

  remainingMs() {
    return Math.max(0, this.def.timeLimitMs - (this.scene.time.now - this._startedAt));
  }

  hpRatio() {
    return this.hp / this.maxHp;
  }

  // 매 프레임 호출. 보스가 좌우로 이동 + 드릴 접촉 시 데미지.
  update(delta, driller) {
    if (!this.alive) return;
    const dt = delta / 1000;

    // 좌우 이동 (아레나 바닥 위)
    if (this.arenaBounds) {
      this.x += this.vx * dt;
      const halfW = this.size.w * 0.45;
      if (this.x < this.arenaBounds.left + halfW) {
        this.x = this.arenaBounds.left + halfW;
        this.vx = Math.abs(this.vx);
      } else if (this.x > this.arenaBounds.right - halfW) {
        this.x = this.arenaBounds.right - halfW;
        this.vx = -Math.abs(this.vx);
      }
      // 진행 방향에 따라 텍스처 교체 (방향별 PNG가 있으면) 또는 flipX
      const dir = this.vx > 0 ? 1 : -1;
      if (dir !== this._lastDir) {
        this._lastDir = dir;
        if (this._dirTextures) {
          this.sprite.setTexture(dir > 0 ? this._dirTextures.right : this._dirTextures.left);
        } else {
          this.sprite.setFlipX(dir < 0);
        }
      }
      this.container.x = this.x;
    }

    // 드릴 접촉 판정
    const dx = driller.worldX - this.x;
    const drillHeadY = driller.y;
    const bossHeadY = this.y - this.size.h * 0.5;  // 보스 가운데 (발이 y, 머리가 y - h/2)
    const dy = drillHeadY - bossHeadY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = Math.max(this.size.w, this.size.h) * 0.42;

    if (dist < hitRadius) {
      const dps = 90 * (driller.drillSpeedMult ?? 1);
      this._applyContinuousDamage(dps * dt);
      if (driller.arenaMode && dist > 1) {
        const pushStrength = 40;
        driller.vx += (dx / dist) * pushStrength;
        driller.vy += (dy / dist) * pushStrength;
      }
    }
  }

  // 실제 이미지(로딩 성공)인지 체크. width<=4은 BootScene이 만든 placeholder.
  _hasRealImage(scene, key) {
    if (!scene.textures.exists(key)) return false;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage?.();
    return !!(src && src.width > 4 && !tex._procedural);
  }

  _applyContinuousDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);

    // 가벼운 깜빡 효과 (180ms throttle)
    const now = this.scene.time.now;
    if (now - this._lastTintAt > 180) {
      this._lastTintAt = now;
      this.sprite.setTint(0xff8888);
      this.scene.time.delayedCall(60, () => this.sprite.clearTint());
    }

    this.onDamage?.(amount, this);

    if (this.hp <= 0) this._defeat();
  }

  // 폭탄 등 큰 데미지 — 강한 시각 효과
  takeDamage(amount, source = null) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);

    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => this.sprite.clearTint());

    // 흔들기
    const baseX = this.x;
    this.scene.tweens.add({
      targets: this.container,
      x: { from: baseX - 12, to: baseX + 12 },
      duration: 45,
      yoyo: true,
      repeat: 4,
      onComplete: () => { this.container.x = this.x; },
    });

    const palette = BOSS_COLOR_PALETTE[this.def.id];
    this._spawnHitParticles(palette?.particle ?? 0xffffff);
    this.onDamage?.(amount, this);

    if (this.hp <= 0) this._defeat();
  }

  _spawnHitParticles(color) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 50 + Math.random() * 80;
      const p = this.scene.add.rectangle(this.x, this.y, 14, 14, color);
      p.setStrokeStyle(2, 0x000000, 0.7);
      p.setDepth(60);
      this.scene.tweens.add({
        targets: p,
        x: this.x + Math.cos(angle) * dist,
        y: this.y + Math.sin(angle) * dist,
        alpha: 0,
        angle: 360,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  _defeat() {
    if (!this.alive) return;
    this.alive = false;
    this._timerEvent?.remove();
    this._idleTween?.stop();

    const palette = BOSS_COLOR_PALETTE[this.def.id];

    // 큰 폭발
    const flash = this.scene.add.circle(this.x, this.y, 200, 0xffffff, 0.95);
    flash.setDepth(85);
    this.scene.tweens.add({
      targets: flash, scale: 2.5, alpha: 0, duration: 600,
      onComplete: () => flash.destroy(),
    });

    const ring = this.scene.add.circle(this.x, this.y, 20);
    ring.setStrokeStyle(12, palette?.glow ?? 0xFFEB3B, 1);
    ring.setDepth(84);
    this.scene.tweens.add({
      targets: ring, radius: 500, alpha: 0, duration: 800,
      onComplete: () => ring.destroy(),
    });

    // 큰 폭발 입자
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
      const dist = 100 + Math.random() * 150;
      const c = i % 2 ? (palette?.particle ?? 0xffffff) : (palette?.glow ?? 0xFFEB3B);
      const p = this.scene.add.rectangle(this.x, this.y, 16, 16, c);
      p.setStrokeStyle(2, 0x000000, 0.6);
      p.setDepth(83);
      this.scene.tweens.add({
        targets: p,
        x: this.x + Math.cos(angle) * dist,
        y: this.y + Math.sin(angle) * dist,
        alpha: 0,
        angle: 360 * 2,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 800 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    this.scene.tweens.add({
      targets: this.container,
      scale: 0, alpha: 0, rotation: Math.PI * 2,
      duration: 800,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.container.destroy();
        this.onDefeated?.(this);
      },
    });

    this._spawnRewardOres();
    this.scene.cameras.main.shake(600, 0.025);
  }

  _spawnRewardOres() {
    if (!this.tileMap) return;
    const ore = ORES[this.def.rewardOre];
    if (!ore) return;

    const T = 64;
    const xOffset = this.tileMap.xOffset;
    const centerTileX = Math.floor((this.x - xOffset) / T);
    const centerTileY = Math.floor((this.y + 100) / T);

    let placed = 0;
    const candidates = [];
    for (let dy = 0; dy <= 8; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        if (dx * dx + dy * dy > 40) continue;
        candidates.push([centerTileX + dx, centerTileY + dy]);
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const [tx, ty] of candidates) {
      if (placed >= this.def.rewardCount) break;
      if (this.tileMap.convertToOre(tx, ty, ore)) placed++;
    }
  }

  _fail() {
    if (!this.alive) return;
    this.alive = false;
    this._idleTween?.stop();

    this.scene.tweens.add({
      targets: this.container,
      y: this.y - 700,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.destroy();
        this.onFailed?.(this);
      },
    });
  }

  forceDefeat() {
    this.hp = 0;
    this._defeat();
  }
}
