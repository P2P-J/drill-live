import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.add.text(540, 960, 'Driller Live', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '96px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(540, 1100, 'Phase 1 Bootstrap', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '40px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }
}
