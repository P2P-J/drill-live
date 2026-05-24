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

// ── 광물 공통: 작은 바위 베이스 (땅에서 솟아난 느낌) ──
function drawRockyBase(g, dirtColor = 0x5a3a20) {
  // 3개의 둥근 바위 조각이 하단에 흩어진 모양
  const main = dirtColor;
  const dark = darken(main, 0.55);
  const light = lighten(main, 1.3);

  g.fillStyle(main, 1);
  g.fillEllipse(18, 54, 16, 10);
  g.fillEllipse(36, 56, 22, 10);
  g.fillEllipse(50, 53, 14, 9);

  // 어두운 경계
  g.lineStyle(1.5, dark, 0.8);
  g.strokeEllipse(18, 54, 16, 10);
  g.strokeEllipse(36, 56, 22, 10);
  g.strokeEllipse(50, 53, 14, 9);

  // 윗부분 하이라이트
  g.fillStyle(light, 0.85);
  g.fillRect(13, 50, 5, 2);
  g.fillRect(30, 52, 6, 2);
  g.fillRect(46, 49, 4, 2);
}

// 반짝이 (광물 주변 작은 점들)
function drawSparkles(g, color = 0xffffff) {
  g.fillStyle(color, 0.95);
  g.fillRect(8, 16, 3, 3);
  g.fillRect(54, 22, 2, 2);
  g.fillRect(48, 10, 2, 2);
  g.fillRect(12, 38, 2, 2);
  g.fillRect(56, 38, 3, 3);
}

// 단일 결정 (중심, 폭, 높이, 색)
function drawShard(g, cx, baseY, hw, h, mainColor, edge = true) {
  const dark = darken(mainColor, 0.45);
  const light = lighten(mainColor, 1.6);

  // 메인 결정 (위로 뾰족한 삼각형 + 직사각 베이스)
  g.fillStyle(mainColor, 1);
  g.beginPath();
  g.moveTo(cx, baseY - h);            // 정점
  g.lineTo(cx + hw, baseY - h * 0.4); // 우측 어깨
  g.lineTo(cx + hw * 0.85, baseY);    // 우측 베이스
  g.lineTo(cx - hw * 0.85, baseY);    // 좌측 베이스
  g.lineTo(cx - hw, baseY - h * 0.4); // 좌측 어깨
  g.closePath();
  g.fillPath();

  // 외곽선
  if (edge) {
    g.lineStyle(1.5, dark, 1);
    g.strokePath();
  }

  // 왼쪽 하이라이트 (반짝)
  g.fillStyle(light, 0.85);
  g.beginPath();
  g.moveTo(cx - hw * 0.5, baseY - h * 0.85);
  g.lineTo(cx - hw * 0.2, baseY - h * 0.85);
  g.lineTo(cx - hw * 0.45, baseY - h * 0.2);
  g.lineTo(cx - hw * 0.7, baseY - h * 0.2);
  g.closePath();
  g.fillPath();
}

