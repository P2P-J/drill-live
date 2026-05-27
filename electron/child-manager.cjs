// Server + youtube-bridge child process 관리.
// Electron 메인에서 사용. ELECTRON_RUN_AS_NODE=1로 Electron 바이너리를 Node로 실행해서
// 패키지된 앱(사용자 PC에 Node 없어도)에서도 동작.

const { spawn } = require('child_process');
const path = require('path');

// app.isPackaged면 process.resourcesPath/app.asar.unpacked/... 안에 server 있음 (asarUnpack 덕분)
// dev에선 프로젝트 루트 직접.
function getProjectRoot() {
  // electron이 packaged 모드면 process.resourcesPath 사용
  if (process.resourcesPath && require('electron').app?.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked');
  }
  return path.join(__dirname, '..');
}

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

  _spawnNode(scriptPath, args = []) {
    const root = getProjectRoot();
    return spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        // packaged 모드에서 node_modules 경로 명시 (asarUnpack로 풀린 곳)
        NODE_PATH: path.join(root, 'node_modules'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  startServer() {
    if (this.serverProc) return;
    const serverPath = path.join(getProjectRoot(), 'server', 'index.js');
    this.serverProc = this._spawnNode(serverPath);
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

    const ytPath = path.join(getProjectRoot(), 'server', 'youtube-bridge.js');
    this.ytProc = this._spawnNode(ytPath, [urlOrId]);

    this.ytProc.stdout?.on('data', (d) => {
      const text = d.toString();
      process.stdout.write(`[YT] ${text}`);
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
    try { this.ytProc.kill('SIGTERM'); } catch (_e) {}
    this.ytProc = null;
    this._setStatus({ state: 'idle', liveId: null });
    return { ok: true };
  }

  getStatus() {
    return this.status;
  }

  killAll() {
    if (this.ytProc) { try { this.ytProc.kill('SIGTERM'); } catch (_e) {} }
    if (this.serverProc) { try { this.serverProc.kill('SIGTERM'); } catch (_e) {} }
    this.ytProc = null;
    this.serverProc = null;
  }
}

module.exports = { ChildManager };
