import { describe, test, expect, beforeEach, vi } from 'vitest';
import { OverlayThrottle } from '../server/overlay.js';

describe('OverlayThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T00:00:00Z'));
  });

  test('admits first LIKE for a name', () => {
    const t = new OverlayThrottle();
    expect(t.admitLike('Alex')).toBe(true);
  });

  test('rejects same name within dedupe window (5s)', () => {
    const t = new OverlayThrottle();
    t.admitLike('Alex');
    vi.advanceTimersByTime(4999);
    expect(t.admitLike('Alex')).toBe(false);
  });

  test('admits same name after 5s window', () => {
    const t = new OverlayThrottle();
    t.admitLike('Alex');
    vi.advanceTimersByTime(5001);
    expect(t.admitLike('Alex')).toBe(true);
  });

  test('global rate limit: 10/sec rolling', () => {
    const t = new OverlayThrottle();
    for (let i = 0; i < 10; i++) {
      expect(t.admitLike(`u${i}`)).toBe(true);
    }
    expect(t.admitLike('u10')).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(t.admitLike('u11')).toBe(true);
  });

  test('non-LIKE kinds always admitted (no throttle)', () => {
    const t = new OverlayThrottle();
    for (let i = 0; i < 20; i++) {
      expect(t.admitOther()).toBe(true);
    }
  });
});
