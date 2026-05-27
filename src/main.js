import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1080,
  height: 1920,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game',
    width: 1080,
    height: 1920,
  },
  pixelArt: false,
  scene: [BootScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// Electron 환경에선 backgroundThrottling: false로 백그라운드에서도 게임/오디오 정상 동작.
// 일반 웹(브라우저)일 때만 visibility 변경 시 audio context suspend/resume 처리 (burst 방지).
if (typeof window !== 'undefined' && !window.electronAPI) {
  document.addEventListener('visibilitychange', () => {
    const ctx = game.sound?.context;
    if (!ctx) return;
    if (document.hidden) {
      ctx.suspend?.();
    } else {
      const originalVolume = game.sound.volume ?? 1.0;
      game.sound.volume = 0;
      ctx.resume?.().then?.(() => {
        let v = 0;
        const step = () => {
          v += 0.05;
          if (v >= originalVolume) {
            game.sound.volume = originalVolume;
            return;
          }
          game.sound.volume = v;
          requestAnimationFrame(step);
        };
        step();
      });
    }
  });
}
