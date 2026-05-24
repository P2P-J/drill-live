// 5종 보스 procedural 텍스처. 각 보스는 카툰 톤 + 바이옴 컬러 팔레트.
// drawer(g, w, h) — Phaser Graphics 위에 보스 그리기

function ensureTexture(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  drawFn(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

// ──────────────────────────────────────────────────────────────
// 1. Mega Mole (Earth, 9000m)
// ──────────────────────────────────────────────────────────────
function drawMegaMole(g, w, h) {
  const cx = w / 2;

  // 몸통 (큰 갈색 타원)
  g.fillStyle(0x6B3A2A, 1);
  g.fillEllipse(cx, h * 0.58, w * 0.85, h * 0.7);

  // 밝은 배 (아래쪽)
  g.fillStyle(0x9C6638, 1);
  g.fillEllipse(cx, h * 0.72, w * 0.6, h * 0.36);

  // 외곽선
  g.lineStyle(5, 0x2A1E14, 1);
  g.strokeEllipse(cx, h * 0.58, w * 0.85, h * 0.7);

  // 귀 (양쪽, 핑크 안)
  g.fillStyle(0x6B3A2A, 1);
  g.fillCircle(cx - w * 0.18, h * 0.28, w * 0.07);
  g.fillCircle(cx + w * 0.18, h * 0.28, w * 0.07);
  g.lineStyle(4, 0x2A1E14, 1);
  g.strokeCircle(cx - w * 0.18, h * 0.28, w * 0.07);
  g.strokeCircle(cx + w * 0.18, h * 0.28, w * 0.07);
  g.fillStyle(0xFFAB91, 1);
  g.fillCircle(cx - w * 0.18, h * 0.28, w * 0.035);
  g.fillCircle(cx + w * 0.18, h * 0.28, w * 0.035);

  // 눈 (작고 검은)
  g.fillStyle(0x000000, 1);
  g.fillCircle(cx - w * 0.09, h * 0.42, w * 0.025);
  g.fillCircle(cx + w * 0.09, h * 0.42, w * 0.025);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - w * 0.09 - 2, h * 0.42 - 2, 3);
  g.fillCircle(cx + w * 0.09 - 2, h * 0.42 - 2, 3);

  // 핑크 코
  g.fillStyle(0xE91E63, 1);
  g.fillCircle(cx, h * 0.5, w * 0.035);
  g.lineStyle(3, 0x880E4F, 1);
  g.strokeCircle(cx, h * 0.5, w * 0.035);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(cx - 3, h * 0.5 - 3, 3);

  // 앞니 두 개 (흰 사각형)
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(cx - w * 0.04, h * 0.55, w * 0.025, h * 0.06, 2);
  g.fillRoundedRect(cx + w * 0.015, h * 0.55, w * 0.025, h * 0.06, 2);
  g.lineStyle(2, 0x424242, 1);
  g.strokeRoundedRect(cx - w * 0.04, h * 0.55, w * 0.025, h * 0.06, 2);
  g.strokeRoundedRect(cx + w * 0.015, h * 0.55, w * 0.025, h * 0.06, 2);

  // 수염 (양쪽 3개씩)
  g.lineStyle(2, 0x424242, 0.8);
  for (let i = -1; i <= 1; i++) {
    const yy = h * 0.5 + i * 6;
    g.beginPath();
    g.moveTo(cx - w * 0.05, yy); g.lineTo(cx - w * 0.2, yy - 2);
    g.strokePath();
    g.beginPath();
    g.moveTo(cx + w * 0.05, yy); g.lineTo(cx + w * 0.2, yy - 2);
    g.strokePath();
  }

  // 큰 발톱 (양쪽 패들 모양)
  g.fillStyle(0x4A2818, 1);
  g.fillRoundedRect(w * 0.04, h * 0.52, w * 0.12, h * 0.32, 10);
  g.fillRoundedRect(w * 0.84, h * 0.52, w * 0.12, h * 0.32, 10);
  g.lineStyle(4, 0x1B0D08, 1);
  g.strokeRoundedRect(w * 0.04, h * 0.52, w * 0.12, h * 0.32, 10);
  g.strokeRoundedRect(w * 0.84, h * 0.52, w * 0.12, h * 0.32, 10);

  // 발톱 손가락 (3개씩)
  g.lineStyle(4, 0x1B0D08, 1);
  for (let i = 0; i < 3; i++) {
    const ox = w * 0.04 + i * w * 0.034 + 6;
    g.beginPath();
    g.moveTo(ox, h * 0.83); g.lineTo(ox, h * 0.92);
    g.strokePath();
    const ox2 = w * 0.84 + i * w * 0.034 + 6;
    g.beginPath();
    g.moveTo(ox2, h * 0.83); g.lineTo(ox2, h * 0.92);
    g.strokePath();
  }
}

// ──────────────────────────────────────────────────────────────
// 2. Crystal Golem (Crystal Cave, 45000m)
// ──────────────────────────────────────────────────────────────
function drawCrystalGolem(g, w, h) {
  const cx = w / 2;
  const purpleDark = 0x3D1A5C;
  const purpleMain = 0x7B4FA6;
  const purpleLight = 0xB39DDB;
  const glow = 0xE1BEE7;

  // 다리 (사각 두 개)
  g.fillStyle(purpleDark, 1);
  g.fillRect(cx - w * 0.25, h * 0.72, w * 0.18, h * 0.25);
  g.fillRect(cx + w * 0.07, h * 0.72, w * 0.18, h * 0.25);
  g.lineStyle(4, 0x1A0A2E, 1);
  g.strokeRect(cx - w * 0.25, h * 0.72, w * 0.18, h * 0.25);
  g.strokeRect(cx + w * 0.07, h * 0.72, w * 0.18, h * 0.25);

  // 몸통 (큰 사각, 결정 모양)
  g.fillStyle(purpleMain, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.32, h * 0.38);
  g.lineTo(cx + w * 0.32, h * 0.38);
  g.lineTo(cx + w * 0.36, h * 0.74);
  g.lineTo(cx - w * 0.36, h * 0.74);
  g.closePath();
  g.fillPath();
  g.lineStyle(5, 0x1A0A2E, 1);
  g.strokePath();

  // 가운데 빛나는 코어 (큰 결정 마름모)
  g.fillStyle(glow, 1);
  g.beginPath();
  g.moveTo(cx, h * 0.45);
  g.lineTo(cx + w * 0.1, h * 0.56);
  g.lineTo(cx, h * 0.67);
  g.lineTo(cx - w * 0.1, h * 0.56);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xffffff, 0.8);
  g.fillTriangle(cx - w * 0.04, h * 0.5, cx + w * 0.01, h * 0.5, cx - w * 0.02, h * 0.55);
  g.lineStyle(3, 0x4527A0, 1);
  g.beginPath();
  g.moveTo(cx, h * 0.45);
  g.lineTo(cx + w * 0.1, h * 0.56);
  g.lineTo(cx, h * 0.67);
  g.lineTo(cx - w * 0.1, h * 0.56);
  g.closePath();
  g.strokePath();

  // 팔 (양쪽 직사각형)
  g.fillStyle(purpleMain, 1);
  g.fillRoundedRect(w * 0.04, h * 0.42, w * 0.16, h * 0.32, 6);
  g.fillRoundedRect(w * 0.8, h * 0.42, w * 0.16, h * 0.32, 6);
  g.lineStyle(4, 0x1A0A2E, 1);
  g.strokeRoundedRect(w * 0.04, h * 0.42, w * 0.16, h * 0.32, 6);
  g.strokeRoundedRect(w * 0.8, h * 0.42, w * 0.16, h * 0.32, 6);

  // 머리 (작은 결정 머리, 몸통 위)
  g.fillStyle(purpleLight, 1);
  g.fillRect(cx - w * 0.18, h * 0.15, w * 0.36, h * 0.22);
  g.lineStyle(5, 0x1A0A2E, 1);
  g.strokeRect(cx - w * 0.18, h * 0.15, w * 0.36, h * 0.22);

  // 머리 위 뾰족한 결정 (왕관처럼)
  g.fillStyle(glow, 1);
  g.fillTriangle(cx - w * 0.12, h * 0.15, cx - w * 0.06, h * 0.04, cx, h * 0.15);
  g.fillTriangle(cx, h * 0.15, cx + w * 0.06, h * 0.04, cx + w * 0.12, h * 0.15);
  g.lineStyle(3, 0x4527A0, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.12, h * 0.15); g.lineTo(cx - w * 0.06, h * 0.04); g.lineTo(cx, h * 0.15);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx, h * 0.15); g.lineTo(cx + w * 0.06, h * 0.04); g.lineTo(cx + w * 0.12, h * 0.15);
  g.strokePath();

  // 빛나는 눈 (가로 사각, 청록 발광)
  g.fillStyle(0x00E5FF, 1);
  g.fillRect(cx - w * 0.1, h * 0.22, w * 0.06, h * 0.04);
  g.fillRect(cx + w * 0.04, h * 0.22, w * 0.06, h * 0.04);
  // 광원
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(cx - w * 0.085, h * 0.225, 4, 4);
  g.fillRect(cx + w * 0.055, h * 0.225, 4, 4);
}

