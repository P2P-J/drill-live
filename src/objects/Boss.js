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
    this.onDefeated = opts.onDefeated;
    this.onFailed = opts.onFailed;
    this.x = x;
    this.y = y;
    this.alive = true;

    const tex = ensureBossTexture(scene, def.id);
    const size = getBossArtSize(def.id);

    this.container = scene.add.container(x, y);
    this.container.setDepth(45);

    this.sprite = scene.add.image(0, 0, tex);
    this.sprite.setOrigin(0.5, 0.6);  // 발 쪽이 중심이라 살짝 아래로

    this.container.add(this.sprite);

    // 등장 연출 — 작게 시작해서 부풀어오름
    this.sprite.setScale(0.1);
    this.sprite.setAlpha(0);
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });
    // 빛 플래시 (등장 임팩트)
    const flash = scene.add.circle(x, y, Math.max(size.w, size.h) * 0.8, 0xffffff, 0.9);
    flash.setDepth(44);
    scene.tweens.add({
      targets: flash,
      scale: 1.6,
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

  takeDamage(amount, source = null) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);

    // 흰 깜빡
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint());

    // 좌우 흔들기
    this.scene.tweens.add({
      targets: this.container,
      x: { from: this.x - 10, to: this.x + 10 },
      duration: 40,
      yoyo: true,
      repeat: 4,
      onComplete: () => { this.container.x = this.x; },
    });

    // 파티클
    const palette = BOSS_COLOR_PALETTE[this.def.id];
    this._spawnHitParticles(palette?.particle ?? 0xffffff);

    if (this.hp <= 0) this._defeat();
  }

  _spawnHitParticles(color) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 40 + Math.random() * 60;
      const p = this.scene.add.rectangle(this.x, this.y - 40, 12, 12, color);
      p.setStrokeStyle(2, 0x000000, 0.7);
      p.setDepth(60);
      this.scene.tweens.add({
        targets: p,
        x: this.x + Math.cos(angle) * dist,
        y: this.y - 40 + Math.sin(angle) * dist,
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

    // 큰 폭발 이펙트
    const flash = this.scene.add.circle(this.x, this.y, 200, 0xffffff, 0.95);
    flash.setDepth(85);
    this.scene.tweens.add({
      targets: flash,
      scale: 2.5,
      alpha: 0,
      duration: 600,
      onComplete: () => flash.destroy(),
    });

    const ring = this.scene.add.circle(this.x, this.y, 20);
    ring.setStrokeStyle(12, palette?.glow ?? 0xFFEB3B, 1);
    ring.setDepth(84);
    this.scene.tweens.add({
      targets: ring,
      radius: 400,
      alpha: 0,
      duration: 800,
      onComplete: () => ring.destroy(),
    });

    // 파편 + 회전+축소 사라지기
    this.scene.tweens.add({
      targets: this.container,
      scale: 0,
      alpha: 0,
      rotation: Math.PI * 2,
      duration: 800,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.container.destroy();
        this.onDefeated?.(this);
      },
    });

    // 광물 우수수 (보상)
    this._spawnRewardOres(palette);

    this.scene.cameras.main.shake(600, 0.025);
  }

  _spawnRewardOres(palette) {
    if (!this.tileMap) return;
    const ore = ORES[this.def.rewardOre];
    if (!ore) return;

    const T = 64;
    const xOffset = this.tileMap.xOffset;
    const centerTileX = Math.floor((this.x - xOffset) / T);
    const centerTileY = Math.floor((this.y + 100) / T);

    let placed = 0;
    const candidates = [];
    for (let dy = 0; dy <= 6; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (dx * dx + dy * dy > 30) continue;
        candidates.push([centerTileX + dx, centerTileY + dy]);
      }
    }
    // 셔플
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

    // 도망/사라짐 — 화면 위쪽으로 빠짐
    this.scene.tweens.add({
      targets: this.container,
      y: this.y - 600,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.destroy();
        this.onFailed?.(this);
      },
    });
  }

  // 외부에서 호출 가능 (디버그용 — 즉시 처치)
  forceDefeat() {
    this.hp = 0;
    this._defeat();
  }
}
