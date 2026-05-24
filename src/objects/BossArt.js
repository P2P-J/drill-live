// 5종 보스 procedural 텍스처 (재디자인). 각 보스는 강한 실루엣 + 디테일 + 발광 코어.

function ensureTexture(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  drawFn(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

// ──────────────────────────────────────────────────────────────
// 1. Mega Mole — 압박감 있는 큰 두더지 (Earth 9000m)
// ──────────────────────────────────────────────────────────────
function drawMegaMole(g, w, h) {
  const cx = w / 2;

  // 발 (양쪽 큰 뭉텅이)
  g.fillStyle(0x2A1E14, 1);
  g.fillEllipse(cx - w * 0.28, h * 0.92, w * 0.22, h * 0.14);
  g.fillEllipse(cx + w * 0.28, h * 0.92, w * 0.22, h * 0.14);

  // 메인 몸통 (큰 갈색 타원, 그림자 + 본체 + 상단 하이라이트)
  g.fillStyle(0x3D2519, 1);
  g.fillEllipse(cx, h * 0.6, w * 0.92, h * 0.7);  // 그림자
  g.fillStyle(0x6B3A2A, 1);
  g.fillEllipse(cx, h * 0.58, w * 0.88, h * 0.66);  // 본체
  g.fillStyle(0x8B4513, 0.65);
  g.fillEllipse(cx - w * 0.08, h * 0.46, w * 0.45, h * 0.28);  // 상단 빛

  g.lineStyle(5, 0x1A0E08, 1);
  g.strokeEllipse(cx, h * 0.58, w * 0.88, h * 0.66);

  // 털 디테일 (작은 어두운 점/털 뭉텅이)
  g.fillStyle(0x2A1E14, 0.6);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rx = Math.cos(a) * w * 0.35;
    const ry = Math.sin(a) * h * 0.25 + h * 0.05;
    g.fillEllipse(cx + rx, h * 0.6 + ry, 8 + (i % 3) * 2, 4 + (i % 2) * 2);
  }

  // 양쪽 큰 발톱 (3개 송곳니 모양)
  for (const side of [-1, 1]) {
    const baseX = cx + side * w * 0.42;
    const baseY = h * 0.62;
    g.fillStyle(0x1A0E08, 1);
    g.fillEllipse(baseX, baseY, w * 0.1, h * 0.18);  // 발 베이스
    g.lineStyle(4, 0x000000, 1);
    g.strokeEllipse(baseX, baseY, w * 0.1, h * 0.18);

    // 3개 발톱
    for (let k = 0; k < 3; k++) {
      const tx = baseX + side * (k - 1) * w * 0.025;
      g.fillStyle(0xECEFF1, 1);
      g.beginPath();
      g.moveTo(tx - w * 0.012, baseY + h * 0.08);
      g.lineTo(tx + w * 0.012, baseY + h * 0.08);
      g.lineTo(tx, baseY + h * 0.2);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0x000000, 1);
      g.strokePath();
    }
  }

  // 얼굴 (밝은 영역으로 강조)
  g.fillStyle(0x9C6638, 1);
  g.fillEllipse(cx, h * 0.5, w * 0.55, h * 0.35);
  g.lineStyle(4, 0x1A0E08, 0.7);
  g.strokeEllipse(cx, h * 0.5, w * 0.55, h * 0.35);

  // 분노한 눈 (빨간 발광 + 검은 동공)
  for (const side of [-1, 1]) {
    const ex = cx + side * w * 0.13;
    const ey = h * 0.45;
    // 빨간 발광 글로우
    g.fillStyle(0xFF1744, 0.3);
    g.fillCircle(ex, ey, w * 0.05);
    g.fillStyle(0xFF5252, 1);
    g.fillCircle(ex, ey, w * 0.035);
    g.lineStyle(3, 0x880000, 1);
    g.strokeCircle(ex, ey, w * 0.035);
    g.fillStyle(0x000000, 1);
    g.fillCircle(ex, ey, w * 0.015);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex - 3, ey - 3, 3);
  }

  // 화난 눈썹 (안쪽 위로 향한 사선)
  g.lineStyle(8, 0x1A0E08, 1);
  g.beginPath(); g.moveTo(cx - w * 0.2, h * 0.38); g.lineTo(cx - w * 0.08, h * 0.43); g.strokePath();
  g.beginPath(); g.moveTo(cx + w * 0.2, h * 0.38); g.lineTo(cx + w * 0.08, h * 0.43); g.strokePath();

  // 핑크 코 (더 크고 뚜렷)
  g.fillStyle(0xE91E63, 1);
  g.fillEllipse(cx, h * 0.55, w * 0.07, h * 0.05);
  g.lineStyle(3, 0x880E4F, 1);
  g.strokeEllipse(cx, h * 0.55, w * 0.07, h * 0.05);
  // 콧구멍
  g.fillStyle(0x4A0000, 1);
  g.fillCircle(cx - 5, h * 0.555, 2);
  g.fillCircle(cx + 5, h * 0.555, 2);

  // 사나운 입 (열려있고 이빨 보임)
  g.fillStyle(0x000000, 1);
  g.fillEllipse(cx, h * 0.66, w * 0.14, h * 0.05);
  // 이빨 (4개 흰 송곳)
  g.fillStyle(0xffffff, 1);
  for (let i = -1.5; i <= 1.5; i++) {
    const tx = cx + i * w * 0.03;
    g.fillTriangle(tx - 3, h * 0.645, tx + 3, h * 0.645, tx, h * 0.68);
    g.lineStyle(1, 0x424242, 1);
    g.strokeTriangle(tx - 3, h * 0.645, tx + 3, h * 0.645, tx, h * 0.68);
  }

  // 둥근 귀 (양쪽)
  for (const side of [-1, 1]) {
    g.fillStyle(0x6B3A2A, 1);
    g.fillCircle(cx + side * w * 0.32, h * 0.28, w * 0.075);
    g.lineStyle(4, 0x1A0E08, 1);
    g.strokeCircle(cx + side * w * 0.32, h * 0.28, w * 0.075);
    g.fillStyle(0xFFAB91, 1);
    g.fillCircle(cx + side * w * 0.32, h * 0.28, w * 0.04);
  }
}

