# Electron 데스크탑 앱 구현 계획

> Spec: [2026-05-27-electron-app-design.md](../specs/2026-05-27-electron-app-design.md)

**Goal:** 웹 게임을 OBS 송출용 데스크탑 앱(.exe / .app)으로 변환. 기능/디자인 100% 보존.

**Architecture:** Electron Main이 Node 서버 자동 spawn, Renderer는 기존 Vite dist 그대로 로드. 컨트롤 UI(video ID + 상태)는 게임 위에 HTML overlay. youtube-bridge는 사용자 trigger로 spawn/kill.

**Tech Stack:** Electron, electron-builder, concurrently, wait-on (개발용)

---

## Phase A: dependencies + scripts

### A1. electron 관련 deps 설치
- `electron` (devDep)
- `electron-builder` (devDep)
- `concurrently` (devDep, dev 모드 multi-process)
- `wait-on` (devDep, vite ready 대기)

```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

### A2. package.json scripts 추가
```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron": "electron .",
    "electron:dev": "concurrently -k \"npm run dev\" \"wait-on http://localhost:3000 && cross-env NODE_ENV=development electron .\"",
    "electron:pack": "vite build && electron-builder --dir",
    "electron:build": "vite build && electron-builder"
  },
  "build": {
    "appId": "com.aenproject.drill-live",
    "productName": "Drill Live",
    "files": [
      "dist/**/*",
      "electron/**/*",
      "server/**/*",
      "public/**/*",
      "package.json"
    ],
    "directories": {
      "output": "release"
    },
    "win": { "target": "nsis" },
    "mac": { "target": "dmg", "category": "public.app-category.entertainment" }
  }
}
```

- Verify: `npm install` 후 `node_modules/electron/` 존재 확인

---

## Phase B: electron/main.js

메인 프로세스 — 윈도우 생성 + 서버 자동 spawn + IPC 설정.

### Files
- Create: `electron/main.js`

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { ChildManager } = require('./child-manager.js');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
let childManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1920,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  mainWindow.loadURL(url);

  // 개발 시 DevTools 자동 오픈
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  childManager = new ChildManager({
    onStatusChange: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('yt:status-change', status);
      }
    },
  });

  // 서버 자동 spawn (포트 8080)
  await childManager.startServer();
  // 서버 listen 대기 (간단히 800ms sleep — startServer가 미래에 promise 반환하면 더 좋음)
  await new Promise((r) => setTimeout(r, 800));

  createWindow();
});

ipcMain.handle('yt:start', async (_e, urlOrId) => {
  return childManager.startYoutube(urlOrId);
});
ipcMain.handle('yt:stop', async () => {
  return childManager.stopYoutube();
});
ipcMain.handle('yt:status', async () => {
  return childManager.getStatus();
});

app.on('window-all-closed', () => {
  childManager?.killAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  childManager?.killAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

---

## Phase C: electron/preload.js

contextBridge로 안전하게 IPC 노출.

### Files
- Create: `electron/preload.js`

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startYoutube: (urlOrId) => ipcRenderer.invoke('yt:start', urlOrId),
  stopYoutube: () => ipcRenderer.invoke('yt:stop'),
  getStatus: () => ipcRenderer.invoke('yt:status'),
  onStatusChange: (callback) => {
    const handler = (_e, status) => callback(status);
    ipcRenderer.on('yt:status-change', handler);
    return () => ipcRenderer.removeListener('yt:status-change', handler);
  },
});
```

---

## Phase D: electron/child-manager.js

server + youtube-bridge child 관리.

### Files
- Create: `electron/child-manager.js`

