import { GAME } from '../config/game.js';

const T = GAME.tileSize;

function ensureTntTexture(scene, key, bodyColor) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);

  // 본체 (둥근 빨강 박스)
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(8, 16, 48, 44, 6);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(8, 16, 48, 44, 6);

  // 어두운 라벨 띠 (상/하)
  g.fillStyle(0x000000, 0.35);
  g.fillRect(10, 28, 44, 4);
  g.fillRect(10, 46, 44, 4);

  // 가운데 흰 박스 (라벨 영역)
  g.fillStyle(0xffffff, 0.85);
  g.fillRect(14, 34, 36, 10);

  // 도화선 홀더
  g.fillStyle(0x424242, 1);
  g.fillRoundedRect(24, 8, 16, 10, 2);
  g.lineStyle(2, 0x000000, 1);
  g.strokeRoundedRect(24, 8, 16, 10, 2);

  // 도화선
  g.lineStyle(3, 0xFFEB3B, 1);
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(38, 0);
  g.strokePath();

  // 도화선 끝 불꽃
  g.fillStyle(0xFF5722, 1);
  g.fillCircle(38, 0, 4);
  g.fillStyle(0xFFEB3B, 1);
  g.fillCircle(38, 0, 2);

  g.generateTexture(key, 64, 64);
  g.destroy();
  return key;
}

// 중력 — px/s^2. 시각적으로 자연스러운 낙하 가속.
const GRAVITY_PX_S2 = 1800;

