import { describe, test, expect, vi } from 'vitest';
import { RemoteTrigger } from '../src/systems/RemoteTrigger.js';

describe('RemoteTrigger', () => {
  test('forwards trigger messages to triggerSystem.fire', () => {
    const triggerSystem = { fire: vi.fn() };
    const rt = new RemoteTrigger(triggerSystem, { enabled: false });
    rt._handleMessage(JSON.stringify({ type: 'trigger', triggerId: 'BOMB', donor: 'Alex' }));
    expect(triggerSystem.fire).toHaveBeenCalledWith('BOMB', 'Alex');
  });

  test('emits "overlay" event for overlay messages and does NOT call fire', () => {
    const triggerSystem = { fire: vi.fn() };
    const rt = new RemoteTrigger(triggerSystem, { enabled: false });
    const handler = vi.fn();
    rt.on('overlay', handler);
    const payload = { type: 'overlay', kind: 'SUB', name: 'NewbieFox' };
    rt._handleMessage(JSON.stringify(payload));
    expect(handler).toHaveBeenCalledWith(payload);
    expect(triggerSystem.fire).not.toHaveBeenCalled();
  });

  test('ignores malformed JSON', () => {
    const triggerSystem = { fire: vi.fn() };
    const rt = new RemoteTrigger(triggerSystem, { enabled: false });
    rt._handleMessage('not json');
    expect(triggerSystem.fire).not.toHaveBeenCalled();
  });

  test('ignores unknown message types (welcome etc)', () => {
    const triggerSystem = { fire: vi.fn() };
    const rt = new RemoteTrigger(triggerSystem, { enabled: false });
    const handler = vi.fn();
    rt.on('overlay', handler);
    rt._handleMessage(JSON.stringify({ type: 'welcome', clients: 1 }));
    expect(triggerSystem.fire).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