```javascript
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

class ChildManager {
  constructor({ onStatusChange } = {}) {
    this.serverProc = null;
    this.ytProc = null;
    this.status = { state: 'idle', liveId: null, lastError: null };
    this.onStatusChange = onStatusChange ?? (() => {});
  }

  _setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.onStatusChange(this.status);
  }

  startServer() {
    if (this.serverProc) return;
    const serverPath = path.join(PROJECT_ROOT, 'server', 'index.js');
    this.serverProc = spawn(process.execPath, [serverPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.serverProc.stdout?.on('data', (d) => process.stdout.write(`[SRV] ${d}`));
    this.serverProc.stderr?.on('data', (d) => process.stderr.write(`[SRV] ${d}`));
    this.serverProc.on('exit', (code) => {
      console.warn(`[SRV] exited code=${code}`);
      this.serverProc = null;
    });
  }

  async startYoutube(urlOrId) {
    if (!urlOrId) return { ok: false, error: 'URL/ID required' };
    if (this.ytProc) await this.stopYoutube();

    this._setStatus({ state: 'connecting', liveId: null, lastError: null });

    const ytPath = path.join(PROJECT_ROOT, 'server', 'youtube-bridge.js');
    this.ytProc = spawn(process.execPath, [ytPath, urlOrId], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.ytProc.stdout?.on('data', (d) => {
      const text = d.toString();
      process.stdout.write(`[YT] ${text}`);
      // 상태 파싱
      const m = text.match(/\[YT\] connected\. liveId=(\S+)/);
      if (m) this._setStatus({ state: 'connected', liveId: m[1], lastError: null });
      if (text.includes('[YT] live ended')) this._setStatus({ state: 'ended' });
    });
    this.ytProc.stderr?.on('data', (d) => {
      const text = d.toString();
      process.stderr.write(`[YT] ${text}`);
      this._setStatus({ state: 'error', lastError: text.slice(0, 200) });
    });
    this.ytProc.on('exit', (code) => {
      console.warn(`[YT] exited code=${code}`);
      this.ytProc = null;
      if (this.status.state !== 'ended' && this.status.state !== 'error') {
        this._setStatus({ state: 'idle' });
      }
    });
    return { ok: true };
  }

  async stopYoutube() {
    if (!this.ytProc) return { ok: true };
    this.ytProc.kill('SIGTERM');
    this.ytProc = null;
    this._setStatus({ state: 'idle', liveId: null });
    return { ok: true };
  }

  getStatus() {
    return this.status;
  }

  killAll() {
    if (this.ytProc) try { this.ytProc.kill('SIGTERM'); } catch {}
    if (this.serverProc) try { this.serverProc.kill('SIGTERM'); } catch {}
    this.ytProc = null;
    this.serverProc = null;
  }
}

module.exports = { ChildManager };
```

**핵심:** `ELECTRON_RUN_AS_NODE=1` 환경변수로 Electron 바이너리를 Node 모드로 실행. 패키지된 앱에서는 시스템 Node가 없을 수 있어서 Electron의 내장 Node 사용.

---

## Phase E: 컨트롤 UI (renderer에 inject)

게임 위에 작은 HTML 패널. `window.electronAPI` 있을 때만 표시.

