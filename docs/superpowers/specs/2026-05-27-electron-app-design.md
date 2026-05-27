# Drill Live — Electron 데스크탑 앱 설계

> 작성: 2026-05-27
> 목적: 웹 게임을 OBS 송출용 데스크탑 앱(.exe / .app)으로 변환. 기능/디자인 100% 보존, 터미널 3개 → 앱 1개.

---

## 1. 동기

현재 라이브 송출 워크플로:
1. 터미널 1: `npm run server`
2. 터미널 2: `npm run dev`
3. OBS 브라우저 소스 `localhost:3000`
4. 터미널 3: `npm run yt -- "URL"`

문제:
- 매번 3개 터미널 켜야 함
- 브라우저 깜빡임/사고 노출 위험 (탭 변경 시)
- 의존성 셋업이 다른 PC에서 다시 필요

목표: 한 번 클릭 = 전부 실행. 게임/서버/브리지가 한 프로세스 트리. OBS는 윈도우 캡처.

---

## 2. 범위

### 포함
- Electron 메인 프로세스 (서버 + 윈도우 관리)
- Renderer = 기존 Vite 빌드 그대로 (`dist/index.html`)
- YouTube 브리지 자동 spawn (앱 UI에서 video ID 입력)
- electron-builder로 Windows `.exe`, Mac `.app` 패키징
- 연결 상태 / 에러 표시 (작은 컨트롤 패널)

### 제외 (이 작업 범위 아님)
- 코드 사인 (Mac $99/년, Windows EV cert)
- 자동 업데이트 인프라
- 게임 로직 변경 (디자인/기능 100% 보존)
- 시청자용 모바일 앱
- Streamer.bot 자동 셋업 (사용자가 OS 레벨에서 별도 설치)

---

## 3. 아키텍처

```
┌────────────────────────────────────────────────────────┐
│  Electron Main Process (Node)                          │
│                                                        │
│  ┌────────────────────┐  ┌──────────────────────────┐ │
│  │ HTTP/WS Server     │  │ youtube-bridge (child)   │ │
│  │ (server/index.js)  │  │ spawn on user demand     │ │
│  │ :8080              │  │                          │ │
│  └────────────────────┘  └──────────────────────────┘ │
│         │                          │                   │
│         └──── IPC ────┐             │                   │
│                       ▼                                │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Renderer Window (Phaser 게임)                    │ │
│  │ file:// dist/index.html (또는 dev: localhost)   │ │
│  │                                                  │ │
│  │  ┌─ 좌상단 작은 컨트롤 패널 ─┐                  │ │
│  │  │ [Video ID/URL] [Start]  │                  │ │
│  │  │ 상태: ● Connected        │                  │ │
│  │  └──────────────────────────┘                  │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
                     ↑
                     │ OBS Window Capture
                     │
              ┌──────┴───────┐
              │  OBS Studio  │ → YouTube Live
              └──────────────┘
```

### 프로세스 책임

| 프로세스 | 책임 |
|----------|------|
| **Electron Main** | 윈도우 생성, 서버/브리지 child spawn 관리, IPC 핸들러, 앱 라이프사이클 |
| **HTTP/WS Server (child)** | 기존 `server/index.js` 그대로. 포트 8080 |
| **youtube-bridge (child)** | 기존 `server/youtube-bridge.js` 그대로. video ID 받아 spawn/kill |
| **Renderer** | Phaser 게임 (기존 코드 100%) + 작은 컨트롤 UI |

---

## 4. 파일 구조

```
drill-live/
├── electron/                       # 신규 — Electron 코드
│   ├── main.js                     # 메인 프로세스
│   ├── preload.js                  # IPC 브릿지
│   └── child-manager.js            # server/yt spawn/kill 관리
│
├── src/                            # 기존 (변경 없음)
│   ├── main.js
│   ├── scenes/
│   └── ...
│
├── public/                         # 기존
│   └── electron-overlay/           # 신규 — 컨트롤 패널 HTML/CSS
│       └── overlay.html (또는 index.html에 inline)
│
├── server/                         # 기존 (변경 없음)
│   ├── index.js
│   ├── youtube-bridge.js
│   └── overlay.js
│
├── dist/                           # Vite 빌드 산출물 (Electron이 이걸 로드)
├── package.json                    # electron + electron-builder dep 추가
└── electron-builder.yml            # 신규 — 패키징 설정
```

