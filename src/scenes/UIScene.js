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

  // 우측 상단 — 드릴 스펙(파워/범위/엔진) + 현재 속도 배율(버프 포함)
  _buildStatsPanel() {
    const w = 300, h = 220;
    const x = GAME.width - w - 12;
    const y = 270;
    this.add.rectangle(x, y, w, h, 0x000000, 0.72).setOrigin(0, 0).setStrokeStyle(3, 0xFFD700, 0.8);

    // 타이틀
    this.add.text(x + w / 2, y + 6, '⛏️ DRILL STATS', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px', color: '#FFD700',
    }).setOrigin(0.5, 0);

    // 행 — 한 row 높이 40
    const rowH = 40;
    const firstRowY = y + 38;
    const rowY = (i) => firstRowY + i * rowH;
    const ROW_BAR_W = w - 28;
    const ROW_BAR_H = 8;

    this._statRows = [];

    const addRow = (i, key, emoji, labelText, maxLv, fillColor) => {
      const ry = rowY(i);
      // 이모지 + 라벨 (좌측)
      const label = this.add.text(x + 14, ry, `${emoji} ${labelText}`, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px', color: '#FFFFFF',
      });
      // Lv / max (우측)
      const value = this.add.text(x + w - 14, ry, `Lv 1 / ${maxLv}`, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px', color: '#FFD54F',
      }).setOrigin(1, 0);
      // 진행바 (라벨 아래)
      const barY = ry + 22;
      this.add.rectangle(x + 14, barY, ROW_BAR_W, ROW_BAR_H, 0x222222).setOrigin(0, 0);
      const barFill = this.add.rectangle(x + 14, barY, ROW_BAR_W, ROW_BAR_H, fillColor).setOrigin(0, 0);
      barFill.scaleX = 1 / maxLv;
      this._statRows.push({ key, label, value, barFill, maxLv });
    };

    addRow(0, 'drillPower', '⚒️', 'POWER',  5, 0x4CAF50);
    addRow(1, 'drillRange', '↔️', 'RANGE',  3, 0xFF9800);
    addRow(2, 'engine',     '⚙️', 'ENGINE', 3, 0x03A9F4);

    // SPEED — 누적 배율 (가장 강조)
    const speedY = rowY(3) + 4;
    this.statSpeedLabel = this.add.text(x + 14, speedY, '⚡ SPEED', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#FFFFFF',
    });
    this.statSpeedValue = this.add.text(x + w - 14, speedY, '×1.0', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '24px', color: '#FFEB3B',
      stroke: '#000000', strokeThickness: 3,
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
        row.value.setText(`Lv ${lv} / ${row.maxLv}`);
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
      fontSize: '88px',
      color: '#FFEB3B',
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5, 0.5);

    this.announceDonor = this.add.text(0, 80, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '64px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
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
    // 우측: 인벤토리가 stats 아래 500~990 차지. buff는 그 아래로
    this.buffArea   = { x: GAME.width - 312, y: 1010, w: 300 };
    this.debuffArea = { x: 12,               y: 270,  w: 300 };  // 좌측 상단 (인벤 비워졌으니)
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

  // ── 상단: DEPTH + GOLD (한 줄) → 6개 바이옴 박스 → 현재 바이옴 이름 ──
  _buildTopHud() {
    const barH = 260;
    this.add.rectangle(0, 0, GAME.width, barH, 0x0A0E1A, 0.85).setOrigin(0, 0);
    this.add.rectangle(0, barH - 4, GAME.width, 4, 0xFFD700, 1.0).setOrigin(0, 0);

    // DEPTH 라벨 (작게, 가운데 위)
    this.add.text(GAME.width / 2, 12, 'DEPTH', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);

    // DEPTH 값 (가운데, 적당히 큰 폰트)
    this.depthText = this.add.text(GAME.width / 2, 32, '0 km', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '48px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // GOLD (우측 상단, DEPTH와 겹치지 않게 작게)
    this.goldText = this.add.text(GAME.width - 24, 18, '0 G', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '26px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0);

    // 6개 바이옴 진행 트래커
    this._biomeDefs = [
      { id: 'earth',    emoji: '🌍', name: 'EARTH' },
      { id: 'crystal',  emoji: '💎', name: 'CRYSTAL' },
      { id: 'abyssal',  emoji: '🌊', name: 'ABYSS' },
      { id: 'forest',   emoji: '🌲', name: 'FOREST' },
      { id: 'magma',    emoji: '🔥', name: 'MAGMA' },
      { id: 'void',     emoji: '🌌', name: 'VOID' },
    ];

    // 마진 50px씩 좌우, 그 안에 6개 균등 배치. 박스 90px로 키워서 큰 이모지 안전하게.
    const margin = 50;
    const usableW = GAME.width - margin * 2;
    const boxSize = 90;
    const gap = (usableW - boxSize * this._biomeDefs.length) / (this._biomeDefs.length - 1);
    const iconY = 150;
    const startX = margin + boxSize / 2;

    this._biomeIcons = this._biomeDefs.map((b, i) => {
      const x = startX + i * (boxSize + gap);
      const bg = this.add.rectangle(x, iconY, boxSize, boxSize, 0x000000, 0.5).setStrokeStyle(2, 0x444444);
      // 이모지 baseline 보정 — y를 박스 중앙보다 +10 내려서 상단 짤림 방지
      const text = this.add.text(x, iconY + 10, b.emoji, {
        fontSize: '52px',
      }).setOrigin(0.5).setAlpha(0.4);
      return { id: b.id, name: b.name, bg, text };
    });

    // 현재 바이옴 이름 (박스 아래, 골드 라인과 겹치지 않게 충분히 위)
    this.biomeText = this.add.text(GAME.width / 2, 212, 'EARTH', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
  }

  _highlightBiome(biomeId) {
    for (const icon of this._biomeIcons ?? []) {
      const active = icon.id === biomeId;
      icon.bg.setStrokeStyle(active ? 4 : 2, active ? 0xFFD700 : 0x444444);
      icon.bg.setFillStyle(active ? 0xFFD700 : 0x000000, active ? 0.25 : 0.5);
      icon.text.setAlpha(active ? 1.0 : 0.35);
      icon.text.setScale(active ? 1.15 : 1.0);
    }
    const cur = this._biomeIcons?.find((b) => b.id === biomeId);
    if (cur) this.biomeText.setText(cur.name);
  }

  // ── 우측: DRILL STATS 패널 바로 아래에 3×4 그리드로 광물 12종 표시 ──
  _buildInventory() {
    const panelW = 300;
    const x = GAME.width - panelW - 12;
    const y = 500;  // stats 패널(270) + h(220) + 간격 10
    const cols = 3;
    const rows = 4;
    const cellW = panelW / cols;
    const cellH = 116;
    const totalH = rows * cellH + 36;  // 헤더 28 + 패딩

    // 패널 배경
    this.add.rectangle(x, y, panelW, totalH, 0x000000, 0.72).setOrigin(0, 0).setStrokeStyle(3, 0xFFD700, 0.8);
    this.add.text(x + panelW / 2, y + 6, '💎 ORES', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px', color: '#FFD700',
    }).setOrigin(0.5, 0);

    const rarityColors = {
      common:    0x666666,
      uncommon:  0x4CAF50,
      rare:      0x2196F3,
      epic:      0x9C27B0,
      legendary: 0xFF9800,
    };

    const iconSize = 48;
    const gridTop = y + 30;
    this.inventoryItems = {};

    ORE_IDS.forEach((id, i) => {
      const ore = ORES[id];
      const rarityColor = rarityColors[ore.rarity] ?? 0x666666;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = x + col * cellW;
      const cellY = gridTop + row * cellH;
      const cx = cellX + cellW / 2;

      // 칸 박스 (rarity 색 stroke)
      this.add.rectangle(cellX + 4, cellY + 2, cellW - 8, cellH - 6, 0x111418, 0.6)
        .setOrigin(0, 0)
        .setStrokeStyle(2, rarityColor, 0.7);

      // 아이콘 (상단 가운데)
      const gemKey = ensureGemTexture(this, id);
      const iconCy = cellY + 32;
      const icon = this.add.image(cx, iconCy, gemKey);
      const baseScale = iconSize / GAME.tileSize;
      icon.setScale(baseScale).setAlpha(0.35);

      // 이름 (아이콘 아래)
      const nameText = this.add.text(cx, iconCy + iconSize / 2 + 4, ore.name, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '12px',
        color: '#FFFFFF',
      }).setOrigin(0.5, 0).setAlpha(0.5);

      // 카운트 (가장 아래, 강조)
      const count = this.add.text(cx, cellY + cellH - 24, '0', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '22px',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0);

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
    // 팝업 — 가운데 상단 (HUD 바 260 아래)
    this.overlayPopup = this.add.container(GAME.width / 2, 340);
    this.overlayPopup.setDepth(99);
    this.overlayPopup.setVisible(false);
    this.overlayPopupText = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '52px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.overlayPopup.add(this.overlayPopupText);

    // LIKE 피드 — 인벤토리(우측 ~102px) 옆 x=120부터, BOTTOM_BAR 위에서 위로 쌓음
    this.overlayLikeAnchorX = 120;
    this.overlayLikeAnchorY = BOTTOM_BAR_Y - 16;
    this.overlayLikeRowH = 36;
  }

  // OverlaySystem이 호출 — 팝업 한 개 표시 (2.5초 후 done 통보)
  _renderPopup(text, kind) {
    const colorByKind = { SUB: '#FFD700', MEMBER: '#E1BEE7', SUPERCHAT: '#FF8A65' };
    this.overlayPopupText.setText(text);
    this.overlayPopupText.setColor(colorByKind[kind] ?? '#FFFFFF');
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
      const biome = this.biomeManager.getBiomeAt(Math.max(0, km));
      this._highlightBiome(biome?.id ?? 'earth');
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