export class ExplosionEffect {
  constructor(scene, tileMap, soundManager = null) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.soundManager = soundManager;
    // 활성 TNT 본체들 — 매 프레임 중력 + 충돌 계산. GameScene.update에서 step() 호출.
    this._bodies = [];
  }

  // 후원 폭탄 트리거 - TNT가 위에서 중력 받아 떨어져서 땅이나 먼저 떨어진 TNT 위에 쌓이고,
  // sizzle 후 폭발. 폭탄끼리 겹치지 않음.
  // opts: { radius, color, label, tntScale, shake, dropFromTilesAbove, sizzleDurationMs, names, explosionSound }
  // 반환: handle (LIKE TNT 같이 sizzle 중에 이름 더 추가하려고 할 때 사용)
  drop(targetX, drillY, opts = {}) {
    const radius = opts.radius ?? 1.5;
    const color = opts.color ?? 0xD32F2F;
    const label = opts.label ?? 'BOMB';
    const tntScale = opts.tntScale ?? 1.0;
    const shake = opts.shake ?? 0.012;
    const dropTiles = opts.dropFromTilesAbove ?? 14;
    const sizzleDurationMs = opts.sizzleDurationMs ?? 1000;
    const names = opts.names ? [...opts.names] : [];
    const explosionSound = opts.explosionSound ?? 'bomb_small';

    const tntKey = ensureTntTexture(this.scene, `tnt-${color.toString(16)}`, color);

    const startY = drillY - dropTiles * T;
    const tnt = this.scene.add.image(targetX, startY, tntKey);
    tnt.setScale(tntScale);
    tnt.setDepth(80);

    const labelText = this.scene.add.text(targetX, startY, label, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: `${Math.floor(16 * tntScale)}px`,
      color: '#000000',
    }).setOrigin(0.5, -1.0).setDepth(81);

    // 좋아요/후원자 이름 표시 (TNT 위쪽에 떠 있음)
    const namesText = this.scene.add.text(targetX, startY - 40, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '18px',
      color: '#FFEB3B',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 1.0).setDepth(82);

    // 핸들 — 외부에서 sizzle 중 이름 추가 가능
    const handle = {
      isLanded: false,
      isExploded: false,
      names,
      addName(name) {
        if (this.isExploded) return false;
        this.names.push(name);
        namesText.setText(this.names.slice(-5).join('\n'));
        return true;
      },
    };
    if (names.length > 0) namesText.setText(names.slice(-5).join('\n'));

    // 본체 — 중력 + 충돌 시뮬레이션에 사용
    const body = {
      x: targetX, y: startY, vy: 0,
      tntScale,
      tnt, labelText, namesText, handle,
      drillY,    // _findGround scan 기준
      state: 'falling',
      // 폭발 메타
      radius, color, shake, sizzleDurationMs, explosionSound,
    };
    this._bodies.push(body);

    // 떨어지는 동안 살짝 흔들기 — 시각 흔들림은 별도 tween
    this.scene.tweens.add({
      targets: tnt,
      angle: { from: -6, to: 6 },
      duration: 120,
      yoyo: true,
      repeat: 8,
    });

    return handle;
  }

  // GameScene.update에서 매 프레임 호출. 모든 falling TNT에 중력 적용 + 충돌 검사.
  step(deltaMs) {
    if (this._bodies.length === 0) return;
    const dt = Math.min(0.05, deltaMs / 1000);

    // 깊이 순(아래쪽=큰 y) 정렬 — 아래쪽 본체부터 처리해야 위 본체가 정확한 충돌 대상을 봄
    const falling = this._bodies.filter(b => b.state === 'falling').sort((a, b) => b.y - a.y);
    for (const body of falling) {
      body.vy += GRAVITY_PX_S2 * dt;
      const newY = body.y + body.vy * dt;
      const restY = this._findRestY(body, newY);
      if (restY !== null && newY >= restY) {
        body.y = restY;
        body.vy = 0;
        body.state = 'sizzling';
        body.handle.isLanded = true;
        this._beginSizzle(body);
      } else {
        body.y = newY;
      }
      body.tnt.y = body.y;
      body.labelText.y = body.y;
      body.namesText.y = body.y - 50;
    }
  }

  _beginSizzle(body) {
    this.soundManager?.play('tnt_sizzle', { duration: body.sizzleDurationMs / 1000 });
    this._sizzle(body.tnt, body.labelText, body.sizzleDurationMs, () => {
      body.handle.isExploded = true;
      body.tnt.destroy();
      body.labelText.destroy();
      body.namesText.destroy();
      // 활성 본체 목록에서 제거 — 다른 폭탄이 이 자리로 떨어질 수 있게
      const idx = this._bodies.indexOf(body);
      if (idx >= 0) this._bodies.splice(idx, 1);
      this.soundManager?.play(body.explosionSound);
      const explosionY = body.y + (T / 2) * body.tntScale;
      this._explode(body.x, explosionY, { radius: body.radius, color: body.color, shake: body.shake });
    });
  }

  // TNT 본체가 newY로 이동하려고 할 때, 정지해야 할 Y(=TNT 중심)를 반환. 충돌 없으면 null.
  _findRestY(body, newY) {
    const halfH = (T / 2) * body.tntScale;
    const halfW = (T / 2) * body.tntScale;
    // 1) 땅
    const groundTile = this._findGround(body.x, body.drillY);
    let rest = groundTile.tileY * T - halfH;
    // 2) 다른 본체들 (falling/sizzling 모두 — 폭발 전 본체는 stack 대상)
    for (const other of this._bodies) {
      if (other === body) continue;
      if (other.state === 'exploded') continue;
      const otherHalfH = (T / 2) * other.tntScale;
      const otherHalfW = (T / 2) * other.tntScale;
      if (Math.abs(body.x - other.x) < halfW + otherHalfW - 4) {
        const stackTop = other.y - otherHalfH;       // 상대 TNT 상단
        const candidateRest = stackTop - halfH;       // 그 위에 살포시
        if (candidateRest < rest && candidateRest > body.y) rest = candidateRest;
      }
    }
    return newY >= rest ? rest : null;
  }

  // 첫 번째 살아있는 타일(=땅) 찾기. drillBottomY = 드릴 sprite의 시각적 바닥.
  // 큰 드릴이면 더 아래까지 스캔해서 드릴 비주얼과 안 겹치게 함.
  _findGround(targetX, drillBottomY) {
    const xOffset = this.tileMap.xOffset;
    const tileX = Math.floor((targetX - xOffset) / T);
    let tileY = Math.max(0, Math.floor(drillBottomY / T));
    for (let i = 0; i < 80; i++) {
      const tile = this.tileMap.getTileAt(tileX, tileY);
      if (tile && !tile.destroyed && !tile.isWall) {
        return { tileX, tileY };
      }
      tileY++;
    }
    return { tileX, tileY: Math.floor(drillBottomY / T) + 3 };
  }

  // 치지직 — 도화선 타들어가는 느낌. duration 파라미터로 길이 조정 가능 (LIKE=3초, BOMB=1초)
  _sizzle(tnt, labelText, sizzleMs, onDone) {
    const startX = tnt.x;
    const startY = tnt.y;

    // 떨림
    const shakeTween = this.scene.tweens.add({
      targets: tnt,
      x: { from: startX - 4, to: startX + 4 },
      duration: 70,
      yoyo: true,
      repeat: -1,
    });

    // 명암 반복 (점점 빨라짐 효과는 ease로 흉내)
    const flashTween = this.scene.tweens.add({
      targets: tnt,
      alpha: { from: 1.0, to: 0.45 },
      duration: 110,
      yoyo: true,
      repeat: -1,
    });

    // 도화선 불꽃 입자 — TNT 위쪽에서 튄다
    const sparkEvent = this.scene.time.addEvent({
      delay: 60,
      repeat: Math.floor(sizzleMs / 60) - 1,
      callback: () => {
        const sx = tnt.x + (Math.random() - 0.5) * 14;
        const sy = tnt.y - 30 * (tnt.scale ?? 1);
        const c = Math.random() < 0.5 ? 0xFFEB3B : 0xFF9800;
        const p = this.scene.add.rectangle(sx, sy, 4, 4, c);
        p.setDepth(86);
        this.scene.tweens.add({
          targets: p,
          x: sx + (Math.random() - 0.5) * 18,
          y: sy - 16 - Math.random() * 12,
          alpha: 0,
          scale: 0.2,
          duration: 260,
          ease: 'Quad.easeOut',
          onComplete: () => p.destroy(),
        });
      },
    });

    // 라벨도 같이 살짝 진동
    const labelTween = this.scene.tweens.add({
      targets: labelText,
      x: { from: labelText.x - 3, to: labelText.x + 3 },
      duration: 90,
      yoyo: true,
      repeat: -1,
    });

    this.scene.time.delayedCall(sizzleMs, () => {
      shakeTween.stop();
      flashTween.stop();
      labelTween.stop();
      sparkEvent.remove();
      tnt.x = startX;
      tnt.y = startY;
      tnt.alpha = 1;
      onDone();
    });
  }

  // 폭발 시각 효과 + 타일 파괴
  _explode(centerX, centerY, opts) {
    const { radius, color, shake } = opts;
    const radiusPx = radius * T;

    // 화이트 플래시
    const flash = this.scene.add.circle(centerX, centerY, radiusPx * 1.2, 0xffffff, 0.9);
    flash.setDepth(85);
    this.scene.tweens.add({
      targets: flash,
      scale: { from: 0.2, to: 1.4 },
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // 컬러 링
    const ring = this.scene.add.circle(centerX, centerY, 8);
    ring.setStrokeStyle(10, color, 1);
    ring.setDepth(84);
    this.scene.tweens.add({
      targets: ring,
      radius: radiusPx * 1.3,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // 두 번째 링 (지연)
    this.scene.time.delayedCall(120, () => {
      const ring2 = this.scene.add.circle(centerX, centerY, 8);
      ring2.setStrokeStyle(6, 0xFFEB3B, 0.9);
      ring2.setDepth(84);
      this.scene.tweens.add({
        targets: ring2,
        radius: radiusPx * 1.1,
        alpha: 0,
        duration: 500,
        onComplete: () => ring2.destroy(),
      });
    });

    // 화염 입자
    this._spawnFireParticles(centerX, centerY, radiusPx);

    // 타일 파괴 (원형)
    const centerTileX = this.tileMap.worldXToTileX(centerX);
    const centerTileY = this.tileMap.worldYToTileY(centerY);
    const ir = Math.ceil(radius);
    const r2 = radius * radius;

    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        const tile = this.tileMap.getTileAt(tx, ty);
        if (!tile || tile.destroyed) continue;
        if (tile.isWall && radius < 3) continue;  // 작은 폭탄은 벽 못 깸
        this.tileMap.destroyTile(tx, ty);
      }
    }

    // 화면 흔들림
    this.scene.cameras.main.shake(Math.min(500, 200 + radius * 60), shake);
  }

  _spawnFireParticles(x, y, radiusPx) {
    const count = 14;
    const palette = [0xFFEB3B, 0xFF9800, 0xFF5722, 0xF44336];
    for (let i = 0; i < count; i++) {
      const c = palette[i % palette.length];
      const p = this.scene.add.rectangle(x, y, 10, 10, c);
      p.setStrokeStyle(1, 0x000000, 0.6);
      p.setDepth(83);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const dist = radiusPx * (0.6 + Math.random() * 0.7);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scaleX: 0.1,
        scaleY: 0.1,
        alpha: 0,
        angle: 360 * (Math.random() < 0.5 ? -1 : 1),
        duration: 500 + Math.random() * 300,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}
