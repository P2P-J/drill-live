# 시청자 이벤트 오버레이 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 라이브의 신규 구독·LIKE·슈퍼챗 이벤트를 게임 화면에 닉네임과 함께 실시간 표시.

**Architecture:** 서버에 `/overlay` 엔드포인트 신설 (게임 트리거와 분리). LIKE는 서버에서 dedupe/throttle. 게임은 `OverlaySystem`이 WebSocket overlay 메시지를 받아 중앙 상단 팝업 큐(SUB/MEMBER/SUPERCHAT) + 좌측 하단 LIKE 피드로 렌더.

**Tech Stack:** Node.js + Express(server), Phaser 4(game), Vitest(test), youtube-chat, ws.

**Spec:** [docs/superpowers/specs/2026-05-25-viewer-overlay-design.md](../specs/2026-05-25-viewer-overlay-design.md)

---

## File Structure

| 파일 | 종류 | 책임 |
|------|------|------|
| `server/overlay.js` | 신규 | dedupe + throttle 순수 로직 (테스트 가능) |
| `server/index.js` | 수정 | `POST /overlay` 엔드포인트, `/like-batch` 통합 |
| `server/youtube-bridge.js` | 수정 | 슈퍼챗 직후 overlay POST |
| `server/fire.js` | 수정 | `overlay` 서브커맨드 |
| `server/README.md` | 수정 | Streamer.bot 연동 섹션 |
| `src/systems/RemoteTrigger.js` | 수정 | `overlay` 타입 분기 + emit |
| `src/systems/OverlaySystem.js` | 신규 | PopupQueue + LikeFeed |
| `src/scenes/UIScene.js` | 수정 | OverlaySystem 인스턴스화 + 구독 |
| `tests/overlayHelper.test.js` | 신규 | overlay.js 단위 테스트 |
| `tests/remoteTrigger.test.js` | 신규 | overlay 분기 테스트 |
| `tests/overlaySystem.test.js` | 신규 | 큐/피드 로직 테스트 |

---

## Task 1: 서버 overlay 헬퍼 모듈 (dedupe + throttle)

**Files:**
- Create: `server/overlay.js`
- Test: `tests/overlayHelper.test.js`

- [ ] **Step 1: Write failing tests**

`tests/overlayHelper.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/overlayHelper.test.js`
Expected: FAIL with "Cannot find module ../server/overlay.js"

- [ ] **Step 3: Implement `server/overlay.js`**

```javascript
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
    // dedupe
    const last = this._lastByName.get(name);
    if (last !== undefined && now - last < DEDUPE_MS) return false;
    // rate limit
    this._recentLikes = this._recentLikes.filter(t => now - t < RATE_WINDOW_MS);
    if (this._recentLikes.length >= RATE_PER_SEC) return false;
    // admit
    this._lastByName.set(name, now);
    this._recentLikes.push(now);
    // cleanup old name entries
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/overlayHelper.test.js`
Expected: PASS, 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/overlay.js tests/overlayHelper.test.js
git commit -m "feat(server): overlay throttle/dedupe 헬퍼"
```

---

## Task 2: 서버 — POST /overlay 엔드포인트

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add VALID_OVERLAY_KINDS and import OverlayThrottle**

`server/index.js`의 상단 import 영역에 추가:
```javascript
import { OverlayThrottle } from './overlay.js';
```

`VALID_TRIGGER_IDS` 정의 아래에 추가:
```javascript
const VALID_OVERLAY_KINDS = new Set(['SUB', 'MEMBER', 'SUPERCHAT', 'LIKE']);
const overlayThrottle = new OverlayThrottle();