// ──────────────────────────────────────────────────────────────
// 3. Abyss Kraken (Abyssal, 90000m)
// ──────────────────────────────────────────────────────────────
function drawAbyssKraken(g, w, h) {
  const cx = w / 2;
  const bodyDark = 0x051A2E;
  const bodyMain = 0x0F4A5C;
  const bodyLight = 0x1A8A9A;

  // 8개 촉수 (베이스 — 아래쪽으로 갈수록 가늘어짐)
  const tCount = 8;
  for (let i = 0; i < tCount; i++) {
    const angle = (Math.PI / (tCount - 1)) * i + Math.PI;  // 아래 반원
    const tx = cx + Math.cos(angle) * w * 0.38;
    const ty = h * 0.55 - Math.sin(angle) * h * 0.12;
    const endX = cx + Math.cos(angle) * w * 0.46;
    const endY = h * 0.95;

    // 두꺼운 곡선 (사각형 여러 개로)
    g.lineStyle(w * 0.05, bodyMain, 1);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + (endX - tx) * 0.5, ty + (endY - ty) * 0.4 + (i % 2 ? 10 : -10));
    g.lineTo(endX, endY);
    g.strokePath();
    g.lineStyle(w * 0.025, bodyDark, 1);
    g.strokePath();

    // 빨판 (작은 원)
    g.fillStyle(bodyLight, 1);
    for (let s = 1; s <= 3; s++) {
      const sx = tx + (endX - tx) * (s / 4);
      const sy = ty + (endY - ty) * (s / 4) + (i % 2 ? 4 * s : -4 * s);
      g.fillCircle(sx, sy, 4);
    }
  }

  // 머리 (큰 원)
  g.fillStyle(bodyMain, 1);
  g.fillCircle(cx, h * 0.42, w * 0.32);
  g.lineStyle(5, 0x000814, 1);
  g.strokeCircle(cx, h * 0.42, w * 0.32);

  // 밝은 반사 (위쪽)
  g.fillStyle(bodyLight, 0.5);
  g.fillCircle(cx - w * 0.1, h * 0.32, w * 0.12);

  // 외눈 (큰 노란 원)
  g.fillStyle(0xFFEB3B, 1);
  g.fillCircle(cx, h * 0.42, w * 0.14);
  g.lineStyle(5, 0x000814, 1);
  g.strokeCircle(cx, h * 0.42, w * 0.14);
  // 동공 (세로 슬릿)
  g.fillStyle(0x000000, 1);
  g.fillEllipse(cx, h * 0.42, w * 0.04, h * 0.12);
  // 광원
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(cx - w * 0.06, h * 0.36, w * 0.025);

  // 머리 위 작은 뿔/지느러미 (3개)
  g.fillStyle(bodyDark, 1);
  for (let i = -1; i <= 1; i++) {
    g.fillTriangle(
      cx + i * w * 0.12 - 6, h * 0.15,
      cx + i * w * 0.12 + 6, h * 0.15,
      cx + i * w * 0.12, h * 0.05,
    );
  }

  // 작은 이빨 (외눈 아래)
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 5; i++) {
    const tx = cx - w * 0.1 + i * w * 0.05;
    g.fillTriangle(tx, h * 0.6, tx + w * 0.04, h * 0.6, tx + w * 0.02, h * 0.68);
  }
  g.lineStyle(2, 0x000000, 1);
  g.strokePath();
}

