import Phaser from 'phaser';

const BOSS_IDS = ['megaMole', 'crystalGolem', 'abyssKraken', 'ancientTreant', 'magmaDragon'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 사용자 드릴 PNG가 /public/assets/drill.png 에 있으면 자동 로드.
    this.load.image('driller', '/assets/drill.png');

    // 보스 PNG가 /public/assets/bosses/<id>.png 에 있으면 자동 로드.
    for (const id of BOSS_IDS) {
      this.load.image(`boss-${id}`, `/assets/bosses/${id}.png`);
    }
    // 로드 실패는 조용히 무시 (procedural 폴백 동작)
    this.load.on('loaderror', () => {});
  }

  create() {
    this.scene.start('GameScene');
  }
}
