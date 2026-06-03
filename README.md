<div align="center">
  <img src="public/assets/drill_rush_youtube_thumbnail.png" alt="Drill Live" width="600" />

  <h1>Drill Live</h1>

  <p><strong>시청자 채팅이 실시간으로 게임 상태를 바꾸는 유튜브 쇼츠 라이브 인터랙티브 게임</strong></p>

  <p>
    <code>Phaser 4</code> ·
    <code>Node.js</code> ·
    <code>WebSocket</code> ·
    <code>Electron</code> ·
    <code>Vitest</code>
  </p>
</div>

---

> **TL;DR.** 유튜브 라이브 채팅·슈퍼챗·좋아요·구독을 게임 트리거로 변환해 4초 이내에 게임 화면에 반영합니다. Phaser로 게임을, Node + WebSocket으로 트리거 브리지를, Electron으로 스트리머용 데스크탑 앱을 만들었고, 65개 테스트와 패키징 안정화까지 끝냈습니다.

## 시작하게 된 이유

평소에 유튜브 쇼츠 라이브를 자주 봤습니다. 그러다가 어떤 채널을 봤어요. 시청자가 채팅에 `bomb`이라고 치면 화면에 폭탄이 떨어지고, 슈퍼챗을 보내면 닉네임이 큰 글씨로 뜨면서 폭발이 일어나는 그런 채널이었습니다.

신기했던 건 시청자가 친 채팅이 4초 뒤에 화면에 그대로 반영되는 그 순간이었어요. 라이브를 그냥 보고 있을 때와는 완전히 다른 감각이 있었습니다. 자기 행동이 즉시 결과로 돌아오는 그 짧은 피드백 루프.

"내가 직접 만들어보면 어떻게 될까?"

그 호기심 하나로 시작한 사이드 프로젝트입니다. 그리고 만들면서 생각했던 것보다 훨씬 재미있는 시스템 설계 문제들이 나왔습니다.

## 기술적으로 어려운 문제들

라이브 시청자 인터랙션 게임을 만들 때 부딪힌 다섯 가지 문제입니다.

**1. 실시간성과 신뢰성의 트레이드오프.** YouTube의 공식 Data API는 쿼터가 빡빡하고 쿼터를 다 쓰면 라이브 중에 채팅이 끊깁니다. 대안인 채팅 스크래핑은 쿼터가 없지만 폴링 간격에 따라 지연이 생깁니다.

**2. 다중 클라이언트 동기화.** 게임 화면을 OBS가 캡처하고, 동시에 트리거 브리지 서버가 채팅을 폴링하며, 게임은 두 곳 모두와 연결되어야 합니다. 어느 하나가 죽어도 라이브가 멈추면 안 됩니다.

**3. 시청자 행위의 과부하 처리.** LIKE 이벤트는 초당 수십 개가 들어옵니다. 매 LIKE마다 게임 화면에 효과를 띄우면 시각적으로 도배되고, 매번 닉네임을 표시하면 시청자가 자기 이름을 찾을 수 없습니다.

**4. 환경 차이.** 웹(`http://`), Electron(`file://`), 패키지된 앱(asar 가상 fs), OBS Window Capture — 같은 게임이 각 환경에서 다르게 동작합니다. 각각의 환경에서 자원 경로, WebSocket URL, 오디오 동작이 다릅니다.

**5. 라이브 송출 안정성.** 라이브 도중 다른 창을 클릭하면 Chromium이 자동으로 timer와 audio를 throttle합니다. 시청자에게 게임이 멈춰 보이고 사운드가 끊깁니다.

이 다섯 문제를 어떻게 풀었는지가 이 프로젝트의 본질입니다.

## 어떤 게임인가요

화면 가운데에서 드릴이 자동으로 땅을 파고 내려갑니다. 깊이 들어갈수록 새로운 바이옴이 나타나요. 지구 → 크리스탈 동굴 → 심해 → 고대 숲 → 마그마 코어 → 공허.

스트리머가 게임을 직접 조작하지 않습니다. **시청자가 라이브에 참여하는 만큼 게임이 풍부해지는 구조**입니다.