// ──────────────────────────────────────────────────────────────
// 2. Crystal Golem — 거대 결정 골렘 (Crystal Cave 45000m)
// ──────────────────────────────────────────────────────────────
function drawCrystalGolem(g, w, h) {
  const cx = w / 2;
  const dark = 0x3D1A5C;
  const mid = 0x7B4FA6;
  const light = 0xB39DDB;
  const glow = 0xE1BEE7;
  const cyan = 0x00E5FF;

  // 다리 (사각 + 결정 발)
  for (const side of [-1, 1]) {
    g.fillStyle(dark, 1);
    g.fillRect(cx + side * w * 0.16 - w * 0.08, h * 0.72, w * 0.16, h * 0.2);
    g.lineStyle(4, 0x1A0A2E, 1);
    g.strokeRect(cx + side * w * 0.16 - w * 0.08, h * 0.72, w * 0.16, h * 0.2);
    // 발 (큰 결정 베이스)
    g.fillStyle(mid, 1);
    g.fillTriangle(
      cx + side * w * 0.16 - w * 0.12, h * 0.99,
      cx + side * w * 0.16 + w * 0.12, h * 0.99,
      cx + side * w * 0.16, h * 0.88
    );
    g.lineStyle(3, 0x1A0A2E, 1);
    g.strokeTriangle(
      cx + side * w * 0.16 - w * 0.12, h * 0.99,
      cx + side * w * 0.16 + w * 0.12, h * 0.99,
      cx + side * w * 0.16, h * 0.88
    );
  }

  // 몸통 (사다리꼴 결정)
  g.fillStyle(mid, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.32, h * 0.42);
  g.lineTo(cx + w * 0.32, h * 0.42);
  g.lineTo(cx + w * 0.4, h * 0.75);
  g.lineTo(cx - w * 0.4, h * 0.75);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, 0x1A0A2E, 1);
  g.strokePath();

  // 몸통 결정 면 (디테일 라인)
  g.lineStyle(2, light, 0.7);
  g.beginPath(); g.moveTo(cx - w * 0.15, h * 0.42); g.lineTo(cx - w * 0.2, h * 0.75); g.strokePath();
  g.beginPath(); g.moveTo(cx + w * 0.15, h * 0.42); g.lineTo(cx + w * 0.2, h * 0.75); g.strokePath();

  // 가슴 코어 (다층 발광 마름모)
  const coreCy = h * 0.55;
  // 외곽 빛
  g.fillStyle(cyan, 0.3);
  g.fillCircle(cx, coreCy, w * 0.16);
  // 큰 마름모
  g.fillStyle(cyan, 1);
  g.beginPath();
  g.moveTo(cx, coreCy - w * 0.13);
  g.lineTo(cx + w * 0.1, coreCy);
  g.lineTo(cx, coreCy + w * 0.13);
  g.lineTo(cx - w * 0.1, coreCy);
  g.closePath();
  g.fillPath();
  // 내부 마름모 (밝게)
  g.fillStyle(0xffffff, 0.95);
  g.beginPath();
  g.moveTo(cx, coreCy - w * 0.07);
  g.lineTo(cx + w * 0.05, coreCy);
  g.lineTo(cx, coreCy + w * 0.07);
  g.lineTo(cx - w * 0.05, coreCy);
  g.closePath();
  g.fillPath();
  g.lineStyle(3, 0x004D5C, 1);
  g.beginPath();
  g.moveTo(cx, coreCy - w * 0.13);
  g.lineTo(cx + w * 0.1, coreCy);
  g.lineTo(cx, coreCy + w * 0.13);
  g.lineTo(cx - w * 0.1, coreCy);
  g.closePath();
  g.strokePath();

  // 어깨 스파이크 (위로 향한 결정 3개씩)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const sx = cx + side * (w * 0.22 + i * w * 0.05);
      const sBaseY = h * 0.42;
      const sTopY = sBaseY - h * 0.06 - i * h * 0.02;
      g.fillStyle(light, 1);
      g.fillTriangle(sx - w * 0.025, sBaseY, sx + w * 0.025, sBaseY, sx, sTopY);
      g.lineStyle(2, 0x1A0A2E, 1);
      g.strokeTriangle(sx - w * 0.025, sBaseY, sx + w * 0.025, sBaseY, sx, sTopY);
    }
  }

  // 팔 (큰 사각 + 큰 주먹)
  for (const side of [-1, 1]) {
    g.fillStyle(mid, 1);
    g.fillRect(side > 0 ? w * 0.78 : w * 0.02, h * 0.46, w * 0.2, h * 0.26);
    g.lineStyle(5, 0x1A0A2E, 1);
    g.strokeRect(side > 0 ? w * 0.78 : w * 0.02, h * 0.46, w * 0.2, h * 0.26);
    // 주먹 (큰 결정 박스)
    const fx = side > 0 ? w * 0.88 : w * 0.12;
    g.fillStyle(light, 1);
    g.fillRect(fx - w * 0.12, h * 0.7, w * 0.24, h * 0.14);
    g.lineStyle(4, 0x1A0A2E, 1);
    g.strokeRect(fx - w * 0.12, h * 0.7, w * 0.24, h * 0.14);
    // 주먹 너클 (3개)
    g.fillStyle(glow, 1);
    for (let i = 0; i < 3; i++) {
      g.fillRect(fx - w * 0.09 + i * w * 0.06, h * 0.7 - 6, w * 0.04, 8);
    }
  }

  // 머리 (큰 사각 + 윗쪽 결정 왕관)
  g.fillStyle(light, 1);
  g.fillRect(cx - w * 0.2, h * 0.13, w * 0.4, h * 0.27);
  g.lineStyle(5, 0x1A0A2E, 1);
  g.strokeRect(cx - w * 0.2, h * 0.13, w * 0.4, h * 0.27);

  // 머리 위 왕관 (큰 결정 5개)
  for (let i = -2; i <= 2; i++) {
    const sx = cx + i * w * 0.075;
    const sTopY = h * 0.02 + Math.abs(i) * h * 0.025;
    g.fillStyle(i === 0 ? glow : light, 1);
    g.fillTriangle(sx - w * 0.035, h * 0.13, sx + w * 0.035, h * 0.13, sx, sTopY);
    g.lineStyle(3, 0x1A0A2E, 1);
    g.strokeTriangle(sx - w * 0.035, h * 0.13, sx + w * 0.035, h * 0.13, sx, sTopY);
  }

  // 얼굴 visor (긴 가로 슬릿, 발광)
  g.fillStyle(0x000000, 1);
  g.fillRect(cx - w * 0.16, h * 0.21, w * 0.32, h * 0.06);
  // 빛나는 눈 슬릿
  g.fillStyle(cyan, 1);
  g.fillRect(cx - w * 0.13, h * 0.23, w * 0.08, h * 0.025);
  g.fillRect(cx + w * 0.05, h * 0.23, w * 0.08, h * 0.025);
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(cx - w * 0.11, h * 0.232, w * 0.025, h * 0.013);
  g.fillRect(cx + w * 0.07, h * 0.232, w * 0.025, h * 0.013);

  // 입 (사각 그릴)
  g.lineStyle(3, 0x1A0A2E, 1);
  for (let i = 0; i < 5; i++) {
    const lx = cx - w * 0.1 + i * w * 0.05;
    g.beginPath(); g.moveTo(lx, h * 0.32); g.lineTo(lx, h * 0.37); g.strokePath();
  }

  // 균열 (몸통에 빛나는 cyan 선)
  g.lineStyle(3, cyan, 0.7);
  g.beginPath();
  g.moveTo(cx - w * 0.25, h * 0.5);
  g.lineTo(cx - w * 0.15, h * 0.55);
  g.lineTo(cx - w * 0.2, h * 0.6);
  g.strokePath();
}

