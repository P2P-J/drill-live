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

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  init(data) {
    this.upgradeSystem = data.upgradeSystem;
    this.biomeManager = data.biomeManager;
    this.buffSystem = data.buffSystem;
    this.triggerSystem = data.triggerSystem;
    this.eventLines = [];
    this.buffIndicators = new Map();
  }

  create() {
    this._buildTopHud();
    this._buildInventory();
    this._buildBottomBar();
    this._buildStatsPanel();
    this._buildBuffArea();
    this._buildAnnouncement();
    this._wireEvents();
    this._refreshStats();
  }

  // 우측 상단 — 드릴 스펙(파워/범위/엔진) + 현재 속도 배율(버프 포함)
  _buildStatsPanel() {
    const w = 270, h = 142;
    const x = GAME.width - w - 12;
    const y = 100;
    const bg = this.add.rectangle(x, y, w, h, 0x000000, 0.65).setOrigin(0, 0).setStrokeStyle(2, 0xFFD700, 0.65);
    const title = this.add.text(x + w / 2, y + 4, 'DRILL STATS', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '14px', color: '#FFD700',
    }).setOrigin(0.5, 0);

    // 행별 라벨/값/Lv바
    const rowY = (i) => y + 26 + i * 26;
    const rowBgY = (i) => rowY(i) + 16;
    const ROW_BAR_W = w - 24;
    const ROW_BAR_H = 5;

    this._statRows = [];

    const addRow = (i, key, labelText, maxLv, fillColor) => {
      const label = this.add.text(x + 12, rowY(i), labelText, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '15px', color: '#FFFFFF',
      });
      const value = this.add.text(x + w - 12, rowY(i), `Lv 1/${maxLv}`, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '15px', color: '#FFD54F',
      }).setOrigin(1, 0);
      // 빈 바 + 채움 바
      const barBg = this.add.rectangle(x + 12, rowBgY(i), ROW_BAR_W, ROW_BAR_H, 0x222222).setOrigin(0, 0);
      const barFill = this.add.rectangle(x + 12, rowBgY(i), ROW_BAR_W, ROW_BAR_H, fillColor).setOrigin(0, 0);
      barFill.scaleX = 1 / maxLv;
      this._statRows.push({ key, label, value, barFill, maxLv });
    };

    addRow(0, 'drillPower', 'POWER',  5, 0x4CAF50);
    addRow(1, 'drillRange', 'RANGE',  3, 0xFF9800);
    addRow(2, 'engine',     'ENGINE', 3, 0x03A9F4);

    // SPEED — 누적 효과 (업그레이드 × 버프). 진행바 없이 텍스트만.
    this.statSpeedLabel = this.add.text(x + 12, rowY(3) + 8, 'SPEED', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '14px', color: '#FFFFFF',
    });
    this.statSpeedValue = this.add.text(x + w - 12, rowY(3) + 8, '×1.0', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '16px', color: '#FFEB3B',
    }).setOrigin(1, 0);
  }

  _refreshStats() {
    if (!this.upgradeSystem) return;
    for (const row of this._statRows ?? []) {
      const lv = this.upgradeSystem.getLevel(row.key);
      // POWER 행은 드릴 이름 표시 (Wood Drill / Stone Drill / Iron Drill / Gold Drill / Diamond Drill)
      if (row.key === 'drillPower') {
        row.value.setText(this.upgradeSystem.getDrillName());
      } else {
        row.value.setText(`Lv ${lv}/${row.maxLv}`);
      }
      row.barFill.scaleX = Math.min(1, lv / row.maxLv);
      // 임시 업그레이드 활성 시 잔여시간 비율로 라벨 색 강조 (임시 = 30초 카운트다운)
      const tempFrac = this.upgradeSystem.remainingFrac(row.key);
      row.label.setColor(tempFrac > 0 ? '#FFEB3B' : '#FFFFFF');
    }
    // SPEED = drillPower 누적 × drillPowerUp 버프 (= 드릴 속도 실효 배율)
    const baseMult = this.upgradeSystem.getDrillSpeedMult?.() ?? 1.0;
    let buffMult = 1.0;
    const dpu = this.buffSystem?.get?.('drillPowerUp');
    if (dpu) buffMult *= dpu.params.mult ?? 1.0;
    const effective = baseMult * buffMult;
    this.statSpeedValue.setText(`×${effective.toFixed(2)}`);
    // 버프 또는 임시 업그레이드 활성 시 빨간 강조
    const anyActive = buffMult > 1.001 || this.upgradeSystem.getLevel('drillPower') > 1;
    this.statSpeedValue.setColor(anyActive ? '#FF5252' : '#FFEB3B');
  }

  _buildAnnouncement() {
    // 가운데 큰 텍스트 (후원/채팅 들어올 때 잠시 표시)
    this.announceContainer = this.add.container(GAME.width / 2, 280);
    this.announceContainer.setDepth(100);
    this.announceContainer.setVisible(false);

    this.announceTrigger = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '72px',
      color: '#FFEB3B',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5, 0.5);

    this.announceDonor = this.add.text(0, 60, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    this.announceContainer.add([this.announceTrigger, this.announceDonor]);
  }

  showAnnouncement(triggerLabel, donor, color = '#FFEB3B') {
    this.announceTrigger.setText(triggerLabel);
    this.announceTrigger.setColor(color);
    this.announceDonor.setText(donor ? `from ${donor}` : '');

    this.announceContainer.setVisible(true);
    this.announceContainer.setAlpha(0);
    this.announceContainer.setScale(0.6);

    this.tweens.killTweensOf(this.announceContainer);
    this.tweens.add({
      targets: this.announceContainer,
      alpha: 1,
      scale: 1.0,
      duration: 280,
      ease: 'Back.easeOut',
    });
    // 2.5초 후 페이드 아웃
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: this.announceContainer,
        alpha: 0,
        duration: 400,
        onComplete: () => this.announceContainer.setVisible(false),
      });
    });
  }

  update() {
    // 스탯 패널 — 버프 영향 있는 SPEED 항목 위해 매 프레임 가벼운 갱신
    this._refreshStats();

    // 버프 잔여시간 갱신
    for (const [id, ind] of this.buffIndicators) {
      const remainMs = this.buffSystem?.remainingMs(id) ?? 0;
      if (remainMs <= 0) {
        ind.container.destroy();
        this.buffIndicators.delete(id);
        continue;
      }
      const remainS = (remainMs / 1000).toFixed(1);
      ind.timeText.setText(`${remainS}s`);
      const frac = this.buffSystem.remainingFrac(id);
      ind.bar.scaleX = frac;
    }
  }

  _buildBuffArea() {
    // 버프(긍정) 우측 — 스탯 패널 아래, 디버프(부정) 좌측 — 인벤토리 옆
    this.buffArea   = { x: GAME.width - 290, y: 260, w: 270 };
    this.debuffArea = { x: 116,              y: 260, w: 300 };
  }

  _addBuffIndicator(id, label, color, isDebuff = false) {
    const area = isDebuff ? this.debuffArea : this.buffArea;
    const sameAreaCount = [...this.buffIndicators.values()]
      .filter((b) => b.isDebuff === isDebuff).length;
    const x = area.x;
    const y = area.y + sameAreaCount * 72;

    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, area.w, 62, 0x000000, 0.88).setOrigin(0, 0)
      .setStrokeStyle(3, color);
    const labelText = this.add.text(12, 8, (isDebuff ? '⚠ ' : '') + label, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '22px',
      color: isDebuff ? '#FF5252' : '#ffffff',
    });
    const timeText = this.add.text(area.w - 12, 8, '0.0s', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '22px',
      color: isDebuff ? '#FFCDD2' : '#FFD700',
    }).setOrigin(1, 0);
    const bar = this.add.rectangle(0, 56, area.w, 6, color).setOrigin(0, 0);

    container.add([bg, labelText, timeText, bar]);
    this.buffIndicators.set(id, { container, labelText, timeText, bar, isDebuff });
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

  // ── 하단 바: 이벤트 피드 (좌) ──
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

  _wireEvents() {
    gameState.on('depth', (km) => {
      this.depthText.setText(`Depth: ${km.toFixed(0)} km`);
      const layer = this.biomeManager.getLayerAt(Math.max(0, km));
      const short = layer.name.split(' ')[0];
      this.biomeText.setText(`${layer.biomeName} - Layer ${short}`);
    });

    gameState.on('gold', (g) => {
      this.goldText.setText(`${g.toLocaleString()} G`);
    });

    // 채팅 임시 업그레이드 — 시청자가 골드 차감해서 30초 buff 발동
    if (this.upgradeSystem) {
      this.upgradeSystem.on('upgrade', ({ name, level, cost }) => {
        this._pushEvent(`${name} → Lv ${level}!`, `-${cost.toLocaleString()} G (30s)`);
      });
      this.upgradeSystem.on('revert', ({ name }) => {
        this._pushEvent(`${name} reverted`, 'to Lv 1');
      });
    }

    // 버프 적용 시 인디케이터 추가 (버프=우측 / 디버프=좌측)
    if (this.buffSystem) {
      this.buffSystem.on('apply', ({ id, params }) => {
        if (this.buffIndicators.has(id)) return;
        const label = params.label ?? id;
        const isDebuff = !!params.isDebuff;
        let color;
        if (isDebuff)                       color = 0xF44336;
        else if (id === 'drillRangeUp')     color = 0xFF9800;
        else if (id === 'drillPowerUp')     color = 0x4CAF50;
        else                                color = 0xFFEB3B;
        this._addBuffIndicator(id, label, color, isDebuff);
      });
    }

    // 트리거 발동 시 가운데 announcement + 이벤트 피드
    if (this.triggerSystem) {
      this.triggerSystem.on('fire', ({ triggerId, def, donor }) => {
        const colorHex = '#' + def.color.toString(16).padStart(6, '0');
        this.showAnnouncement(def.label, donor, colorHex);
        this._pushEvent(`${def.label}!`, `from ${donor}`);
      });
    }

    // 보스 이벤트 — 경고 / 등장 / 처치 / 실패
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