function sanitizeName(raw) {
  return String(raw ?? '').slice(0, 80).trim();
}
```

- [ ] **Step 2: Add /overlay endpoint**

`app.post('/trigger', ...)` 정의 아래에 추가:
```javascript
// 표시 전용 오버레이 — 게임 메커니즘에 영향 없음.
// LIKE는 서버에서 dedupe(5s/name) + rate limit(10/s) 적용.
app.post('/overlay', (req, res) => {
  const { kind, name, amount, tier, text } = req.body ?? {};
  if (!VALID_OVERLAY_KINDS.has(kind)) {
    return res.status(400).json({ error: 'invalid kind', got: kind, valid: [...VALID_OVERLAY_KINDS] });
  }
  const cleanName = sanitizeName(name);
  if (!cleanName) return res.status(400).json({ error: 'name required' });

  const admitted = kind === 'LIKE'
    ? overlayThrottle.admitLike(cleanName)
    : overlayThrottle.admitOther();

  if (!admitted) {
    return res.json({ ok: true, throttled: true, delivered: 0 });
  }

  const event = {
    type: 'overlay',
    kind,
    name: cleanName,
    amount: typeof amount === 'number' ? amount : null,
    tier: typeof tier === 'string' ? tier : null,
    text: typeof text === 'string' ? text.slice(0, 200) : null,
    at: Date.now(),
  };
  broadcast(event);
  res.json({ ok: true, delivered: clients.size, event });
});
```

- [ ] **Step 3: Update /status to include overlay kinds**

기존 `/status` 핸들러 교체:
```javascript
app.get('/status', (_req, res) => {
  res.json({
    ok: true,
    clients: clients.size,
    validTriggers: [...VALID_TRIGGER_IDS],
    validOverlayKinds: [...VALID_OVERLAY_KINDS],
  });
});
```

- [ ] **Step 4: Manual smoke test**

서버 띄우고 호출:
```bash
npm run server &
SERVER_PID=$!
sleep 1

# 정상 케이스
curl -s -X POST http://localhost:8080/overlay \
  -H "Content-Type: application/json" \
  -d '{"kind":"SUB","name":"Alex"}'
# 기대: {"ok":true,"delivered":0,"event":{"type":"overlay","kind":"SUB",...}}

# 잘못된 kind
curl -s -X POST http://localhost:8080/overlay \
  -H "Content-Type: application/json" \
  -d '{"kind":"NOPE","name":"Alex"}'
# 기대: HTTP 400, {"error":"invalid kind",...}

# 빈 name
curl -s -X POST http://localhost:8080/overlay \
  -H "Content-Type: application/json" \
  -d '{"kind":"SUB"}'
# 기대: HTTP 400, {"error":"name required"}

# LIKE 5회 중복 (dedupe 확인)
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8080/overlay \
    -H "Content-Type: application/json" \
    -d '{"kind":"LIKE","name":"SameUser"}'
  echo
done
# 기대: 첫번째만 delivered: N, 나머지는 throttled: true

kill $SERVER_PID
```

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat(server): POST /overlay 엔드포인트 (sub/like/superchat 표시용)"
```

---

## Task 3: 서버 — /like-batch에 overlay broadcast 통합

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Update /like-batch handler**

기존 `app.post('/like-batch', ...)` 핸들러를 다음으로 교체:
```javascript
// LIKE 배치 — 각 이름마다 LIKE 트리거 + overlay 둘 다 broadcast (overlay만 throttle).
app.post('/like-batch', (req, res) => {
  const donors = Array.isArray(req.body?.donors) ? req.body.donors : [];
  if (donors.length === 0) return res.status(400).json({ error: 'donors[] required' });
  let overlayDelivered = 0;
  for (const raw of donors) {
    const donor = sanitizeName(raw);
    if (!donor) continue;
    // 게임 트리거는 항상 발사 (throttle 없음)
    broadcast({ type: 'trigger', triggerId: 'LIKE', donor, at: Date.now() });
    // overlay만 throttle 통과 시 발사
    if (overlayThrottle.admitLike(donor)) {
      broadcast({
        type: 'overlay',
        kind: 'LIKE',
        name: donor,
        amount: null, tier: null, text: null,
        at: Date.now(),
      });
      overlayDelivered++;
    }
  }
  console.log(`[FIRE] LIKE × ${donors.length} (overlay ${overlayDelivered}) → ${clients.size} clients`);
  res.json({ ok: true, count: donors.length, overlayDelivered, delivered: clients.size });
});
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run server &
SERVER_PID=$!
sleep 1

curl -s -X POST http://localhost:8080/like-batch \
  -H "Content-Type: application/json" \
  -d '{"donors":["A","B","C","A","A"]}'
# 기대: count:5, overlayDelivered: ~3 (A는 dedupe로 1번만)

kill $SERVER_PID
```

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(server): /like-batch가 trigger + overlay 둘 다 broadcast"
```

---

## Task 4: youtube-bridge.js — 슈퍼챗 직후 overlay POST

**Files:**
- Modify: `server/youtube-bridge.js`

- [ ] **Step 1: Add postOverlay helper**

`postTrigger` 함수 정의 바로 아래에 추가:
```javascript
async function postOverlay(payload) {
  try {
    const res = await fetch(`${SERVER_URL}/overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[YT] /overlay ${res.status}:`, body);
    }
  } catch (e) {
    console.warn('[YT] POST /overlay error:', e.message);
  }
}
```

- [ ] **Step 2: Fire overlay after superchat trigger**

`chat.on('chat', ...)` 핸들러 안의 슈퍼챗 처리 블록을 다음으로 교체 (기존 `if (item.superchat) { ... return; }` 전체):
```javascript
  if (item.superchat) {
    const usd = parseAmountToUsd(item.superchat.amount);
    const defaultTier = tierFromAmount(usd);
    const triggerId = keywordFromText(text, defaultTier) ?? defaultTier;
    console.log(`[YT] superchat ${item.superchat.amount} (~$${usd.toFixed(2)}) from ${author} → ${triggerId}`);
    postTrigger(triggerId, author);
    postOverlay({ kind: 'SUPERCHAT', name: author, amount: Number(usd.toFixed(2)), tier: triggerId });
    return;
  }
