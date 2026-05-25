// LIKE overlay 전용 dedupe + global rate limit.
// 다른 kind(SUB/MEMBER/SUPERCHAT)는 throttle 안 함.

const DEDUPE_MS = 5000;
const RATE_PER_SEC = 10;
const RATE_WINDOW_MS = 1000;

export class OverlayThrottle {
  constructor() {
    this._lastByName = new Map();   // name → ms
    this._recentLikes = [];          // ms timestamps in last RATE_WINDOW_MS
  }

  admitLike(name) {
    const now = Date.now();
    const last = this._lastByName.get(name);
    if (last !== undefined && now - last < DEDUPE_MS) return false;
    this._recentLikes = this._recentLikes.filter(t => now - t < RATE_WINDOW_MS);
    if (this._recentLikes.length >= RATE_PER_SEC) return false;
    this._lastByName.set(name, now);
    this._recentLikes.push(now);
    if (this._lastByName.size > 500) {
      for (const [n, t] of this._lastByName) {
        if (now - t > DEDUPE_MS * 6) this._lastByName.delete(n);
      }
    }
    return true;
  }

  admitOther() {
    return true;
  }
}