// ──────────────────────────────────────────────────────────────
// 4. Ancient Treant (Forest, 450000m)
// ──────────────────────────────────────────────────────────────
function drawAncientTreant(g, w, h) {
  const cx = w / 2;
  const barkDark = 0x3E2723;
  const barkMain = 0x6B3A2A;
  const barkLight = 0x8D6E63;
  const leafDark = 0x1B5E20;
  const leafMain = 0x4CAF50;
  const leafLight = 0xA5D6A7;

  // 뿌리 (양쪽 발 — 사다리꼴)
  g.fillStyle(barkDark, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.32, h * 0.85);
  g.lineTo(cx - w * 0.12, h * 0.85);
  g.lineTo(cx - w * 0.18, h * 0.99);
  g.lineTo(cx - w * 0.38, h * 0.99);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(cx + w * 0.12, h * 0.85);
  g.lineTo(cx + w * 0.32, h * 0.85);
  g.lineTo(cx + w * 0.38, h * 0.99);
  g.lineTo(cx + w * 0.18, h * 0.99);
  g.closePath();
  g.fillPath();
  g.lineStyle(4, 0x1B0D08, 1);
  g.strokePath();

  // 몸통 (두꺼운 줄기)
  g.fillStyle(barkMain, 1);
  g.fillRoundedRect(cx - w * 0.25, h * 0.4, w * 0.5, h * 0.5, 14);
  g.lineStyle(5, 0x1B0D08, 1);
  g.strokeRoundedRect(cx - w * 0.25, h * 0.4, w * 0.5, h * 0.5, 14);

  // 줄기 디테일 (세로 선)
  g.lineStyle(3, barkLight, 0.6);
  g.beginPath();
  g.moveTo(cx - w * 0.12, h * 0.45); g.lineTo(cx - w * 0.1, h * 0.85);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx, h * 0.42); g.lineTo(cx + w * 0.03, h * 0.88);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + w * 0.12, h * 0.45); g.lineTo(cx + w * 0.14, h * 0.85);
  g.strokePath();

  // 가지 팔 (양쪽)
  g.fillStyle(barkDark, 1);
  g.fillRoundedRect(w * 0.0, h * 0.5, w * 0.25, h * 0.1, 8);
  g.fillRoundedRect(w * 0.75, h * 0.5, w * 0.25, h * 0.1, 8);
  g.lineStyle(4, 0x1B0D08, 1);
  g.strokeRoundedRect(w * 0.0, h * 0.5, w * 0.25, h * 0.1, 8);
  g.strokeRoundedRect(w * 0.75, h * 0.5, w * 0.25, h * 0.1, 8);

  // 손가락 가지 (3개씩)
  g.lineStyle(6, barkDark, 1);
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(w * 0.02, h * 0.52 + i * h * 0.025);
    g.lineTo(w * -0.04, h * 0.45 + i * h * 0.06);
    g.strokePath();
    g.beginPath();
    g.moveTo(w * 0.98, h * 0.52 + i * h * 0.025);
    g.lineTo(w * 1.04, h * 0.45 + i * h * 0.06);
    g.strokePath();
  }

  // 잎사귀 머리 (큰 구름 모양 — 여러 원)
  g.fillStyle(leafDark, 1);
  g.fillCircle(cx, h * 0.25, w * 0.32);
  g.fillCircle(cx - w * 0.25, h * 0.3, w * 0.2);
  g.fillCircle(cx + w * 0.25, h * 0.3, w * 0.2);
  g.fillCircle(cx - w * 0.15, h * 0.12, w * 0.18);
  g.fillCircle(cx + w * 0.15, h * 0.12, w * 0.18);

  g.fillStyle(leafMain, 1);
  g.fillCircle(cx, h * 0.25, w * 0.24);
  g.fillCircle(cx - w * 0.2, h * 0.3, w * 0.14);
  g.fillCircle(cx + w * 0.2, h * 0.3, w * 0.14);

  g.fillStyle(leafLight, 0.7);
  g.fillCircle(cx - w * 0.08, h * 0.18, w * 0.08);
  g.fillCircle(cx + w * 0.16, h * 0.22, w * 0.06);

  // 빛나는 녹색 눈 (몸통에)
  g.fillStyle(0xCCFF90, 1);
  g.fillCircle(cx - w * 0.08, h * 0.55, w * 0.04);
  g.fillCircle(cx + w * 0.08, h * 0.55, w * 0.04);
  g.lineStyle(3, 0x2E7D32, 1);
  g.strokeCircle(cx - w * 0.08, h * 0.55, w * 0.04);
  g.strokeCircle(cx + w * 0.08, h * 0.55, w * 0.04);
  g.fillStyle(0x1B5E20, 1);
  g.fillCircle(cx - w * 0.08, h * 0.55, w * 0.018);
  g.fillCircle(cx + w * 0.08, h * 0.55, w * 0.018);

  // 입 (가로 줄, 약간 굽음)
  g.lineStyle(4, 0x1B0D08, 1);
  g.beginPath();
  g.moveTo(cx - w * 0.06, h * 0.68);
  g.lineTo(cx + w * 0.06, h * 0.68);
  g.strokePath();
}

