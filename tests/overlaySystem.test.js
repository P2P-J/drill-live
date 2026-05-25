import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OverlaySystem } from '../src/systems/OverlaySystem.js';

function makeScene() {
  return {
    showPopupCalls: [],
    addLikeCalls: [],
    expireLikeCalls: [],
    _renderPopup(text, kind) { this.showPopupCalls.push({ text, kind }); },
    _renderLike(name) { this.addLikeCalls.push(name); },
    _expireLike(name) { this.expireLikeCalls.push(name); },
  };
}

describe('OverlaySystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T00:00:00Z'));
  });

  test('SUB payload routes to popup', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    sys.handle({ type: 'overlay', kind: 'SUB', name: 'NewbieFox' });
    expect(scene.showPopupCalls).toEqual([
      { text: '⭐ NewbieFox subscribed!', kind: 'SUB' },
    ]);
  });

  test('SUPERCHAT formats name + amount + tier', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    sys.handle({ type: 'overlay', kind: 'SUPERCHAT', name: 'Whale', amount: 5, tier: 'MEGA_BLAST' });
    expect(scene.showPopupCalls[0].text).toBe('💰 Whale — $5 MEGA_BLAST');
  });

  test('MEMBER payload routes to popup with diamond icon', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    sys.handle({ type: 'overlay', kind: 'MEMBER', name: 'VIP' });
    expect(scene.showPopupCalls[0].text).toBe('💎 VIP joined membership!');
  });

  test('popups serialize through queue (one at a time)', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    sys.handle({ type: 'overlay', kind: 'SUB', name: 'A' });
    sys.handle({ type: 'overlay', kind: 'SUB', name: 'B' });
    sys.handle({ type: 'overlay', kind: 'SUB', name: 'C' });
    expect(scene.showPopupCalls).toHaveLength(1);
    expect(scene.showPopupCalls[0].text).toBe('⭐ A subscribed!');
    sys.notifyPopupDone();
    expect(scene.showPopupCalls).toHaveLength(2);
    expect(scene.showPopupCalls[1].text).toBe('⭐ B subscribed!');
    sys.notifyPopupDone();
    expect(scene.showPopupCalls[2].text).toBe('⭐ C subscribed!');
  });

  test('queue caps at 12 — oldest dropped', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    for (let i = 0; i < 20; i++) {
      sys.handle({ type: 'overlay', kind: 'SUB', name: `U${i}` });
    }
    let rendered = 1;
    while (sys._popupQueue.length > 0) {
      sys.notifyPopupDone();
      rendered++;
    }
    expect(rendered).toBeLessThanOrEqual(13);
  });

  test('LIKE routes to feed renderer', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    sys.handle({ type: 'overlay', kind: 'LIKE', name: 'CoolGuy' });
    expect(scene.addLikeCalls).toEqual(['CoolGuy']);
    expect(scene.showPopupCalls).toHaveLength(0);
  });

  test('LIKE feed caps at 6 — oldest expired', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    for (let i = 0; i < 8; i++) {
      sys.handle({ type: 'overlay', kind: 'LIKE', name: `U${i}` });
    }
    expect(scene.addLikeCalls).toHaveLength(8);
    expect(scene.expireLikeCalls).toEqual(['U0', 'U1']);
    expect(sys._likeFeed).toHaveLength(6);
  });

  test('ignores invalid payload', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    sys.handle({ type: 'overlay' });
    sys.handle({ type: 'overlay', kind: 'BOGUS', name: 'x' });
    sys.handle({ type: 'overlay', kind: 'SUB' });
    expect(scene.showPopupCalls).toHaveLength(0);
    expect(scene.addLikeCalls).toHaveLength(0);
  });
});
