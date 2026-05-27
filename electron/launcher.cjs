// Electron launcher — ELECTRON_RUN_AS_NODE 환경변수가 셸에 박혀있으면
// electron 바이너리가 Node 모드로 떠서 main process가 동작 안 함.
// 이 launcher가 env에서 그 변수 제거 후 electron 실행.

const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
const child = spawn(electron, ['.', ...args], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => process.exit(code ?? 0));
