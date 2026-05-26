// 후원/채팅/구독 트리거를 받아 게임 효과를 발동시키는 중앙 디스패처.
// Phase 3: 현재는 키보드 시뮬레이션. Phase 4에서 WebSocket → 실제 슈퍼챗 연결.
// PRD 4-3, 4-4 기준 14종 트리거.

import { ExplosionEffect } from '../objects/ExplosionEffect.js';
import { ORES } from '../config/ores.js';
import { GAME } from '../config/game.js';
import { gameState } from './GameState.js';

const MOCK_DONORS = [
  'Steve', 'Alex', 'Mike', 'Emma', 'Sarah', 'Ryan', 'Jane', 'Tom',
  'JinHyun', 'YukiP', 'BigDripz', 'PixelKing', 'OreLord', 'DigItGood',
  'CryptoMiner', 'Cookie5', 'SuperFan99',
];
export function randomDonor() {
  return MOCK_DONORS[Math.floor(Math.random() * MOCK_DONORS.length)];
}

export const TRIGGER_DEFS = {
  // 채팅 — 가장 작은 TNT 한 개 (`!bomb` 무료, 별도 쿨다운 없음)
  CHAT_BOMB:  { type: 'bomb', radius: 1.2, color: 0xFFC107, tntScale: 0.7,  priceLabel: 'CHAT', label: 'BOMB' },

  // 후원 폭발 계열 — count: 5 (한 슈퍼챗에 폭탄 5개 흩뿌리기)
  BOMB:       { type: 'bomb', count: 5, radius: 2.2, color: 0xFF9800, tntScale: 0.9,  priceLabel: '$1',  label: 'ULTRA BOMB' },
  ULTRA_BOMB: { type: 'bomb', count: 5, radius: 3.2, color: 0xF44336, tntScale: 1.2,  priceLabel: '$3',  label: 'MEGA BOMB' },
  MEGA_BLAST: { type: 'bomb', count: 5, radius: 4.5, color: 0xD32F2F, tntScale: 1.5,  priceLabel: '$5',  label: 'GIGA BLAST', shake: 0.018 },
  NUKE:       { type: 'bomb', count: 5, radius: 8.0, color: 0xE91E63, tntScale: 2.0,  priceLabel: '$20', label: 'NUKE', shake: 0.04, screenFlash: true, announceMs: 10000 },

  // 좋아요 — 가장 작은 TNT, 3초 sizzle, 좋아요 누른 사람 이름 표시 (sizzle 중 추가됨)
  LIKE:       { type: 'like', radius: 1.2, color: 0xE91E63, tntScale: 0.75, priceLabel: '❤',  label: 'LIKE', sizzleDurationMs: 3000 },

  // 드릴 속도 버프 — BuffSystem 활용
  DRILL_UP:   { type: 'buff', buffId: 'drillPowerUp', params: { mult: 2.0 }, durationMs: 30000, priceLabel: '$2',  label: 'DRILL UP',  color: 0xCDDC39 },
  OVERDRIVE:  { type: 'buff', buffId: 'drillPowerUp', params: { mult: 7.0 }, durationMs: 30000, priceLabel: '$10', label: 'OVERDRIVE', color: 0x00BCD4 },

  // 채팅 (전체 채널 쿨다운 10초)
  FAST:       { type: 'buff', buffId: 'drillPowerUp', params: { mult: 1.5 }, durationMs: 10000, cooldownMs: 10000, priceLabel: 'CHAT', label: 'FAST', color: 0x90CAF9 },

  // 신규 구독 — 드릴 아래 10줄을 현재 바이옴 특수 광물로 가득 채움
  SUB:        { type: 'special', action: 'subscribe', priceLabel: 'SUB', label: 'NEW SUB!', color: 0xF06292 },

  // 드릴 변경 — 채팅이 직접 Lv을 지정해서 골드 차감 후 30초 유지
  // 가격 = upgrades.drillPower.cost[targetLv-1]. 다운그레이드 시도는 무시.
  DRILL_WOOD:    { type: 'special', action: 'setDrill', drillLevel: 1, priceLabel: 'CHAT', label: 'WOOD DRILL!',    color: 0xCDA678 },
  DRILL_STONE:   { type: 'special', action: 'setDrill', drillLevel: 2, priceLabel: 'CHAT', label: 'STONE DRILL!',   color: 0xB0B0B0 },
  DRILL_IRON:    { type: 'special', action: 'setDrill', drillLevel: 3, priceLabel: 'CHAT', label: 'IRON DRILL!',    color: 0xA8C5DC },
  DRILL_GOLD:    { type: 'special', action: 'setDrill', drillLevel: 4, priceLabel: 'CHAT', label: 'GOLD DRILL!',    color: 0xFFD54F },
  DRILL_DIAMOND: { type: 'special', action: 'setDrill', drillLevel: 5, priceLabel: 'CHAT', label: 'DIAMOND DRILL!', color: 0x80DEEA },

  // 범위/엔진은 기존 incremental 방식 유지 (Lv 한 단계씩 증가)
  UPGRADE_RANGE:  { type: 'special', action: 'upgradeRange',  priceLabel: 'CHAT', label: 'RANGE UP!',  color: 0xFF9800 },
  UPGRADE_ENGINE: { type: 'special', action: 'upgradeEngine', priceLabel: 'CHAT', label: 'ENGINE UP!', color: 0x03A9F4 },

  // 스트리머 전용 — youtube-bridge에서 owner/moderator만 발동 가능
  RESET:      { type: 'special', action: 'reset',   priceLabel: 'STREAMER', label: 'NEW MAP!', color: 0xFFFFFF },
  JACKPOT:    { type: 'special', action: 'jackpot', priceLabel: 'STREAMER', label: 'JACKPOT!', color: 0xFFD700 },
};

