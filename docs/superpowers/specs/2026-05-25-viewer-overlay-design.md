# 시청자 이벤트 오버레이 (Sub / Like / Superchat) — 설계 명세

> 작성일: 2026-05-25
> 목적: YouTube 라이브에서 들어오는 신규 구독·LIKE·슈퍼챗(멤버십)을 게임 화면에 닉네임과 함께 실시간 표시.

---

## 1. 동기

현재 `youtube-bridge.js`는 슈퍼챗을 게임 트리거(폭탄/드릴 등)로만 변환한다. 일반 채팅·구독·LIKE는 화면에 노출되지 않는다. 시청자가 자신의 액션이 화면에 반영되는 것을 보지 못하면 참여 동기가 약해진다.

- 슈퍼챗: 게임 이펙트는 있지만 **누가 보냈는지 화면에 안 뜸**
- 신규 구독: 코드 주석에 `별도 시스템 필요`로 표기되어 미구현
- LIKE: 코드 주석에 `채팅 API에 없음`으로 표기되어 미구현
- 일반 채팅 메시지는 표시 대상에서 제외 (요청자 명세)

---

## 2. 범위

### 포함
- 신규 구독자 닉네임 화면 표시
- 슈퍼챗/멤버십 닉네임 + 금액/티어 화면 표시
- LIKE 누른 시청자 닉네임 화면 표시
- 서버 측 `POST /overlay` 엔드포인트
- Streamer.bot에서 호출할 수 있는 페이로드 정의
- 게임 클라이언트 `OverlaySystem`
- 수동 테스트 도구 (`server/fire.js` 확장)

### 제외
- 일반 채팅 메시지 본문 표시
- YouTube Data API v3 직접 폴링 (Streamer.bot이 이벤트 소스 역할)
- LIKE 누적 카운터 시각화 (이름 표시만)
- 다국어 닉네임 별도 처리 (UTF-8 그대로 표시)

---

## 3. 아키텍처

### 3.1 데이터 흐름

```
[YouTube Live]
   │
   ├── (chat/superchat) ──► youtube-bridge.js ──┐
   │                                            │
   └── (sub / like)     ──► Streamer.bot     ───┤
                                                │
                                                ▼
                              ┌─────────────────────────┐
                              │  server/index.js        │
                              │  POST /overlay          │
                              │  POST /trigger (기존)   │
                              └────────────┬────────────┘
                                           │ WebSocket broadcast
                                           ▼
                              ┌─────────────────────────┐
                              │  RemoteTrigger (게임)   │
                              │   ├─ type: 'trigger' ──► TriggerSystem
                              │   └─ type: 'overlay' ──► OverlaySystem
                              └─────────────────────────┘
```

### 3.2 책임 분리

- `/trigger` (기존): 게임 메커니즘에 영향 주는 이벤트 (폭탄, 드릴 변경 등)
- `/overlay` (신규): 표시 전용 이벤트 (게임 메커니즘 영향 없음)
- 슈퍼챗·신규 구독은 **두 엔드포인트 모두**로 발사: 게임 이펙트(폭탄/SUB 광물 스폰)와 화면 표시는 독립 채널
- LIKE는 기존에 트리거로도 존재하므로 두 채널 모두 발사

---

## 4. 서버 (`server/index.js`)

### 4.1 새 엔드포인트: `POST /overlay`

**Request body:**
```json
{
  "kind": "SUB" | "MEMBER" | "SUPERCHAT" | "LIKE",
  "name": "CoolUser1",
  "amount": 5.00,        // SUPERCHAT/MEMBER 옵션
  "tier": "DIAMOND",     // SUPERCHAT 옵션 (티어 표시용)
  "text": "축하해요"      // SUPERCHAT 옵션 (메시지 본문 표시는 v1에서는 미사용)
}
```

**Validation:**
- `kind`는 4종 중 하나 (그 외 400)
- `name`은 문자열, 1~80자로 잘라냄 (긴 닉네임 방어)
- `amount`는 숫자 (선택)
- `tier`는 기존 `VALID_TRIGGER_IDS`와 동일 (선택)

**Response:**
```json
{ "ok": true, "delivered": 2 }
```

**Broadcast payload:**
```json
{
  "type": "overlay",
  "kind": "SUB",
  "name": "CoolUser1",
  "amount": null,
  "tier": null,
  "at": 1716624000000
}
```

