import { GAME } from '../config/game.js';

const TILE_PX = GAME.tileSize;

// ── 색상 유틸 ──
export function darken(hex, f) {
  const r = Math.max(0, Math.round(((hex >> 16) & 0xff) * f));
  const g = Math.max(0, Math.round(((hex >> 8) & 0xff) * f));
  const b = Math.max(0, Math.round((hex & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

export function lighten(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((hex & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

// 결정적 해시 (타일 좌표 → 0~0xffffffff)
export function tileHash(x, y) {
  let h = (x * 73856093) ^ (y * 19349663);
  h = ((h ^ (h >>> 13)) * 0x5bd1e995) >>> 0;
  return h;
}

// 텍스처 한 번만 생성
function ensureTexture(scene, key, drawFn, size = TILE_PX) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  drawFn(g);
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}

// ── 흙 타일 텍스처 (variant 0~3, 색상별 캐싱) ──
export function ensureDirtTexture(scene, baseColor, variant = 0) {
  const key = `dirt-${baseColor.toString(16)}-v${variant}`;
  return ensureTexture(scene, key, (g) => {
    const t = TILE_PX;
    const base = baseColor;
    const top = lighten(base, 1.18);
    const bot = darken(base, 0.72);
    const dark = darken(base, 0.55);
    const dark2 = darken(base, 0.42);
    const light = lighten(base, 1.35);

    // 베이스
    g.fillStyle(base, 1);
    g.fillRect(0, 0, t, t);

    // 상단 하이라이트 (햇빛 라인)
    g.fillStyle(top, 1);
    g.fillRect(2, 2, t - 4, 4);

    // 좌측 하이라이트
    g.fillStyle(top, 0.6);
    g.fillRect(2, 6, 2, t - 12);

    // 하단 그림자
    g.fillStyle(bot, 1);
    g.fillRect(2, t - 6, t - 4, 4);

    // 우측 그림자
    g.fillStyle(bot, 0.6);
    g.fillRect(t - 4, 6, 2, t - 12);

    // variant별 돌멩이/디테일 위치
    const patterns = [
      // variant 0
      [{ x: 12, y: 18, w: 8, h: 6, c: dark },
       { x: 40, y: 38, w: 7, h: 5, c: dark2 },
       { x: 30, y: 14, w: 4, h: 3, c: light },
       { x: 18, y: 44, w: 3, h: 2, c: light }],
      // variant 1
      [{ x: 22, y: 14, w: 7, h: 5, c: dark2 },
       { x: 10, y: 36, w: 9, h: 6, c: dark },
       { x: 44, y: 18, w: 3, h: 3, c: light },
       { x: 38, y: 44, w: 4, h: 3, c: light }],
      // variant 2
      [{ x: 14, y: 24, w: 8, h: 6, c: dark },
       { x: 36, y: 12, w: 6, h: 5, c: dark2 },
       { x: 44, y: 36, w: 7, h: 5, c: dark },
       { x: 22, y: 42, w: 3, h: 2, c: light }],
      // variant 3
      [{ x: 18, y: 38, w: 8, h: 5, c: dark },
       { x: 38, y: 22, w: 7, h: 6, c: dark2 },
       { x: 12, y: 12, w: 4, h: 3, c: light },
       { x: 46, y: 46, w: 3, h: 3, c: light }],
    ];
    for (const p of patterns[variant % 4]) {
      g.fillStyle(p.c, 1);
      g.fillRect(p.x, p.y, p.w, p.h);
    }
  });
}

// ── 벽 타일 (회색 + 균열) ──
export function ensureWallTexture(scene, variant = 0) {
  const key = `wall-v${variant}`;
  return ensureTexture(scene, key, (g) => {
    const t = TILE_PX;
    const base = 0x4a4a4a;
    const top = 0x7a7a7a;
    const bot = 0x2a2a2a;
    const crack = 0x1a1a1a;

    // 베이스
    g.fillStyle(base, 1);
    g.fillRect(0, 0, t, t);

    // 입체감
    g.fillStyle(top, 1);
    g.fillRect(2, 2, t - 4, 4);
    g.fillRect(2, 6, 2, t - 12);
    g.fillStyle(bot, 1);
    g.fillRect(2, t - 6, t - 4, 4);
    g.fillRect(t - 4, 6, 2, t - 12);

    // 균열 (variant별 다른 패턴)
    g.lineStyle(2, crack, 1);
    const cracks = [
      [{ x1: 14, y1: 10, x2: 28, y2: 30 }, { x1: 28, y1: 30, x2: 22, y2: 50 }],
      [{ x1: 40, y1: 8, x2: 32, y2: 26 }, { x1: 16, y1: 22, x2: 38, y2: 44 }],
      [{ x1: 10, y1: 38, x2: 30, y2: 22 }, { x1: 30, y1: 22, x2: 48, y2: 32 }],
      [{ x1: 24, y1: 14, x2: 16, y2: 34 }, { x1: 36, y1: 18, x2: 50, y2: 50 }],
    ];
    for (const c of cracks[variant % 4]) {
      g.beginPath();
      g.moveTo(c.x1, c.y1);
      g.lineTo(c.x2, c.y2);
      g.strokePath();
    }
    // 작은 점들 (단단함 표현)
    g.fillStyle(crack, 1);
    g.fillRect(20, 20, 2, 2);
    g.fillRect(44, 28, 2, 2);
    g.fillRect(28, 42, 2, 2);
  });
}

// ── 광물 보석 (8각형 + 하이라이트, ore별 캐싱) ──
export function ensureGemTexture(scene, oreId, oreColor) {
  const key = `gem-${oreId}`;
  return ensureTexture(scene, key, (g) => {
    const t = TILE_PX;
    const cx = t / 2, cy = t / 2;
    const r = t * 0.32;
    const inner = t * 0.20;

    // 어두운 외곽 (그림자 살짝 오른쪽 아래 오프셋)
    drawOctagon(g, cx + 1, cy + 2, r, darken(oreColor, 0.25), 1);

    // 어두운 테두리 색
    drawOctagon(g, cx, cy, r, darken(oreColor, 0.5), 1);

    // 메인 보석
    drawOctagon(g, cx, cy, r - 3, oreColor, 1);

    // 하이라이트 (좌상단)
    g.fillStyle(lighten(oreColor, 1.7), 0.9);
    g.fillTriangle(
      cx - inner * 0.7, cy - inner * 0.3,
      cx - inner * 0.2, cy - inner * 0.7,
      cx + inner * 0.1, cy - inner * 0.5
    );

    // 반짝이 점
    g.fillStyle(0xffffff, 0.95);
    g.fillRect(cx - inner * 0.4, cy - inner * 0.6, 3, 3);
  });
}

function drawOctagon(g, cx, cy, r, color, alpha) {
  g.fillStyle(color, alpha);
  const s = r * 0.41; // 8각형 한 변의 절반
  const pts = [
    cx - s, cy - r,
    cx + s, cy - r,
    cx + r, cy - s,
    cx + r, cy + s,
    cx + s, cy + r,
    cx - s, cy + r,
    cx - r, cy + s,
    cx - r, cy - s,
  ];
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillPath();
}