---

## 5. Electron Main Process (`electron/main.js`)

### 책임
1. 앱 시작 시 `server/index.js`를 child process로 spawn
2. BrowserWindow 생성 (1080×1920 고정, frameless 옵션)
3. `dist/index.html` 로드 (또는 dev mode면 `http://localhost:3000`)
4. IPC 핸들러:
   - `yt:start({ url })` → youtube-bridge spawn
   - `yt:stop()` → youtube-bridge kill
   - `yt:status()` → 현재 상태 반환
5. 앱 종료 시 모든 child kill

### 라이프사이클
- `app.whenReady()`: 서버 spawn → 1초 대기 (서버 listen 완료) → 윈도우 열기
- `window.on('closed')`: child들 kill → app.quit()

---

## 6. Renderer 컨트롤 UI

기존 Phaser 게임 위에 작은 controls overlay (HTML/CSS, Phaser 외부):
- 위치: 좌상단 (또는 우상단), OBS가 캡처할 때 잘리지 않게
- 크기: 폭 ~280px, 높이 ~120px
- 내용:
  - Video URL/ID 입력 박스
  - [Start] / [Stop] 버튼
  - 연결 상태 dot (● 회색=disconnected / 노랑=connecting / 초록=connected / 빨강=error)
  - 마지막 에러 메시지 (작게)

OBS 송출 시 이 패널을 윈도우 캡처 영역에서 제외하려면:
- 사용자가 OBS에서 "Crop"으로 잘라냄
- 또는 Electron의 `setIgnoreMouseEvents` + 별도 컨트롤 윈도우

**v1**: 단순화 — 패널이 게임 위에 그냥 떠 있음. OBS에서 사용자가 crop.
**v2** (선택): 별도 컨트롤 윈도우 (메인 윈도우 = 게임 only, 컨트롤 윈도우 = controls).

### v1 선택 이유
- 가장 빠른 구현. v2는 추가 윈도우 + 두 윈도우 간 IPC. 복잡도 ↑

---

## 7. IPC API

`preload.js`에서 `window.electronAPI` 노출:

```js
contextBridge.exposeInMainWorld('electronAPI', {
  startYoutube: (urlOrId) => ipcRenderer.invoke('yt:start', urlOrId),
  stopYoutube: () => ipcRenderer.invoke('yt:stop'),
  getStatus: () => ipcRenderer.invoke('yt:status'),
  onStatusChange: (cb) => ipcRenderer.on('yt:status-change', (e, status) => cb(status)),
});
```

### Status 객체
```typescript
{
  state: 'idle' | 'connecting' | 'connected' | 'error' | 'ended',
  liveId: string | null,
  lastError: string | null,
}
```

### IPC 핸들러 (main.js)
- `yt:start`: 기존 yt 프로세스 있으면 kill. 새 spawn. stdout 파싱해서 status 변경 emit.
- `yt:stop`: SIGTERM
- `yt:status`: 현재 status 반환

---

## 8. Child Process 관리 (`electron/child-manager.js`)

### Server (자동)
- 앱 시작 → spawn `server/index.js`
- stdout/stderr → main 콘솔로 forward (디버그)
- 죽으면 재시작 (또는 사용자 알림)

### YouTube Bridge (사용자 trigger)
- `yt:start` IPC 받으면 spawn `server/youtube-bridge.js <urlOrId>`
- stdout 모니터링:
  - `[YT] connected. liveId=XXX` → state='connected', liveId 추출
  - `[YT] live ended` → state='ended'
  - 에러 stderr → state='error', lastError 저장
- `yt:stop` → kill (SIGTERM)
- 재 start 시 기존 거 먼저 kill

### 포트 충돌 방지
- 앱 시작 전 8080 점유 체크 → 이미 점유면 사용자에게 알림 (`기존 서버를 종료하세요`)

---

## 9. Vite 빌드 통합

