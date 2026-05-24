import { describe, test, expect } from 'vitest';
import { OreLayer } from '../src/objects/OreLayer.js';
import { BiomeManager } from '../src/objects/BiomeManager.js';

const biomeManager = new BiomeManager();
const oreLayer = new OreLayer(biomeManager);

describe('OreLayer.rollOreAt', () => {
  test('returns null when rand exceeds sum of probabilities', () => {
    // 1-1 표토층: coal=0.15, copper=0.05 → 합 0.20
    expect(oreLayer.rollOreAt(100, 0.99)).toBeNull();
    expect(oreLayer.rollOreAt(100, 0.50)).toBeNull();
  });

  test('returns coal at km=100 with rand=0.05 (within coal slot 0~0.15)', () => {
    expect(oreLayer.rollOreAt(100, 0.05).id).toBe('coal');
  });

  test('returns coal at km=100 with rand=0.14 (still within coal)', () => {
    expect(oreLayer.rollOreAt(100, 0.14).id).toBe('coal');
  });

  test('returns copper at km=100 with rand=0.18 (within copper slot 0.15~0.20)', () => {
    expect(oreLayer.rollOreAt(100, 0.18).id).toBe('copper');
  });

  test('returns crystal in Crystal Cave 2-2 수정층 at km=20000', () => {
    // 2-2: crystal=0.12, amethyst=0.08
    expect(oreLayer.rollOreAt(20000, 0.05).id).toBe('crystal');
    expect(oreLayer.rollOreAt(20000, 0.13).id).toBe('amethyst');
  });

  test('returns sapphire in Abyssal at km=55000', () => {
    // 3-1: crystal=0.05, sapphire=0.15
    const ore = oreLayer.rollOreAt(55000, 0.10);
    expect(ore.id).toBe('sapphire');
  });

  test('returns lavaCrystal possibility in Magma 5-3', () => {
    // 5-3 마그마층: ruby=0.10, diamond=0.10, lavaCrystal=0.05
    // 0~0.10 ruby, 0.10~0.20 diamond, 0.20~0.25 lavaCrystal
    expect(oreLayer.rollOreAt(750000, 0.22).id).toBe('lavaCrystal');
  });

  test('returns voidStone possibility in Void cycle', () => {
    // 6-3: voidStone=0.08 first → 0~0.08 should be voidStone
    expect(oreLayer.rollOreAt(2_000_000, 0.04).id).toBe('voidStone');
  });

  test('returned ore is a full ORE object', () => {
    const ore = oreLayer.rollOreAt(100, 0.05);
    expect(ore.id).toBe('coal');
    expect(ore.name).toBe('Coal');
    expect(ore.value).toBe(5);
    expect(typeof ore.color).toBe('number');
  });
});
