// OverlaySystem — 시청자 이벤트(sub/member/superchat/like) 화면 표시 관리.
// 데이터 로직(큐/피드)과 렌더링을 분리: scene이 _renderPopup/_renderLike/_expireLike 훅을 구현하면 동작.

const POPUP_QUEUE_MAX = 12;
const LIKE_FEED_MAX = 6;
const VALID_KINDS = new Set(['SUB', 'MEMBER', 'SUPERCHAT', 'LIKE']);

function formatPopupText(kind, name, amount, tier) {
  if (kind === 'SUB')    return `⭐ ${name} subscribed!`;
  if (kind === 'MEMBER') return `💎 ${name} joined membership!`;
  if (kind === 'SUPERCHAT') {
    const amt = (amount != null) ? `$${amount}` : '';
    const t = tier ? ` ${tier}` : '';
    return `💰 ${name} — ${amt}${t}`.trim();
  }
  return null;
}

export class OverlaySystem {
  constructor(scene) {
    this.scene = scene;
    this._popupQueue = [];      // pending popups (currently-shown은 큐에 없음)
    this._popupActive = false;
    this._likeFeed = [];         // active LIKE names (oldest first)
  }

  handle(payload) {
    if (!payload || payload.type !== 'overlay') return;
    const { kind, name } = payload;
    if (!VALID_KINDS.has(kind)) return;
    if (typeof name !== 'string' || !name) return;

    if (kind === 'LIKE') {
      this._addLike(name);
      return;
    }
    this._enqueuePopup(payload);
  }

  _enqueuePopup(payload) {
    const text = formatPopupText(payload.kind, payload.name, payload.amount, payload.tier);
    if (!text) return;
    const item = { text, kind: payload.kind };
    if (this._popupActive) {
      this._popupQueue.push(item);
      if (this._popupQueue.length > POPUP_QUEUE_MAX) {
        this._popupQueue.shift();  // 오래된 것 drop
      }
      return;
    }
    this._showPopupNow(item);
  }

  _showPopupNow(item) {
    this._popupActive = true;
    this.scene._renderPopup(item.text, item.kind);
  }

  // Scene이 팝업 사라진 직후 호출 — 다음 큐 항목 진행
  notifyPopupDone() {
    this._popupActive = false;
    const next = this._popupQueue.shift();
    if (next) this._showPopupNow(next);
  }

  _addLike(name) {
    this._likeFeed.push(name);
    this.scene._renderLike(name);
    while (this._likeFeed.length > LIKE_FEED_MAX) {
      const expired = this._likeFeed.shift();
      this.scene._expireLike(expired);
    }
  }

  // LIKE 항목 자체 수명 만료 시 외부에서 호출 가능 (Phaser timer 콜백 등)
  notifyLikeExpired(name) {
    const idx = this._likeFeed.indexOf(name);
    if (idx >= 0) this._likeFeed.splice(idx, 1);
  }
}