- `bomb` → 폭탄 한 개 투하
- `fast` → 드릴 속도 10초간 1.5배
- `wood` / `stone` / `iron` / `gold` / `diamond` → 드릴 모습 3초간 변경
- 슈퍼챗 $1 → 폭탄 5개 흩뿌리며 낙하 + 후원자 닉네임 화면 표시
- 슈퍼챗 $20 NUKE → 화면 전체 플래시 + 카메라 강흔들 + 후원자 이름 10초 표시
- 좋아요 → 좌측 하단 LIKE 피드에 닉네임 표시
- 구독 → 화면 중앙 큰 배너 + 드릴 아래 10줄을 바이옴 특수 광물로 변환

## 기술 선택의 이유

| 영역 | 선택 | 대안 | 선택 이유 |
|------|------|------|----------|
| 게임 엔진 | **Phaser 4** | Unity, Godot | 브라우저 기반이라 OBS 브라우저 소스로 바로 캡처 가능. Unity는 빌드 후 별도 송출 필요. Godot는 라이브러리 생태계가 약함 |
| 라이브 채팅 | **youtube-chat** | YouTube Data API v3 | Data API는 쿼터가 라이브 한 시간에 소진. 채팅 스크래핑은 폴링 지연 4초가 있지만 쿼터가 없어 라이브 종료 시까지 안정적 |
| 데스크탑 앱 | **Electron** | Tauri, NW.js | 기존 웹 코드를 그대로 사용해야 했음. Tauri는 Rust 백엔드 + WebView라 Node 서버를 같이 띄우기 까다로움 |
| 통신 | **WebSocket** | Server-Sent Events, polling | 게임 → 서버 양방향 통신 필요(나중에 게임 상태 보고용). SSE는 단방향, polling은 지연 |
| 테스트 | **Vitest** | Jest | Vite 기반 프로젝트와 동일 설정 공유. ESM 호환성 |

각 선택은 **"가장 좋은 기술"이 아니라 "이 문제에 가장 잘 맞는 기술"**을 기준으로 했습니다.

## 아키텍처

### 전체 시스템

게임, 트리거 브리지 서버, 유튜브 연결을 **세 레이어로 명확히 분리**했습니다.

```
┌─────────────────────────────────────────────────────────┐
│                  Electron 메인 프로세스                  │
│                                                         │
│   ┌──────────────────┐    ┌─────────────────────────┐   │
│   │  트리거 브리지    │    │  youtube-bridge.js      │   │
│   │  서버 (:8080)    │    │  (사용자 trigger spawn) │   │
│   └────────┬─────────┘    └────────────┬────────────┘   │
│            │                           │                │
│            │ WebSocket broadcast       │ POST /trigger  │
│            ▼                           ▼                │
│   ┌──────────────────────────────────────────────────┐  │
│   │  Renderer 프로세스 (Phaser 게임)                 │  │
│   │  └ 우상단 컨트롤 패널 (Video URL + 연결 상태)    │  │
│   └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ OBS Window Capture
                          │
                  ┌───────┴────────┐
                  │   OBS Studio   │ → YouTube Live
                  └────────────────┘
```

세 레이어로 나눈 이유는 **각 레이어가 자기 관심사에만 집중**하게 하기 위해서입니다.

- **트리거 브리지 서버**는 트리거 ID와 닉네임만 알면 됩니다. 게임이 어떻게 폭탄을 그리는지 모릅니다.
- **youtube-bridge**는 채팅 텍스트를 트리거 ID로 변환만 합니다. 다른 채팅 소스(예: Streamer.bot)도 같은 `/trigger` 엔드포인트로 연결 가능.
- **게임**은 어디서 트리거가 왔는지 모릅니다. WebSocket 메시지만 받으면 됩니다.

덕분에 새 채팅 소스를 추가하거나, 게임 효과를 바꾸거나, 트리거를 추가할 때 다른 레이어 코드를 건드릴 필요가 없습니다.

### 시청자 채팅 → 게임 반응 시퀀스

시청자가 채팅에 `bomb`을 칠 때 일어나는 일입니다.

