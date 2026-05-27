# Drill Live — Electron 데스크탑 앱 가이드

OBS 송출용 스트리머 앱. 한 번 클릭 = 게임 + 트리거 서버 + YouTube 브리지 모두 실행.

---

## 개발 모드 실행

```bash
npm install            # (최초 1회) electron 등 dep 설치
npm run electron:dev   # Vite + Electron 동시 실행 (HMR 가능)
```

- 좌상단 컨트롤 패널에 YouTube URL 붙여넣기 → **Start** → 연결되면 dot 초록색
- **Stop** 으로 YouTube 연결 해제 (게임은 계속 실행)
- 윈도우 닫으면 서버/브리지 자동 종료

## 일반 실행 (개발 모드 X, 빌드된 자원 사용)

```bash
npm run build       # vite build → dist/
npm run electron    # dist/ 로드 + 서버 spawn
```

## 패키징 (배포용 .exe / .app)

### Windows
```bash
npm run electron:build   # release/Drill Live Setup x.x.x.exe 생성
```
- 사용자는 .exe 더블클릭 → 설치 → 시작 메뉴에서 "Drill Live" 실행
- Node.js 설치 필요 없음 (Electron 내장 Node 사용)

### Mac
```bash
npm run electron:build   # release/Drill Live-x.x.x.dmg 생성
```
- 코드 사인 안 한 상태 → 처음 실행 시 "확인되지 않은 개발자" 경고
- 해결: 우클릭 → 열기

### 빠른 테스트 (패키징 안 함, 디렉토리만)
```bash
npm run electron:pack    # release/win-unpacked/Drill Live.exe (Windows) 등
```

---

## OBS 송출 설정

1. OBS에서 **Window Capture** 소스 추가 (Browser Source 아님)
2. Window: `[Drill Live]` 선택
3. **좌상단 컨트롤 패널은 Crop으로 잘라내기**
   - Right-click on source → Filters → Crop/Pad
   - Top: 0, Left: 320, Right: 0, Bottom: 0 (대략, 패널 폭 만큼)

---

## 트러블슈팅

### `npm run electron` 시 회색 창만 뜨고 게임 안 보임
- 빌드 안 됨. `npm run build` 먼저 실행.

### 포트 8080 already in use
- 이미 실행된 server 있음. 종료:
  - Linux/Mac: `lsof -ti:8080 | xargs kill -9`
  - Windows: `netstat -ano | findstr :8080` → PID 확인 → `taskkill /PID <pid> /F`

### Electron이 Node 모드로만 실행됨 (WSL/Linux)
- 셸에 `ELECTRON_RUN_AS_NODE=1` 환경변수가 설정돼 있음
- `electron/launcher.cjs`가 자동 제거하므로 `npm run electron` 사용 권장

### YouTube 연결이 안 됨
- 라이브가 실제 송출 중이어야 함 (대기실 X)
- URL 또는 video ID 정확히 입력
- 4초 폴링 지연 있음 — 채팅이 즉시 반영되지 않을 수 있음

### Mac에서 "손상되었거나 열 수 없음" 에러
- 코드 사인 안 됨 — 우클릭 → 열기 → "열기" 한 번 누르면 이후 정상

---

## 구조 (개발자용)

```
electron/
├── main.cjs          # 메인 프로세스 — 윈도우 + 서버 spawn + IPC
├── preload.cjs       # contextBridge로 안전한 IPC API 노출
├── child-manager.cjs # server/youtube-bridge child 관리
└── launcher.cjs      # ELECTRON_RUN_AS_NODE 제거 wrapper
```

- 렌더러: 기존 `dist/index.html` (Vite 빌드). 변경 없음.
- 서버: `server/index.js` 그대로. main이 자동 spawn.
- YouTube 브리지: `server/youtube-bridge.js` 그대로. UI에서 trigger.

### IPC API (`window.electronAPI`)
- `startYoutube(urlOrId)` → `{ ok: true }`
- `stopYoutube()` → `{ ok: true }`
- `getStatus()` → `{ state, liveId, lastError }`
- `onStatusChange(callback)` → unsubscribe 함수

### 상태 (state)
- `idle` — YouTube 안 연결됨
- `connecting` — 연결 시도 중
- `connected` — 라이브 채팅 폴링 중 (`liveId` 채워짐)
- `ended` — 라이브 종료됨
- `error` — 에러 (`lastError` 메시지 확인)