```

- [ ] **Step 3: Handle membership messages (best-effort)**

슈퍼챗 처리 블록 바로 아래, 스트리머 명령어 블록 위에 추가:
```javascript
  // 멤버십 가입 — youtube-chat 시스템 메시지 (형식 불안정, best-effort)
  if (item.isMembership) {
    console.log(`[YT] membership from ${author}`);
    postOverlay({ kind: 'MEMBER', name: author });
    postTrigger('SUB', author);  // 광물 스폰 이펙트 재사용
    return;
  }
```

- [ ] **Step 4: Manual verification note**

실제 슈퍼챗 테스트는 라이브 방송이 필요. 코드 변경 자체는 서버 띄우고 youtube-bridge 실행해서 syntax 에러 없이 시작되는지 확인:
```bash
npm run server &
SERVER_PID=$!
sleep 1
# 잘못된 ID로 띄워서 syntax는 통과하는지 확인 (실제 connect는 실패해도 OK)
timeout 5 node server/youtube-bridge.js INVALID_ID 2>&1 | head -5 || true
kill $SERVER_PID
```
기대: import/parse 에러 없이 실행되어 connect 시도 후 종료.

- [ ] **Step 5: Commit**

```bash
git add server/youtube-bridge.js
git commit -m "feat(yt): 슈퍼챗/멤버십 시 overlay POST 병행"
```

---

## Task 5: server/fire.js — overlay 서브커맨드

**Files:**
- Modify: `server/fire.js`

- [ ] **Step 1: Replace fire.js with subcommand support**

`server/fire.js` 전체 교체:
```javascript
#!/usr/bin/env node
// CLI 헬퍼 — 트리거 또는 overlay 발사.
// 사용:
//   node server/fire.js BOMB                     # 트리거
//   node server/fire.js BOMB Alex
//   node server/fire.js overlay SUB NewbieFox
//   node server/fire.js overlay LIKE CoolGuy
//   node server/fire.js overlay SUPERCHAT Whale99 5 DIAMOND

const PORT = process.env.PORT || 8080;
const args = process.argv.slice(2);

function usage() {
  console.error('Usage:');
  console.error('  node server/fire.js <TRIGGER_ID> [donor]');
  console.error('  node server/fire.js overlay <KIND> <name> [amount] [tier]');
  process.exit(1);
}

if (args.length === 0) usage();

let path, body;
if (args[0] === 'overlay') {
  const [, kind, name, amount, tier] = args;
  if (!kind || !name) usage();
  path = '/overlay';
  body = { kind, name };
  if (amount !== undefined) body.amount = Number(amount);
  if (tier !== undefined) body.tier = tier;
} else {
  const [triggerId, donor] = args;
  path = '/trigger';
  body = { triggerId };
  if (donor) body.donor = donor;
}