### 4.2 LIKE throttle/dedupe (서버 측)

오버레이 LIKE만 throttle 적용 — 게임 트리거 LIKE는 그대로 유지.

```
- 동일 name 5초간 dedupe (최근 닉네임 → 마지막 표시 시각 맵)
- 전역 rate limit: 초당 10개 초과 시 추가 LIKE overlay broadcast 생략
  (단, /trigger는 그대로 유지 — 게임 LIKE 트리거는 동작)
- dedupe/rate limit 맵은 메모리에 보관, 30초 후 만료된 항목 청소
```

### 4.3 기존 `/like-batch` 통합

기존 엔드포인트는 `donors[]` 받아서 LIKE 트리거만 보냈음. **유지하되, 각 donor에 대해 `/overlay` 로직도 동일하게 호출**해서 게임 이펙트와 화면 표시가 함께 일어나게 함.

---

## 5. youtube-bridge.js 변경

### 5.1 슈퍼챗 처리 직후 overlay broadcast

기존 슈퍼챗 핸들러는 `/trigger`만 호출. 직후 `/overlay`도 호출:

```js
// 슈퍼챗 처리 직후
await postOverlay({
  kind: 'SUPERCHAT',
  name: author,
  amount: usd,
  tier: triggerId,
});
```

### 5.2 일반 채팅은 변경 없음

명세대로 일반 채팅 메시지는 표시하지 않음. 현재 동작 유지 (로그만).

### 5.3 멤버십 메시지 (best-effort)

`youtube-chat`의 `item.isMembership` 플래그가 있으면 `MEMBER`로 분기. 형식 불안정성 때문에 신규 멤버 여부 판단이 어려우면 그냥 skip (Streamer.bot 경로에 의존).

---

## 6. Streamer.bot 연동 가이드

`server/README.md`에 1페이지짜리 섹션 추가:

```
## Streamer.bot 연동 — Sub/Like 이벤트
1. Streamer.bot 실행
2. Actions → New → "YouTube Sub Overlay"
   Trigger: YouTube → User Subscribed
   Sub-Action: HTTP Request
     URL: http://localhost:8080/overlay
     Method: POST
     Headers: Content-Type: application/json
     Body: {"kind":"SUB","name":"%user%"}
3. 같은 방식으로 "YouTube Like" 이벤트도 등록
   Body: {"kind":"LIKE","name":"%user%"}
4. Membership 이벤트도 동일하게 {"kind":"MEMBER","name":"%user%","amount":4.99}
```

(Streamer.bot의 변수명은 사용자 환경에 따라 다를 수 있으므로 README에 placeholder로 적고 실제 적용 시 사용자 확인)

---

## 7. 게임 클라이언트

### 7.1 `RemoteTrigger.js` 변경

기존 `_handleMessage`는 `type === 'trigger'`만 처리. `type === 'overlay'` 분기 추가:

```js
if (msg?.type === 'overlay') {
  this._emit('overlay', msg);
  return;
}
```

`UIScene`에서 `remoteTrigger.on('overlay', fn)`으로 구독.

### 7.2 새 시스템: `src/systems/OverlaySystem.js`

`UIScene`이 소유. 두 가지 표시기 관리:

**(A) PopupQueue (큰 이벤트용)**
- 대상: SUB, MEMBER, SUPERCHAT
- 위치: 화면 중앙 상단, y=120 부근
- 표시 시간: 2500ms (fade in 200ms / hold 2000ms / fade out 300ms)
- 동시 다발 처리: 큐에 쌓고 한 번에 하나만 표시 (순차)
- 큐 길이 제한: 최대 12개. 초과 시 가장 오래된 항목 drop.
- 텍스트 포맷:
  - SUB: `⭐ {name} subscribed!`
  - MEMBER: `💎 {name} joined membership!`
  - SUPERCHAT: `💰 {name} — ${amount} {tier}`

**(B) LikeFeed (좌측 하단 스트림)**
- 대상: LIKE
- 위치: 좌측 하단, x=24, y=화면 하단에서 위로 쌓임
- 최대 6개 동시 표시
- 새 항목은 가장 아래 슬롯에 fade in (150ms), 6개 초과 시 가장 위 슬롯 fade out (200ms)
- 각 항목 자체 수명: 4초 후 자동 fade out
- 텍스트 포맷: `💗 {name}`

