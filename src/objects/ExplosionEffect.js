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

export class ExplosionEffect {
  constructor(scene, tileMap) {
    this.scene = scene;
    this.tileMap = tileMap;
  }

  // 후원 폭탄 트리거 - 위에서 TNT가 떨어져서 폭발
  // opts: { radius, color, label, tntScale, durationMs, shake, dropFromTilesAbove }
  drop(targetX, targetY, opts = {}) {
    const radius = opts.radius ?? 1.5;
    const color = opts.color ?? 0xD32F2F;
    const label = opts.label ?? 'BOMB';
    const tntScale = opts.tntScale ?? 1.0;
    const shake = opts.shake ?? 0.012;
    const dropTiles = opts.dropFromTilesAbove ?? 14;

    const tntKey = ensureTntTexture(this.scene, `tnt-${color.toString(16)}`, color);

    const startY = targetY - dropTiles * T;
    const tnt = this.scene.add.image(targetX, startY, tntKey);
    tnt.setScale(tntScale);
    tnt.setDepth(80);

    // 라벨 텍스트 (TNT 박스 위에 표시)
    const labelText = this.scene.add.text(targetX, startY, label, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: `${Math.floor(16 * tntScale)}px`,
      color: '#000000',
    }).setOrigin(0.5, -1.0).setDepth(81);

    // 낙하 (가속도 느낌)
    const fallDuration = 600;
    this.scene.tweens.add({
      targets: [tnt, labelText],
      y: targetY,
      duration: fallDuration,
      ease: 'Quad.easeIn',
      onComplete: () => {
        tnt.destroy();
        labelText.destroy();
        this._explode(targetX, targetY, { radius, color, shake });
      },
    });

    // 떨어지는 동안 살짝 흔들기 (도화선이 타는 느낌)
    this.scene.tweens.add({
      targets: tnt,
      angle: { from: -6, to: 6 },
      duration: 120,
      yoyo: true,
      repeat: Math.floor(fallDuration / 240),
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
        // 폭탄은 벽도 깨뜨릴 수 있게 (반경 클 때만)
        if (tile.isWall && radius < 3) continue;
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
