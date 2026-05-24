import { describe, test, expect, vi } from 'vitest';
import { GameState } from '../src/systems/GameState.js';

describe('GameState', () => {
  test('starts with 0 gold and 0 depth', () => {
    const s = new GameState();
    expect(s.gold).toBe(0);
    expect(s.depthKm).toBe(0);
  });

  test('all upgrades start at level 1', () => {
    const s = new GameState();
    expect(s.upgrades.drillPower).toBe(1);
    expect(s.upgrades.drillRange).toBe(1);
    expect(s.upgrades.fuelTank).toBe(1);
    expect(s.upgrades.cargo).toBe(1);
    expect(s.upgrades.engine).toBe(1);
  });

  test('addGold increments gold and emits gold event', () => {
    const s = new GameState();
    const spy = vi.fn();
    s.on('gold', spy);
    s.addGold(100);
    expect(s.gold).toBe(100);
    expect(spy).toHaveBeenCalledWith(100);
    s.addGold(50);
    expect(s.gold).toBe(150);
    expect(spy).toHaveBeenLastCalledWith(150);
  });

  test('setDepth updates depth and emits depth event', () => {
    const s = new GameState();
    const spy = vi.fn();
    s.on('depth', spy);
    s.setDepth(123.4);
    expect(s.depthKm).toBe(123.4);
    expect(spy).toHaveBeenCalledWith(123.4);
  });

  test('setUpgrade updates upgrade level and emits upgrade event', () => {
    const s = new GameState();
    const spy = vi.fn();
    s.on('upgrade', spy);
    s.setUpgrade('drillPower', 3);
    expect(s.upgrades.drillPower).toBe(3);
    expect(spy).toHaveBeenCalledWith({ name: 'drillPower', level: 3 });
  });

  test('off removes a listener', () => {
    const s = new GameState();
    const spy = vi.fn();
    s.on('gold', spy);
    s.off('gold', spy);
    s.addGold(10);
    expect(spy).not.toHaveBeenCalled();
  });

  test('multiple listeners all fire', () => {
    const s = new GameState();
    const a = vi.fn();
    const b = vi.fn();
    s.on('gold', a);
    s.on('gold', b);
    s.addGold(5);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  test('spendGold deducts only when affordable, returns success boolean', () => {
    const s = new GameState();
    s.addGold(100);
    expect(s.spendGold(40)).toBe(true);
    expect(s.gold).toBe(60);
    expect(s.spendGold(999)).toBe(false);
    expect(s.gold).toBe(60);
  });
});