// ──────────────────────────────────────────────────────────────
// 3. Abyss Kraken — 심해 괴물 (Abyssal 90000m)
// ──────────────────────────────────────────────────────────────
function drawAbyssKraken(g, w, h) {
  const cx = w / 2;
  const headCy = h * 0.38;
  const dark = 0x051A2E;
  const mid = 0x0F4A5C;
  const light = 0x1A8A9A;
  const tealGlow = 0x4DD0E1;

  // 10개 촉수 (베이스 + 두꺼운 → 가는 → 끝)
  const tCount = 10;
  for (let i = 0; i < tCount; i++) {
    const angle = Math.PI + (Math.PI * (i + 0.5) / tCount);  // 아래 반원
    const startX = cx + Math.cos(angle) * w * 0.32;
    const startY = headCy + Math.abs(Math.sin(angle)) * h * 0.05 + h * 0.15;

    // 굵은 베이스
    const segments = 5;
    let prevX = startX, prevY = startY;
    const lenX = (cx + Math.cos(angle) * w * 0.48) - startX;
    const lenY = h * 0.95 - startY;
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const wave = Math.sin(t * Math.PI * 2 + i) * w * 0.04;
      const tx = startX + lenX * t + wave;
      const ty = startY + lenY * t;
      const thickness = w * 0.04 * (1 - t * 0.7);
      g.lineStyle(thickness * 2, mid, 1);
      g.beginPath(); g.moveTo(prevX, prevY); g.lineTo(tx, ty); g.strokePath();
      g.lineStyle(thickness * 2 - 2, light, 0.4);
      g.beginPath(); g.moveTo(prevX, prevY); g.lineTo(tx, ty); g.strokePath();
      // 빨판 (작은 원)
      if (s < segments) {
        g.fillStyle(tealGlow, 0.9);
        g.fillCircle(tx, ty, 3 - s * 0.3);
      }
      prevX = tx; prevY = ty;
    }
    // 끝 후크
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(prevX - 3, prevY, prevX + 3, prevY, prevX, prevY + 8);
  }

  // 머리 (큰 둥근 타원 — 그림자 + 본체 + 빛)
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + 4, headCy + 4, w * 0.66, h * 0.5);
  g.fillStyle(mid, 1);
  g.fillEllipse(cx, headCy, w * 0.62, h * 0.46);
  g.lineStyle(5, 0x000814, 1);
  g.strokeEllipse(cx, headCy, w * 0.62, h * 0.46);

  // 머리 위 작은 뿔 / 지느러미 (3개)
  for (let i = -1; i <= 1; i++) {
    const sx = cx + i * w * 0.15;
    g.fillStyle(dark, 1);
    g.fillTriangle(sx - w * 0.04, headCy - h * 0.22, sx + w * 0.04, headCy - h * 0.22, sx, headCy - h * 0.32);
    g.lineStyle(3, 0x000814, 1);
    g.strokeTriangle(sx - w * 0.04, headCy - h * 0.22, sx + w * 0.04, headCy - h * 0.22, sx, headCy - h * 0.32);
  }

  // 발광 점 (생체광)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const px = cx + Math.cos(a) * w * 0.25;
    const py = headCy + Math.sin(a) * h * 0.18;
    g.fillStyle(tealGlow, 0.3);
    g.fillCircle(px, py, 8);
    g.fillStyle(0xE0F7FA, 1);
    g.fillCircle(px, py, 3);
  }

  // 메인 외눈 (큰 노란 + 슬릿 동공)
  g.fillStyle(0xFFEB3B, 1);
  g.fillCircle(cx, headCy, w * 0.16);
  g.lineStyle(5, 0x000814, 1);
  g.strokeCircle(cx, headCy, w * 0.16);
  // 슬릿 동공
  g.fillStyle(0x000000, 1);
  g.fillEllipse(cx, headCy, w * 0.05, h * 0.18);
  // 광원
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - w * 0.08, headCy - h * 0.05, w * 0.03);
  g.fillCircle(cx + w * 0.05, headCy + h * 0.08, w * 0.012);

  // 작은 부속 눈 2개 (위쪽 좌우)
  for (const side of [-1, 1]) {
    const ex = cx + side * w * 0.22;
    const ey = headCy - h * 0.1;
    g.fillStyle(0xFF6F00, 1);
    g.fillCircle(ex, ey, w * 0.04);
    g.lineStyle(3, 0x000814, 1);
    g.strokeCircle(ex, ey, w * 0.04);
    g.fillStyle(0x000000, 1);
    g.fillCircle(ex, ey, w * 0.018);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(ex - 2, ey - 2, 2);
  }

  // 부리 (검은 단단한 V자 부리)
  g.fillStyle(0x000000, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.06, headCy + h * 0.13);
  g.lineTo(cx + w * 0.06, headCy + h * 0.13);
  g.lineTo(cx + w * 0.02, headCy + h * 0.22);
  g.lineTo(cx, headCy + h * 0.18);
  g.lineTo(cx - w * 0.02, headCy + h * 0.22);
  g.closePath();
  g.fillPath();
  g.lineStyle(2, 0xffffff, 1);
  g.strokePath();
}