### 7.3 기존 이벤트 피드와의 관계

`docs/spec.md` 6번에 "이벤트 피드(화면 하단 좌측)"가 정의되어 있지만 현 코드엔 미구현. LIKE 피드가 그 자리를 사실상 차지한다. 향후 다른 이벤트 피드가 필요해지면 LIKE 피드 위쪽으로 분리.

### 7.4 `UIScene` 통합 지점

`UIScene.create()`에서:
1. `OverlaySystem` 인스턴스 생성 (Scene 참조 보유)
2. `gameState.remoteTrigger.on('overlay', payload => overlay.handle(payload))` 연결

---

## 8. 테스트 도구 (`server/fire.js`)

기존 fire.js는 `node server/fire.js BOMB Alex` 형식. 첫 인자가 `overlay`면 overlay 엔드포인트로 라우팅:

```bash
node server/fire.js overlay SUB NewbieFox
node server/fire.js overlay LIKE CoolGuy
node server/fire.js overlay SUPERCHAT Whale99 5 DIAMOND
```

---

## 9. 동작 시나리오

### 9.1 시청자 신규 구독
1. Streamer.bot → `POST /overlay {kind:SUB, name:'NewbieFox'}`
2. 서버 broadcast → 게임 PopupQueue에 `⭐ NewbieFox subscribed!` 추가
3. 큐가 비어있으면 즉시 표시, 아니면 대기
4. (선택) Streamer.bot이 별도로 `/trigger SUB`도 호출하면 게임 메커니즘(SUB 광물 스폰) 동시 발생

### 9.2 슈퍼챗 $5 from CoolUser1
1. youtube-bridge가 슈퍼챗 감지
2. `/trigger MEGA_BLAST` (게임 폭탄)
3. 직후 `/overlay SUPERCHAT name=CoolUser1 amount=5 tier=MEGA_BLAST`
4. 게임 화면: 폭탄 터지면서 동시에 상단 팝업 `💰 CoolUser1 — $5 MEGA_BLAST`

### 9.3 LIKE 폭주 (초당 50개)
1. Streamer.bot이 50회 `/overlay LIKE` 호출
2. 서버: 같은 이름 5초 dedupe + 초당 10개 throttle → 실제 broadcast는 ~10개
3. 게임: LikeFeed에 최대 6개만 보임 (위에서부터 밀려나감)
4. 게임 트리거 LIKE는 별도 채널이므로 throttle 영향 없음 — 기존대로 동작

---

## 10. 실패/에러 처리

- 서버 미실행: 게임은 평소처럼 silent 동작 (기존 `RemoteTrigger` 재연결 로직 그대로)
- `/overlay` 잘못된 페이로드: 400 응답, broadcast 안 함
- WebSocket 메시지 형식 깨짐: `RemoteTrigger._handleMessage` JSON parse 실패 시 무시 (기존 동작)
- OverlaySystem 큐 폭주: 큐 길이 12 초과 시 drop (서버 throttle로 정상 상황에선 발생 안 함)

---

## 11. 파일 변경 요약

| 파일 | 변경 종류 |
|------|----------|
| `server/index.js` | `POST /overlay`, dedupe/throttle, `/like-batch` overlay 통합 |
| `server/youtube-bridge.js` | 슈퍼챗 직후 overlay POST, 멤버십 best-effort |
| `server/fire.js` | `overlay` 서브커맨드 추가 |
| `server/README.md` | Streamer.bot 연동 섹션 추가 |
| `src/systems/RemoteTrigger.js` | `overlay` 타입 분기 + emit |
| `src/systems/OverlaySystem.js` | **신규** — PopupQueue + LikeFeed |
| `src/scenes/UIScene.js` | OverlaySystem 생성 및 RemoteTrigger 구독 |

---

## 12. 비고 / 미결정

- 슈퍼챗 메시지 본문(text)은 v1에서는 표시 안 함. 필요시 v2에서 팝업 두 줄로 확장.
- LIKE 피드 자체 수명 4초는 임시값. 실제 방송에서 가독성 보고 조정.
- 멤버 등급(MEMBER → tier)은 v1 미구현. amount만 받음.
