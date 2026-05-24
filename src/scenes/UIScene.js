import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { UPGRADES, UPGRADE_ORDER } from '../config/upgrades.js';
import { gameState } from '../systems/GameState.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  init(data) {
    this.upgradeSystem = data.upgradeSystem;
    this.biomeManager = data.biomeManager;
  }

  create() {
    this._buildHud();
    this._buildUpgradePanel();
    this._wireEvents();
  }

  _buildHud() {
    // Top bar (y=0 to 130)
    this.add.rectangle(0, 0, GAME.width, 140, 0x000000, 0.55).setOrigin(0, 0);

    this.depthText = this.add.text(30, 18, 'Depth: 0.0 km', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '46px',
      color: '#ffffff',
    });

    this.goldText = this.add.text(GAME.width - 30, 18, 'Gold: 0', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '46px',
      color: '#FFD700',
    }).setOrigin(1, 0);

    this.biomeText = this.add.text(30, 80, 'Earth - Layer 1-1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#cccccc',
    });
  }

  _buildUpgradePanel() {
    const panelY = GAME.hudY;     // 1400
    const panelH = GAME.hudHeight; // 520

    this.add.rectangle(0, panelY, GAME.width, panelH, 0x1a1a1a, 0.97).setOrigin(0, 0);
    this.add.rectangle(0, panelY, GAME.width, 4, 0xFFD700).setOrigin(0, 0);

    this.add.text(GAME.width / 2, panelY + 16, 'UPGRADES', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '36px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);

    // 5 buttons in a row
    const margin = 16;
    const gap = 12;
    const btnW = Math.floor((GAME.width - margin * 2 - gap * 4) / 5);
    const btnH = panelH - 110;
    const startX = margin;
    const startY = panelY + 80;

    this.upgradeButtons = {};
    UPGRADE_ORDER.forEach((name, i) => {
      const x = startX + i * (btnW + gap);
      this.upgradeButtons[name] = this._createUpgradeButton(name, x, startY, btnW, btnH);
    });
  }

  _createUpgradeButton(name, x, y, w, h) {
    const def = UPGRADES[name];
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, w, h, 0x2a2a2a).setOrigin(0, 0)
      .setStrokeStyle(3, 0x555555);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this._tryBuy(name));

    // 아이콘 (단순 박스 + 글자, 추후 그래픽으로 교체)
    const iconColor = this._iconColor(name);
    const icon = this.add.rectangle(w / 2, 70, 90, 90, iconColor).setStrokeStyle(3, 0x000000);
    const iconLabel = this.add.text(w / 2, 70, def.name.charAt(0), {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '52px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    const nameText = this.add.text(w / 2, 140, def.name, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    const levelText = this.add.text(w / 2, 200, `Lv 1/${def.maxLevel}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);

    const costText = this.add.text(w / 2, h - 50, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    container.add([bg, icon, iconLabel, nameText, levelText, costText]);
    container.bg = bg;
    container.levelText = levelText;
    container.costText = costText;
    container.name = name;

    this._updateButtonVisual(container);
    return container;
  }

  _iconColor(name) {
    return {
      drillPower: 0xFFC107,
      drillRange: 0xFF9800,
      engine:     0x03A9F4,
      fuelTank:   0x9E9E9E,
      cargo:      0x795548,
    }[name] ?? 0x666666;
  }

  _tryBuy(name) {
    if (this.upgradeSystem.buy(name)) {
      const btn = this.upgradeButtons[name];
      // Green flash
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
      this.goldText.setText(`Gold: ${g.toLocaleString()}`);
      for (const btn of Object.values(this.upgradeButtons)) {
        this._updateButtonVisual(btn);
      }
    });

    gameState.on('upgrade', () => {
      for (const btn of Object.values(this.upgradeButtons)) {
        this._updateButtonVisual(btn);
      }
    });
  }
}
