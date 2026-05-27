// 외부 트리거 브리지 서버에 연결. 서버가 push한 트리거 이벤트를 TriggerSystem.fire로 전달.
// 서버 미실행 / 연결 끊김 / 메시지 형식 오류 시 silently 동작 — 키보드 시뮬레이션은 그대로 작동.
// Phase 4: youtube-chat / Streamer.bot → 서버 → 게임 흐름 완성.

// Electron file:// 환경에선 location.hostname이 빈 문자열이라 'ws://:8080/ws'가 됨 → 연결 실패.
// file:// 또는 hostname 비어있으면 localhost 강제.
function getDefaultUrl() {
  if (typeof location === 'undefined') return 'ws://localhost:8080/ws';
  if (location.protocol === 'file:' || !location.hostname) {
    return 'ws://localhost:8080/ws';
  }
  return `ws://${location.hostname}:8080/ws`;
}
const DEFAULT_URL = getDefaultUrl();
const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export class RemoteTrigger {
  constructor(triggerSystem, opts = {}) {
    this.triggerSystem = triggerSystem;
    this.url = opts.url ?? DEFAULT_URL;
    this.enabled = opts.enabled ?? true;
    this._ws = null;
    this._reconnectMs = RECONNECT_INITIAL_MS;
    this._closedManually = false;
    this._listeners = new Map();
  }

  connect() {
    if (!this.enabled || this._closedManually) return;
    try {
      const ws = new WebSocket(this.url);
      this._ws = ws;
      ws.addEventListener('open', () => {
        console.log(`[RemoteTrigger] connected → ${this.url}`);
        this._reconnectMs = RECONNECT_INITIAL_MS;
        this._emit('open');
      });
      ws.addEventListener('message', (e) => this._handleMessage(e.data));
      ws.addEventListener('close', () => {
        this._ws = null;
        this._emit('close');
        if (!this._closedManually) this._scheduleReconnect();
      });
      ws.addEventListener('error', () => {
        // 서버 미실행 시 에러 — 다음 reconnect로 회복. 콘솔에 spam 안 함.
      });
    } catch (e) {
      console.warn('[RemoteTrigger] connect error:', e.message);
      this._scheduleReconnect();
    }
  }

  disconnect() {
    this._closedManually = true;
    this._ws?.close();
    this._ws = null;
  }

  _scheduleReconnect() {
    setTimeout(() => this.connect(), this._reconnectMs);
    this._reconnectMs = Math.min(RECONNECT_MAX_MS, this._reconnectMs * 1.7);
  }

  _handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (_e) { return; }
    if (msg?.type === 'trigger' && typeof msg.triggerId === 'string') {
      this.triggerSystem.fire(msg.triggerId, msg.donor ?? null);
      this._emit('trigger', msg);
      return;
    }
    if (msg?.type === 'overlay' && typeof msg.kind === 'string') {
      this._emit('overlay', msg);
      return;
    }
    // 'welcome' 등 기타 메시지는 무시
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
