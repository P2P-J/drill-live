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

export function tileHash(x, y) {
  let h = (x * 73856093) ^ (y * 19349663);
  h = ((h ^ (h >>> 13)) * 0x5bd1e995) >>> 0;
  return h;
}

function ensureTexture(scene, key, drawFn, size = TILE_PX) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  drawFn(g);
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}

// ── 흙 타일 ──
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

    g.fillStyle(base, 1); g.fillRect(0, 0, t, t);
    g.fillStyle(top, 1); g.fillRect(2, 2, t - 4, 4);
    g.fillStyle(top, 0.6); g.fillRect(2, 6, 2, t - 12);
    g.fillStyle(bot, 1); g.fillRect(2, t - 6, t - 4, 4);
    g.fillStyle(bot, 0.6); g.fillRect(t - 4, 6, 2, t - 12);

    const patterns = [
      [{ x: 12, y: 18, w: 8, h: 6, c: dark }, { x: 40, y: 38, w: 7, h: 5, c: dark2 },
       { x: 30, y: 14, w: 4, h: 3, c: light }, { x: 18, y: 44, w: 3, h: 2, c: light }],
      [{ x: 22, y: 14, w: 7, h: 5, c: dark2 }, { x: 10, y: 36, w: 9, h: 6, c: dark },
       { x: 44, y: 18, w: 3, h: 3, c: light }, { x: 38, y: 44, w: 4, h: 3, c: light }],
      [{ x: 14, y: 24, w: 8, h: 6, c: dark }, { x: 36, y: 12, w: 6, h: 5, c: dark2 },
       { x: 44, y: 36, w: 7, h: 5, c: dark }, { x: 22, y: 42, w: 3, h: 2, c: light }],
      [{ x: 18, y: 38, w: 8, h: 5, c: dark }, { x: 38, y: 22, w: 7, h: 6, c: dark2 },
       { x: 12, y: 12, w: 4, h: 3, c: light }, { x: 46, y: 46, w: 3, h: 3, c: light }],
    ];
    for (const p of patterns[variant % 4]) {
      g.fillStyle(p.c, 1); g.fillRect(p.x, p.y, p.w, p.h);
    }
  });
}

// ── 벽 타일 ──
export function ensureWallTexture(scene, variant = 0) {
  const key = `wall-v${variant}`;
  return ensureTexture(scene, key, (g) => {
    const t = TILE_PX;
    g.fillStyle(0x4a4a4a, 1); g.fillRect(0, 0, t, t);
    g.fillStyle(0x7a7a7a, 1); g.fillRect(2, 2, t - 4, 4); g.fillRect(2, 6, 2, t - 12);
    g.fillStyle(0x2a2a2a, 1); g.fillRect(2, t - 6, t - 4, 4); g.fillRect(t - 4, 6, 2, t - 12);

    g.lineStyle(2, 0x1a1a1a, 1);
    const cracks = [
      [{ x1: 14, y1: 10, x2: 28, y2: 30 }, { x1: 28, y1: 30, x2: 22, y2: 50 }],
      [{ x1: 40, y1: 8, x2: 32, y2: 26 }, { x1: 16, y1: 22, x2: 38, y2: 44 }],
      [{ x1: 10, y1: 38, x2: 30, y2: 22 }, { x1: 30, y1: 22, x2: 48, y2: 32 }],
      [{ x1: 24, y1: 14, x2: 16, y2: 34 }, { x1: 36, y1: 18, x2: 50, y2: 50 }],
    ];
    for (const c of cracks[variant % 4]) {
      g.beginPath(); g.moveTo(c.x1, c.y1); g.lineTo(c.x2, c.y2); g.strokePath();
    }
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(20, 20, 2, 2); g.fillRect(44, 28, 2, 2); g.fillRect(28, 42, 2, 2);
  });
}

// ── 광물별 고유 드로잉 헬퍼 ──

function drawDiamondShape(g, cx, cy, hw, hh, color) {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(cx, cy - hh);
  g.lineTo(cx + hw, cy);
  g.lineTo(cx, cy + hh);
  g.lineTo(cx - hw, cy);
  g.closePath();
  g.fillPath();
}

function strokeDiamondShape(g, cx, cy, hw, hh, color, w) {
  g.lineStyle(w, color, 1);
  g.beginPath();
  g.moveTo(cx, cy - hh);
  g.lineTo(cx + hw, cy);
  g.lineTo(cx, cy + hh);
  g.lineTo(cx - hw, cy);
  g.closePath();
  g.strokePath();
}

