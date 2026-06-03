<div align="center">
  <img src="public/assets/drill_rush_youtube_thumbnail.png" alt="Drill Live" width="600" />
  <h1>Drill Live</h1>
  <p><strong>시청자 채팅이 게임을 바꾸는 유튜브 쇼츠 라이브 인터랙티브 게임</strong></p>
</div>

---

## 시작하게 된 이유

평소에 유튜브 쇼츠 라이브를 자주 봤습니다. 그러다가 어떤 채널을 봤어요. 시청자가 채팅에 `bomb`이라고 치면 화면에 폭탄이 떨어지고, 슈퍼챗을 보내면 닉네임이 큰 글씨로 뜨면서 폭발이 일어나는 그런 채널이었습니다.

신기했던 건 시청자가 친 채팅이 4초 뒤에 화면에 그대로 반영되는 그 순간이었어요. 라이브를 그냥 보고 있을 때와는 완전히 다른 감각이 있었습니다. 자기 행동이 즉시 결과로 돌아오는 그 짧은 피드백 루프.

"내가 직접 만들어보면 어떻게 될까?"

그 호기심 하나로 시작한 사이드 프로젝트입니다.

## Drill Live는 어떤 게임인가요

화면 가운데에서 드릴이 자동으로 땅을 파고 내려갑니다. 깊이 들어갈수록 새로운 바이옴이 나타나요. 지구 → 크리스탈 동굴 → 심해 → 고대 숲 → 마그마 코어 → 공허. 시청자가 채팅에 명령어를 치거나 슈퍼챗을 보내면 게임이 즉시 반응합니다.

- `bomb` → 폭탄 한 개 투하
- `fast` → 드릴 속도 10초간 1.5배
- `wood` / `stone` / `iron` / `gold` / `diamond` → 드릴 모습 3초간 변경
- 슈퍼챗 $1 → 폭탄 5개 흩뿌리며 낙하
- 슈퍼챗 $20 NUKE → 화면 전체 플래시 + 카메라 강흔들 + 후원자 이름 10초 표시

스트리머가 게임을 직접 조작하지 않습니다. 드릴은 자동으로 진행되고, 시청자가 라이브에 참여하는 만큼 게임이 풍부해지는 구조입니다.

## 기술 스택

| 영역 | 선택 |
|------|------|
| 게임 엔진 | Phaser 4 |
| 번들러 | Vite |
| 트리거 브리지 | Node.js + Express + ws |
| 유튜브 채팅 | youtube-chat (API 쿼터 없이 폴링) |
| 데스크탑 앱 | Electron + electron-builder |
| 테스트 | Vitest |

## 아키텍처

### 전체 흐름

게임, 트리거 브리지 서버, 유튜브 연결을 세 레이어로 명확히 분리했습니다.

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
│   │  └ 좌상단 컨트롤 패널 (Video URL + 상태)         │  │
│   └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ OBS Window Capture
                          │
                  ┌───────┴────────┐
                  │   OBS Studio   │ → YouTube Live
                  └────────────────┘
```

### 시청자 → 게임 트리거 시퀀스

시청자가 채팅에 `bomb`이라고 치면 다음 일이 벌어집니다.

```
시청자       YouTube       youtube-bridge      Trigger       Phaser 게임
            라이브 채팅      (4초 폴링)        Server         (WebSocket)
  │            │                │                │               │
  │ "bomb"     │                │                │               │
  ├──────────▶│                 │                │               │
  │            │                 │                │               │
  │            │ ─ 최대 4초 ─ ▶  │                │               │
  │            │  fetchChat()    │                │               │
  │            │                 │                │               │
  │            │                 │ POST /trigger  │               │
  │            │                 │ { triggerId,   │               │
  │            │                 │   donor }      │               │
  │            │                 ├───────────────▶│               │
  │            │                 │                │               │
  │            │                 │                │ WS broadcast  │
  │            │                 │                │ {type, ...}   │
  │            │                 │                ├──────────────▶│
  │            │                 │                │               │
  │            │                 │                │      TriggerSystem.fire()
  │            │                 │                │      → 폭탄 낙하
  │            │                 │                │      → 후원자 이름 표시
  │            │                 │                │      → 사운드 재생
```

이 분리 덕분에 서버는 **트리거 ID만 알면 되고**, 게임은 **효과 구현에만 집중**할 수 있습니다. 나중에 Streamer.bot 같은 외부 도구도 같은 `/trigger` 엔드포인트로 연결할 수 있는 구조입니다.

### 트리거 시스템 데이터 흐름

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
       │ .fire()      │ │ (닉네임 표시) │ │ (드릴 가속) │
       └─────────────┘ └──────────────┘ └──────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
  ExplosionEffect  Driller
  (폭탄 낙하)      (컨셉 변경/hurt)
```

## 핵심 설계 결정

### 1. 게임 메커니즘 트리거와 표시 전용 오버레이를 분리

