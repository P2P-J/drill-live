import { describe, test, expect, vi } from 'vitest';
import { GameState } from '../src/systems/GameState.js';
import { UpgradeSystem } from '../src/systems/UpgradeSystem.js';
import { GAME } from '../src/config/game.js';

function makeSystem() {
  const state = new GameState();
  const sys = new UpgradeSystem(state);
  return { state, sys };
}

describe('UpgradeSystem.nextCost', () => {
  test('returns cost of going from level 1 -> 2 for drillPower', () => {
    const { sys } = makeSystem();
    expect(sys.nextCost('drillPower')).toBe(100);
  });

  test('returns null when at max level', () => {
    const { state, sys } = makeSystem();
    state.upgrades.drillPower = 5;
    expect(sys.nextCost('drillPower')).toBeNull();
  });
});

describe('UpgradeSystem.canBuy', () => {
  test('false when not enough gold', () => {
    const { sys } = makeSystem();
    expect(sys.canBuy('drillPower')).toBe(false);  // gold=0, cost=100
  });

  test('true when gold >= next cost and not maxed', () => {
    const { state, sys } = makeSystem();
    state.addGold(200);
    expect(sys.canBuy('drillPower')).toBe(true);
  });

  test('false when maxed', () => {
    const { state, sys } = makeSystem();
    state.upgrades.drillPower = 5;
    state.addGold(100000);
    expect(sys.canBuy('drillPower')).toBe(false);
  });
});

describe('UpgradeSystem.buy', () => {
  test('deducts gold and bumps level by 1', () => {
    const { state, sys } = makeSystem();
    state.addGold(200);
    const ok = sys.buy('drillPower');
    expect(ok).toBe(true);
    expect(state.gold).toBe(100);
    expect(state.upgrades.drillPower).toBe(2);
  });

  test('returns false when cannot afford and does not mutate', () => {
    const { state, sys } = makeSystem();
    expect(sys.buy('drillPower')).toBe(false);
    expect(state.gold).toBe(0);
    expect(state.upgrades.drillPower).toBe(1);
  });
});

describe('UpgradeSystem effective values', () => {
  test('getDrillSpeed at all level 1 equals baseDrillSpeed', () => {
    const { sys } = makeSystem();
    expect(sys.getDrillSpeed()).toBe(GAME.baseDrillSpeed);
  });

  test('getDrillSpeed scales by drillPower multiplier', () => {
    const { state, sys } = makeSystem();
    state.upgrades.drillPower = 3;  // mult 1.7
    expect(sys.getDrillSpeed()).toBeCloseTo(GAME.baseDrillSpeed * 1.7);
  });

  test('getDrillSpeed combines drillPower and engine multipliers', () => {
    const { state, sys } = makeSystem();
    state.upgrades.drillPower = 5; // 3.0
    state.upgrades.engine = 3;     // 1.5
    expect(sys.getDrillSpeed()).toBeCloseTo(GAME.baseDrillSpeed * 3.0 * 1.5);
  });

  test('getDrillRange returns tiles[level-1]', () => {
    const { state, sys } = makeSystem();
    expect(sys.getDrillRange()).toBe(1);
    state.upgrades.drillRange = 2;
    expect(sys.getDrillRange()).toBe(3);
    state.upgrades.drillRange = 3;
    expect(sys.getDrillRange()).toBe(5);
  });
});

describe('UpgradeSystem events', () => {
  test('buy emits upgrade event on gameState', () => {
    const { state, sys } = makeSystem();
    state.addGold(500);
    const spy = vi.fn();
    state.on('upgrade', spy);
    sys.buy('drillPower');
    expect(spy).toHaveBeenCalledWith({ name: 'drillPower', level: 2 });
  });
});