// ──────────────────────────────────────────────────────────────
// 5. Magma Dragon (Magma, 950000m)
// ──────────────────────────────────────────────────────────────
function drawMagmaDragon(g, w, h) {
  const cx = w / 2;
  const bodyDark = 0x7B1A00;
  const bodyMain = 0xBF360C;
  const bodyLight = 0xFF5722;
  const fireYellow = 0xFFEB3B;
  const fireOrange = 0xFF9800;

  // 양쪽 날개 (큰 박쥐형 — 둥근 삼각형)
  g.fillStyle(bodyDark, 1);
  // 왼쪽 날개
  g.beginPath();
  g.moveTo(cx - w * 0.2, h * 0.4);
  g.lineTo(w * 0.02, h * 0.2);
  g.lineTo(w * 0.05, h * 0.5);
  g.lineTo(w * 0.1, h * 0.45);
  g.lineTo(w * 0.15, h * 0.55);
  g.lineTo(cx - w * 0.15, h * 0.6);
  g.closePath();
  g.fillPath();
  g.lineStyle(4, 0x1B0D08, 1);
  g.strokePath();
  // 오른쪽 날개
  g.beginPath();
  g.moveTo(cx + w * 0.2, h * 0.4);
  g.lineTo(w * 0.98, h * 0.2);
  g.lineTo(w * 0.95, h * 0.5);
  g.lineTo(w * 0.9, h * 0.45);
  g.lineTo(w * 0.85, h * 0.55);
  g.lineTo(cx + w * 0.15, h * 0.6);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // 몸통 (길쭉한 타원)
  g.fillStyle(bodyMain, 1);
  g.fillEllipse(cx, h * 0.55, w * 0.45, h * 0.42);
  g.lineStyle(5, 0x1B0D08, 1);
  g.strokeEllipse(cx, h * 0.55, w * 0.45, h * 0.42);

  // 배 (밝은 색)
  g.fillStyle(bodyLight, 1);
  g.fillEllipse(cx, h * 0.65, w * 0.25, h * 0.22);

  // 비늘 라인 (가로 줄 3개)
  g.lineStyle(2, 0x1B0D08, 0.6);
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(cx - w * 0.12, h * 0.55 + i * 12);
    g.lineTo(cx + w * 0.12, h * 0.55 + i * 12);
    g.strokePath();
  }

  // 머리 (큰 타원, 약간 길쭉)
  g.fillStyle(bodyMain, 1);
  g.fillEllipse(cx, h * 0.28, w * 0.32, h * 0.24);
  g.lineStyle(5, 0x1B0D08, 1);
  g.strokeEllipse(cx, h * 0.28, w * 0.32, h * 0.24);

  // 머리 뿔 (양쪽 위)
  g.fillStyle(bodyDark, 1);
  g.fillTriangle(cx - w * 0.13, h * 0.18, cx - w * 0.05, h * 0.18, cx - w * 0.09, h * 0.04);
  g.fillTriangle(cx + w * 0.05, h * 0.18, cx + w * 0.13, h * 0.18, cx + w * 0.09, h * 0.04);
  g.strokePath();
  g.lineStyle(4, 0x1B0D08, 1);
  g.strokeTriangle(cx - w * 0.13, h * 0.18, cx - w * 0.05, h * 0.18, cx - w * 0.09, h * 0.04);
  g.strokeTriangle(cx + w * 0.05, h * 0.18, cx + w * 0.13, h * 0.18, cx + w * 0.09, h * 0.04);

  // 노란 눈
  g.fillStyle(fireYellow, 1);
  g.fillCircle(cx - w * 0.08, h * 0.28, w * 0.04);
  g.fillCircle(cx + w * 0.08, h * 0.28, w * 0.04);
  g.lineStyle(3, 0x1B0D08, 1);
  g.strokeCircle(cx - w * 0.08, h * 0.28, w * 0.04);
  g.strokeCircle(cx + w * 0.08, h * 0.28, w * 0.04);
  // 동공 슬릿
  g.fillStyle(0x000000, 1);
  g.fillEllipse(cx - w * 0.08, h * 0.28, w * 0.01, h * 0.06);
  g.fillEllipse(cx + w * 0.08, h * 0.28, w * 0.01, h * 0.06);

  // 콧구멍
  g.fillStyle(0x1B0D08, 1);
  g.fillCircle(cx - w * 0.03, h * 0.38, 3);
  g.fillCircle(cx + w * 0.03, h * 0.38, 3);

  // 불 입김 (입 아래, 화염 색 삼각형)
  g.fillStyle(fireOrange, 1);
  g.fillTriangle(cx - w * 0.05, h * 0.45, cx + w * 0.05, h * 0.45, cx, h * 0.4);
  g.fillStyle(fireYellow, 1);
  g.fillTriangle(cx - w * 0.025, h * 0.44, cx + w * 0.025, h * 0.44, cx, h * 0.41);

  // 꼬리 (몸통 아래로 길게)
  g.fillStyle(bodyDark, 1);
  g.beginPath();
  g.moveTo(cx + w * 0.05, h * 0.85);
  g.lineTo(cx + w * 0.2, h * 0.95);
  g.lineTo(cx + w * 0.05, h * 0.97);
  g.closePath();
  g.fillPath();
  g.lineStyle(4, 0x1B0D08, 1);
  g.strokePath();
}

// ──────────────────────────────────────────────────────────────
// Export — boss id → drawer + 권장 사이즈
// ──────────────────────────────────────────────────────────────
const BOSS_ART = {
  megaMole:     { drawer: drawMegaMole,     w: 400, h: 280 },
  crystalGolem: { drawer: drawCrystalGolem, w: 350, h: 500 },
  abyssKraken:  { drawer: drawAbyssKraken,  w: 480, h: 480 },
  ancientTreant:{ drawer: drawAncientTreant,w: 420, h: 520 },
  magmaDragon:  { drawer: drawMagmaDragon,  w: 500, h: 420 },
};

export function ensureBossTexture(scene, bossId) {
  const art = BOSS_ART[bossId];
  if (!art) return null;
  return ensureTexture(scene, `boss-${bossId}`, art.w, art.h, art.drawer);
}

export function getBossArtSize(bossId) {
  return BOSS_ART[bossId];
}
