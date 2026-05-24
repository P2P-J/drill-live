import { describe, test, expect } from 'vitest';
import { BiomeManager } from '../src/objects/BiomeManager.js';

const bm = new BiomeManager();

describe('BiomeManager.getBiomeAt', () => {
  test('returns earth at 0km', () => {
    expect(bm.getBiomeAt(0).id).toBe('earth');
  });
  test('returns earth at 5000km', () => {
    expect(bm.getBiomeAt(5000).id).toBe('earth');
  });
  test('returns crystal at 25000km', () => {
    expect(bm.getBiomeAt(25000).id).toBe('crystal');
  });
  test('returns abyssal at 75000km', () => {
    expect(bm.getBiomeAt(75000).id).toBe('abyssal');
  });
  test('returns forest at 300000km', () => {
    expect(bm.getBiomeAt(300000).id).toBe('forest');
  });
  test('returns magma at 800000km', () => {
    expect(bm.getBiomeAt(800000).id).toBe('magma');
  });
  test('returns void at 1500000km', () => {
    expect(bm.getBiomeAt(1500000).id).toBe('void');
  });
  test('returns void at very large km (cycle region)', () => {
    expect(bm.getBiomeAt(50_000_000).id).toBe('void');
  });
});

describe('BiomeManager.getLayerAt', () => {
  test('returns 1-1 표토층 at 100km', () => {
    expect(bm.getLayerAt(100).name).toMatch(/표토/);
  });
  test('returns 1-2 점토층 at 1000km', () => {
    expect(bm.getLayerAt(1000).name).toMatch(/점토/);
  });
  test('returns 1-7 전환 구간 at 9700km', () => {
    expect(bm.getLayerAt(9700).name).toMatch(/전환/);
  });
  test('returns 6-3 cycle layer at deep void', () => {
    const layer = bm.getLayerAt(50_000_000);
    expect(layer.isCycle).toBe(true);
  });
});

describe('BiomeManager.getColorAt', () => {
  test('returns layer.color at exact layer start', () => {
    // 표토층 시작 = 0x A0522D
    expect(bm.getColorAt(0)).toBe(0xA0522D);
  });
  test('returns base color in the middle of a non-transition layer', () => {
    // 1-2 점토층 중간 1000km
    expect(bm.getColorAt(1000)).toBe(0x8B4513);
  });
  test('transition layer 9500km blends toward crystal (t=0)', () => {
    // 9500km = transition start → still 0x2A1E14
    expect(bm.getColorAt(9500)).toBe(0x2A1E14);
  });
  test('transition layer mid blends partway', () => {
    // 9500~9999 transition, at 9750 (t≈0.5)
    // start=0x2A1E14 (42, 30, 20), end=0x9B72CF (155, 114, 207)
    // mid R = round((42+155)/2)=98, G = round((30+114)/2)=72, B = round((20+207)/2)=113
    // 0x624871
    const c = bm.getColorAt(9750);
    const r = (c >> 16) & 0xff;
    const g = (c >> 8) & 0xff;
    const b = c & 0xff;
    expect(r).toBeGreaterThan(42);
    expect(r).toBeLessThan(155);
    expect(g).toBeGreaterThan(30);
    expect(b).toBeGreaterThan(20);
  });
  test('transition near end approaches crystal start color', () => {
    // 9998km, very close to crystal 0x9B72CF
    const c = bm.getColorAt(9998);
    const r = (c >> 16) & 0xff;
    expect(r).toBeGreaterThan(140); // close to 155
  });
  test('void cycle returns color from the cycleColors list', () => {
    // 1,200,000 cycle start → cycleColors[0] = 0xA0522D (earth color)
    expect(bm.getColorAt(1_200_000)).toBe(0xA0522D);
  });
  test('void cycle wraps around after 5 segments', () => {
    // cycleKm=100000, 5 colors → full cycle = 500000km
    // 1,200,000 + 500,000 = 1,700,000 should return cycleColors[0] again
    expect(bm.getColorAt(1_700_000)).toBe(0xA0522D);
  });
});

describe('BiomeManager.kmToY / yToKm', () => {
  test('px <-> km roundtrip', () => {
    // GAME.pxPerKm = 64 default
    expect(bm.kmToY(10)).toBe(640);
    expect(bm.yToKm(640)).toBe(10);
  });
});