try {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('FAIL:', json);
    process.exit(2);
  }
  console.log(`OK ${path}:`, json);
} catch (e) {
  console.error('Could not reach server at port ' + PORT + ':', e.message);
  console.error('Did you run `npm run server`?');
  process.exit(3);
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run server &
SERVER_PID=$!
sleep 1

node server/fire.js overlay SUB NewbieFox
# 기대: OK /overlay: {ok:true, ...}

node server/fire.js overlay LIKE CoolGuy
# 기대: OK /overlay: {ok:true, ...}

node server/fire.js overlay SUPERCHAT Whale99 5 DIAMOND
# 기대: OK /overlay: {ok:true, event:{...amount:5,tier:"DIAMOND"}}

node server/fire.js BOMB Alex
# 기대 (기존 동작 회귀 확인): OK /trigger: {ok:true, ...}

kill $SERVER_PID
```

- [ ] **Step 3: Commit**

```bash
git add server/fire.js
git commit -m "feat(fire): overlay 서브커맨드 (sub/like/superchat 수동 테스트)"
```

---

## Task 6: server/README.md — Streamer.bot 가이드 + overlay 섹션

**Files:**
- Modify: `server/README.md`

- [ ] **Step 1: Append overlay endpoint to 엔드포인트 table**

기존 엔드포인트 테이블에 한 줄 추가 (`/like-batch` 행 아래):
```markdown
| POST | `/overlay` | `{kind, name, amount?, tier?, text?}` — 화면 표시 전용 (게임 영향 없음) |
```

- [ ] **Step 2: Append new section after 환경변수 section**

`### 환경변수` 섹션 끝에 다음 추가:
```markdown

---

## 시청자 이벤트 화면 표시 (overlay)

신규 구독, LIKE, 슈퍼챗·멤버십을 게임 화면에 닉네임과 함께 표시.

- **SUB / MEMBER / SUPERCHAT**: 화면 중앙 상단 팝업 (2.5초)
- **LIKE**: 좌측 하단 피드 (최대 6개, 4초 자동 fade)

LIKE는 서버에서 동일 닉네임 5초 dedupe + 초당 10개 throttle (overlay만, 게임 트리거는 영향 없음).

### 수동 테스트
```bash
npm run fire overlay SUB NewbieFox
npm run fire overlay LIKE CoolGuy
npm run fire overlay SUPERCHAT Whale99 5 DIAMOND
npm run fire overlay MEMBER VIP123 4.99
```

### Streamer.bot 연동 (신규 구독 / LIKE)

YouTube의 신규 구독/LIKE는 youtube-chat 라이브러리로 받을 수 없음. Streamer.bot에서 이벤트를 잡아 `POST /overlay`로 전달.

1. Streamer.bot → **Actions** → New: "YouTube Sub Overlay"
   - **Trigger**: YouTube → User Subscribed (또는 New Member)
   - **Sub-Action**: HTTP Request
     - URL: `http://localhost:8080/overlay`
     - Method: POST
     - Headers: `Content-Type: application/json`
     - Body: `{"kind":"SUB","name":"%user%"}`
2. 같은 방식으로 "YouTube Like":
   - Trigger: YouTube → Like (or 비슷한 이름)
   - Body: `{"kind":"LIKE","name":"%user%"}`
3. 멤버십:
   - Trigger: YouTube → New Member / Member Milestone
   - Body: `{"kind":"MEMBER","name":"%user%","amount":4.99}`

> `%user%` 같은 변수명은 Streamer.bot 버전마다 다를 수 있음. 실제 트리거 변수 패널에서 닉네임에 해당하는 토큰으로 치환.

슈퍼챗은 `youtube-bridge.js`가 자동으로 `/overlay`도 호출하므로 Streamer.bot 설정 불필요.
```

- [ ] **Step 3: Commit**

```bash
git add server/README.md
git commit -m "docs(server): overlay 엔드포인트 + Streamer.bot 연동 가이드"
```

---

## Task 7: RemoteTrigger.js — overlay 메시지 분기

**Files:**
- Modify: `src/systems/RemoteTrigger.js`
- Test: `tests/remoteTrigger.test.js`

- [ ] **Step 1: Write failing test**

`tests/remoteTrigger.test.js`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/remoteTrigger.test.js`
Expected: FAIL — overlay 분기가 없어서 "expected handler to have been called" 실패.

- [ ] **Step 3: Add overlay branch to RemoteTrigger**

`src/systems/RemoteTrigger.js`의 `_handleMessage` 메서드를 다음으로 교체:
```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/remoteTrigger.test.js`
Expected: PASS, 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/systems/RemoteTrigger.js tests/remoteTrigger.test.js
git commit -m "feat(client): RemoteTrigger overlay 메시지 분기 + emit"
```

---

## Task 8: OverlaySystem — 큐/피드 데이터 로직 (Phaser 무관)

**Files:**
- Create: `src/systems/OverlaySystem.js`
- Test: `tests/overlaySystem.test.js`

PopupQueue + LikeFeed의 **데이터 흐름**만 먼저 구현하고 단위 테스트. 실제 Phaser 렌더는 Task 9에서 통합.

- [ ] **Step 1: Write failing tests**

`tests/overlaySystem.test.js`:
```javascript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OverlaySystem } from '../src/systems/OverlaySystem.js';

