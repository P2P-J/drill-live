import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { ORES, ORE_IDS } from '../config/ores.js';
import { gameState } from '../systems/GameState.js';
import { ensureGemTexture } from '../objects/TileArt.js';
import { OverlaySystem } from '../systems/OverlaySystem.js';

// 인벤토리 — 우측 stats 패널 바로 아래 3×4 그리드로 통합 표시
// (위치/폭은 _buildInventory()에서 stats 패널과 같은 영역 사용)

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
    this.remoteTrigger = data.remoteTrigger;
    this.eventLines = [];
    this.buffIndicators = new Map();
    this.likeItems = new Map();
  }

  create() {
    this._buildTopHud();
    this._buildBiomeTracker();  // 좌측 세로 6개 원형
    this._buildInventory();
    this._buildBottomBar();
    this._buildStatsPanel();
    this._buildBuffArea();
    this._buildAnnouncement();
    this._buildOverlay();
    this._wireEvents();
    this._refreshStats();

    this.overlaySystem = new OverlaySystem(this);
    if (this.remoteTrigger) {
      this.remoteTrigger.on('overlay', (payload) => this.overlaySystem.handle(payload));
    }
  }

  // 우측 — 둥근 모서리 DRILL 패널 (게임 톤)
  _buildStatsPanel() {
    const w = 320, h = 280;
    const x = GAME.width - w - 16;
    const y = 160;
    const radius = 16;

    // 둥근 박스
    const panel = this.add.graphics();
    panel.fillStyle(0x12172A, 0.92);
    panel.fillRoundedRect(x, y, w, h, radius);
    panel.lineStyle(2, 0x2A3045, 1.0);
    panel.strokeRoundedRect(x, y, w, h, radius);

    // 헤더 — 알약 모양 [⚒️ DRILL]
    const headerPillX = x + 16;
    const headerPillY = y + 14;
    const headerPillW = 116;
    const headerPillH = 36;
    const headerPill = this.add.graphics();
    headerPill.fillStyle(0xFFD700, 1.0);
    headerPill.fillRoundedRect(headerPillX, headerPillY, headerPillW, headerPillH, headerPillH / 2);
    this.add.text(headerPillX + 18, headerPillY + headerPillH / 2 + 3, '⚒️', {
      fontSize: '20px', padding: { top: 2, bottom: 2 },
    }).setOrigin(0.5, 0.5);
    this.add.text(headerPillX + 36, headerPillY + headerPillH / 2, 'DRILL', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px', color: '#12172A',
    }).setOrigin(0, 0.5);

    // 행 — 한 row 50px
    const rowH = 50;
    const firstRowY = y + 70;
    const rowY = (i) => firstRowY + i * rowH;
    const barX = x + 16;
    const barW = w - 32;
    const barH_ = 8;

    this._statRows = [];

    const addRow = (i, key, labelText, maxLv, fillColor) => {
      const ry = rowY(i);
      const label = this.add.text(x + 16, ry, labelText, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '19px', color: '#8C95A3',
      });
      const value = this.add.text(x + w - 16, ry, `1 / ${maxLv}`, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '22px', color: '#FFFFFF',
      }).setOrigin(1, 0);
      // 진행바
      const barY = ry + 30;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x2A3045, 1.0);
      barBg.fillRoundedRect(barX, barY, barW, barH_, barH_ / 2);
      const barFill = this.add.graphics();
      const drawFill = (frac) => {
        barFill.clear();
        barFill.fillStyle(fillColor, 1.0);
        const fw = Math.max(barH_, barW * Math.max(0, Math.min(1, frac)));
        barFill.fillRoundedRect(barX, barY, fw, barH_, barH_ / 2);
      };
      drawFill(1 / maxLv);
      this._statRows.push({ key, label, value, barFill, drawFill, maxLv });
    };

    addRow(0, 'drillPower', 'POWER',  5, 0xE91E63);
    addRow(1, 'drillRange', 'RANGE',  3, 0xFF8A65);
    addRow(2, 'engine',     'ENGINE', 3, 0x4FC3F7);

    // SPEED — 가장 강조
    const speedY = rowY(3) + 4;
    this.statSpeedLabel = this.add.text(x + 16, speedY, 'SPEED', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '19px', color: '#8C95A3',
    });
    this.statSpeedValue = this.add.text(x + w - 16, speedY, '×1.0', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '26px', color: '#4CD964',
    }).setOrigin(1, 0);
  }

  _refreshStats() {
    if (!this.upgradeSystem) return;
    for (const row of this._statRows ?? []) {
      const lv = this.upgradeSystem.getLevel(row.key);
      if (row.key === 'drillPower') {
        row.value.setText(this.upgradeSystem.getDrillName());
      } else {
        row.value.setText(`${lv} / ${row.maxLv}`);
      }
      row.drawFill(lv / row.maxLv);
      // 임시 업그레이드 활성 시 라벨 색 강조
      const tempFrac = this.upgradeSystem.remainingFrac(row.key);
      row.label.setColor(tempFrac > 0 ? '#FFD700' : '#8C95A3');
    }
    // SPEED = drillPower 누적 × drillPowerUp 버프
    const baseMult = this.upgradeSystem.getDrillSpeedMult?.() ?? 1.0;
    let buffMult = 1.0;
    const dpu = this.buffSystem?.get?.('drillPowerUp');
    if (dpu) buffMult *= dpu.params.mult ?? 1.0;
    const effective = baseMult * buffMult;
    this.statSpeedValue.setText(`×${effective.toFixed(2)}`);
    const anyActive = buffMult > 1.001 || this.upgradeSystem.getLevel('drillPower') > 1;
    this.statSpeedValue.setColor(anyActive ? '#FF5252' : '#4CD964');
  }

  _buildAnnouncement() {
    // 가운데 큰 텍스트 (후원/채팅 들어올 때 잠시 표시)
    // ORES 패널 아래, 게임 영역 위쪽 빈 공간 (사용자 빨간 박스 영역)
    this.announceContainer = this.add.container(GAME.width / 2, 600);
    this.announceContainer.setDepth(100);
    this.announceContainer.setVisible(false);

    this.announceTrigger = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '88px',
      color: '#FFEB3B',
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5, 0.5);

    this.announceDonor = this.add.text(0, 80, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '64px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5, 0.5);

    this.announceContainer.add([this.announceTrigger, this.announceDonor]);
  }

  showAnnouncement(triggerLabel, donor, color = '#FFEB3B', holdMs = 4000) {
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
    this.time.delayedCall(holdMs, () => {
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
    // DRILL 패널 아래 (사용자 파란 박스) — buff/debuff 한 영역 공유, 자동 세로 쌓임
    const sharedBuffArea = { x: 744, y: 460, w: 320 };
    this.buffArea = sharedBuffArea;
    this.debuffArea = sharedBuffArea;
  }

  _addBuffIndicator(id, label, color, isDebuff = false) {
    const area = isDebuff ? this.debuffArea : this.buffArea;
    // 같은 area 안에서 isDebuff 구분 없이 위에서부터 쌓이게
    const sameAreaCount = [...this.buffIndicators.values()]
      .filter((b) => b._areaRef === area).length;
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
    this.buffIndicators.set(id, { container, labelText, timeText, bar, isDebuff, _areaRef: area });
  }

  // ── 상단 HUD: 좌측 DEPTH | 가운데 알약 바이옴 | 우측 GOLD + 진행도 막대 ──
  _buildTopHud() {
    const barH = 150;
    // 어두운 배경
    this.add.rectangle(0, 0, GAME.width, barH, 0x0A0E1A, 0.92).setOrigin(0, 0);

    // ── 좌측: DEPTH 라벨 + 값 ──
    this.add.text(28, 22, 'DEPTH', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '18px',
      color: '#8C95A3',
    }).setOrigin(0, 0);
    this.depthText = this.add.text(28, 44, '0 km', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '40px',
      color: '#FFFFFF',
    }).setOrigin(0, 0);

    // ── 우측: GOLD 라벨 + 값 ──
    this.add.text(GAME.width - 28, 22, 'GOLD', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '18px',
      color: '#8C95A3',
    }).setOrigin(1, 0);
    this.goldText = this.add.text(GAME.width - 28, 44, '0', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '40px',
      color: '#FFD700',
    }).setOrigin(1, 0);

    // ── 가운데: 알약 모양 [🌍 EARTH] ──
    this._biomeDefs = [
      { id: 'earth',    emoji: '🌍', name: 'EARTH',   shortLabel: 'E' },
      { id: 'crystal',  emoji: '💎', name: 'CRYSTAL', shortLabel: 'C' },
      { id: 'abyssal',  emoji: '🌊', name: 'ABYSS',   shortLabel: 'A' },
      { id: 'forest',   emoji: '🌲', name: 'FOREST',  shortLabel: 'F' },
      { id: 'magma',    emoji: '🔥', name: 'MAGMA',   shortLabel: 'M' },
      { id: 'void',     emoji: '🌌', name: 'VOID',    shortLabel: 'V' },
    ];

    const pillW = 240;
    const pillH = 60;
    const pillX = (GAME.width - pillW) / 2;
    const pillY = 30;
    this._biomePillBg = this.add.graphics();
    this._drawPill(this._biomePillBg, pillX, pillY, pillW, pillH, 0x1A1F2E, 1.0, 0xFFD700, 3);
    this._biomePillEmoji = this.add.text(pillX + 38, pillY + pillH / 2 + 5, '🌍', {
      fontSize: '34px',
      padding: { top: 4, bottom: 4 },
    }).setOrigin(0.5, 0.5);
    this.biomeText = this.add.text(pillX + 80, pillY + pillH / 2, 'EARTH', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#FFFFFF',
    }).setOrigin(0, 0.5);

    // ── 진행도 막대 (상단 HUD 아래) ──
    const trackY = 110;
    const trackX = 32;
    const trackW = GAME.width - 64;
    const trackH = 14;
    this._progressBg = this.add.graphics();
    this._drawPill(this._progressBg, trackX, trackY, trackW, trackH, 0x1A1F2E, 1.0, 0x333A4A, 1);
    this._progressFill = this.add.graphics();
    this.progressInfo = { x: trackX, y: trackY, w: trackW, h: trackH };

    // 좌 "EARTH" 우 "NEXT →" 라벨
    this.progressLeftText = this.add.text(trackX + 4, trackY - 18, 'EARTH', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '12px',
      color: '#8C95A3',
    }).setOrigin(0, 0);
    this.progressRightText = this.add.text(trackX + trackW - 4, trackY - 18, 'NEXT →', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '12px',
      color: '#8C95A3',
    }).setOrigin(1, 0);
  }

  // 좌측 세로 바이옴 트래커 — 6개 원형 아이콘 (큰 사이즈, 라벨 아래, 점선 연결)
  _buildBiomeTracker() {
    const trackerX = 50;
    const trackerStartY = 220;
    const iconRadius = 30;
    const iconSpacing = 260;  // 길이 2배 (이전 110)

    // 원과 원 사이 세로 점선 연결
    const dotsG = this.add.graphics();
    dotsG.fillStyle(0x444A5A, 1.0);
    for (let i = 0; i < this._biomeDefs.length - 1; i++) {
      const cy1 = trackerStartY + i * iconSpacing;
      const cy2 = trackerStartY + (i + 1) * iconSpacing;
      // 라벨이 원 아래 ~30px 차지하니까 그 아래부터 다음 원 위까지 점선
      const startY = cy1 + iconRadius + 36;
      const endY = cy2 - iconRadius - 8;
      const dotR = 3;
      const dotGap = 14;
      for (let y = startY; y < endY; y += dotGap) {
        dotsG.fillCircle(trackerX, y, dotR);
      }
    }

    this._biomeTrackerIcons = this._biomeDefs.map((b, i) => {
      const cy = trackerStartY + i * iconSpacing;
      const dashRing = this.add.graphics().setVisible(false);
      const bgCircle = this.add.graphics();
      bgCircle.fillStyle(0x1A1F2E, 1.0);
      bgCircle.fillCircle(trackerX, cy, iconRadius);
      bgCircle.lineStyle(2, 0x333A4A, 1.0);
      bgCircle.strokeCircle(trackerX, cy, iconRadius);
      // 이모지 — anchor y를 원 center보다 +8 아래에 두고 origin 정중앙
      // (Phaser text의 이모지 bbox가 위쪽에 치우쳐 그려지는 걸 anchor 이동으로 보정)
      const emoji = this.add.text(trackerX, cy + 5, b.emoji, {
        fontSize: '40px',
        padding: { top: 4, bottom: 4 },
      }).setOrigin(0.5, 0.5).setAlpha(0.4);
      // 라벨 — 이모지 아래 풀 이름
      const label = this.add.text(trackerX, cy + iconRadius + 12, b.name, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '16px',
        color: '#8C95A3',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5, 0);

      const setActive = (active) => {
        if (active) {
          dashRing.clear();
          dashRing.lineStyle(4, 0xFFD700, 1.0);
          // 점선 outer ring — 16조각
          const segments = 16;
          for (let s = 0; s < segments; s++) {
            if (s % 2 === 0) {
              const a0 = (s / segments) * Math.PI * 2;
              const a1 = ((s + 1) / segments) * Math.PI * 2;
              dashRing.beginPath();
              dashRing.arc(trackerX, cy, iconRadius + 8, a0, a1, false);
              dashRing.strokePath();
            }
          }
          dashRing.setVisible(true);
          bgCircle.clear();
          bgCircle.fillStyle(0xFFD700, 0.22);
          bgCircle.fillCircle(trackerX, cy, iconRadius);
          bgCircle.lineStyle(3, 0xFFD700, 1.0);
          bgCircle.strokeCircle(trackerX, cy, iconRadius);
          emoji.setAlpha(1.0);
          label.setColor('#FFD700');
        } else {
          dashRing.setVisible(false);
          bgCircle.clear();
          bgCircle.fillStyle(0x1A1F2E, 1.0);
          bgCircle.fillCircle(trackerX, cy, iconRadius);
          bgCircle.lineStyle(2, 0x333A4A, 1.0);
          bgCircle.strokeCircle(trackerX, cy, iconRadius);
          emoji.setAlpha(0.4);
          label.setColor('#8C95A3');
        }
      };

      return { id: b.id, name: b.name, setActive };
    });
  }

  // 알약 모양 (rounded full-radius rectangle)
  _drawPill(graphics, x, y, w, h, fillColor, fillAlpha, strokeColor, strokeWidth) {
    const r = h / 2;
    graphics.clear();
    if (fillColor !== undefined) {
      graphics.fillStyle(fillColor, fillAlpha ?? 1.0);
      graphics.fillRoundedRect(x, y, w, h, r);
    }
    if (strokeColor !== undefined && strokeWidth) {
      graphics.lineStyle(strokeWidth, strokeColor, 1.0);
      graphics.strokeRoundedRect(x, y, w, h, r);
    }
  }

  _highlightBiome(biomeId, km) {
    const cur = this._biomeDefs.find((b) => b.id === biomeId);
    if (!cur) return;

    // 가운데 알약 텍스트/이모지 갱신
    this._biomePillEmoji.setText(cur.emoji);
    this.biomeText.setText(cur.name);

    // 진행도 막대 갱신
    const biome = this.biomeManager.getBiomeAt(km);
    if (biome) {
      const span = biome.endKm - biome.startKm;
      const progress = span > 0 ? Math.max(0, Math.min(1, (km - biome.startKm) / span)) : 0;
      const { x, y, w, h } = this.progressInfo;
      this._progressFill.clear();
      this._progressFill.fillStyle(0xFFD700, 1.0);
      this._progressFill.fillRoundedRect(x, y, Math.max(h, w * progress), h, h / 2);
      // 좌측 라벨: 현재 바이옴 이름
      this.progressLeftText.setText(cur.name);
    }

    // 좌측 세로 바이옴 트래커 강조 (Task 2에서 구현)
    if (this._biomeTrackerIcons) {
      for (const icon of this._biomeTrackerIcons) {
        const active = icon.id === biomeId;
        icon.setActive(active);
      }
    }
  }

  // ── DRILL 패널 왼쪽: 둥근 ORES 패널, 6×2 가로 그리드 ──
  _buildInventory() {
    const cols = 6;
    const rows = 2;
    const panelW = 630;  // 좌측 바이옴 트래커 라벨 우측 끝(~90)까지 마진 ~14
    const panelH = 280;
    const drillW = 320;
    const drillRightMargin = 16;
    const x = GAME.width - drillW - drillRightMargin - 12 - panelW;
    const y = 160;  // DRILL과 같은 y
    const radius = 16;
    const cellW = panelW / cols;
    const headerH = 50;
    const gridH = panelH - headerH - 12;
    const cellH = gridH / rows;

    // 둥근 박스 배경
    const panel = this.add.graphics();
    panel.fillStyle(0x12172A, 0.92);
    panel.fillRoundedRect(x, y, panelW, panelH, radius);
    panel.lineStyle(2, 0x2A3045, 1.0);
    panel.strokeRoundedRect(x, y, panelW, panelH, radius);

    // 헤더 — 작은 알약 [💎 ORES]
    const hpX = x + 16, hpY = y + 12, hpW = 88, hpH = 28;
    const headerPill = this.add.graphics();
    headerPill.fillStyle(0xFFD700, 1.0);
    headerPill.fillRoundedRect(hpX, hpY, hpW, hpH, hpH / 2);
    this.add.text(hpX + 14, hpY + hpH / 2 + 3, '💎', {
      fontSize: '16px', padding: { top: 2, bottom: 2 },
    }).setOrigin(0.5, 0.5);
    this.add.text(hpX + 30, hpY + hpH / 2, 'ORES', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '14px', color: '#12172A',
    }).setOrigin(0, 0.5);

    const rarityColors = {
      common:    0x4A4F60,
      uncommon:  0x4CAF50,
      rare:      0x2196F3,
      epic:      0x9C27B0,
      legendary: 0xFF9800,
    };

    const iconSize = 36;
    const gridTop = y + headerH;
    this.inventoryItems = {};

    ORE_IDS.forEach((id, i) => {
      const ore = ORES[id];
      const rarityColor = rarityColors[ore.rarity] ?? 0x4A4F60;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = x + col * cellW + 6;
      const cellY = gridTop + row * cellH + 4;
      const cellInnerW = cellW - 12;
      const cellInnerH = cellH - 8;
      const cx = cellX + cellInnerW / 2;

      // 둥근 칸
      const cellG = this.add.graphics();
      cellG.fillStyle(0x1A1F2E, 0.95);
      cellG.fillRoundedRect(cellX, cellY, cellInnerW, cellInnerH, 8);
      cellG.lineStyle(2, rarityColor, 0.85);
      cellG.strokeRoundedRect(cellX, cellY, cellInnerW, cellInnerH, 8);

      // 아이콘 (상단)
      const gemKey = ensureGemTexture(this, id);
      const iconY = cellY + 22;
      const icon = this.add.image(cx, iconY, gemKey);
      const baseScale = iconSize / GAME.tileSize;
      icon.setScale(baseScale).setAlpha(0.35);

      // 이름 (가운데, 살짝 위로) — 흰색 + 검정 테두리
      const nameText = this.add.text(cx, cellY + cellInnerH / 2 + 2, ore.name, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '13px',
        color: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0);

      // 카운트 — bottom 정렬
      const count = this.add.text(cx, cellY + cellInnerH - 6, '0', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '22px',
        color: '#FFD700',
      }).setOrigin(0.5, 1.0);

      this.inventoryItems[id] = { icon, count, nameText, baseScale };
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

  _buildOverlay() {
    // 팝업 — ORES 패널 아래 빈 공간 (사용자 빨간 박스 영역)
    this.overlayPopup = this.add.container(GAME.width / 2, 600);
    this.overlayPopup.setDepth(99);
    this.overlayPopup.setVisible(false);
    this.overlayPopupText = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '52px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 10,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.overlayPopup.add(this.overlayPopupText);

    // LIKE 피드 — 인벤토리(우측 ~102px) 옆 x=120부터, BOTTOM_BAR 위에서 위로 쌓음
    this.overlayLikeAnchorX = 120;
    this.overlayLikeAnchorY = BOTTOM_BAR_Y - 16;
    this.overlayLikeRowH = 36;
  }

  // OverlaySystem이 호출 — 팝업 한 개 표시 (2.5초 후 done 통보)
  _renderPopup(text, _kind) {
    // 후원자 이름은 항상 흰색 + 검정 테두리 (가독성 최우선)
    this.overlayPopupText.setText(text);
    this.overlayPopupText.setColor('#FFFFFF');
    this.overlayPopup.setVisible(true);
    this.overlayPopup.setAlpha(0);
    this.overlayPopup.setScale(0.7);

    this.tweens.killTweensOf(this.overlayPopup);
    this.tweens.add({
      targets: this.overlayPopup, alpha: 1, scale: 1.0,
      duration: 220, ease: 'Back.easeOut',
    });
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: this.overlayPopup, alpha: 0,
        duration: 300,
        onComplete: () => {
          this.overlayPopup.setVisible(false);
          this.overlaySystem?.notifyPopupDone();
        },
      });
    });
  }

  // OverlaySystem이 호출 — LIKE 1건 추가 (4초 자체 fade)
  _renderLike(name) {
    const existing = this.likeItems.get(name);
    if (existing) existing.destroy();

    const c = this.add.container(this.overlayLikeAnchorX, this.overlayLikeAnchorY);
    c.setDepth(98);
    const txt = this.add.text(0, 0, `💗 ${name}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#FF80AB',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0, 1);
    c.add(txt);
    c.setAlpha(0);
    this.likeItems.set(name, c);

    this._restackLikeFeed();

    this.tweens.add({
      targets: c, alpha: 1, duration: 150, ease: 'Quad.easeOut',
    });
    this.time.delayedCall(4000, () => {
      if (!this.likeItems.has(name)) return;
      this.tweens.add({
        targets: c, alpha: 0, duration: 250,
        onComplete: () => {
          c.destroy();
          this.likeItems.delete(name);
          this.overlaySystem?.notifyLikeExpired(name);
          this._restackLikeFeed();
        },
      });
    });
  }

  // OverlaySystem이 호출 — 큐 초과로 강제 만료
  _expireLike(name) {
    const c = this.likeItems.get(name);
    if (!c) return;
    this.likeItems.delete(name);
    this.tweens.killTweensOf(c);
    this.tweens.add({
      targets: c, alpha: 0, duration: 200,
      onComplete: () => {
        c.destroy();
        this._restackLikeFeed();
      },
    });
  }

  _restackLikeFeed() {
    const entries = [...this.likeItems.entries()];
    const last = entries.length - 1;
    entries.forEach(([_name, c], i) => {
      const targetY = this.overlayLikeAnchorY - (last - i) * this.overlayLikeRowH;
      this.tweens.add({
        targets: c, y: targetY, duration: 120, ease: 'Quad.easeOut',
      });
    });
  }

  _wireEvents() {
    gameState.on('depth', (km) => {
      this.depthText.setText(`${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`);
      const safeKm = Math.max(0, km);
      const biome = this.biomeManager.getBiomeAt(safeKm);
      this._highlightBiome(biome?.id ?? 'earth', safeKm);
    });

    gameState.on('gold', (g) => {
      this.goldText.setText(g.toLocaleString());
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
        const colorHex = '#' + (def.color ?? 0xFFEB3B).toString(16).padStart(6, '0');
        const holdMs = def.announceMs ?? 4000;
        this.showAnnouncement(def.label, donor, colorHex, holdMs);
        this._pushEvent(`${def.label}!`, `from ${donor}`);
      });
    }

    // 보스 이벤트 — 경고 / 등장 / 처치 / 실패
    gameState.on('ore', ({ oreId, total }) => {
      const item = this.inventoryItems[oreId];
      if (!item) return;
      item.count.setText(String(total));
      item.icon.setAlpha(1.0);
      item.nameText?.setAlpha(1.0);
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
