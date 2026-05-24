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

// 통합 드릴머신: 본체 + 헬멧 + 드릴 비트 + 트랙이 한 텍스처로 합쳐짐.
// 컨테이너가 회전하면 전체가 한 덩어리로 회전 (본체/비트 분리 안 됨).
// 텍스처 크기: 64x96 (세로로 길게 — 본체 위쪽, 드릴 비트 아래쪽)
export function ensureDrillerTexture(scene) {
  const w = T;
  const h = Math.floor(T * 1.5);  // 96
  return ensureTex(scene, 'driller', w, h, (g) => {
    const cx = w / 2;
    // 좌표 기준: 본체 중심 = y 32 (위쪽 1/3 지점)
    const bodyCy = 32;

    // ── 헬멧 (위쪽 반원) ──
    g.fillStyle(0xD32F2F, 1);
    g.fillCircle(cx, bodyCy - 22, 14);
    // 헬멧 어두운 띠 (밴드)
    g.fillStyle(0x8B0000, 1);
    g.fillRect(cx - 16, bodyCy - 12, 32, 4);
    // 외곽선
    g.lineStyle(2, 0x000000, 1);
    g.beginPath();
    g.arc(cx, bodyCy - 22, 14, Math.PI, 0, false);
    g.strokePath();

    // 헬멧 헤드라이트 (정면 노란 원)
    g.fillStyle(0xFFEB3B, 1);
    g.fillCircle(cx, bodyCy - 26, 3.5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 0.8, bodyCy - 27, 1.3);

    // ── 몸통 (둥근 노란 박스) ──
    const bodyW = 50;
    const bodyH = 34;
    g.fillStyle(0xFFC107, 1);
    g.fillRoundedRect(cx - bodyW / 2, bodyCy - 8, bodyW, bodyH, 7);
    g.lineStyle(3, 0x000000, 1);
    g.strokeRoundedRect(cx - bodyW / 2, bodyCy - 8, bodyW, bodyH, 7);
    // 몸통 위쪽 하이라이트
    g.fillStyle(0xFFE082, 1);
    g.fillRoundedRect(cx - bodyW / 2 + 4, bodyCy - 5, bodyW - 8, 4, 3);

    // ── 눈 2개 (창문 형태) ──
    g.fillStyle(0x000000, 1);
    g.fillRoundedRect(cx - 15, bodyCy + 2, 11, 9, 3);
    g.fillRoundedRect(cx + 4, bodyCy + 2, 11, 9, 3);
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 13, bodyCy + 4, 3, 3);
    g.fillRect(cx + 6, bodyCy + 4, 3, 3);

    // ── 캐터필러 트랙 (몸통 하단) ──
    g.fillStyle(0x212121, 1);
    g.fillRoundedRect(cx - 28, bodyCy + 22, 56, 10, 3);
    // 트랙 세그먼트
    g.fillStyle(0x424242, 1);
    for (let i = 0; i < 6; i++) {
      g.fillRect(cx - 25 + i * 9, bodyCy + 25, 4, 4);
    }
    g.lineStyle(2, 0x000000, 1);
    g.strokeRoundedRect(cx - 28, bodyCy + 22, 56, 10, 3);

    // ── 드릴 비트 (몸통 아래에 통합 — 트랙 바로 아래) ──
    const bitTop = bodyCy + 32;
    const bitBottom = bitTop + 30;
    const bitHalfW = 14;

    // 비트 본체
    g.fillStyle(0xBDBDBD, 1);
    g.beginPath();
    g.moveTo(cx - bitHalfW, bitTop);
    g.lineTo(cx + bitHalfW, bitTop);
    g.lineTo(cx, bitBottom);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x000000, 1);
    g.strokePath();

    // 비트 나선 줄 (가로 띠 3개, 폭이 위→아래로 점점 좁아짐)
    g.lineStyle(2, 0x424242, 1);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const yy = bitTop + (bitBottom - bitTop) * t;
      const widthAt = bitHalfW * (1 - t);
      g.beginPath();
      g.moveTo(cx - widthAt, yy - 3);
      g.lineTo(cx + widthAt, yy + 3);
      g.strokePath();
    }

    // 비트 끝 광채
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(cx - bitHalfW + 3, bitTop + 3, 4, 4);
  });
}