function makeScene() {
  // minimal stub: render hooks가 호출되었는지만 확인
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
    // 첫 번째만 즉시 렌더, 나머지는 큐 대기
    expect(scene.showPopupCalls).toHaveLength(1);
    expect(scene.showPopupCalls[0].text).toBe('⭐ A subscribed!');
    // notifyPopupDone 호출 시 다음 항목 진행
    sys.notifyPopupDone();
    expect(scene.showPopupCalls).toHaveLength(2);
    expect(scene.showPopupCalls[1].text).toBe('⭐ B subscribed!');
    sys.notifyPopupDone();
    expect(scene.showPopupCalls[2].text).toBe('⭐ C subscribed!');
  });

  test('queue caps at 12 — oldest dropped', () => {
    const scene = makeScene();
    const sys = new OverlaySystem(scene);
    // 1개 즉시 렌더, 나머지 큐 적재
    for (let i = 0; i < 20; i++) {
      sys.handle({ type: 'overlay', kind: 'SUB', name: `U${i}` });
    }
    // 렌더된 1 + 큐 최대 12 = 13개 효율 처리
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/overlaySystem.test.js`
Expected: FAIL with "Cannot find module ../src/systems/OverlaySystem.js"

- [ ] **Step 3: Implement OverlaySystem (data-only)**

`src/systems/OverlaySystem.js`:
```javascript
// OverlaySystem — 시청자 이벤트(sub/member/superchat/like) 화면 표시 관리.
// 데이터 로직(큐/피드)과 렌더링을 분리해서, scene이 _renderPopup/_renderLike/_expireLike 훅을 구현하면 동작.

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

  // 팝업 큐
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

  // LIKE 피드
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/overlaySystem.test.js`
Expected: PASS, 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/systems/OverlaySystem.js tests/overlaySystem.test.js
git commit -m "feat(client): OverlaySystem 데이터 로직 (팝업 큐 + LIKE 피드)"
```

---

## Task 9: UIScene 통합 — Phaser 렌더 훅 + RemoteTrigger 구독

**Files:**
- Modify: `src/scenes/UIScene.js`

UIScene이 `OverlaySystem`의 `_renderPopup`/`_renderLike`/`_expireLike` 훅을 구현하고, `RemoteTrigger`의 `overlay` 이벤트에 핸들러를 연결.

- [ ] **Step 1: Import OverlaySystem and accept remoteTrigger from init**

`src/scenes/UIScene.js` 상단 imports 영역에 추가:
```javascript
import { OverlaySystem } from '../systems/OverlaySystem.js';
```

`init(data)` 메서드를 다음으로 교체 (`remoteTrigger`와 overlay 표시용 컨테이너 맵 추가):
```javascript
  init(data) {
    this.upgradeSystem = data.upgradeSystem;
    this.biomeManager = data.biomeManager;
    this.buffSystem = data.buffSystem;
    this.triggerSystem = data.triggerSystem;
    this.remoteTrigger = data.remoteTrigger;
    this.eventLines = [];
    this.buffIndicators = new Map();
    this.likeItems = new Map();   // name → container
  }
```

- [ ] **Step 2: Add overlay UI builders + render hooks**

`_wireEvents()` 메서드 정의 바로 위에 다음 메서드들 추가:
```javascript
  _buildOverlay() {
    // 팝업 — 가운데 상단 (announcement보다 살짝 아래, 겹치지 않게)
    this.overlayPopup = this.add.container(GAME.width / 2, 200);
    this.overlayPopup.setDepth(99);
    this.overlayPopup.setVisible(false);
    this.overlayPopupText = this.add.text(0, 0, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '52px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.overlayPopup.add(this.overlayPopupText);

    // LIKE 피드 — 좌측 하단, 인벤토리 옆 BOTTOM_BAR 위
    // 인벤토리는 우측 폭이 INVENTORY_X+INVENTORY_W=102까지. 그 옆 x=120부터.
    this.overlayLikeAnchorX = 120;
    this.overlayLikeAnchorY = BOTTOM_BAR_Y - 16;  // 아래에서 위로 쌓음
    this.overlayLikeRowH = 36;
  }

  // OverlaySystem이 호출 — 팝업 한 개 표시 (2.5초 후 done 통보)
  _renderPopup(text, kind) {
    const colorByKind = { SUB: '#FFD700', MEMBER: '#E1BEE7', SUPERCHAT: '#FF8A65' };
    this.overlayPopupText.setText(text);
    this.overlayPopupText.setColor(colorByKind[kind] ?? '#FFFFFF');
    this.overlayPopup.setVisible(true);
    this.overlayPopup.setAlpha(0);
    this.overlayPopup.setScale(0.7);

    this.tweens.killTweensOf(this.overlayPopup);
    this.tweens.add({
      targets: this.overlayPopup, alpha: 1, scale: 1.0,
      duration: 220, ease: 'Back.easeOut',
    });
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: this.overlayPopup, alpha: 0,
        duration: 300,
        onComplete: () => {
          this.overlayPopup.setVisible(false);
          this.overlaySystem?.notifyPopupDone();
        },
      });
    });
  }

  // OverlaySystem이 호출 — LIKE 1건 추가 (4초 자체 fade)
  _renderLike(name) {
    // 기존 동일 이름 항목이 살아있으면 먼저 제거 (서버 dedupe로 보통 없음, 안전망)
    const existing = this.likeItems.get(name);
    if (existing) existing.destroy();

    const c = this.add.container(this.overlayLikeAnchorX, this.overlayLikeAnchorY);
    c.setDepth(98);
    const txt = this.add.text(0, 0, `💗 ${name}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#FF80AB',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0, 1);
    c.add(txt);
    c.setAlpha(0);
    this.likeItems.set(name, c);

    // 위쪽 기존 항목들 한 칸씩 밀어올림
    this._restackLikeFeed();

    this.tweens.add({
      targets: c, alpha: 1, duration: 150, ease: 'Quad.easeOut',
    });
    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: c, alpha: 0, duration: 250,
        onComplete: () => {
          c.destroy();
          this.likeItems.delete(name);
          this.overlaySystem?.notifyLikeExpired(name);
          this._restackLikeFeed();
        },
      });
    });
  }

  // OverlaySystem이 호출 — 큐 초과로 강제 만료
  _expireLike(name) {
    const c = this.likeItems.get(name);
    if (!c) return;
    this.tweens.killTweensOf(c);
    this.tweens.add({
      targets: c, alpha: 0, duration: 200,
      onComplete: () => {
        c.destroy();
        this.likeItems.delete(name);
        this._restackLikeFeed();
      },
    });
  }

  _restackLikeFeed() {
    // 가장 최근(맵 삽입 순) 항목이 가장 아래(=anchorY).
    const entries = [...this.likeItems.entries()];
    const last = entries.length - 1;
    entries.forEach(([_name, c], i) => {
      const targetY = this.overlayLikeAnchorY - (last - i) * this.overlayLikeRowH;
      this.tweens.add({
        targets: c, y: targetY, duration: 120, ease: 'Quad.easeOut',
      });
    });
  }
