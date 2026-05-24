import { GAME } from '../config/game.js';

function ensureTex(scene, key, w, h, drawFn) {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics().setVisible(false);
  drawFn(g);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

// 업그레이드 아이콘들 (64x64)
export function ensureUpgradeIcon(scene, name) {
  const key = `upgrade-icon-${name}`;
  const w = 64, h = 64;
  return ensureTex(scene, key, w, h, (g) => {
    if (name === 'drillPower') {
      // 회전 드릴 콘 (위→아래)
      g.fillStyle(0xBDBDBD, 1);
      g.beginPath();
      g.moveTo(20, 8); g.lineTo(44, 8); g.lineTo(32, 56); g.closePath();
      g.fillPath();
      g.lineStyle(3, 0x000000, 1);
      g.strokePath();
      g.lineStyle(2, 0x424242, 1);
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const y = 8 + (56 - 8) * t;
        const hw = 12 * (1 - t);
        g.beginPath(); g.moveTo(32 - hw, y - 3); g.lineTo(32 + hw, y + 3); g.strokePath();
      }
    } else if (name === 'drillRange') {
      // 좌우 화살표
      g.fillStyle(0xFF9800, 1);
      g.fillRect(20, 26, 24, 12);
      g.lineStyle(3, 0x000000, 1);
      g.strokeRect(20, 26, 24, 12);
      // 왼쪽 화살촉
      g.fillStyle(0xFF9800, 1);
      g.beginPath();
      g.moveTo(20, 18); g.lineTo(8, 32); g.lineTo(20, 46); g.closePath();
      g.fillPath();
      g.strokePath();
      // 오른쪽 화살촉
      g.beginPath();
      g.moveTo(44, 18); g.lineTo(56, 32); g.lineTo(44, 46); g.closePath();
      g.fillPath();
      g.strokePath();
    } else if (name === 'engine') {
      // 톱니바퀴
      g.fillStyle(0x03A9F4, 1);
      g.fillCircle(32, 32, 18);
      g.lineStyle(3, 0x000000, 1);
      g.strokeCircle(32, 32, 18);
      // 톱니 6개
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const x = 32 + Math.cos(a) * 22;
        const y = 32 + Math.sin(a) * 22;
        g.fillStyle(0x03A9F4, 1);
        g.fillRect(x - 4, y - 4, 8, 8);
        g.lineStyle(2, 0x000000, 1);
        g.strokeRect(x - 4, y - 4, 8, 8);
      }
      // 가운데 구멍
      g.fillStyle(0x01579b, 1);
      g.fillCircle(32, 32, 6);
    } else if (name === 'fuelTank') {
      // 연료통 (사각 + 손잡이)
      g.fillStyle(0x9E9E9E, 1);
      g.fillRoundedRect(14, 16, 36, 36, 4);
      g.lineStyle(3, 0x000000, 1);
      g.strokeRoundedRect(14, 16, 36, 36, 4);
      // 손잡이
      g.fillStyle(0x616161, 1);
      g.fillRect(28, 8, 12, 8);
      g.strokeRect(28, 8, 12, 8);
      // 게이지 라인
      g.lineStyle(2, 0x424242, 1);
      g.beginPath(); g.moveTo(20, 30); g.lineTo(44, 30); g.strokePath();
      g.beginPath(); g.moveTo(20, 38); g.lineTo(44, 38); g.strokePath();
      // 빨간 표시
      g.fillStyle(0xf44336, 1);
      g.fillRect(20, 44, 24, 4);
    } else if (name === 'cargo') {
      // 상자
      g.fillStyle(0x795548, 1);
      g.fillRect(10, 16, 44, 36);
      g.lineStyle(3, 0x000000, 1);
      g.strokeRect(10, 16, 44, 36);
      // 뚜껑
      g.fillStyle(0x5d4037, 1);
      g.fillRect(10, 16, 44, 10);
      g.strokeRect(10, 16, 44, 10);
      // X 자물쇠
      g.lineStyle(3, 0x000000, 1);
      g.beginPath();
      g.moveTo(20, 28); g.lineTo(44, 48);
      g.moveTo(44, 28); g.lineTo(20, 48);
      g.strokePath();
      // 작은 자물쇠
      g.fillStyle(0xFFC107, 1);
      g.fillCircle(32, 38, 4);
      g.lineStyle(1, 0x000000, 1);
      g.strokeCircle(32, 38, 4);
    }
  });
}
