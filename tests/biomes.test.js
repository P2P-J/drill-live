import { describe, test, expect } from 'vitest';
import { BIOMES, ALL_LAYERS } from '../src/config/biomes.js';
import { ORES } from '../src/config/ores.js';

describe('BIOMES dataset', () => {
  test('has 6 biomes in PRD order', () => {
    expect(BIOMES.map(b => b.id)).toEqual(['earth', 'crystal', 'abyssal', 'forest', 'magma', 'void']);
  });

  test('biome depth ranges are continuous (prev.endKm == next.startKm)', () => {
    for (let i = 1; i < BIOMES.length; i++) {
      expect(BIOMES[i].startKm).toBe(BIOMES[i - 1].endKm);
    }
  });

  test('first biome starts at 0km, void biome is infinite', () => {
    expect(BIOMES[0].startKm).toBe(0);
    const voidBiome = BIOMES.find(b => b.id === 'void');
    expect(voidBiome.endKm).toBe(Infinity);
    expect(voidBiome.isInfinite).toBe(true);
  });

  test('every layer has continuous range within its biome', () => {
    for (const biome of BIOMES) {
      for (let i = 1; i < biome.layers.length; i++) {
        expect(biome.layers[i].startKm).toBe(biome.layers[i - 1].endKm);
      }
    }
  });

  test('every layer ore probability total stays under 1.0 (leaves room for empty tiles)', () => {
    for (const layer of ALL_LAYERS) {
      const total = Object.values(layer.oreProbabilities).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(1.0);
      expect(total).toBeGreaterThanOrEqual(0);
    }
  });

  test('every ore in oreProbabilities is a valid ore id', () => {
    for (const layer of ALL_LAYERS) {
      for (const oreId of Object.keys(layer.oreProbabilities)) {
        expect(ORES[oreId]).toBeDefined();
      }
    }
  });

  test('transitionTo layers exist at biome boundaries (except after void)', () => {
    for (let i = 0; i < BIOMES.length - 1; i++) {
      const lastLayer = BIOMES[i].layers[BIOMES[i].layers.length - 1];
      expect(lastLayer.transitionTo).toBeDefined();
    }
  });
});