```
시청자      YouTube       youtube-bridge      Trigger        Phaser 게임
            라이브 채팅     (4초 폴링)         Server         (WebSocket)
  │            │                │                │                │
  │ "bomb"     │                │                │                │
  ├──────────▶│                 │                │                │
  │            │                 │                │                │
  │            │ ─ 최대 4초 ─ ▶  │                │                │
  │            │  fetchChat()    │                │                │
  │            │                 │                │                │
  │            │                 │ firstToken()   │                │
  │            │                 │ matchCommand() │                │
  │            │                 │                │                │
  │            │                 │ POST /trigger  │                │
  │            │                 │ { triggerId,   │                │
  │            │                 │   donor }      │                │
  │            │                 ├───────────────▶│                │
  │            │                 │                │                │
  │            │                 │                │ validate       │
  │            │                 │                │ WS broadcast   │
  │            │                 │                ├───────────────▶│
  │            │                 │                │                │
  │            │                 │                │       RemoteTrigger.fire()
  │            │                 │                │       → TriggerSystem
  │            │                 │                │       → 폭탄 낙하 + 사운드
  │            │                 │                │       → 후원자 이름 표시
```

### 트리거 데이터 흐름

서버가 broadcast한 메시지를 게임 클라이언트가 어떻게 분기하는지입니다.

```
                   POST /trigger { triggerId, donor }
                              │
                              ▼
                  ┌─────────────────────────┐
                  │   Trigger Bridge Server  │
                  │   validate triggerId     │
                  └───────────┬─────────────┘
                              │ WS broadcast
                              ▼
                  ┌─────────────────────────┐
                  │   RemoteTrigger         │  ← 게임 클라이언트
                  │   (WebSocket listener)  │
                  └───────────┬─────────────┘
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
       ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
       │ TriggerSystem│ │ OverlaySystem│ │ BuffSystem   │
       │ .fire()      │ │ (닉네임 표시) │ │ (드릴 가속)  │
       └─────────────┘ └──────────────┘ └──────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
  ExplosionEffect  Driller
  (폭탄 낙하)      (컨셉 변경/hurt)
```

## 핵심 설계 결정

### 1. 게임 메커니즘과 표시 전용 오버레이를 별도 엔드포인트로 분리

처음에는 `/trigger` 하나에 다 몰아넣었는데, LIKE 이벤트가 초당 수십 개씩 들어오니 문제가 생겼습니다. 시청자가 좋아요를 연타하면 게임 화면이 폭탄으로 도배되거든요.

그래서 두 엔드포인트로 분리했습니다.

- `POST /trigger` — 게임 메커니즘에 영향을 주는 이벤트 (폭탄, 드릴 변환)
- `POST /overlay` — 닉네임 화면 표시 전용 (게임 영향 없음)

LIKE는 서버에서 **동일 닉네임 5초 dedupe + 초당 10개 throttle**을 적용합니다. 단, throttle은 `/overlay`에만 적용. `/trigger`는 그대로 둬서 게임 메커니즘은 throttle 없이 즉시 발사하게 했습니다. 시각 표시 부담과 게임 메커니즘 부담을 분리한 거죠.

```js
// server/overlay.js
admitLike(name) {
  const now = Date.now();
  if (now - this._lastByName.get(name) < DEDUPE_MS) return false;
  this._recentLikes = this._recentLikes.filter(t => now - t < RATE_WINDOW_MS);
  if (this._recentLikes.length >= RATE_PER_SEC) return false;
  this._lastByName.set(name, now);
  this._recentLikes.push(now);
  return true;
}
```

### 2. 폭탄 슈퍼챗은 5개씩 좌우 흩뿌리며 낙하

초기에는 슈퍼챗 한 번에 폭탄 한 개였는데, 시각적 임팩트가 약했습니다.

```js
// TriggerSystem.js
const xOffset = Math.floor((GAME.width - GAME.chunkTilesX * GAME.tileSize) / 2);
const minX = xOffset + (GAME.wallLeftX + 1) * GAME.tileSize + GAME.tileSize * 0.5;
const maxX = xOffset + GAME.wallRightX * GAME.tileSize - GAME.tileSize * 0.5;

for (let i = 0; i < count; i++) {
  const offsetX = count === 1 ? 0 : (Math.random() - 0.5) * 400;
  const dropX = Math.max(minX, Math.min(maxX, this.driller.worldX + offsetX));

  this.scene.time.delayedCall(i * 80, () => {
    this.explosionEffect.drop(dropX, baseY, { ... });
  });
}
```