// ──────────────────────────────────────────────────────────────
// 4. Ancient Treant — 고대 나무 정령 (Forest 450000m)
// ──────────────────────────────────────────────────────────────
function drawAncientTreant(g, w, h) {
  const cx = w / 2;
  const barkDeep = 0x2D1810;
  const barkDark = 0x3E2723;
  const barkMain = 0x5D4037;
  const barkLight = 0x8D6E63;
  const leafDark = 0x1B5E20;
  const leafMid = 0x388E3C;
  const leafLight = 0x66BB6A;
  const runeGlow = 0xCCFF90;
  const eyeGlow = 0xCDDC39;

  // 뿌리 (3개 사방으로)
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    g.fillStyle(barkDark, 1);
    const rx = cx + i * w * 0.16;
    g.beginPath();
    g.moveTo(rx - w * 0.05, h * 0.85);
    g.lineTo(rx + w * 0.05, h * 0.85);
    g.lineTo(rx + (i > 0 ? w * 0.08 : -w * 0.08), h * 0.99);
    g.lineTo(rx - (i > 0 ? w * 0.04 : -w * 0.04), h * 0.99);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0x1A0E08, 1);
    g.strokePath();
  }

  // 메인 줄기 (그림자 + 본체 + 입체)
  g.fillStyle(barkDeep, 1);
  g.fillRoundedRect(cx - w * 0.3, h * 0.35, w * 0.6, h * 0.55, 18);
  g.fillStyle(barkMain, 1);
  g.fillRoundedRect(cx - w * 0.28, h * 0.36, w * 0.56, h * 0.52, 16);
  g.lineStyle(5, 0x1A0E08, 1);
  g.strokeRoundedRect(cx - w * 0.28, h * 0.36, w * 0.56, h * 0.52, 16);

  // 줄기 결 (세로 어두운 라인)
  g.lineStyle(3, barkDark, 0.7);
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(cx + i * w * 0.08, h * 0.4);
    g.lineTo(cx + i * w * 0.08 + (i % 2 ? w * 0.01 : -w * 0.01), h * 0.85);
    g.strokePath();
  }

  // 옹이 구멍 (어두운 둥근 자국)
  g.fillStyle(barkDeep, 1);
  g.fillCircle(cx - w * 0.18, h * 0.72, w * 0.04);
  g.fillCircle(cx + w * 0.2, h * 0.78, w * 0.035);
  g.lineStyle(2, 0x1A0E08, 1);
  g.strokeCircle(cx - w * 0.18, h * 0.72, w * 0.04);
  g.strokeCircle(cx + w * 0.2, h * 0.78, w * 0.035);

  // 가지 팔 (양쪽 2단계 가지)
  for (const side of [-1, 1]) {
    g.lineStyle(w * 0.045, barkDark, 1);
    // 주 가지
    g.beginPath();
    g.moveTo(cx + side * w * 0.28, h * 0.5);
    g.lineTo(cx + side * w * 0.42, h * 0.45);
    g.strokePath();
    // 손 (잎 클러스터)
    const handX = cx + side * w * 0.46;
    const handY = h * 0.42;
    g.fillStyle(leafDark, 1);
    g.fillCircle(handX, handY, w * 0.07);
    g.fillStyle(leafMid, 1);
    g.fillCircle(handX, handY - w * 0.02, w * 0.05);
    g.fillStyle(leafLight, 0.8);
    g.fillCircle(handX - w * 0.02, handY - w * 0.03, w * 0.025);
    // 작은 가지
    g.lineStyle(w * 0.025, barkDark, 1);
    g.beginPath();
    g.moveTo(cx + side * w * 0.28, h * 0.55);
    g.lineTo(cx + side * w * 0.35, h * 0.58);
    g.strokePath();
  }

  // 잎사귀 머리 (다층 클라우드)
  g.fillStyle(leafDark, 1);
  g.fillCircle(cx, h * 0.22, w * 0.36);
  g.fillCircle(cx - w * 0.28, h * 0.28, w * 0.22);
  g.fillCircle(cx + w * 0.28, h * 0.28, w * 0.22);
  g.fillCircle(cx - w * 0.18, h * 0.1, w * 0.2);
  g.fillCircle(cx + w * 0.18, h * 0.1, w * 0.2);
  // 중간층
  g.fillStyle(leafMid, 1);
  g.fillCircle(cx, h * 0.22, w * 0.28);
  g.fillCircle(cx - w * 0.22, h * 0.26, w * 0.14);
  g.fillCircle(cx + w * 0.22, h * 0.26, w * 0.14);
  // 밝은 하이라이트
  g.fillStyle(leafLight, 0.75);
  g.fillCircle(cx - w * 0.1, h * 0.16, w * 0.1);
  g.fillCircle(cx + w * 0.16, h * 0.2, w * 0.08);

  // 새 머리 라인 (잎 안에 가지)
  g.lineStyle(3, barkDark, 0.6);
  g.beginPath();
  g.moveTo(cx - w * 0.05, h * 0.36); g.lineTo(cx - w * 0.1, h * 0.25);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + w * 0.05, h * 0.36); g.lineTo(cx + w * 0.12, h * 0.25);
  g.strokePath();

  // 빛나는 눈 (깊은 어두운 구멍 + 발광 코어)
  for (const side of [-1, 1]) {
    const ex = cx + side * w * 0.1;
    const ey = h * 0.5;
    // 어두운 구멍
    g.fillStyle(0x000000, 1);
    g.fillEllipse(ex, ey, w * 0.07, h * 0.05);
    // 발광 코어
    g.fillStyle(eyeGlow, 0.4);
    g.fillCircle(ex, ey, w * 0.05);
    g.fillStyle(eyeGlow, 1);
    g.fillCircle(ex, ey, w * 0.025);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(ex - 3, ey - 3, 3);
  }

  // 입 (지그재그 갈라진 자국)
  g.lineStyle(5, 0x000000, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.12, h * 0.66);
  g.lineTo(cx - w * 0.06, h * 0.64);
  g.lineTo(cx - w * 0.02, h * 0.68);
  g.lineTo(cx + w * 0.02, h * 0.64);
  g.lineTo(cx + w * 0.06, h * 0.68);
  g.lineTo(cx + w * 0.12, h * 0.66);
  g.strokePath();

  // 룬 문자 (발광 녹색 표시 — 몸통 디테일)
  g.lineStyle(3, runeGlow, 0.9);
  // 첫 룬 (X 모양)
  g.beginPath(); g.moveTo(cx - w * 0.18, h * 0.55); g.lineTo(cx - w * 0.12, h * 0.6); g.strokePath();
  g.beginPath(); g.moveTo(cx - w * 0.12, h * 0.55); g.lineTo(cx - w * 0.18, h * 0.6); g.strokePath();
  // 두 번째 룬 (Y 모양)
  g.beginPath(); g.moveTo(cx + w * 0.12, h * 0.55); g.lineTo(cx + w * 0.15, h * 0.6); g.strokePath();
  g.beginPath(); g.moveTo(cx + w * 0.18, h * 0.55); g.lineTo(cx + w * 0.15, h * 0.6); g.strokePath();
  g.beginPath(); g.moveTo(cx + w * 0.15, h * 0.6); g.lineTo(cx + w * 0.15, h * 0.65); g.strokePath();

  // 버섯 (트렁크에 작은 버섯 클러스터)
  for (let i = 0; i < 3; i++) {
    const mx = cx - w * 0.22 + i * w * 0.04;
    const my = h * 0.82;
    g.fillStyle(0xD32F2F, 1);
    g.fillEllipse(mx, my, w * 0.025, h * 0.018);
    g.fillStyle(0xffffff, 1);
    g.fillRect(mx - 2, my, 4, 6);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(mx - 2, my - 3, 1.5);
  }
}

