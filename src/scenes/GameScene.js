import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { BiomeManager } from '../objects/BiomeManager.js';
import { TileMap } from '../objects/TileMap.js';
import { gameState } from '../systems/GameState.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.biomeManager = new BiomeManager();
    this.tileMap = new TileMap(this, this.biomeManager);

    // 배경 (타일 너머)
    this.bg = this.add.rectangle(0, 0, GAME.width, GAME.height * 100, 0x111111)
      .setOrigin(0, 0)
      .setDepth(-10);

    // 초기 청크 로드 (driller가 y=0에서 출발한다고 가정)
    this.tileMap.update(0);

    // 임시 디버그 텍스트 — 카메라에 고정
    this.debugText = this.add.text(20, 20, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    gameState.setDepth(0);
  }

  update(_time, _delta) {
    // 임시: driller가 아직 없으니 y=0 고정
    const drillerY = 0;
    this.tileMap.update(drillerY);

    const km = this.biomeManager.yToKm(drillerY);
    const layer = this.biomeManager.getLayerAt(km);
    this.debugText.setText(
      `Depth: ${km.toFixed(1)} km\nBiome: ${layer.biomeEmoji} ${layer.biomeName}\nLayer: ${layer.name}`
    );
  }
}