처음에는 `/trigger` 하나에 다 몰아넣었는데, LIKE 이벤트가 초당 수십 개씩 들어오기 시작하니 문제가 생겼습니다. 시청자가 좋아요를 연타하면 게임 화면이 폭탄으로 도배되거든요.

그래서 두 엔드포인트로 분리했습니다.

- `POST /trigger` — 게임 메커니즘에 영향을 주는 이벤트 (폭탄, 드릴 변환)
- `POST /overlay` — 닉네임 화면 표시 전용 (게임 영향 없음)

LIKE는 서버에서 **동일 닉네임 5초 dedupe + 초당 10개 throttle**을 적용합니다. 단, throttle은 overlay에만 적용. `/trigger`는 그대로 둬서 게임 메커니즘은 원하는 만큼 발사할 수 있게 했습니다.

### 2. 폭탄 슈퍼챗은 5개씩 흩뿌리며 낙하

초기에는 슈퍼챗 한 번에 폭탄 한 개였는데, 시청자 입장에서 후원하고 보는 시각적 임팩트가 약했습니다.

```js
// TriggerSystem.js
for (let i = 0; i < count; i++) {
  const offsetX = count === 1 ? 0 : (Math.random() - 0.5) * 400;
  const rawX = this.driller.worldX + offsetX;
  const dropX = Math.max(minX, Math.min(maxX, rawX));  // 채굴 영역 안으로 clamp

  this.scene.time.delayedCall(i * 80, () => {
    this.explosionEffect.drop(dropX, baseY, { ... });
  });
}
```

5개를 80ms 간격으로 좌우 ±200px 흩뿌리며 떨어뜨립니다. `Math.max/min` clamp로 벽 너머로 안 날아가게 했어요.

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

메시지의 **첫 단어만 매칭**해서 `!` 있어도 되고 없어도 되도록 했습니다. `bomb`은 발동, `i want bomb`은 무시.

### 4. 드릴 컨셉 시스템 (5종 × normal/hurt)

채팅에 `wood`, `stone`, `iron`, `gold`, `diamond` 치면 드릴 모습이 3초간 변합니다. 같은 컨셉이 또 오면 타이머만 리프레시. 폭탄에 맞으면 현재 컨셉의 hurt 텍스처로 350ms 전환됐다가 normal로 복귀.

문제는 각 컨셉별 PNG의 native 크기가 달랐다는 점입니다. drill-rush.png는 1024×1536(세로 1.5), drill_v3_*.png는 1248×1248(정사각).

```js
_recomputeBaseScale(key) {
  const srcImg = this.scene.textures.get(key)?.getSourceImage?.();
  const naturalW = (srcImg && srcImg.width) || 64;
  this._baseScale = this._targetWidth / naturalW;  // 화면 폭 256px 강제
}
```

`setTexture` 후 native width를 보고 base scale을 재계산해서 **모든 컨셉이 화면에 동일 크기(256px)**로 보이게 정규화했습니다. 종횡비 차이는 컨셉별 `originY` 보정으로 처리.

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

### 2. Vite 자원 경로

`dist/index.html`이 자원을 `/assets/...` 절대경로로 참조합니다. 그런데 Electron이 `file://dist/index.html`로 로드하면 `/assets/...`는 **파일시스템 루트**를 찾아요. 자원 못 찾음.

```js
// vite.config.js
export default defineConfig({
  base: './',  // 상대 경로로
  ...
});
```

추가로 코드에서도 `location.protocol`을 보고 분기:

```js
const ASSET_BASE = (typeof location !== 'undefined' && location.protocol === 'file:')
  ? './assets'
  : '/assets';
```

### 3. WebSocket URL 빈 hostname

게임이 `ws://${location.hostname}:8080/ws`로 연결하는데, `file://` 환경에선 `location.hostname`이 빈 문자열입니다. 결과는 `ws://:8080/ws` — 잘못된 URL.

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

이 한 줄로 해결. 그 외에도 CORS(webSecurity false), 포트 8080 충돌 다이얼로그, child 프로세스 orphan 방지 signal 핸들러 등을 추가했습니다.

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
├── tests/                # Vitest 테스트
└── docs/                 # 설계 문서 + 운영 가이드
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

## 한 가지 더

만들면서 가장 흥미로웠던 건 시청자 인터랙션의 **즉시성**이었습니다. 채팅 한 줄이 4초 이내에 게임 화면에 반응하는 그 짧은 피드백 루프가, 라이브 시청 경험을 어떻게 바꾸는지 직접 만들어보면서 알게 됐어요.

기술적으로는 Phaser, Electron, WebSocket, Node child process 등 새로 손에 익힌 게 많았지만, 더 큰 발견은 **시청자가 자기 행동의 결과를 즉시 본다**는 그 한 가지였습니다.

라이브 첫 방송에서 누군가 처음으로 `bomb`을 치고 4초 뒤에 폭탄이 떨어지는 걸 볼 그 순간이, 만드는 내내 가장 기다려진 순간이었습니다.