// ──────────────────────────────────────────────────────────────
// 5. Magma Dragon — 화염 드래곤 (Magma 950000m)
// ──────────────────────────────────────────────────────────────
function drawMagmaDragon(g, w, h) {
  const cx = w / 2;
  const dark = 0x1B0500;
  const bodyDark = 0x7B1A00;
  const bodyMid = 0xBF360C;
  const bodyLight = 0xFF5722;
  const lava = 0xFF9800;
  const fire = 0xFFEB3B;

  // 큰 박쥐형 날개 (양쪽, 본체 뒤)
  for (const side of [-1, 1]) {
    const wOriginX = cx + side * w * 0.18;
    const wOriginY = h * 0.4;
    // 날개 멤브레인
    g.fillStyle(dark, 1);
    g.beginPath();
    g.moveTo(wOriginX, wOriginY);
    g.lineTo(cx + side * w * 0.5, h * 0.1);
    g.lineTo(cx + side * w * 0.48, h * 0.25);
    g.lineTo(cx + side * w * 0.45, h * 0.22);
    g.lineTo(cx + side * w * 0.42, h * 0.32);
    g.lineTo(cx + side * w * 0.38, h * 0.3);
    g.lineTo(cx + side * w * 0.35, h * 0.4);
    g.lineTo(cx + side * w * 0.3, h * 0.38);
    g.lineTo(cx + side * w * 0.28, h * 0.5);
    g.lineTo(cx + side * w * 0.2, h * 0.55);
    g.closePath();
    g.fillPath();
    g.lineStyle(4, 0x000000, 1);
    g.strokePath();
    // 날개 안쪽 밝은 색
    g.fillStyle(bodyDark, 0.7);
    g.beginPath();
    g.moveTo(wOriginX + side * 8, wOriginY);
    g.lineTo(cx + side * w * 0.45, h * 0.15);
    g.lineTo(cx + side * w * 0.22, h * 0.5);
    g.closePath();
    g.fillPath();
    // 날개 본 (뼈대 라인)
    g.lineStyle(3, dark, 1);
    g.beginPath(); g.moveTo(wOriginX, wOriginY); g.lineTo(cx + side * w * 0.5, h * 0.1); g.strokePath();
    g.beginPath(); g.moveTo(wOriginX, wOriginY); g.lineTo(cx + side * w * 0.42, h * 0.32); g.strokePath();
    g.beginPath(); g.moveTo(wOriginX, wOriginY); g.lineTo(cx + side * w * 0.35, h * 0.4); g.strokePath();
    g.beginPath(); g.moveTo(wOriginX, wOriginY); g.lineTo(cx + side * w * 0.28, h * 0.5); g.strokePath();
  }

  // 꼬리 (S자, 끝 화살촉)
  g.lineStyle(w * 0.04, bodyDark, 1);
  g.beginPath();
  g.moveTo(cx, h * 0.78);
  g.lineTo(cx + w * 0.12, h * 0.86);
  g.lineTo(cx - w * 0.02, h * 0.93);
  g.lineTo(cx + w * 0.18, h * 0.98);
  g.strokePath();
  g.fillStyle(bodyMid, 1);
  g.fillTriangle(cx + w * 0.14, h * 0.96, cx + w * 0.24, h * 0.94, cx + w * 0.2, h * 0.99);

  // 다리 (앞 + 뒤 2개)
  for (const side of [-1, 1]) {
    g.fillStyle(bodyDark, 1);
    g.fillRoundedRect(cx + side * w * 0.18 - w * 0.04, h * 0.66, w * 0.08, h * 0.14, 6);
    g.lineStyle(4, 0x000000, 1);
    g.strokeRoundedRect(cx + side * w * 0.18 - w * 0.04, h * 0.66, w * 0.08, h * 0.14, 6);
    // 발톱
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0xECEFF1, 1);
      const cx2 = cx + side * w * 0.18 + (i - 1) * w * 0.024;
      g.fillTriangle(cx2 - 4, h * 0.79, cx2 + 4, h * 0.79, cx2, h * 0.84);
      g.lineStyle(1, 0x000000, 1);
      g.strokeTriangle(cx2 - 4, h * 0.79, cx2 + 4, h * 0.79, cx2, h * 0.84);
    }
  }

  // 몸통 (큰 타원, 두꺼운 외곽선)
  g.fillStyle(bodyDark, 1);
  g.fillEllipse(cx + 4, h * 0.54 + 4, w * 0.5, h * 0.4);  // 그림자
  g.fillStyle(bodyMid, 1);
  g.fillEllipse(cx, h * 0.54, w * 0.48, h * 0.38);
  g.lineStyle(5, 0x000000, 1);
  g.strokeEllipse(cx, h * 0.54, w * 0.48, h * 0.38);

  // 배 (밝은 색, 비늘 라인)
  g.fillStyle(bodyLight, 1);
  g.fillEllipse(cx, h * 0.62, w * 0.28, h * 0.22);
  g.lineStyle(2, dark, 0.6);
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(cx - w * 0.12, h * 0.55 + i * h * 0.04);
    g.lineTo(cx + w * 0.12, h * 0.55 + i * h * 0.04);
    g.strokePath();
  }

  // 등 가시 (척추 따라 6개)
  for (let i = 0; i < 6; i++) {
    const sx = cx + (i - 2.5) * w * 0.05;
    const sy = h * 0.4 - Math.abs(i - 2.5) * h * 0.02;
    g.fillStyle(dark, 1);
    g.fillTriangle(sx - w * 0.018, sy + 6, sx + w * 0.018, sy + 6, sx, sy - h * 0.06);
    g.lineStyle(2, 0x000000, 1);
    g.strokeTriangle(sx - w * 0.018, sy + 6, sx + w * 0.018, sy + 6, sx, sy - h * 0.06);
  }

  // 비늘 (몸통에 다이아 패턴)
  g.fillStyle(bodyDark, 0.4);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const sx = cx - w * 0.16 + col * w * 0.08 + (row % 2 ? w * 0.04 : 0);
      const sy = h * 0.5 + row * h * 0.04;
      g.fillTriangle(sx - 5, sy, sx + 5, sy, sx, sy + 6);
    }
  }

  // 용암 균열 (몸통에 빛나는 오렌지 선)
  g.lineStyle(3, lava, 0.85);
  g.beginPath();
  g.moveTo(cx - w * 0.18, h * 0.5);
  g.lineTo(cx - w * 0.05, h * 0.55);
  g.lineTo(cx - w * 0.12, h * 0.62);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + w * 0.15, h * 0.48);
  g.lineTo(cx + w * 0.08, h * 0.56);
  g.lineTo(cx + w * 0.16, h * 0.65);
  g.strokePath();

  // 머리 (큰 각진 머리)
  g.fillStyle(bodyMid, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.18, h * 0.18);
  g.lineTo(cx + w * 0.18, h * 0.18);
  g.lineTo(cx + w * 0.22, h * 0.3);
  g.lineTo(cx + w * 0.08, h * 0.42);
  g.lineTo(cx - w * 0.08, h * 0.42);
  g.lineTo(cx - w * 0.22, h * 0.3);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, 0x000000, 1);
  g.strokePath();

  // 큰 뿔 (양쪽 위 곡선)
  for (const side of [-1, 1]) {
    g.fillStyle(dark, 1);
    g.beginPath();
    g.moveTo(cx + side * w * 0.12, h * 0.18);
    g.lineTo(cx + side * w * 0.2, h * 0.05);
    g.lineTo(cx + side * w * 0.06, h * 0.15);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0x000000, 1);
    g.strokePath();
  }

  // 작은 뿔 (안쪽)
  for (const side of [-1, 1]) {
    g.fillStyle(dark, 1);
    g.fillTriangle(
      cx + side * w * 0.03, h * 0.18,
      cx + side * w * 0.06, h * 0.18,
      cx + side * w * 0.045, h * 0.1
    );
    g.lineStyle(2, 0x000000, 1);
    g.strokeTriangle(
      cx + side * w * 0.03, h * 0.18,
      cx + side * w * 0.06, h * 0.18,
      cx + side * w * 0.045, h * 0.1
    );
  }

  // 노란 눈 (큰)
  for (const side of [-1, 1]) {
    const ex = cx + side * w * 0.08;
    const ey = h * 0.27;
    g.fillStyle(fire, 0.4);
    g.fillCircle(ex, ey, w * 0.05);
    g.fillStyle(fire, 1);
    g.fillCircle(ex, ey, w * 0.035);
    g.lineStyle(3, 0x000000, 1);
    g.strokeCircle(ex, ey, w * 0.035);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(ex, ey, w * 0.008, h * 0.045);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(ex - 3, ey - 3, 2.5);
  }

  // 콧구멍
  g.fillStyle(dark, 1);
  g.fillCircle(cx - w * 0.025, h * 0.36, 3);
  g.fillCircle(cx + w * 0.025, h * 0.36, 3);

  // 이빨 (양쪽 송곳)
  g.fillStyle(0xECEFF1, 1);
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const tx = cx + i * w * 0.025;
    g.fillTriangle(tx - 3, h * 0.42, tx + 3, h * 0.42, tx, h * 0.47);
    g.lineStyle(1, 0x000000, 1);
    g.strokeTriangle(tx - 3, h * 0.42, tx + 3, h * 0.42, tx, h * 0.47);
  }

  // 불 입김 (머리 아래 다층 화염)
  g.fillStyle(lava, 0.9);
  g.fillTriangle(cx - w * 0.08, h * 0.42, cx + w * 0.08, h * 0.42, cx, h * 0.52);
  g.fillStyle(fire, 0.95);
  g.fillTriangle(cx - w * 0.05, h * 0.43, cx + w * 0.05, h * 0.43, cx, h * 0.5);
  g.fillStyle(0xffffff, 0.7);
  g.fillTriangle(cx - w * 0.02, h * 0.44, cx + w * 0.02, h * 0.44, cx, h * 0.47);
}

