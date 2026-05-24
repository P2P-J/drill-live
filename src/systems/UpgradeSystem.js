import { UPGRADES } from '../config/upgrades.js';
import { GAME } from '../config/game.js';

export class UpgradeSystem {
  constructor(gameState) {
    this.state = gameState;
  }

  // 다음 단계 구매 비용. 이미 maxLevel이면 null.
  nextCost(name) {
    const def = UPGRADES[name];
    if (!def) return null;
    const current = this.state.upgrades[name];
    if (current >= def.maxLevel) return null;
    return def.cost[current];   // cost[1]은 1→2 단계 비용
  }

  canBuy(name) {
    const cost = this.nextCost(name);
    if (cost === null) return false;
    return this.state.gold >= cost;
  }

  buy(name) {
    if (!this.canBuy(name)) return false;
    const cost = this.nextCost(name);
    this.state.spendGold(cost);
    const newLevel = this.state.upgrades[name] + 1;
    this.state.setUpgrade(name, newLevel);
    return true;
  }

  // 효과 계산자 — Driller가 매 프레임 참조
  getDrillSpeed() {
    const lvlPower = this.state.upgrades.drillPower;
    const lvlEngine = this.state.upgrades.engine;
    const powerMult = UPGRADES.drillPower.multiplier[lvlPower - 1];
    const engineMult = UPGRADES.engine.multiplier[lvlEngine - 1];
    return GAME.baseDrillSpeed * powerMult * engineMult;
  }

  // 드릴 채굴 속도 배율 (mineProgress 누적 속도)
  getDrillSpeedMult() {
    const lvl = this.state.upgrades.drillPower;
    return UPGRADES.drillPower.multiplier[lvl - 1];
  }

  getEngineMult() {
    const lvl = this.state.upgrades.engine;
    return UPGRADES.engine.multiplier[lvl - 1];
  }

  getDrillRange() {
    const lvl = this.state.upgrades.drillRange;
    return UPGRADES.drillRange.tiles[lvl - 1];
  }
}
