import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { ORES, ORE_IDS } from '../config/ores.js';
import { TRIGGERS } from '../config/triggers.js';
import { gameState } from '../systems/GameState.js';
import { ensureGemTexture } from '../objects/TileArt.js';

const INVENTORY_X = 12;
const INVENTORY_W = 96;
const INVENTORY_TOP = 110;

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  init(data) {
    this.upgradeSystem = data.upgradeSystem;
    this.biomeManager = data.biomeManager;
  }

  create() {
    this._buildTopHud();
    this._buildInventory();
    this._buildTriggerPanel();
    this._wireEvents();
  }

  // ── 상단 HUD (Depth + Biome + 자동 업그레이드 상태) ──
  _buildTopHud() {
    this.add.rectangle(0, 0, GAME.width, 100, 0x000000, 0.6).setOrigin(0, 0);

    this.depthText = this.add.text(GAME.width / 2, 14, 'Depth: 0.0 km', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '46px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.biomeText = this.add.text(GAME.width / 2, 64, 'Earth - Layer 1-1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#cccccc',
    }).setOrigin(0.5, 0);
  }

  // ── 좌측 광물 인벤토리 ──
  _buildInventory() {
    const x = INVENTORY_X;
    const y = INVENTORY_TOP;
    const w = INVENTORY_W;
    const itemH = 102;
    const totalH = ORE_IDS.length * itemH + 20;

    this.add.rectangle(x, y, w, totalH, 0x000000, 0.55).setOrigin(0, 0)
      .setStrokeStyle(2, 0xFFD700, 0.5);

    this.inventoryItems = {};
    ORE_IDS.forEach((id, i) => {
      const cy_ = y + 10 + i * itemH;
      this.add.rectangle(x + w / 2, cy_ + 30, 60, 60, 0x1a1a1a, 0.7)
        .setStrokeStyle(1, 0x444444, 0.8);

      const gemKey = ensureGemTexture(this, id);
      const icon = this.add.image(x + w / 2, cy_ + 30, gemKey);
      icon.setScale(56 / GAME.tileSize);
      icon.setAlpha(0.35);

      const count = this.add.text(x + w / 2, cy_ + 68, '0', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '22px',
        color: '#FFD700',
      }).setOrigin(0.5, 0);

      this.inventoryItems[id] = { icon, count };
    });
  }

  // ── 하단: 후원 트리거 안내 패널 (ZRQYT COMANDOS 스타일) ──
  _buildTriggerPanel() {
    const panelY = GAME.hudY;
    const panelH = GAME.hudHeight;

    this.add.rectangle(0, panelY, GAME.width, panelH, 0x111118, 0.98).setOrigin(0, 0);
    this.add.rectangle(0, panelY, GAME.width, 6, 0xFFD700).setOrigin(0, 0);

    // 헤더
    this.add.text(24, panelY + 12, 'TRIGGERS', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '34px',
      color: '#FFD700',
    }).setOrigin(0, 0);

    this.add.text(GAME.width - 24, panelY + 18, '$1 = BOMB 💥', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#FFEB3B',
    }).setOrigin(1, 0);

    // 3열 × 5행 = 15칸 그리드
    const cols = 3;
    const rows = 5;
    const gridTop = panelY + 70;
    const gridLeft = 16;
    const gridRight = 16;
    const gap = 8;
    const cellW = Math.floor((GAME.width - gridLeft - gridRight - gap * (cols - 1)) / cols);
    const cellH = Math.floor((panelH - 80 - gap * (rows - 1)) / rows);

    TRIGGERS.forEach((trig, i) => {
      if (i >= cols * rows) return;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridLeft + col * (cellW + gap);
      const y = gridTop + row * (cellH + gap);
      this._createTriggerCell(trig, x, y, cellW, cellH);
    });
  }

  _createTriggerCell(trig, x, y, w, h) {
    // 배경
    const bg = this.add.rectangle(x, y, w, h, 0x1f1f28, 1).setOrigin(0, 0)
      .setStrokeStyle(2, 0x333344);

    // 좌측 컬러 박스 (아이콘 자리)
    const boxSize = Math.min(h - 12, 56);
    this.add.rectangle(x + 8, y + (h - boxSize) / 2, boxSize, boxSize, trig.color, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x000000);
    // 박스 안에 첫 글자
    this.add.text(x + 8 + boxSize / 2, y + h / 2, trig.label.charAt(0), {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '28px',
      color: '#000000',
    }).setOrigin(0.5, 0.5);

    // 라벨
    this.add.text(x + boxSize + 16, y + 8, trig.label, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0, 0);

    // 가격 (타입에 따라 색상 다름)
    const priceColor = trig.type === 'donate' ? '#FFD700'
                     : trig.type === 'chat'   ? '#90CAF9'
                     :                          '#F8BBD0';
    this.add.text(x + w - 8, y + 8, trig.price, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: priceColor,
    }).setOrigin(1, 0);

    // 효과 설명
    this.add.text(x + boxSize + 16, y + h - 26, trig.effect, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#bbbbbb',
    }).setOrigin(0, 0);
  }

  _wireEvents() {
    gameState.on('depth', (km) => {
      this.depthText.setText(`Depth: ${km.toFixed(1)} km`);
      const layer = this.biomeManager.getLayerAt(Math.max(0, km));
      const short = layer.name.split(' ')[0];
      this.biomeText.setText(`${layer.biomeName} - Layer ${short}`);
    });

    gameState.on('ore', ({ oreId, total }) => {
      const item = this.inventoryItems[oreId];
      if (!item) return;
      item.count.setText(String(total));
      item.icon.setAlpha(1.0);
      this.tweens.add({
        targets: item.icon,
        scale: { from: (56 / GAME.tileSize) * 1.3, to: (56 / GAME.tileSize) },
        duration: 240,
        ease: 'Back.easeOut',
      });
    });
  }
}