```

- [ ] **Step 3: Wire OverlaySystem in create()**

`create()` 메서드를 다음으로 교체 (`_buildOverlay()` 호출 + OverlaySystem 인스턴스 + 구독 추가):
```javascript
  create() {
    this._buildTopHud();
    this._buildInventory();
    this._buildBottomBar();
    this._buildStatsPanel();
    this._buildBuffArea();
    this._buildAnnouncement();
    this._buildOverlay();
    this._wireEvents();
    this._refreshStats();

    this.overlaySystem = new OverlaySystem(this);
    if (this.remoteTrigger) {
      this.remoteTrigger.on('overlay', (payload) => this.overlaySystem.handle(payload));
    }
  }
```

- [ ] **Step 4: Pass remoteTrigger from GameScene to UIScene**

`src/scenes/GameScene.js`를 열어 `this.scene.launch('UIScene', { ... })` 또는 `this.scene.start('UIScene', { ... })` 호출 부분을 찾아 `remoteTrigger`를 data에 추가. 검색 명령:
```bash
grep -n "UIScene" src/scenes/GameScene.js
```
호출 형태가 예를 들어 `this.scene.launch('UIScene', { upgradeSystem: this.upgradeSystem, biomeManager: this.biomeManager, buffSystem: this.buffSystem, triggerSystem: this.triggerSystem })` 라면 다음과 같이 한 키를 추가:
```javascript
this.scene.launch('UIScene', {
  upgradeSystem: this.upgradeSystem,
  biomeManager: this.biomeManager,
  buffSystem: this.buffSystem,
  triggerSystem: this.triggerSystem,
  remoteTrigger: this.remoteTrigger,
});
```
(키 이름은 GameScene에서 RemoteTrigger 인스턴스를 보관하는 필드명에 맞춰 조정. 예: `this.remote`, `this.remoteTrigger`. 그쪽 필드명 그대로 사용.)

- [ ] **Step 5: Run all tests (regression check)**

Run: `npm test`
Expected: 모든 기존 테스트 + 신규 overlay 테스트 모두 PASS.

- [ ] **Step 6: Manual browser verification**

3개 터미널에서:
```bash
# 터미널 1
npm run server