// 청크 (불규칙 둥근 조각, 석탄/구리/철/금 같은 비결정 광물용)
function drawChunk(g, cx, cy, w, h, mainColor, edge = true) {
  const dark = darken(mainColor, 0.45);
  const light = lighten(mainColor, 1.4);
  g.fillStyle(mainColor, 1);
  g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
  if (edge) {
    g.lineStyle(1.5, dark, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
  }
  // 하이라이트
  g.fillStyle(light, 0.85);
  g.fillRect(cx - w / 2 + 3, cy - h / 2 + 2, Math.max(3, w * 0.35), 2);
}

// ── 광물별 그리기 ──

function drawCoal(g) {
  drawRockyBase(g, 0x5a3a20);
  // 청흑색 석탄 덩어리 — 둥근 조각 3개를 살짝 겹치게
  drawChunk(g, 22, 30, 16, 16, 0x2c3340);
  drawChunk(g, 38, 26, 18, 18, 0x232a36);
  drawChunk(g, 32, 18, 14, 14, 0x3a4150);
  // 푸른 반짝 (석탄 광물의 특징)
  g.fillStyle(0x6a8aa0, 0.9);
  g.fillRect(26, 24, 2, 2);
  g.fillRect(40, 22, 2, 2);
  drawSparkles(g, 0x90a8c0);
}

function drawCopper(g) {
  drawRockyBase(g, 0x5a3a20);
  // 주황빛 구리 — 둥글둥글한 조각들
  drawChunk(g, 22, 32, 14, 14, 0xa55a28);
  drawChunk(g, 36, 28, 16, 16, 0xc26830);
  drawChunk(g, 30, 18, 12, 12, 0xd47840);
  drawChunk(g, 46, 36, 12, 10, 0x9c5024);
  // 밝은 점
  g.fillStyle(0xff9a4a, 1);
  g.fillRect(24, 28, 3, 2);
  g.fillRect(36, 24, 3, 2);
  drawSparkles(g, 0xffb060);
}

function drawIron(g) {
  drawRockyBase(g, 0x5a3a20);
  // 은빛 철 — 각진 조각 (각진 느낌으로 폴리곤)
  g.fillStyle(0xc5c5c5, 1);
  g.beginPath(); g.moveTo(14, 38); g.lineTo(24, 18); g.lineTo(34, 26); g.lineTo(30, 42); g.closePath(); g.fillPath();
  g.lineStyle(1.5, 0x7a7a7a, 1); g.strokePath();

  g.fillStyle(0xa8a8a8, 1);
  g.beginPath(); g.moveTo(32, 40); g.lineTo(40, 18); g.lineTo(54, 24); g.lineTo(50, 44); g.closePath(); g.fillPath();
  g.lineStyle(1.5, 0x6a6a6a, 1); g.strokePath();

  // 하이라이트
  g.fillStyle(0xf0f0f0, 0.85);
  g.fillRect(18, 22, 4, 2);
  g.fillRect(38, 22, 4, 2);
  // 갈색 점 (불순물)
  g.fillStyle(0x7a4a20, 1);
  g.fillRect(24, 34, 2, 2);
  g.fillRect(46, 32, 2, 2);
  drawSparkles(g, 0xeeeeee);
}

function drawGold(g) {
  drawRockyBase(g, 0x5a3a20);
  // 금 너겟 — 작은 노란 덩어리들이 모여있는 모양
  drawChunk(g, 20, 34, 10, 10, 0xf2c124);
  drawChunk(g, 30, 28, 12, 12, 0xffd84a);
  drawChunk(g, 42, 32, 11, 11, 0xf2c124);
  drawChunk(g, 36, 20, 10, 10, 0xffe070);
  drawChunk(g, 50, 38, 9, 9, 0xd9a818);
  // 빛나는 점
  g.fillStyle(0xfff5a0, 1);
  g.fillRect(24, 32, 3, 2);
  g.fillRect(32, 26, 3, 2);
  g.fillRect(40, 22, 3, 2);
  drawSparkles(g, 0xffeb3b);
}

function drawCrystalCluster(g, mainColor, rockBase = 0x4a4a4a) {
  drawRockyBase(g, rockBase);
  // 가운데 큰 결정 + 좌우 작은 결정 2개
  drawShard(g, 32, 46, 8, 36, mainColor);
  drawShard(g, 18, 48, 5, 22, mainColor);
  drawShard(g, 48, 47, 6, 26, mainColor);
  drawSparkles(g, lighten(mainColor, 1.6));
}

function drawCrystal(g)  { drawCrystalCluster(g, 0xb39ddb, 0x4a4a4a); }
function drawAmethyst(g) { drawCrystalCluster(g, 0x9c27b0, 0x3a2a4a); }
function drawSapphire(g) { drawCrystalCluster(g, 0x2196f3, 0x2a3a4a); }
function drawEmerald(g)  { drawCrystalCluster(g, 0x4caf50, 0x2a4a2a); }
function drawDiamond(g) {
  // 다이아: 더 큰 단일 결정 + 강한 광채
  drawRockyBase(g, 0x4a4a4a);
  drawShard(g, 32, 48, 10, 40, 0xb9f6ca);
  drawShard(g, 18, 50, 4, 18, 0x80deea);
  drawShard(g, 48, 49, 5, 22, 0x80deea);
  // 가운데 별 모양 반짝 (다이아만의 특징)
  g.fillStyle(0xffffff, 1);
  g.fillRect(30, 22, 4, 4);
  g.fillRect(28, 24, 8, 1);
  g.fillRect(32, 18, 1, 12);
  drawSparkles(g, 0xffffff);
}

function drawRuby(g) {
  // 루비: 진한 빨강 결정
  drawRockyBase(g, 0x4a2020);
  drawShard(g, 32, 47, 9, 38, 0xe53935);
  drawShard(g, 18, 49, 5, 22, 0xc62828);
  drawShard(g, 49, 48, 6, 26, 0xff5252);
  drawSparkles(g, 0xff8a80);
}

function drawLavaCrystal(g) {
  // 용암 결정: 주황색 결정 + 그 위에 노란 광채
  drawRockyBase(g, 0x4a2010);
  drawShard(g, 32, 47, 9, 38, 0xff5722);
  drawShard(g, 18, 49, 5, 22, 0xd84315);
  drawShard(g, 49, 48, 6, 26, 0xffa726);
  // 노란 핵심
  g.fillStyle(0xffeb3b, 0.9);
  g.fillTriangle(32, 18, 28, 32, 36, 32);
  drawSparkles(g, 0xffeb3b);
}

function drawVoidStone(g) {
  // 공허석: 어두운 결정 + 보라 코어 + 별 반짝
  drawRockyBase(g, 0x1a1a2e);
  drawShard(g, 32, 47, 9, 38, 0x2a2050);
  drawShard(g, 18, 49, 5, 22, 0x1a1538);
  drawShard(g, 49, 48, 6, 26, 0x3a2a70);
  // 보라 코어
  g.fillStyle(0x7e57c2, 0.9);
  g.fillTriangle(32, 22, 28, 36, 36, 36);
  // 별 모양
  g.fillStyle(0xffffff, 1);
  g.fillRect(31, 25, 3, 3);
  g.fillRect(30, 26, 5, 1);
  g.fillRect(32, 23, 1, 7);
  // 추가 별
  g.fillRect(10, 28, 2, 2);
  g.fillRect(54, 32, 2, 2);
  drawSparkles(g, 0xb39ddb);
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
