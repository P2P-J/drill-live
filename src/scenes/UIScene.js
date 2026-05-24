import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { UPGRADES, UPGRADE_ORDER } from '../config/upgrades.js';
import { ORES, ORE_IDS } from '../config/ores.js';
import { gameState } from '../systems/GameState.js';
import { ensureGemTexture } from '../objects/TileArt.js';
import { ensureUpgradeIcon } from '../objects/UIArt.js';

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
    this._buildUpgradePanel();
    this._wireEvents();
  }

  // ── 상단 (Depth + Biome만) ──
  _buildTopHud() {
    this.add.rectangle(0, 0, GAME.width, 100, 0x000000, 0.6).setOrigin(0, 0);

    this.depthText = this.add.text(GAME.width / 2, 18, 'Depth: 0.0 km', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.biomeText = this.add.text(GAME.width / 2, 70, 'Earth - Layer 1-1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
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

    // 패널 배경
    this.add.rectangle(x, y, w, totalH, 0x000000, 0.55).setOrigin(0, 0)
      .setStrokeStyle(2, 0xFFD700, 0.5);

    this.inventoryItems = {};
    ORE_IDS.forEach((id, i) => {
      const ore = ORES[id];
      const cy_ = y + 10 + i * itemH;

      // 다이아 모양 아이콘 배경 (살짝 어두운 사각)
      const iconBg = this.add.rectangle(x + w / 2, cy_ + 30, 60, 60, 0x1a1a1a, 0.7)
        .setStrokeStyle(1, 0x444444, 0.8);

      // 광물 텍스처
      const gemKey = ensureGemTexture(this, id);
      const icon = this.add.image(x + w / 2, cy_ + 30, gemKey);
      icon.setScale(56 / GAME.tileSize);  // 64 → 56 정도로 작게
      icon.setAlpha(0.35);  // 0개일 땐 흐릿

      const count = this.add.text(x + w / 2, cy_ + 68, '0', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '22px',
        color: '#FFD700',
      }).setOrigin(0.5, 0);

      this.inventoryItems[id] = { icon, count, bg: iconBg };
    });
  }

  // ── 하단 업그레이드 패널 ──
  _buildUpgradePanel() {
    const panelY = GAME.hudY;
    const panelH = GAME.hudHeight;

    this.add.rectangle(0, panelY, GAME.width, panelH, 0x1a1a1a, 0.98).setOrigin(0, 0);
    this.add.rectangle(0, panelY, GAME.width, 6, 0xFFD700).setOrigin(0, 0);

    // 제목 + 골드
    this.add.text(24, panelY + 12, 'UPGRADES', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '32px',
      color: '#FFD700',
    }).setOrigin(0, 0);

    // 작은 골드 카운터 (참고용, 우측 끝)
    this.goldText = this.add.text(GAME.width - 24, panelY + 16, '$0', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '28px',
      color: '#FFD700',
    }).setOrigin(1, 0);

    const margin = 16;
    const gap = 12;
    const btnW = Math.floor((GAME.width - margin * 2 - gap * 4) / 5);
    const btnH = panelH - 100;
    const startY = panelY + 70;

    this.upgradeButtons = {};
    UPGRADE_ORDER.forEach((name, i) => {
      const x = margin + i * (btnW + gap);
      this.upgradeButtons[name] = this._createUpgradeButton(name, x, startY, btnW, btnH);
    });
  }

  _createUpgradeButton(name, x, y, w, h) {
    const def = UPGRADES[name];
    const container = this.add.container(x, y);

    // 어두운 배경 + 외곽선
    const bg = this.add.rectangle(0, 0, w, h, 0x2a2a2a).setOrigin(0, 0)
      .setStrokeStyle(3, 0x555555);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this._tryBuy(name));

    // 아이콘 영역 (테두리 박스 + 진짜 아이콘 텍스처)
    const iconBoxBg = this.add.rectangle(w / 2, 56, 80, 80, 0x111111)
      .setStrokeStyle(2, 0x555555);

    const iconKey = ensureUpgradeIcon(this, name);
    const icon = this.add.image(w / 2, 56, iconKey);
    icon.setScale(0.95);

    const nameText = this.add.text(w / 2, 110, def.name, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    const levelText = this.add.text(w / 2, 150, `Lv 1/${def.maxLevel}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);

    const costText = this.add.text(w / 2, h - 50, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    container.add([bg, iconBoxBg, icon, nameText, levelText, costText]);
    container.bg = bg;
    container.levelText = levelText;
    container.costText = costText;
    container.name = name;

    this._updateButtonVisual(container);
    return container;
  }

  _tryBuy(name) {
    if (this.upgradeSystem.buy(name)) {
      const btn = this.upgradeButtons[name];
      this.tweens.add({
        targets: btn.bg,
        scale: { from: 1.05, to: 1.0 },
        duration: 200,
      });
    }
  }

  _updateButtonVisual(btn) {
    const def = UPGRADES[btn.name];
    const level = gameState.upgrades[btn.name];
    const cost = this.upgradeSystem.nextCost(btn.name);
    const canBuy = this.upgradeSystem.canBuy(btn.name);

    btn.levelText.setText(`Lv ${level}/${def.maxLevel}`);

    if (cost === null) {
      btn.costText.setText('MAX');
      btn.costText.setColor('#FFD700');
      btn.bg.setStrokeStyle(3, 0xFFD700);
    } else {
      btn.costText.setText(`$${cost.toLocaleString()}`);
      btn.costText.setColor(canBuy ? '#4caf50' : '#777777');
      btn.bg.setStrokeStyle(3, canBuy ? 0x4caf50 : 0x555555);
    }
  }

  _wireEvents() {
    gameState.on('depth', (km) => {
      this.depthText.setText(`Depth: ${km.toFixed(1)} km`);
      const layer = this.biomeManager.getLayerAt(Math.max(0, km));
      const short = layer.name.split(' ')[0];
      this.biomeText.setText(`${layer.biomeName} - Layer ${short}`);
    });

    gameState.on('gold', (g) => {
      this.goldText.setText(`$${g.toLocaleString()}`);
      for (const btn of Object.values(this.upgradeButtons)) {
        this._updateButtonVisual(btn);
      }
    });

    gameState.on('upgrade', () => {
      for (const btn of Object.values(this.upgradeButtons)) {
        this._updateButtonVisual(btn);
      }
    });

    gameState.on('ore', ({ oreId, total }) => {
      const item = this.inventoryItems[oreId];
      if (!item) return;
      item.count.setText(String(total));
      item.icon.setAlpha(1.0);  // 한 번이라도 캐면 풀 컬러
      // 잠깐 확대 애니메이션
      this.tweens.add({
        targets: item.icon,
        scale: { from: (56 / GAME.tileSize) * 1.3, to: (56 / GAME.tileSize) },
        duration: 240,
        ease: 'Back.easeOut',
      });
    });
  }
}
