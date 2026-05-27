// Electron 메인 프로세스 — 윈도우 + 서버 자동 spawn + IPC.
// Renderer = 기존 Vite 빌드 (dist/index.html) 또는 dev 모드의 vite server.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { ChildManager } = require('./child-manager.cjs');

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
    title: 'Drill Live',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
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
  childManager = new ChildManager({
    onStatusChange: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('yt:status-change', status);
      }
    },
  });

  // 트리거 브리지 서버 자동 spawn (포트 8080)
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
