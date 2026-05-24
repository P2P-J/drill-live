import { describe, test, expect } from 'vitest';
import { ORES, ORE_IDS } from '../src/config/ores.js';

describe('ORES catalog', () => {
  test('has 12 entries', () => {
    expect(ORE_IDS.length).toBe(12);
  });

  test('every ore has required fields', () => {
    for (const id of ORE_IDS) {
      const ore = ORES[id];
      expect(ore.id).toBe(id);
      expect(typeof ore.name).toBe('string');
      expect(ore.name.length).toBeGreaterThan(0);
      expect(typeof ore.value).toBe('number');
      expect(ore.value).toBeGreaterThan(0);
      expect(typeof ore.color).toBe('number');
      expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(ore.rarity);
    }
  });

  test('values are monotonically non-decreasing in declared order', () => {
    let prev = 0;
    for (const id of ORE_IDS) {
      expect(ORES[id].value).toBeGreaterThanOrEqual(prev);
      prev = ORES[id].value;
    }
  });

  test('cheapest ore is coal (5G), priciest is voidStone (10000G)', () => {
    expect(ORES.coal.value).toBe(5);
    expect(ORES.voidStone.value).toBe(10000);
  });
});
