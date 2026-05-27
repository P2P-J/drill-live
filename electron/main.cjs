// Electron 메인 프로세스 — 윈도우 + 서버 자동 spawn + IPC.
// Renderer = 기존 Vite 빌드 (dist/index.html) 또는 dev 모드의 vite server.

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const { ChildManager } = require('./child-manager.cjs');

const SERVER_PORT = 8080;
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
let childManager = null;

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '127.0.0.1');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1920,
    resizable: true,
    center: true,           // 모니터 가운데 정렬 (큰 게임 사이즈 좌상단 클립 방지)
    autoHideMenuBar: true,
    backgroundColor: '#4A2818',  // 갈색 (게임 letterbox 영역과 매치)
    title: 'Drill Live',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // file:// scheme로 dist/index.html 로드 시 Phaser asset XHR이 CORS로 막히지 않게.
      // 외부 컨텐츠 안 띄우는 본인 사용용 앱이라 안전.
      webSecurity: false,
    },
  });

  const url = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
  mainWindow.loadURL(url);

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // 포트 충돌 체크 — 이미 다른 서버 떠 있으면 알림 후 종료
  const portFree = await isPortFree(SERVER_PORT);
  if (!portFree) {
    dialog.showErrorBox(
      'Port already in use',
      `${SERVER_PORT} 포트가 이미 사용 중입니다.\n다른 Drill Live 인스턴스나 \`npm run server\`를 종료한 뒤 다시 실행해주세요.`
    );
    app.quit();
    return;
  }

  childManager = new ChildManager({
    onStatusChange: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('yt:status-change', status);
      }
    },
  });

  // 트리거 브리지 서버 자동 spawn (포트 SERVER_PORT)
  childManager.startServer();
  // 서버 listen 대기 (대략 800ms)
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

// 강제 종료 시그널에서도 child cleanup (orphan 프로세스 방지)
const cleanup = () => {
  try { childManager?.killAll(); } catch (_e) {}
};
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);