function drawHexagon(g, cx, cy, r, color) {
  g.fillStyle(color, 1);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

function strokeHexagon(g, cx, cy, r, color, w) {
  g.lineStyle(w, color, 1);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.strokePath();
}

function drawTriangle(g, cx, cy, hw, hh, color) {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(cx, cy - hh);
  g.lineTo(cx + hw, cy + hh);
  g.lineTo(cx - hw, cy + hh);
  g.closePath();
  g.fillPath();
}

// ── ORE 별 텍스처 ──
// 각 광물이 자신만의 모양/패턴을 가지도록 개별 그리기.
// outline 추가로 흙 위에서도 잘 보이게.

function drawCoal(g) {
  const c = 0x1a1a1a;
  const cd = 0x000000;
  const ch = 0x424242;
  g.fillStyle(c, 1);
  g.fillRoundedRect(8, 14, 18, 14, 4);
  g.fillRoundedRect(28, 24, 20, 16, 4);
  g.fillRoundedRect(14, 38, 16, 14, 4);
  g.lineStyle(2, cd, 1);
  g.strokeRoundedRect(8, 14, 18, 14, 4);
  g.strokeRoundedRect(28, 24, 20, 16, 4);
  g.strokeRoundedRect(14, 38, 16, 14, 4);
  // 하이라이트
  g.fillStyle(ch, 1);
  g.fillRect(11, 17, 5, 2);
  g.fillRect(31, 27, 6, 2);
  g.fillRect(17, 41, 5, 2);
}

function drawCopper(g) {
  const c = 0xb87333;
  const cd = 0x6d4c1d;
  const ch = 0xd49354;
  g.fillStyle(c, 1);
  g.fillRoundedRect(8, 14, 20, 8, 3);
  g.fillRoundedRect(28, 26, 24, 9, 3);
  g.fillRoundedRect(12, 40, 22, 10, 3);
  g.lineStyle(2, cd, 1);
  g.strokeRoundedRect(8, 14, 20, 8, 3);
  g.strokeRoundedRect(28, 26, 24, 9, 3);
  g.strokeRoundedRect(12, 40, 22, 10, 3);
  g.fillStyle(ch, 1);
  g.fillRect(11, 16, 8, 2);
  g.fillRect(31, 28, 10, 2);
  g.fillRect(15, 42, 9, 2);
}

function drawIron(g) {
  const c = 0xd0d0d0;
  const cd = 0x707070;
  const cdot = 0x5a4530;
  // 큰 은빛 원들
  g.fillStyle(c, 1);
  g.fillCircle(18, 22, 7);
  g.fillCircle(42, 30, 9);
  g.fillCircle(26, 44, 6);
  g.lineStyle(2, cd, 1);
  g.strokeCircle(18, 22, 7);
  g.strokeCircle(42, 30, 9);
  g.strokeCircle(26, 44, 6);
  // 갈색 점 (불순물)
  g.fillStyle(cdot, 1);
  g.fillRect(20, 21, 2, 2);
  g.fillRect(45, 30, 2, 2);
}

function drawGold(g) {
  const c = 0xffd700;
  const cd = 0xb8860b;
  const ch = 0xfff59d;
  g.fillStyle(c, 1);
  g.fillRect(10, 14, 12, 12);
  g.fillRect(30, 22, 14, 14);
  g.fillRect(40, 14, 10, 10);
  g.fillRect(16, 38, 14, 14);
  g.fillRect(38, 42, 12, 12);
  g.lineStyle(2, cd, 1);
  g.strokeRect(10, 14, 12, 12);
  g.strokeRect(30, 22, 14, 14);
  g.strokeRect(40, 14, 10, 10);
  g.strokeRect(16, 38, 14, 14);
  g.strokeRect(38, 42, 12, 12);
  g.fillStyle(ch, 1);
  g.fillRect(12, 16, 4, 2);
  g.fillRect(32, 24, 4, 2);
  g.fillRect(18, 40, 4, 2);
}

// Crystal 계열 ─ 다이아몬드 모양
function drawCrystal(g) {
  // 큰 마름모 + 작은 마름모 2개
  drawDiamondShape(g, 32, 32, 18, 22, 0xb39ddb);
  strokeDiamondShape(g, 32, 32, 18, 22, 0x4a148c, 2);
  drawDiamondShape(g, 32, 26, 9, 12, 0xe1d5f5);
  drawDiamondShape(g, 14, 16, 5, 6, 0xb39ddb);
  drawDiamondShape(g, 50, 50, 5, 6, 0xb39ddb);
  // 반짝이
  g.fillStyle(0xffffff, 1);
  g.fillRect(26, 22, 3, 3);
}

// Amethyst — 보라 결정 클러스터
function drawAmethyst(g) {
  // 3개 뾰족한 결정
  drawTriangle(g, 24, 28, 8, 14, 0x9c27b0);
  drawTriangle(g, 40, 32, 9, 16, 0x9c27b0);
  drawTriangle(g, 32, 44, 7, 12, 0x9c27b0);
  // 어두운 외곽
  g.lineStyle(2, 0x4a148c, 1);
  g.beginPath(); g.moveTo(24, 14); g.lineTo(32, 42); g.lineTo(16, 42); g.closePath(); g.strokePath();
  g.beginPath(); g.moveTo(40, 16); g.lineTo(49, 48); g.lineTo(31, 48); g.closePath(); g.strokePath();
  g.beginPath(); g.moveTo(32, 32); g.lineTo(39, 56); g.lineTo(25, 56); g.closePath(); g.strokePath();
  // 밝은 코어
  g.fillStyle(0xce93d8, 1);
  g.fillTriangle(24, 18, 26, 28, 22, 28);
  g.fillTriangle(40, 20, 42, 30, 38, 30);
}

function drawSapphire(g) {
  drawDiamondShape(g, 32, 32, 20, 24, 0x2196f3);
  strokeDiamondShape(g, 32, 32, 20, 24, 0x0d47a1, 3);
  drawDiamondShape(g, 32, 28, 10, 12, 0xbbdefb);
  // 반짝이
  g.fillStyle(0xffffff, 1);
  g.fillRect(26, 22, 4, 4);
  g.fillRect(40, 36, 2, 2);
}

function drawEmerald(g) {
  drawHexagon(g, 32, 32, 22, 0x4caf50);
  strokeHexagon(g, 32, 32, 22, 0x1b5e20, 3);
  drawHexagon(g, 32, 32, 13, 0xc8e6c9);
  g.fillStyle(0xffffff, 1);
  g.fillRect(26, 24, 4, 4);
}

function drawDiamond(g) {
  // 크고 빛나는 마름모
  drawDiamondShape(g, 32, 32, 22, 26, 0xb9f6ca);
  strokeDiamondShape(g, 32, 32, 22, 26, 0x004d40, 3);
  // 내부 입체 라인
  g.lineStyle(2, 0x80cbc4, 1);
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(20, 18);
  g.moveTo(32, 6); g.lineTo(44, 18);
  g.moveTo(20, 18); g.lineTo(44, 18);
  g.strokePath();
  // 반짝이 별 모양
  g.fillStyle(0xffffff, 1);
  g.fillRect(28, 14, 4, 4);
  g.fillRect(26, 16, 8, 1);
  g.fillRect(30, 12, 1, 8);
}

function drawRuby(g) {
  drawDiamondShape(g, 32, 32, 20, 24, 0xe53935);
  strokeDiamondShape(g, 32, 32, 20, 24, 0x7f0000, 3);
  drawDiamondShape(g, 32, 28, 10, 12, 0xff8a80);
  g.fillStyle(0xffffff, 1);
  g.fillRect(26, 22, 4, 4);
}

function drawLavaCrystal(g) {
  // 불꽃처럼 3개 뾰족한 결정
  drawTriangle(g, 24, 28, 7, 18, 0xff5722);
  drawTriangle(g, 40, 26, 8, 20, 0xff5722);
  drawTriangle(g, 32, 44, 9, 14, 0xff5722);
  g.lineStyle(2, 0x7b1a00, 1);
  g.beginPath(); g.moveTo(24, 10); g.lineTo(31, 46); g.lineTo(17, 46); g.closePath(); g.strokePath();
  g.beginPath(); g.moveTo(40, 6); g.lineTo(48, 46); g.lineTo(32, 46); g.closePath(); g.strokePath();
  g.beginPath(); g.moveTo(32, 30); g.lineTo(41, 58); g.lineTo(23, 58); g.closePath(); g.strokePath();
  g.fillStyle(0xffeb3b, 1);
  g.fillTriangle(24, 16, 26, 26, 22, 26);
  g.fillTriangle(40, 12, 43, 24, 37, 24);
}

function drawVoidStone(g) {
  // 검은 마름모 + 보라 코어 + 작은 별들
  drawDiamondShape(g, 32, 32, 22, 26, 0x1a1a2e);
  strokeDiamondShape(g, 32, 32, 22, 26, 0x000000, 3);
  drawDiamondShape(g, 32, 30, 11, 14, 0x673ab7);
  // 별
  g.fillStyle(0xffffff, 1);
  g.fillRect(30, 28, 2, 6); g.fillRect(28, 30, 6, 2);
  g.fillRect(40, 38, 1, 3); g.fillRect(39, 39, 3, 1);
  g.fillRect(22, 42, 1, 3); g.fillRect(21, 43, 3, 1);
}

const ORE_DRAWERS = {
  coal: drawCoal,
  copper: drawCopper,
  iron: drawIron,
  gold: drawGold,
  crystal: drawCrystal,
  amethyst: drawAmethyst,
  sapphire: drawSapphire,
  emerald: drawEmerald,
  diamond: drawDiamond,
  ruby: drawRuby,
  lavaCrystal: drawLavaCrystal,
  voidStone: drawVoidStone,
};

export function ensureGemTexture(scene, oreId) {
  const key = `gem-${oreId}`;
  const drawer = ORE_DRAWERS[oreId];
  if (!drawer) return null;
  return ensureTexture(scene, key, (g) => drawer(g));
}