기존 `vite build` → `dist/` 그대로 사용.
Electron이 production mode에선 `file://dist/index.html` 로드.
Dev mode (`npm run electron:dev`)에선 vite dev server + electron 같이 띄움 → HMR 가능.

### NPM Scripts 추가
```json
{
  "scripts": {
    "electron": "electron electron/main.js",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron electron/main.js\"",
    "electron:build": "vite build && electron-builder",
    "electron:pack": "vite build && electron-builder --dir"  // 패키징 테스트용 (디렉토리만)
  }
}
```

---

## 10. Packaging (electron-builder)

### `electron-builder.yml`
```yaml
appId: com.aenproject.drill-live
productName: Drill Live
directories:
  output: release
files:
  - dist/**/*
  - electron/**/*
  - server/**/*
  - public/**/*
  - package.json
  - "!node_modules/.cache"
extraResources:
  - from: public/assets
    to: assets
win:
  target: nsis
  icon: build/icon.ico
mac:
  target: dmg
  icon: build/icon.icns
  category: public.app-category.entertainment
```

### 산출물
- Windows: `release/Drill Live Setup 1.0.0.exe` (NSIS installer)
- Mac: `release/Drill Live-1.0.0.dmg`

### 종속성 처리
- `youtube-chat`, `express`, `ws` 등 server-side deps는 `dependencies`에 있어야 패키지에 포함됨.
- Electron 자체는 `devDependencies`.

---

## 11. 알려진 문제 / 트레이드오프

### 보안
- `contextIsolation: true` + `nodeIntegration: false` (디폴트 안전 설정)
- preload.js로만 제한된 API 노출

### 코드 사인
- v1: 사인 안 함. Mac에선 "확인되지 않은 개발자" 경고, Windows에선 SmartScreen 경고
- 본인 사용용이라 OK. 공유하려면 별도 작업

### 자동 업데이트
- v1: 없음. 새 버전 나오면 사용자가 재다운로드
- v2: `electron-updater` + GitHub Releases (작업 큼)

### 게임 윈도우 사이즈
- v1: 1080×1920 고정 (리사이즈 불가). OBS 송출 비율 보장.
- 사용자가 미리보기/디버그 위해 작게 보고 싶으면 zoom factor 조정 가능. (별도 단축키)

---

## 12. 검증 시나리오

### Day 1 끝나면
- `npm run electron:dev`로 앱 실행
- 서버 자동 spawn 확인 (포트 8080 listen)
- 게임 로딩 + 채굴 동작
- 컨트롤 UI에서 video URL 입력 → Start → 연결 상태 변경
- 기존 fire CLI(`npm run fire BOMB Alex`)로 트리거 발사 → 게임 반영

### Day 2 끝나면
- `npm run electron:pack`으로 unpacked 빌드 → 실행
- `npm run electron:build`로 .exe 빌드 → 실행
- 패키지된 앱에서 모든 자원 로드 (PNG, 오디오, dist/)

### 최종
- OBS 윈도우 캡처로 게임 송출
- YouTube 라이브에서 슈퍼챗/채팅 → 게임 트리거 동작

---

## 13. 파일 변경 요약

| 파일 | 변경 종류 |
|------|----------|
| `package.json` | electron + electron-builder 등 dep 추가, scripts |
| `electron/main.js` | 신규 — 메인 프로세스 |
| `electron/preload.js` | 신규 — IPC 브릿지 |
| `electron/child-manager.js` | 신규 — server/yt spawn 관리 |
| `index.html` 또는 `src/main.js` | 신규 controls UI mount |
| `electron-builder.yml` | 신규 — 패키징 설정 |
| `build/icon.ico` `build/icon.icns` | 선택 — 앱 아이콘 (없으면 디폴트) |
| `.gitignore` | `release/` 추가 |

기존 게임 / 서버 / youtube-bridge 코드는 **변경 없음**.

---

## 14. 비고

- WSL 환경에서는 Electron 빌드/실행이 까다로움 (X11 또는 Windows 호스트에서 빌드). 사용자 PC가 Windows라면 native 빌드 권장.
- 본 작업은 1~2일 분량. 자율 진행 가능 (사용자 의견 필요한 분기점 없음).