# 터미널 2
npm run dev

# 터미널 3 — 브라우저에서 localhost:3000 열고 게임 로딩 후
npm run fire overlay SUB NewbieFox
npm run fire overlay LIKE CoolGuy
npm run fire overlay LIKE Maple99
npm run fire overlay LIKE DrillFan
npm run fire overlay LIKE Pixel
npm run fire overlay LIKE Rocket
npm run fire overlay LIKE Phoenix    # 6번째 — 첫 LIKE 사라지는지 확인
npm run fire overlay SUPERCHAT Whale99 5 MEGA_BLAST
npm run fire overlay MEMBER VIP123 4.99
```

체크리스트 (직접 화면으로 확인):
- [ ] 중앙 상단에 SUB/SUPERCHAT/MEMBER 팝업이 차례로 표시되는가 (서로 겹치지 않고)
- [ ] 좌측 하단(인벤토리 옆)에 LIKE 닉네임이 위로 쌓이는가
- [ ] 6번째 LIKE 추가 시 가장 위(가장 오래된) 항목이 사라지는가
- [ ] 4초 후 각 LIKE 항목이 자동으로 fade out 되는가
- [ ] 기존 게임 트리거(`npm run fire BOMB Alex`)는 평소대로 동작하는가 (회귀 없음)

- [ ] **Step 7: Commit**

```bash
git add src/scenes/UIScene.js src/scenes/GameScene.js
git commit -m "feat(ui): OverlaySystem 통합 — 팝업/LIKE 피드 렌더"
```

---

## Verification Summary

전체 끝나면:

```bash
npm test
```
**Expected:** 모든 테스트 PASS (기존 6 + 신규 3 파일 = 16+ 테스트).

수동 검증은 Task 9 Step 6의 체크리스트.

---

## Spec Coverage Check

| Spec 섹션 | 구현 Task |
|----------|----------|
| 4.1 `/overlay` 엔드포인트 | Task 2 |
| 4.2 LIKE throttle/dedupe | Task 1, 2 |
| 4.3 `/like-batch` 통합 | Task 3 |
| 5 youtube-bridge 슈퍼챗 overlay | Task 4 |
| 5.3 멤버십 best-effort | Task 4 Step 3 |
| 6 Streamer.bot 가이드 | Task 6 |
| 7.1 RemoteTrigger overlay 분기 | Task 7 |
| 7.2 OverlaySystem PopupQueue | Task 8, 9 |
| 7.2 LikeFeed | Task 8, 9 |
| 7.4 UIScene 통합 | Task 9 |
| 8 fire.js overlay 서브커맨드 | Task 5 |
| 10 실패/에러 처리 | Task 2 (validation), Task 7 (malformed) |