5개를 80ms 간격으로 좌우 ±200px 흩뿌리며 떨어뜨립니다. `Math.max/min` clamp로 채굴 영역(좌우 벽 안쪽) 밖으로 안 날아가게 했어요.

### 3. 채팅 명령어 `!` 옵션화 + 첫 단어 매칭

`!fast`, `!bomb` 형식이었는데 시청자가 매번 `!` 치는 게 부담이었습니다. 그렇다고 `bomb`만 쳐도 발동하게 하면 "i want to bomb him" 같은 자연 채팅에도 폭탄이 떨어지죠.

```js
// youtube-bridge.js
function firstToken(text) {
  let s = String(text || '').toLowerCase().trim();
  if (s.startsWith('!')) s = s.slice(1).trim();
  return s.match(/^[a-z]+/)?.[0] ?? '';
}
```

메시지의 **첫 단어만 매칭**해서 `!` 있어도 되고 없어도 되도록 했습니다.

| 시청자 입력 | 결과 |
|------------|------|
| `bomb` / `!bomb` / `BOMB!!!` | ✅ 폭탄 발사 |
| `i want bomb` | ❌ 무시 (첫 단어 `i`) |
| `please !fast` | ❌ 무시 (첫 단어 `please`) |

### 4. 드릴 컨셉 시스템 (5종 × normal/hurt) — 크기 자동 정규화

채팅에 `wood`, `stone`, `iron`, `gold`, `diamond` 치면 드릴 모습이 3초간 변합니다. 같은 컨셉이 또 오면 타이머만 리프레시. 폭탄에 맞으면 현재 컨셉의 hurt 텍스처로 350ms 전환됐다가 normal로 복귀.

문제는 각 컨셉별 PNG의 native 크기가 달랐다는 점입니다. drill-rush.png는 1024×1536(세로 1.5), drill_v3_*.png는 1248×1248(정사각).

```js
_recomputeBaseScale(key) {
  const srcImg = this.scene.textures.get(key)?.getSourceImage?.();
  const naturalW = (srcImg && srcImg.width) || 64;
  this._baseScale = this._targetWidth / naturalW;  // 화면 폭 256px 강제
}
```

`setTexture` 후 native width를 보고 base scale을 재계산해서 **모든 컨셉이 화면에 동일 크기(256px)**로 보이게 정규화했습니다. 종횡비 차이는 컨셉별 `originY` 보정 테이블로 처리.

## 테스트 전략

`Vitest`로 65개 테스트를 작성했습니다. 게임 코드의 특성상 모든 걸 자동화하기 어려워서 두 원칙을 정했어요.

**1. 데이터 로직과 렌더링을 명확히 분리.** 예를 들어 `OverlaySystem`은 팝업 큐 관리와 LIKE 피드 관리라는 데이터 로직을 가지고, 실제 렌더링은 Scene이 hook (`_renderPopup`, `_renderLike`, `_expireLike`)으로 받습니다.

```js
// tests/overlaySystem.test.js
function makeScene() {
  return {
    showPopupCalls: [],
    _renderPopup(text, kind) { this.showPopupCalls.push({ text, kind }); },
    _renderLike(name) { this.addLikeCalls.push(name); },
    _expireLike(name) { this.expireLikeCalls.push(name); },
  };
}

test('popups serialize through queue (one at a time)', () => {
  const scene = makeScene();
  const sys = new OverlaySystem(scene);
  sys.handle({ type: 'overlay', kind: 'SUB', name: 'A' });
  sys.handle({ type: 'overlay', kind: 'SUB', name: 'B' });
  expect(scene.showPopupCalls).toHaveLength(1);  // 큐로 대기
  sys.notifyPopupDone();
  expect(scene.showPopupCalls).toHaveLength(2);
});
```

Phaser 없이 순수 자바스크립트로 시스템 동작을 검증합니다.

**2. throttle/dedupe 같은 시간 의존 로직은 fake timer로.**

