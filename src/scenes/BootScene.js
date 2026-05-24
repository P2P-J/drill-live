import Phaser from 'phaser';

const BOSS_IDS = ['megaMole', 'crystalGolem', 'abyssKraken', 'ancientTreant', 'magmaDragon'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 사용자 드릴 PNG가 /public/assets/drill.png 에 있으면 자동 로드.
    this.load.image('driller', '/assets/drill.png');

    // 보스 PNG — 단일(<id>.png) 또는 방향별(<id>-left.png / <id>-right.png) 둘 다 시도.
    // 방향별이 둘 다 있으면 Boss.js에서 진행 방향에 맞춰 텍스처 스왑.
    for (const id of BOSS_IDS) {
      this.load.image(`boss-${id}`, `/assets/bosses/${id}.png`);
      this.load.image(`boss-${id}-left`, `/assets/bosses/${id}-left.png`);
      this.load.image(`boss-${id}-right`, `/assets/bosses/${id}-right.png`);
    }
    // 로드 실패는 조용히 무시 (procedural 폴백 동작)
    this.load.on('loaderror', () => {});
  }

  create() {
    this.scene.start('GameScene');
  }
}
