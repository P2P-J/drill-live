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
  },
  pixelArt: false,
  scene: [BootScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// 탭 백그라운드 → 사운드/AudioContext 일시정지. 다시 활성화 시 부드럽게 resume.
// (백그라운드에서 누적된 audio scheduling이 한꺼번에 burst로 들리는 현상 방지)
document.addEventListener('visibilitychange', () => {
  const ctx = game.sound?.context;
  if (!ctx) return;
  if (document.hidden) {
    ctx.suspend?.();
  } else {
    // 잠시 mute 상태로 resume 후 짧은 fade-in (burst 방지)
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
