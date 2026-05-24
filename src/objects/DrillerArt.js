import { GAME } from '../config/game.js';

const T = GAME.tileSize;

function ensureTex(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  drawFn(g);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

// 본체: 둥근 노란 몸체 + 헬멧 + 헤드라이트 + 작은 창문 + 라인 디테일
// 폭 ≈ 1 타일, 높이 ≈ 1 타일
export function ensureBodyTexture(scene) {
  const w = T;
  const h = T;
  return ensureTex(scene, 'driller-body', w, h, (g) => {
    const cx = w / 2;
    const cy = h / 2;

    // ── 헬멧 (위쪽 반원) ──
    g.fillStyle(0xD32F2F, 1);
    g.fillCircle(cx, cy - 18, 18);
    // 헬멧 어두운 띠
    g.fillStyle(0x8B0000, 1);
    g.fillRect(cx - 18, cy - 4, 36, 4);
    // 헬멧 외곽선 (위쪽 곡선만 살짝)
    g.lineStyle(2, 0x000000, 1);
    g.beginPath();
    g.arc(cx, cy - 18, 18, Math.PI, 0, false);
    g.strokePath();

    // ── 헤드라이트 (헬멧 정면 작은 노란 원) ──
    g.fillStyle(0xFFEB3B, 1);
    g.fillCircle(cx, cy - 22, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 1, cy - 23, 1.5);

    // ── 몸통 (둥근 사각형, 노란 메인) ──
    g.fillStyle(0xFFC107, 1);
    g.fillRoundedRect(cx - 23, cy - 4, 46, 30, 6);
    // 몸통 외곽선
    g.lineStyle(3, 0x000000, 1);
    g.strokeRoundedRect(cx - 23, cy - 4, 46, 30, 6);
    // 몸통 하이라이트 (왼쪽 위 살짝 밝은 띠)
    g.fillStyle(0xFFE082, 1);
    g.fillRect(cx - 19, cy - 1, 12, 3);

    // ── 창문/눈 2개 ──
    g.fillStyle(0x000000, 1);
    g.fillRoundedRect(cx - 14, cy + 2, 10, 8, 2);
    g.fillRoundedRect(cx + 4, cy + 2, 10, 8, 2);
    // 눈 안에 흰 반짝임
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 12, cy + 4, 3, 2);
    g.fillRect(cx + 6, cy + 4, 3, 2);

    // ── 캐터필러 트랙 (몸통 하단) ──
    g.fillStyle(0x212121, 1);
    g.fillRoundedRect(cx - 26, cy + 18, 52, 10, 3);
    // 트랙 세그먼트 점들
    g.fillStyle(0x424242, 1);
    for (let i = 0; i < 6; i++) {
      g.fillRect(cx - 23 + i * 9, cy + 21, 4, 4);
    }
    g.lineStyle(2, 0x000000, 1);
    g.strokeRoundedRect(cx - 26, cy + 18, 52, 10, 3);
  });
}

// 드릴 비트 (회전용 — 따로 그려서 매 프레임 rotation 가능)
export function ensureDrillBitTexture(scene) {
  const w = T * 0.55;
  const h = T * 0.7;
  return ensureTex(scene, 'driller-bit', w, h, (g) => {
    const cx = w / 2;
    const top = 4;
    const bottom = h - 4;
    const halfW = T * 0.18;

    // 본체 (긴 원뿔)
    g.fillStyle(0xBDBDBD, 1);
    g.beginPath();
    g.moveTo(cx - halfW, top);
    g.lineTo(cx + halfW, top);
    g.lineTo(cx, bottom);
    g.closePath();
    g.fillPath();

    // 외곽선
    g.lineStyle(2, 0x000000, 1);
    g.strokePath();

    // 나선형 디테일 (가로 줄 4개)
    g.lineStyle(2, 0x424242, 1);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const y = top + (bottom - top) * t;
      // 폭은 위에서 아래로 점점 좁아짐
      const widthAt = halfW * (1 - t);
      g.beginPath();
      g.moveTo(cx - widthAt, y - 3);
      g.lineTo(cx + widthAt, y + 3);
      g.strokePath();
    }

    // 끝쪽 하이라이트
    g.fillStyle(0xeeeeee, 1);
    g.fillRect(cx - halfW + 3, top + 3, 4, 6);
  });
}

// 작은 흙 파편 (채굴 시 튀는 파티클용)
export function ensureChunkTexture(scene, color) {
  const key = `chunk-${color.toString(16)}`;
  return ensureTex(scene, key, 10, 10, (g) => {
    g.fillStyle(color, 1);
    g.fillRect(0, 0, 10, 10);
    g.lineStyle(1, 0x000000, 1);
    g.strokeRect(0, 0, 10, 10);
  });
}
