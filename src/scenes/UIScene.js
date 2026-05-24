import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { ORES, ORE_IDS } from '../config/ores.js';
import { gameState } from '../systems/GameState.js';
import { ensureGemTexture } from '../objects/TileArt.js';

const INVENTORY_X = 6;
const INVENTORY_W = 96;
const INVENTORY_TOP = 110;

const BOTTOM_BAR_H = 100;
const BOTTOM_BAR_Y = GAME.height - BOTTOM_BAR_H;

// Phase 2에서 BossTracker로 대체. 우선 거리 산정용 데이터.
const BOSS_DEPTHS = [
  { id: 'mega_mole',    name: 'Mega Mole',     km: 9000 },
  { id: 'crystal_golem',name: 'Crystal Golem', km: 45000 },
  { id: 'abyss_kraken', name: 'Abyss Kraken',  km: 90000 },
  { id: 'ancient_treant',name:'Ancient Treant',km: 450000 },
  { id: 'magma_dragon', name: 'Magma Dragon',  km: 950000 },
];

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  init(data) {
    this.upgradeSystem = data.upgradeSystem;
    this.biomeManager = data.biomeManager;
    this.eventLines = [];
  }

  create() {
    this._buildTopHud();
    this._buildInventory();
    this._buildBottomBar();
    this._wireEvents();
  }

  // ── 상단: Depth + Biome 중앙, Gold 우측 작게 ──
  _buildTopHud() {
    this.add.rectangle(0, 0, GAME.width, 90, 0x000000, 0.55).setOrigin(0, 0);

    this.depthText = this.add.text(GAME.width / 2, 8, 'Depth: 0.0 km', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '44px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.biomeText = this.add.text(GAME.width / 2, 58, 'Earth - Layer 1-1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#cccccc',
    }).setOrigin(0.5, 0);

    // Gold (작게, 우측 상단)
    this.goldText = this.add.text(GAME.width - 18, 24, '0 G', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '26px',
      color: '#FFD700',
    }).setOrigin(1, 0);
  }

  // ── 좌측 광물 인벤토리 (12종) ──
  _buildInventory() {
    const x = INVENTORY_X;
    const y = INVENTORY_TOP;
    const w = INVENTORY_W;
    // 사용 가능 높이 안에 12개를 균등 배치
    const available = BOTTOM_BAR_Y - INVENTORY_TOP - 20;
    const itemH = Math.floor(available / ORE_IDS.length);
    const iconSize = Math.min(58, itemH - 22);
    const totalH = ORE_IDS.length * itemH + 16;

    this.add.rectangle(x, y, w, totalH, 0x000000, 0.55).setOrigin(0, 0)
      .setStrokeStyle(2, 0xFFD700, 0.4);

    this.inventoryItems = {};
    ORE_IDS.forEach((id, i) => {
      const cy_ = y + 8 + i * itemH + itemH / 2;

      // 어두운 박스 배경
      this.add.rectangle(x + w / 2, cy_ - 8, iconSize + 4, iconSize + 4, 0x1a1a1a, 0.7)
        .setStrokeStyle(1, 0x444444, 0.6);

      const gemKey = ensureGemTexture(this, id);
      const icon = this.add.image(x + w / 2, cy_ - 8, gemKey);
      icon.setScale(iconSize / GAME.tileSize);
      icon.setAlpha(0.3);

      const count = this.add.text(x + w / 2, cy_ + iconSize / 2 - 4, '0', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '18px',
        color: '#FFD700',
      }).setOrigin(0.5, 0);

      this.inventoryItems[id] = { icon, count, baseScale: iconSize / GAME.tileSize };
    });
  }

  // ── 하단 바: 이벤트 피드 (좌) + Next Boss (우) ──
  _buildBottomBar() {
    this.add.rectangle(0, BOTTOM_BAR_Y, GAME.width, BOTTOM_BAR_H, 0x000000, 0.6).setOrigin(0, 0);
    this.add.rectangle(0, BOTTOM_BAR_Y, GAME.width, 3, 0xFFD700).setOrigin(0, 0);

    // 좌측: 최근 이벤트 텍스트 (최대 2줄)
    this.eventText1 = this.add.text(20, BOTTOM_BAR_Y + 14, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    });
    this.eventText2 = this.add.text(20, BOTTOM_BAR_Y + 50, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#bbbbbb',
    });

    // 우측: 다음 보스 정보
    this.nextBossText = this.add.text(GAME.width - 20, BOTTOM_BAR_Y + 14, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#FF5252',
    }).setOrigin(1, 0);
    this.bossDistanceText = this.add.text(GAME.width - 20, BOTTOM_BAR_Y + 50, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#FFAB91',
    }).setOrigin(1, 0);
  }

  // ── 이벤트 피드 ──
  _pushEvent(title, sub = '') {
    this.eventLines.push({ title, sub });
    if (this.eventLines.length > 2) this.eventLines.shift();
    this._refreshEventText();
  }

  _refreshEventText() {
    const [first, second] = this.eventLines;
    this.eventText1.setText(first?.title ?? '');
    this.eventText2.setText(first?.sub ?? second?.title ?? '');
  }

  _updateNextBoss(km) {
    const next = BOSS_DEPTHS.find(b => b.km > km);
    if (!next) {
      this.nextBossText.setText('All bosses cleared');
      this.bossDistanceText.setText('');
      return;
    }
    const dist = next.km - km;
    this.nextBossText.setText(`Next: ${next.name}`);
    this.bossDistanceText.setText(`${dist.toFixed(0)} km away`);
  }

  _wireEvents() {
    gameState.on('depth', (km) => {
      this.depthText.setText(`Depth: ${km.toFixed(1)} km`);
      const layer = this.biomeManager.getLayerAt(Math.max(0, km));
      const short = layer.name.split(' ')[0];
      this.biomeText.setText(`${layer.biomeName} - Layer ${short}`);
      this._updateNextBoss(km);
    });

    gameState.on('gold', (g) => {
      this.goldText.setText(`${g.toLocaleString()} G`);
    });

    gameState.on('upgrade', ({ name, level }) => {
      this._pushEvent(`Upgrade: ${name} Lv ${level}`, '');
    });

    gameState.on('ore', ({ oreId, total }) => {
      const item = this.inventoryItems[oreId];
      if (!item) return;
      item.count.setText(String(total));
      item.icon.setAlpha(1.0);
      this.tweens.add({
        targets: item.icon,
        scale: { from: item.baseScale * 1.3, to: item.baseScale },
        duration: 240,
        ease: 'Back.easeOut',
      });
      // 희귀 광물은 이벤트 피드에도 띄움
      const ore = ORES[oreId];
      if (ore.value >= 400) {
        this._pushEvent(`+${ore.name}!`, `+${ore.value} G`);
      }
    });
  }
}
