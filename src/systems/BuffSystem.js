// 일시 버프 관리 — 슈퍼챗/구독 트리거가 게임에 임시로 효과를 주는 시스템.
// PRD 4-1: 같은 효과 중복 시 → 지속시간 갱신 (중첩 아님).
// id 예: 'drillRangeUp' (캐굴 범위 확장), 'drillSpeedUp' (속도), 'engineUp' (이동) 등.

export class BuffSystem {
  constructor(scene) {
    this.scene = scene;
    this.buffs = new Map();
    this._listeners = new Map();
  }

  apply(id, params, durationMs) {
    const now = this.scene.time.now;
    const wasActive = this.buffs.has(id);
    this.buffs.set(id, {
      params: { ...params },
      startedAt: now,
      expiresAt: now + durationMs,
      durationMs,
    });
    this._emit('apply', { id, params, durationMs, refreshed: wasActive });
  }

  get(id) {
    const buff = this.buffs.get(id);
    if (!buff) return null;
    if (this.scene.time.now >= buff.expiresAt) {
      this.buffs.delete(id);
      this._emit('expire', { id });
      return null;
    }
    return buff;
  }

  remainingMs(id) {
    const buff = this.buffs.get(id);
    if (!buff) return 0;
    return Math.max(0, buff.expiresAt - this.scene.time.now);
  }

  remainingFrac(id) {
    const buff = this.buffs.get(id);
    if (!buff || buff.durationMs <= 0) return 0;
    return Math.max(0, this.remainingMs(id) / buff.durationMs);
  }

  update() {
    const now = this.scene.time.now;
    for (const [id, buff] of [...this.buffs]) {
      if (now >= buff.expiresAt) {
        this.buffs.delete(id);
        this._emit('expire', { id });
      }
    }
  }

  active() {
    this.update();
    return [...this.buffs.entries()].map(([id, buff]) => ({ id, ...buff }));
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (set) for (const fn of set) fn(payload);
  }
}
