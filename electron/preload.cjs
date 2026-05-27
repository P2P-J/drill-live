// preload — contextBridge로 renderer에 안전한 IPC API 노출.
// nodeIntegration: false + contextIsolation: true 하에서 동작.

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