// ──────────────────────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────────────────────
const BOSS_ART = {
  megaMole:      { drawer: drawMegaMole,      w: 480, h: 360 },
  crystalGolem:  { drawer: drawCrystalGolem,  w: 400, h: 560 },
  abyssKraken:   { drawer: drawAbyssKraken,   w: 540, h: 500 },
  ancientTreant: { drawer: drawAncientTreant, w: 460, h: 580 },
  magmaDragon:   { drawer: drawMagmaDragon,   w: 580, h: 440 },
};

export function ensureBossTexture(scene, bossId) {
  const key = `boss-${bossId}`;
  // 1) BootScene이 PNG를 미리 로드했으면 그걸 사용 (사용자 디자인 우선)
  if (scene.textures.exists(key)) {
    // procedural placeholder가 아닌 실제 이미지인지 체크 (placeholder는 무시)
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage?.();
    if (src && src.width > 4 && !tex._procedural) return key;
  }
  // 2) 없으면 procedural 폴백
  const art = BOSS_ART[bossId];
  if (!art) return null;
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  art.drawer(g, art.w, art.h);
  g.generateTexture(key, art.w, art.h);
  g.destroy();
  scene.textures.get(key)._procedural = true;
  return key;
}

export function getBossArtSize(bossId) {
  return BOSS_ART[bossId];
}
