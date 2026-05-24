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

  // 채팅
  FAST:       { type: 'buff', buffId: 'drillPowerUp', params: { mult: 1.5 }, durationMs: 10000, priceLabel: 'CHAT', label: '!fast', color: 0x90CAF9 },

  // 구독/멤버십
  SUB:        { type: 'oreSpawn', oreId: 'biome',   count: 6, radius: 2.0, priceLabel: 'SUB',    label: 'NEW SUB!',    color: 0xF06292 },
  MEMBER:     { type: 'oreSpawn', oreId: 'diamond', count: 8, radius: 2.5, priceLabel: 'MEMBER', label: 'NEW MEMBER!', color: 0xAB47BC },
};

export class TriggerSystem {
  constructor(scene, deps) {
    this.scene = scene;
    this.driller = deps.driller;
    this.tileMap = deps.tileMap;
    this.biomeManager = deps.biomeManager;
    this.buffSystem = deps.buffSystem;
    this.oreLayer = deps.oreLayer;

    this.explosionEffect = new ExplosionEffect(scene, this.tileMap);
    this._listeners = new Map();
  }

  fire(triggerId, donor = null) {
    const def = TRIGGER_DEFS[triggerId];
    if (!def) {
      console.warn('Unknown trigger:', triggerId);
      return;
    }
    donor = donor ?? randomDonor();

    const event = { triggerId, def, donor };
    this._emit('fire', event);

    switch (def.type) {
      case 'bomb':       return this._handleBomb(def);
      case 'buff':       return this._handleBuff(def);
      case 'oreSpawn':   return this._handleOreSpawn(def);
    }
  }

  _handleBomb(def) {
    const targetX = this.driller.worldX;
    // 드릴 sprite 텍스처는 64x96, origin (0.5, 0.333) — sprite 바닥 = drill.y + 64*scale
    // 큰 드릴이어도 sprite 바닥 아래에서 땅을 찾도록.
    const drillScale = this.driller.sprite?.scaleY ?? 1.0;
    const drillVisualBottomY = this.driller.y + 64 * drillScale;
    this.explosionEffect.drop(targetX, drillVisualBottomY, {
      radius: def.radius,
      color: def.color,
      label: def.label,
      tntScale: def.tntScale,
      shake: def.shake ?? 0.012,
    });
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