```js
test('global rate limit: 10/sec rolling', () => {
  const t = new OverlayThrottle();
  for (let i = 0; i < 10; i++) {
    expect(t.admitLike(`u${i}`)).toBe(true);
  }
  expect(t.admitLike('u10')).toBe(false);
  vi.advanceTimersByTime(1001);
  expect(t.admitLike('u11')).toBe(true);
});
```

렌더링이나 사운드는 수동 테스트로 검증하지만, **로직은 코드로 보장**합니다.

## Electron 데스크탑 앱 — 패키징 함정들

기능을 다 만든 뒤 라이브 송출 워크플로를 보니 터미널 3개(서버 / 게임 / 유튜브 브리지)에 OBS 브라우저 소스를 따로 셋업해야 했습니다. 매번 번거롭고 실수하기 쉬워서 **한 클릭으로 다 띄우는 데스크탑 앱**으로 바꾸기로 했어요.

Electron으로 감싸는 건 쉬웠는데, **패키징해서 .exe로 만드는 과정에서 7개 치명적 버그**가 줄줄이 나왔습니다.

### 1. `asarUnpack`에 `node_modules` 누락

`electron-builder`가 기본적으로 `node_modules`를 asar에 압축합니다. 그런데 main 프로세스가 child로 spawn한 `server/index.js`는 일반 Node 모드로 실행되니까 asar 가상 fs를 못 봐요. `require('express')` 실패.

```json
"asarUnpack": [
  "server/**/*",
  "public/assets/**/*",
  "node_modules/**/*",
  "package.json"
]
```

`package.json`도 같이 풀어야 합니다. `type: "module"` 인식이 안 되면 ESM 파일을 CJS로 처리해서 syntax error.

### 2. Vite 자원 절대 경로

`dist/index.html`이 자원을 `/assets/...` 절대경로로 참조합니다. 그런데 Electron이 `file://dist/index.html`로 로드하면 `/assets/...`는 **파일시스템 루트**를 찾아요.

```js
// vite.config.js
export default defineConfig({
  base: './',  // 상대 경로로
  ...
});
```

코드 안에서도 `location.protocol`을 보고 분기:

```js
const ASSET_BASE = (location.protocol === 'file:') ? './assets' : '/assets';
```

### 3. WebSocket URL 빈 hostname

게임이 `ws://${location.hostname}:8080/ws`로 연결하는데, `file://` 환경에선 `location.hostname`이 **빈 문자열**입니다. 결과는 `ws://:8080/ws`.

