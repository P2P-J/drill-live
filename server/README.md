# Drill Live 트리거 브리지

YouTube Live 이벤트(후원/채팅/구독/좋아요)를 받아 게임에 push 하는 Node WebSocket 서버.

## 구조

```
브라우저 게임 (Phaser)
        ↑ WebSocket
        |
   server/index.js   ← HTTP POST /trigger
        ↑
        |
   (Phase 4-B에서 youtube-chat / Streamer.bot 연동 모듈이 여기 호출)
```

## 실행

```bash
# 게임과 별도 터미널에서
npm run server          # 포트 8080
```

서버 시작되면 게임(`npm run dev`)이 자동으로 `ws://localhost:8080/ws`에 연결.
서버 미실행 상태로도 게임은 키보드 시뮬레이션으로 잘 작동 (RemoteTrigger가 silently retry).

## 트리거 발사 (테스트)

### 방법 1: CLI 헬퍼
```bash
npm run fire BOMB Alex
npm run fire NUKE
npm run fire LIKE BigDripz
npm run fire SUB Cookie5
```

### 방법 2: curl
```bash
curl -X POST http://localhost:8080/trigger \
     -H "Content-Type: application/json" \
     -d '{"triggerId":"BOMB","donor":"Alex"}'
```

### 방법 3: LIKE 배치 (좋아요 여러 명 한번에)
```bash
curl -X POST http://localhost:8080/like-batch \
     -H "Content-Type: application/json" \
     -d '{"donors":["Alex","Sarah","Mike"]}'
```

## 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/trigger` | `{triggerId, donor?}` — 단일 트리거 발사 |
| POST | `/like-batch` | `{donors: [...]}` — LIKE 트리거 N개 발사 |
| POST | `/overlay` | `{kind, name, amount?, tier?, text?}` — 화면 표시 전용 (게임 영향 없음) |
| GET | `/status` | 연결된 클라이언트 수 + 유효 triggerId 목록 |
| WS | `/ws` | 게임 클라이언트가 연결. 트리거 이벤트 push 수신 |

## 유효한 triggerId

`BOMB`, `ULTRA_BOMB`, `MEGA_BLAST`, `NUKE`,
`LIKE`,
`DRILL_UP`, `TURBO`, `OVERDRIVE`,
`GOLD_RUSH`, `GEM_DROP`, `DIAMOND`, `SPECIAL`,
`RANGE_UP`, `FAST`,
`SUB`,
`RESET`, `JACKPOT` (스트리머 전용)

자세한 효과는 [docs/test-commands.md](../docs/test-commands.md) 참조.

## Phase 4-B: YouTube 라이브 실연결

`server/youtube-bridge.js`가 `youtube-chat` 라이브러리로 채팅/슈퍼챗을 폴링해서 자동으로 `/trigger`에 POST한다.

### 실행
```bash
# 세 개 터미널 동시:
npm run server                          # 1) 트리거 브리지 (8080)
npm run dev                             # 2) 게임 (3000)
npm run yt <liveVideoId>                # 3) YouTube 연결
# 또는 URL 통째로:
npm run yt -- "https://www.youtube.com/watch?v=ABC123"
# 또는 @handle / UC 채널 ID:
npm run yt -- @MyChannel
```

### 트리거 매핑
**슈퍼챗 금액 (USD)** → 기본 트리거 (메시지에 키워드 있으면 키워드 우선, 금액 한도 안에서만):

| USD 범위 | 기본 트리거 |
|---|---|
| ≥ $20 | NUKE |
| $15 ~ $19 | SPECIAL |
| $10 ~ $14 | DIAMOND |
| $5 ~ $9 | MEGA_BLAST |
| $3 ~ $4 | GOLD_RUSH |
| $2 | DRILL_UP |
| $1 | BOMB |

원/엔도 자동 환산 (USD ~1300:1, ~150:1 단순 환산).

**키워드 (메시지 안에 포함)**: `nuke`, `special`, `diamond`, `overdrive`, `range`, `gem`, `turbo`, `mega`, `gold`, `ultra`, `drill`, `bomb`. 단, 결제 금액 한도 안의 트리거만 허용 (시청자가 더 비싼 효과 강요 불가).

**채팅 명령어 (누구나)**:
- `!bomb` → CHAT_BOMB (가장 작은 TNT, 무료)
- `!fast` → FAST (드릴 ×1.5 / 10초, 채널 쿨다운 10초)

**드릴 변경** (직접 Lv 지정, 30초 임시, 가격 미달이면 silently fail):
- `!wood` → DRILL_WOOD (0 G, Lv 1 — 리셋용)
- `!stone` → DRILL_STONE (16,000 G, ×1.2)
- `!iron` → DRILL_IRON (80,000 G, ×1.5)
- `!gold` → DRILL_GOLD (360,000 G, ×1.75)
- `!diamond` → DRILL_DIAMOND (1,600,000 G, ×2.0)

**범위/엔진** (다음 Lv +1, 30초 임시):
- `!range` → UPGRADE_RANGE (드릴 범위)
- `!engine` → UPGRADE_ENGINE (이동/낙하 속도)

**스트리머 전용** (owner/moderator만 — 환경변수 `STREAMER_CHANNEL_ID`로 특정 채널 ID 강제 가능):
- `!reset` → RESET (새 맵 생성)
- `!jackpot` → JACKPOT (다이아 파티)

### 알려진 제약
- 좋아요(LIKE) 이벤트는 youtube-chat API에 없음. 채팅 명령어(`!like` 같은 별도 명령) 또는 YouTube Data API + OAuth 필요.
- 신규 구독 / 멤버 가입 이벤트 정확히 받기는 youtube-chat의 시스템 메시지 파싱이 불안정. 정식 연동은 YouTube Live Streaming API 필요.
- 슈퍼챗 / 채팅 명령어는 정상 작동.

### 환경변수
- `BRIDGE_URL` — 트리거 브리지 URL (기본 `http://localhost:8080`)
- `YOUTUBE_LIVE_ID` — CLI 인자 대신 사용
- `YT_POLL_MS` — 채팅 폴링 간격 ms (기본 4000)

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
