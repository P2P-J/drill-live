import Phaser from 'phaser';

const BOSS_IDS = ['megaMole', 'crystalGolem', 'abyssKraken', 'ancientTreant', 'magmaDragon'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 보스 PNG가 /public/assets/bosses/<id>.png 에 있으면 자동 로드.
    // 없으면 procedural 폴백 (BossArt.js의 기본 디자인).
    for (const id of BOSS_IDS) {
      this.load.image(`boss-${id}`, `/assets/bosses/${id}.png`);
    }
    // 로드 실패는 조용히 무시 (콘솔 경고만)
    this.load.on('loaderror', (file) => {
      if (file?.key?.startsWith?.('boss-')) {
        // 보스 PNG 없음 — procedural로 그릴 거니까 OK
      }
    });
  }

  create() {
    this.scene.start('GameScene');
  }
}