export class TriggerSystem {
  constructor(scene, deps) {
    this.scene = scene;
    this.driller = deps.driller;
    this.tileMap = deps.tileMap;
    this.biomeManager = deps.biomeManager;
    this.buffSystem = deps.buffSystem;
    this.oreLayer = deps.oreLayer;

    this.soundManager = deps.soundManager;
    this.upgradeSystem = deps.upgradeSystem;
    this.explosionEffect = new ExplosionEffect(scene, this.tileMap, this.soundManager, this.driller);
    this.cooldownManager = deps.cooldownManager;
    this._listeners = new Map();
  }

  // 트리거 ID → 발동 시점(=TNT 낙하 / 광물 스폰 / 버프 적용) 사운드 매핑.
  // 폭탄/LIKE 폭발 사운드는 ExplosionEffect가 적절한 시점에 직접 재생.
  _triggerSound(triggerId) {
    const map = {
      DRILL_UP: 'drill_up', OVERDRIVE: 'overdrive',
      FAST: 'chat_fast',
      SUB: 'sub_jingle',
    };
    const key = map[triggerId];
    if (key) this.soundManager?.play(key);
  }

  fire(triggerId, donor = null) {
    const def = TRIGGER_DEFS[triggerId];
    if (!def) {
      console.warn('Unknown trigger:', triggerId);
      return;
    }
    // 쿨다운 검사 (채팅 트리거 전체 채널 쿨다운)
    if (def.cooldownMs && this.cooldownManager) {
      if (!this.cooldownManager.tryFire(triggerId, def.cooldownMs)) {
        return;  // 쿨다운 중 → 무시
      }
    }
    donor = donor ?? randomDonor();

    // special 액션 중 골드 체크가 필요한 채팅 업그레이드는 결과를 받아서 실패 시 announce/sound 안 함
    if (def.type === 'special') {
      const result = this._handleSpecial(def, donor);
      if (result && result.ok === false) {
        this._emit('denied', { triggerId, def, donor, result });
        return;
      }
    }

    const event = { triggerId, def, donor };
    this._emit('fire', event);

    // composite는 자식 트리거가 각자 사운드를 재생하므로 여기선 skip
    if (def.type !== 'composite') this._triggerSound(triggerId);

    switch (def.type) {
      case 'bomb':       return this._handleBomb(def, donor);
      case 'buff':       return this._handleBuff(def);
      case 'like':       return this._handleLike(def, donor);
      case 'composite':  return this._handleComposite(def, donor);
      case 'special':    return;  // 이미 위에서 처리됨
    }
  }