```js
function getDefaultUrl() {
  if (location.protocol === 'file:' || !location.hostname) {
    return 'ws://localhost:8080/ws';
  }
  return `ws://${location.hostname}:8080/ws`;
}
```

라이브 도중 서버 로그를 보다가 `→ 0 clients`로 broadcast되는 걸 보고 발견했습니다.

### 4. `backgroundThrottling`

라이브 중에 다른 창을 클릭하면 사운드가 끊겼어요. Chromium 기본 동작이 hidden/blur 상태에서 timer와 audio를 throttle하는 거였습니다.

```js
webPreferences: {
  backgroundThrottling: false,
}
```

이 한 줄로 해결.

### 그 외

- **CORS** — `webSecurity: false`로 file:// 환경에서 Phaser XHR 통과
- **포트 충돌** — 시작 전 `8080` 점유 체크 → 다이얼로그 알림
- **Child orphan** — `SIGINT`/`SIGTERM`/`exit` signal 핸들러로 cleanup

## 성능과 확장성 고려

**1. 폴링 간격은 4초.** youtube-chat 기본은 1초인데 API 부담 줄이려고 4초로 늘렸습니다. 라이브 채팅 흐름에서 4초 지연은 시청자가 거의 체감 못 합니다.

**2. LIKE는 throttle/dedupe.** 초당 10개 + 동일 닉네임 5초 dedupe. 초당 50개씩 들어와도 게임은 영향 없음.

**3. 텍스처 정규화.** 모든 드릴 PNG가 native 크기와 무관하게 화면 폭 256px로 자동 정규화. 새 컨셉 텍스처 추가할 때 PNG 크기 신경 안 써도 됨.

**4. 새 트리거 추가 비용.**

```js
// src/systems/TriggerSystem.js
TRIGGER_DEFS = {
  NEW_TRIGGER: {
    type: 'bomb',  // 또는 'buff', 'special', 'oreSpawn'
    radius: 3.0,
    label: 'NEW',
    ...
  },
};
```

`TRIGGER_DEFS`에 한 줄 추가하고 server `VALID_TRIGGER_IDS`에 추가하면 끝. 게임 로직 코드는 안 건드려도 됩니다.

## 프로젝트 구조

```
drill-live/
├── electron/
│   ├── main.cjs          # 메인 프로세스, 윈도우 + 서버 spawn + IPC
│   ├── preload.cjs       # contextBridge로 안전한 IPC API 노출
│   ├── child-manager.cjs # server/youtube-bridge 자식 프로세스 관리
│   └── launcher.cjs      # ELECTRON_RUN_AS_NODE 환경변수 트랩 우회
│
├── src/
│   ├── scenes/           # Phaser scenes (Boot/Game/UI)
│   ├── systems/          # 게임 시스템 (Trigger/Buff/Overlay/RemoteTrigger 등)
│   ├── objects/          # 게임 오브젝트 (Driller/TileMap/ExplosionEffect 등)
│   └── config/           # 바이옴/광물/업그레이드 설정
│
├── server/
│   ├── index.js          # HTTP/WS 트리거 브리지 서버
│   ├── youtube-bridge.js # YouTube 채팅 폴링 → /trigger POST
│   ├── overlay.js        # LIKE dedupe + throttle 헬퍼
│   └── fire.js           # CLI 헬퍼 (수동 트리거 발사)
│
├── public/assets/        # 드릴 PNG (5종 컨셉 × 2 상태) + 사운드
├── tests/                # Vitest (65 tests)
└── docs/                 # 설계 문서 + 운영 가이드
    ├── superpowers/specs/    # 디자인 스펙
    └── superpowers/plans/    # 구현 계획
```

## 실행 방법

### 개발 모드

```bash
npm install
npm run electron:dev     # Vite HMR + Electron 동시
```

### 빌드 + 실행

```bash
npm run build
npm run electron
```

### .exe / .dmg 패키징

```bash
npm run electron:build   # release/Drill Live Setup x.x.x.exe (또는 .dmg)
```

## 회고 — 무엇을 배웠나

만들면서 기술적으로 손에 익힌 것이 많았습니다. Phaser scene 구조와 game loop, Node child process + IPC, Electron 패키징 메커니즘, WebSocket 라이프사이클, asar 가상 파일시스템, Chromium의 백그라운드 throttling 정책 같은 것들.

그런데 더 큰 발견은 **시스템 설계가 시각적 디테일까지 영향을 준다**는 점이었습니다.

예를 들어 트리거 시스템을 처음에 `/trigger` 하나로 묶었을 때는 잘 동작하는 것처럼 보였어요. LIKE를 받아 처리하기 전까지는요. 막상 초당 수십 개의 LIKE가 들어오기 시작하니 게임 화면이 도배되고, 시청자는 자기 닉네임을 찾을 수 없고, 게임 메커니즘은 의도와 다르게 발동되었습니다. **"게임 메커니즘"과 "표시"는 완전히 다른 자원이라는 걸 그제야 알게 됐고**, 두 엔드포인트로 분리한 뒤에야 시각적 디테일을 잡을 수 있었습니다.

비슷한 발견이 곳곳에 있었어요. 채팅 명령어 매칭 로직은 자연어 처리 문제가 아니라 사용자 경험 설계 문제였고, 드릴 텍스처 정규화는 그래픽 문제가 아니라 데이터 계약 문제였고, Electron 패키징은 빌드 문제가 아니라 환경 차이 문제였습니다.

**좋은 시스템 설계는 시각적 결과까지 끌어올린다**는 걸 직접 만들어보면서 알게 된 것이 이 프로젝트에서 얻은 가장 큰 것입니다.

라이브 첫 방송에서 누군가 처음으로 `bomb`을 치고 4초 뒤에 폭탄이 떨어지는 걸 볼 그 순간이, 만드는 내내 가장 기다려진 순간이었습니다.

---

<div align="center">
  <sub>
    Built with curiosity · 2026
  </sub>
</div>
