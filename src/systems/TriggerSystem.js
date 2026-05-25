// 후원/채팅/구독 트리거를 받아 게임 효과를 발동시키는 중앙 디스패처.
// Phase 3: 현재는 키보드 시뮬레이션. Phase 4에서 WebSocket → 실제 슈퍼챗 연결.
// PRD 4-3, 4-4 기준 14종 트리거.

import { ExplosionEffect } from '../objects/ExplosionEffect.js';
import { ORES } from '../config/ores.js';
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
  // 폭발 계열 — 위에서 TNT 떨어져서 폭발
  BOMB:       { type: 'bomb', radius: 1.6, color: 0xFF9800, tntScale: 0.9,  priceLabel: '$1',  label: 'BOMB' },
  ULTRA_BOMB: { type: 'bomb', radius: 2.6, color: 0xF44336, tntScale: 1.2,  priceLabel: '$3',  label: 'ULTRA BOMB' },
  MEGA_BLAST: { type: 'bomb', radius: 3.6, color: 0xD32F2F, tntScale: 1.5,  priceLabel: '$5',  label: 'MEGA BLAST' },
  NUKE:       { type: 'bomb', radius: 6.0, color: 0xE91E63, tntScale: 2.0,  priceLabel: '$20', label: 'NUKE',     shake: 0.025 },

  // 좋아요 — 가장 작은 TNT, 3초 sizzle, 좋아요 누른 사람 이름 표시 (sizzle 중 추가됨)
  LIKE:       { type: 'like', radius: 1.2, color: 0xE91E63, tntScale: 0.75, priceLabel: '❤',  label: 'LIKE', sizzleDurationMs: 3000 },

  // 드릴 계열 — BuffSystem 활용
  DRILL_UP:   { type: 'buff', buffId: 'drillPowerUp', params: { mult: 1.5 }, durationMs: 30000, priceLabel: '$2',  label: 'DRILL UP',  color: 0xCDDC39 },
  TURBO:      { type: 'buff', buffId: 'drillPowerUp', params: { mult: 3.0 }, durationMs: 15000, priceLabel: '$5',  label: 'TURBO',     color: 0x4CAF50 },
  OVERDRIVE:  { type: 'buff', buffId: 'drillPowerUp', params: { mult: 5.0 }, durationMs: 20000, priceLabel: '$10', label: 'OVERDRIVE', color: 0x00BCD4 },

  // 광물 계열 — 드릴 근처에 광물 강제 생성
  GOLD_RUSH:  { type: 'oreSpawn', oreId: 'gold',    count: 12, radius: 2.5, priceLabel: '$3',  label: 'GOLD RUSH',  color: 0xFFD700 },
  GEM_DROP:   { type: 'oreSpawn', oreId: 'sapphire',count: 8,  radius: 2.0, priceLabel: '$5',  label: 'GEM DROP',   color: 0x2196F3 },
  DIAMOND:    { type: 'oreSpawn', oreId: 'diamond', count: 5,  radius: 2.5, priceLabel: '$10', label: 'DIAMOND',    color: 0xB9F6CA },
  SPECIAL:    { type: 'oreSpawn', oreId: 'biome',   count: 8,  radius: 2.5, priceLabel: '$15', label: 'SPECIAL',    color: 0xBA68C8 },

  // 범위 확장 (이미 SPACE로 구현된 것)
  RANGE_UP:   { type: 'buff', buffId: 'drillRangeUp', params: { bonus: 2, label: 'RANGE UP!' }, durationMs: 10000, priceLabel: 'SC', label: 'RANGE UP', color: 0xFF9800 },

  // 채팅 (전체 채널 쿨다운 30초)
  FAST:       { type: 'buff', buffId: 'drillPowerUp', params: { mult: 1.5 }, durationMs: 10000, cooldownMs: 30000, priceLabel: 'CHAT', label: '!fast', color: 0x90CAF9 },

  // 구독/멤버십
  SUB:        { type: 'oreSpawn', oreId: 'biome',   count: 6, radius: 2.0, priceLabel: 'SUB',    label: 'NEW SUB!',    color: 0xF06292 },
  MEMBER:     { type: 'oreSpawn', oreId: 'diamond', count: 8, radius: 2.5, priceLabel: 'MEMBER', label: 'NEW MEMBER!', color: 0xAB47BC },

  // 선물 구독 ($5+) — NUKE + DIAMOND 동시 발동 (spec 5-3)
  GIFT_SUB:   { type: 'composite', triggers: ['NUKE', 'DIAMOND'], priceLabel: 'GIFT', label: 'GIFT SUB!', color: 0xFFD54F },
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
    this.explosionEffect = new ExplosionEffect(scene, this.tileMap, this.soundManager);
    this.cooldownManager = deps.cooldownManager;
    this._listeners = new Map();
  }

  // 트리거 ID → 발동 시점(=TNT 낙하 / 광물 스폰 / 버프 적용) 사운드 매핑.
  // 폭탄/LIKE 폭발 사운드는 ExplosionEffect가 적절한 시점에 직접 재생.
  _triggerSound(triggerId) {
    const map = {
      DRILL_UP: 'drill_up', TURBO: 'turbo', OVERDRIVE: 'overdrive',
      RANGE_UP: 'range_up', FAST: 'chat_fast',
      GOLD_RUSH: 'gold_rush', GEM_DROP: 'gem_drop', DIAMOND: 'diamond_spawn', SPECIAL: 'special_ore',
      SUB: 'sub_jingle', MEMBER: 'member_jingle', GIFT_SUB: 'gift_sub',
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

    const event = { triggerId, def, donor };
    this._emit('fire', event);

    // composite는 자식 트리거가 각자 사운드를 재생하므로 여기선 skip
    if (def.type !== 'composite') this._triggerSound(triggerId);

    switch (def.type) {
      case 'bomb':       return this._handleBomb(def, donor);
      case 'buff':       return this._handleBuff(def);
      case 'oreSpawn':   return this._handleOreSpawn(def);
      case 'like':       return this._handleLike(def, donor);
      case 'composite':  return this._handleComposite(def, donor);
    }
  }

  // 여러 트리거를 묶어서 동시 발동 (예: GIFT_SUB = NUKE + DIAMOND)
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
    // 보스 활성 중이면 보스가 타겟. 아니면 드릴 아래에.
    const boss = this.bossTracker?.activeBoss;
    const drillScale = this.driller.sprite?.scaleY ?? 1.0;
    const targetX = boss ? boss.x : this.driller.worldX;
    const drillVisualBottomY = this.driller.y + 64 * drillScale;
    const targetY = boss ? boss.y : drillVisualBottomY;

    // 반경에 따라 폭발 사운드 결정 (TNT 낙하 시 안 울리고, 폭발 순간 ExplosionEffect가 재생)
    const explosionSound =
      def.radius >= 5.0 ? 'nuke' :
      def.radius >= 3.0 ? 'bomb_mega' :
      def.radius >= 2.0 ? 'bomb_ultra' :
      'bomb_small';

    this.explosionEffect.drop(targetX, targetY, {
      radius: def.radius,
      color: def.color,
      label: def.label,
      tntScale: def.tntScale,
      shake: def.shake ?? 0.012,
      explosionSound,
    });

    // 보스에게 데미지 (PRD 4-3 BOSS BOMB / BOSS NUKE 비례 + 일반 폭탄도 데미지)
    if (boss) {
      const damageMap = {
        BOMB: 100, ULTRA_BOMB: 300, MEGA_BLAST: 600, NUKE: 2500,
      };
      const dmg = damageMap[Object.keys(TRIGGER_DEFS).find(k => TRIGGER_DEFS[k] === def)] ?? 100;
      // 폭발 직후 (낙하 + sizzle = ~1.6초 후) 데미지 적용
      this.scene.time.delayedCall(1600, () => boss.takeDamage(dmg));
    }
  }

  _handleBuff(def) {
    const params = { ...def.params, label: def.label };
    this.buffSystem.apply(def.buffId, params, def.durationMs);
  }

  _handleOreSpawn(def) {
    let oreId = def.oreId;
    if (oreId === 'biome') {
      oreId = this._biomeSpecialOre();
    }
    const ore = ORES[oreId];
    if (!ore) return;

    // 드릴 근처에 광물 강제 생성 (radius 안의 빈 곳/일반 흙 타일을 광물로 변환)
    const centerTileX = this.driller.getCurrentTileX();
    const centerTileY = this.driller.getTileY() + 2;  // 드릴 약간 아래

    const ir = Math.ceil(def.radius);
    const r2 = def.radius * def.radius;
    let placed = 0;
    const candidates = [];
    for (let dy = 0; dy <= ir + 1; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        candidates.push([centerTileX + dx, centerTileY + dy]);
      }
    }
    // 무작위 셔플
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const [tx, ty] of candidates) {
      if (placed >= def.count) break;
      if (this.tileMap.convertToOre(tx, ty, ore)) placed++;
    }
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
