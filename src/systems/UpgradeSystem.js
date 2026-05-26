import { UPGRADES, TEMP_UPGRADE_MS } from '../config/upgrades.js';
import { GAME } from '../config/game.js';

// 임시 업그레이드 시스템 — 채팅으로만 살 수 있고, 30초 후 Lv 1로 복귀.
// 영구 레벨 없음. 매 라이브 처음부터 끝까지 베이스 = Lv 1.
export class UpgradeSystem {
  constructor(scene, gameState) {
    this.scene = scene;
    this.state = gameState;
    // 임시 레벨 + 만료 시각 (ms)
    this.temp = {
      drillPower: { level: 1, expiresAt: 0 },
      drillRange: { level: 1, expiresAt: 0 },
      engine:     { level: 1, expiresAt: 0 },
    };
    this._listeners = new Map();
  }

  // GameScene.update에서 매 프레임 호출. 만료된 임시 업그레이드를 Lv 1로 복귀.
  update() {
    const now = this.scene.time.now;
    for (const name of Object.keys(this.temp)) {
      const t = this.temp[name];
      if (t.level > 1 && now >= t.expiresAt) {
        const prevLevel = t.level;
        t.level = 1;
        t.expiresAt = 0;
        this._emit('revert', { name, prevLevel });
      }
    }
  }

  remainingMs(name) {
    const t = this.temp[name];
    if (!t || t.level <= 1) return 0;
    return Math.max(0, t.expiresAt - this.scene.time.now);
  }

  remainingFrac(name) {
    const total = TEMP_UPGRADE_MS[name];
    if (!total) return 0;
    return this.remainingMs(name) / total;
  }

  // 드릴 직접 지정 (wood=1, stone=2, iron=3, gold=4, diamond=5).
  // 다운그레이드 시도는 거부, 같은 Lv은 타이머만 갱신.
  tryBuyDrillByLevel(targetLv) {
    const def = UPGRADES.drillPower;
    if (targetLv < 1 || targetLv > def.maxLevel) {
      return { ok: false, reason: 'invalid', targetLv };
    }
    const curLv = this.temp.drillPower.level;
    // 같은 Lv 또는 더 낮은 Lv 요청 — 다운그레이드는 무시, 같은 Lv은 timer 갱신만
    if (targetLv === curLv) {
      this.temp.drillPower.expiresAt = this.scene.time.now + TEMP_UPGRADE_MS.drillPower;
      this._emit('refresh', { name: 'drillPower', level: curLv });
      return { ok: true, level: curLv, cost: 0, refreshed: true };
    }
    if (targetLv < curLv) {
      return { ok: false, reason: 'downgrade', curLv, targetLv };
    }
    // 업그레이드 — Lv N으로 가는 비용 = cost[N-1]
    const cost = def.cost[targetLv - 1];
    if (this.state.gold < cost) {
      return { ok: false, reason: 'no_gold', cost, gold: this.state.gold };
    }
    if (cost > 0) this.state.spendGold(cost);
    this.temp.drillPower.level = targetLv;
    this.temp.drillPower.expiresAt = this.scene.time.now + TEMP_UPGRADE_MS.drillPower;
    this._emit('upgrade', { name: 'drillPower', level: targetLv, cost });
    return { ok: true, level: targetLv, cost, name: 'drillPower' };
  }

  // 채팅 트리거 발동 시 호출 — 다음 Lv 비용 충당되면 임시 Lv +1, 타이머 갱신.
  // (범위/엔진용 — drillPower는 tryBuyDrillByLevel 사용)
  // 반환: { ok, level?, cost?, name?, reason? }
  tryChatUpgrade(name) {
    const def = UPGRADES[name];
    if (!def) return { ok: false, reason: 'unknown' };
    const cur = this.temp[name].level;
    if (cur >= def.maxLevel) {
      // 이미 만렙 — 만료 시각만 갱신 (지속 시간 리프레시)
      this.temp[name].expiresAt = this.scene.time.now + TEMP_UPGRADE_MS[name];
      this._emit('refresh', { name, level: cur });
      return { ok: true, level: cur, cost: 0, name, refreshed: true };
    }
    const cost = def.cost[cur];
    if (this.state.gold < cost) {
      return { ok: false, reason: 'no_gold', cost, gold: this.state.gold };
    }
    this.state.spendGold(cost);
    const newLv = cur + 1;
    this.temp[name].level = newLv;
    this.temp[name].expiresAt = this.scene.time.now + TEMP_UPGRADE_MS[name];
    this._emit('upgrade', { name, level: newLv, cost });
    return { ok: true, level: newLv, cost, name };
  }

  getLevel(name) {
    return this.temp[name]?.level ?? 1;
  }

  getDrillName() {
    const lv = this.getLevel('drillPower');
    return UPGRADES.drillPower.names?.[lv - 1] ?? `Lv ${lv}`;
  }

  getDrillSpeed() {
    const powerMult = UPGRADES.drillPower.multiplier[this.getLevel('drillPower') - 1];
    const engineMult = UPGRADES.engine.multiplier[this.getLevel('engine') - 1];
    return GAME.baseDrillSpeed * powerMult * engineMult;
  }

  getDrillSpeedMult() {
    return UPGRADES.drillPower.multiplier[this.getLevel('drillPower') - 1];
  }

  getEngineMult() {
    return UPGRADES.engine.multiplier[this.getLevel('engine') - 1];
  }

  getDrillRange() {
    return UPGRADES.drillRange.tiles[this.getLevel('drillRange') - 1];
  }

  nextCost(name) {
    const def = UPGRADES[name];
    if (!def) return null;
    const cur = this.temp[name].level;
    if (cur >= def.maxLevel) return null;
    return def.cost[cur];
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