  // 반환: { ok, ... } — fire()가 ok===false면 announce/sound 안 함
  _handleSpecial(def, donor) {
    switch (def.action) {
      case 'reset':         this._doReset();          return { ok: true };
      case 'jackpot':       this._doJackpot();        return { ok: true };
      case 'subscribe':     this._doSubscribe(donor); return { ok: true };
      case 'setDrill':      return this._doSetDrill(def.drillLevel, donor);
      case 'upgradeRange':  return this._doChatUpgrade('drillRange', donor);
      case 'upgradeEngine': return this._doChatUpgrade('engine', donor);
    }
    return { ok: true };
  }

  // 드릴 직접 지정 (wood/stone/iron/gold/diamond) — 골드 충분하면 해당 Lv으로.
  _doSetDrill(targetLv, donor) {
    if (!this.upgradeSystem) return { ok: false, reason: 'no-system' };
    const result = this.upgradeSystem.tryBuyDrillByLevel(targetLv);
    this._emit('upgrade-attempt', { name: 'drillPower', donor, result });
    return result;
  }

  // 범위/엔진 — 다음 Lv로 단계 증가.
  _doChatUpgrade(name, donor) {
    if (!this.upgradeSystem) return { ok: false, reason: 'no-system' };
    const result = this.upgradeSystem.tryChatUpgrade(name);
    this._emit('upgrade-attempt', { name, donor, result });
    return result;
  }

  // 신규 구독 — 드릴 바로 아래 10줄(전 채굴 폭)을 현재 바이옴 특수 광물로 채움
  _doSubscribe(_donor) {
    const oreId = this._biomeSpecialOre();
    const ore = ORES[oreId];
    if (!ore) return;
    const centerTileX = this.driller.getCurrentTileX();
    const startTileY = this.driller.getTileY() + 1;  // 드릴 바로 아래부터
    const rows = 10;
    // 채굴 가능 영역 = 벽 안쪽 (wallLeftX+1 ~ wallRightX-1)
    const wallLeftX = GAME.wallLeftX;
    const wallRightX = GAME.wallRightX;
    for (let dy = 0; dy < rows; dy++) {
      const ty = startTileY + dy;
      for (let tx = wallLeftX + 1; tx < wallRightX; tx++) {
        this.tileMap.convertToOre(tx, ty, ore);
      }
    }
  }

  // 새 맵 생성 — 모든 청크 destroy 후 재생성. 드릴 위치/골드/광물 인벤은 유지.
  _doReset() {
    // 진행 중인 폭탄/sizzle 정리 (재생성된 타일에 잘못된 폭발 안 가게)
    if (this.explosionEffect?._bodies) {
      for (const body of [...this.explosionEffect._bodies]) {
        body.tnt?.destroy();
        body.labelText?.destroy();
        body.namesText?.destroy();
        if (body.sizzleHandles) for (const h of body.sizzleHandles) h.stop?.();
      }
      this.explosionEffect._bodies = [];
    }
    // 청크 전체 destroy
    const cys = [...this.tileMap.chunks.keys()];
    for (const cy of cys) this.tileMap.destroyChunk(cy);
    // 드릴 주변 청크 재생성
    this.tileMap.update(this.driller.y);
    // 화면 플래시 + 카메라 흔들림
    const cam = this.scene.cameras.main;
    cam.flash(500, 255, 255, 255);
    cam.shake(300, 0.012);
  }