### Files
- Modify: `index.html`

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>Drill Live</title>
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: #000; }
      #game { width: 100vw; height: 100vh; }
      /* Electron 컨트롤 패널 — window.electronAPI 있을 때만 활성 */
      #electron-controls {
        position: fixed; top: 16px; left: 16px; z-index: 9999;
        background: rgba(10, 14, 26, 0.92);
        border: 2px solid #FFD700;
        border-radius: 12px;
        padding: 12px 14px;
        font-family: Arial Black, Arial, sans-serif;
        color: #FFFFFF;
        width: 280px;
        display: none;
      }
      #electron-controls h3 {
        margin: 0 0 8px 0; font-size: 14px; color: #FFD700;
      }
      #electron-controls input {
        width: 100%; padding: 6px 8px; box-sizing: border-box;
        background: #1A1F2E; border: 1px solid #333A4A;
        color: #FFFFFF; border-radius: 6px;
        font-size: 12px; margin-bottom: 6px;
      }
      #electron-controls button {
        padding: 6px 14px; margin-right: 6px;
        background: #FFD700; color: #12172A; border: 0;
        border-radius: 6px; font-weight: bold; cursor: pointer;
      }
      #electron-controls button.stop { background: #E91E63; color: #fff; }
      #electron-controls .status {
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; margin-top: 8px;
      }
      #electron-controls .dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #666; display: inline-block;
      }
      #electron-controls .dot.connecting { background: #FFC107; }
      #electron-controls .dot.connected { background: #4CAF50; }
      #electron-controls .dot.error { background: #F44336; }
      #electron-controls .err {
        font-size: 10px; color: #FF8A65; margin-top: 4px;
        white-space: pre-wrap; word-break: break-all;
      }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <div id="electron-controls">
      <h3>📡 YouTube Live</h3>
      <input id="yt-url" placeholder="https://youtube.com/watch?v=..." />
      <button id="yt-start">Start</button>
      <button id="yt-stop" class="stop">Stop</button>
      <div class="status">
        <span class="dot" id="yt-dot"></span>
        <span id="yt-state">idle</span>
      </div>
      <div class="err" id="yt-err"></div>
    </div>
    <script type="module" src="/src/main.js"></script>
    <script>
      // Electron 환경 감지 후 컨트롤 패널 활성화
      if (window.electronAPI) {
        const panel = document.getElementById('electron-controls');
        panel.style.display = 'block';

        const dot = document.getElementById('yt-dot');
        const state = document.getElementById('yt-state');
        const err = document.getElementById('yt-err');
        const apply = (status) => {
          dot.className = 'dot ' + (status.state || '');
          state.textContent = status.liveId
            ? `${status.state} — ${status.liveId}`
            : status.state || 'idle';
          err.textContent = status.lastError || '';
        };
        window.electronAPI.onStatusChange(apply);
        window.electronAPI.getStatus().then(apply);

        document.getElementById('yt-start').onclick = async () => {
          const url = document.getElementById('yt-url').value.trim();
          if (!url) return;
          await window.electronAPI.startYoutube(url);
        };
        document.getElementById('yt-stop').onclick = async () => {
          await window.electronAPI.stopYoutube();
        };
      }
    </script>
  </body>
</html>
```

---

## Phase F: dev/build scripts

### F1. cross-env (devDep)
Windows/Unix 환경변수 통일.

### F2. .gitignore
```
release/
```

---

## Phase G: dev mode 검증

1. `npm run electron:dev`
2. Vite dev server (3000) + Electron 윈도우 자동 열림
3. 게임 로딩 확인
4. 좌상단 컨트롤 패널 표시 확인
5. video URL 입력 → Start → 상태 노랑(connecting) → 초록(connected, liveId 표시)
6. 다른 터미널에서 `npm run fire BOMB Alex` → 게임에 폭탄 ✓
7. Stop 버튼 → 상태 idle ✓
8. 윈도우 닫기 → 서버/yt 모두 종료 확인 (`lsof -ti:8080` 빔)

---

## Phase H: build 검증

1. `npm run electron:pack` (디렉토리만, 빠른 테스트)
2. `release/win-unpacked/Drill Live.exe` (또는 mac-arm64/) 실행
3. 게임 + 서버 + 컨트롤 다 동작 확인
4. `npm run electron:build` (.exe installer)
5. installer 실행 → 설치 → 시작 메뉴에서 실행 가능

---

## Verification Summary

```bash
# Dev 모드
npm run electron:dev

# 패키징 (디렉토리만)
npm run electron:pack
ls release/

# 풀 빌드 (installer)
npm run electron:build
ls release/
```

### 회귀 체크
- 기존 `npm run dev` 여전히 동작 (Vite 단독)
- 기존 `npm run server` + `npm run yt`도 동작 (Electron 없이)
- Tests: 65개 그대로 통과

---

## Spec Coverage Check

| Spec 섹션 | 구현 Phase |
|----------|-----------|
| 3 아키텍처 | A~F 전체 |
| 5 Main Process | B |
| 6 컨트롤 UI | E |
| 7 IPC API | C, D |
| 8 Child 관리 | D |
| 9 Vite 통합 | A |
| 10 Packaging | F, H |
| 12 검증 시나리오 | G, H |

---

## 비고

- 사용자 자리 비울 때 진행 → 의견 필요한 분기점 없음 (디자인 자율 결정 완료)
- WSL에서 Electron 빌드: `apt install libnss3 libgbm1` 등 의존성 필요할 수 있음 → 빌드 실패 시 사용자에게 알림
- 코드 사인 안 함 (사용자 본인 사용용)