  // 잭팟 — 현재 청크 + 인접 청크의 빈 흙 타일들을 무작위로 다이아몬드로 변환
  _doJackpot() {
    const diamondOre = ORES.diamond;
    if (!diamondOre) return;
    const visibleTiles = [];
    for (const chunk of this.tileMap.chunks.values()) {
      for (const tile of chunk.tiles.values()) {
        if (!tile.destroyed && !tile.isWall) visibleTiles.push(tile);
      }
    }
    // 무작위 셔플 + 상위 N개만 변환
    for (let i = visibleTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [visibleTiles[i], visibleTiles[j]] = [visibleTiles[j], visibleTiles[i]];
    }
    const targetCount = Math.min(80, Math.floor(visibleTiles.length * 0.4));
    for (let i = 0; i < targetCount; i++) {
      const tile = visibleTiles[i];
      this.tileMap.convertToOre(tile.tileX, tile.tileY, diamondOre);
    }
    // 사운드 + 화면 효과
    this.scene.cameras.main.flash(300, 255, 215, 0);  // 금색 플래시
  }

  // 여러 트리거를 묶어서 동시 발동
  _handleComposite(def, donor) {
    for (const childId of def.triggers) this.fire(childId, donor);
  }

  // 좋아요 — 활성 LIKE TNT가 sizzle 중이면 이름만 추가. 없으면 새 TNT 떨어뜨림.
  _handleLike(def, donor) {
    if (this._activeLike && !this._activeLike.isExploded) {
      this._activeLike.addName(donor);
      return;
    }
    const drillScale = this.driller.sprite?.scaleY ?? 1.0;
    const drillVisualBottomY = this.driller.y + 64 * drillScale;
    const targetX = this.driller.worldX;
    this._activeLike = this.explosionEffect.drop(targetX, drillVisualBottomY, {
      radius: def.radius,
      color: def.color,
      label: def.label,
      tntScale: def.tntScale,
      shake: 0.01,
      sizzleDurationMs: def.sizzleDurationMs,
      names: [donor],
      explosionSound: 'bomb_small',
    });
  }

  _handleBomb(def) {
    const drillScale = this.driller.sprite?.scaleY ?? 1.0;
    const baseY = this.driller.y + 64 * drillScale;
    const count = def.count ?? 1;

    // 반경에 따라 폭발 사운드 결정 (TNT 낙하 시 안 울리고, 폭발 순간 ExplosionEffect가 재생)
    const explosionSound =
      def.radius >= 5.0 ? 'nuke' :
      def.radius >= 3.0 ? 'bomb_mega' :
      def.radius >= 2.0 ? 'bomb_ultra' :
      'bomb_small';

    // NUKE 끝판왕 효과 — 첫 폭탄과 함께 화면 전체 플래시
    if (def.screenFlash) {
      this.scene.cameras.main.flash(400, 255, 255, 255);
    }

    // count만큼 좌우 ±200px 흩뿌리며 80ms 간격으로 순차 낙하
    for (let i = 0; i < count; i++) {
      const offsetX = count === 1 ? 0 : (Math.random() - 0.5) * 400;
      this.scene.time.delayedCall(i * 80, () => {
        this.explosionEffect.drop(this.driller.worldX + offsetX, baseY, {
          radius: def.radius,
          color: def.color,
          label: def.label,
          tntScale: def.tntScale,
          shake: def.shake ?? 0.012,
          explosionSound,
        });
      });
    }
  }

  _handleBuff(def) {
    const params = { ...def.params, label: def.label };
    this.buffSystem.apply(def.buffId, params, def.durationMs);
  }

  _biomeSpecialOre() {
    const km = this.biomeManager.yToKm(this.driller.y);
    const biome = this.biomeManager.getBiomeAt(km);
    // 바이옴별 특수 광물 매핑
    const map = {
      earth:    'gold',
      crystal:  'amethyst',
      abyssal:  'sapphire',
      forest:   'emerald',
      magma:    'ruby',
      void:     'voidStone',
    };
    return map[biome.id] ?? 'gold';
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (set) for (const fn of set) fn(payload);
  }
}
