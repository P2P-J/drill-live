import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { BiomeManager } from '../objects/BiomeManager.js';
import { TileMap } from '../objects/TileMap.js';
import { Driller } from '../objects/Driller.js';
import { gameState } from '../systems/GameState.js';

const DRILLER_TILE_X = 8;

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
      .setDepth(-10)
      .setScrollFactor(0);

    // 초기 청크 로드
    this.tileMap.update(0);

    // 드릴러 생성 (지면 약간 위에서 시작)
    this.driller = new Driller(this, DRILLER_TILE_X, -GAME.tileSize / 2);

    // 카메라가 드릴러를 따라가게 (y만)
    this.cameras.main.setBounds(0, -GAME.height, GAME.width, Number.MAX_SAFE_INTEGER);
    this.cameras.main.startFollow(this.driller.container, true, 0, 0.1);
    // 화면 위쪽 1/3 지점에 driller가 머물도록 offset
    this.cameras.main.setFollowOffset(0, -GAME.height * 0.2);

    // 디버그 텍스트 (카메라 고정)
    this.debugText = this.add.text(20, 20, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    gameState.setDepth(0);
  }

  update(_time, delta) {
    this.driller.update(delta);
    this.tileMap.update(this.driller.y);

    const km = this.biomeManager.yToKm(this.driller.y);
    gameState.setDepth(km);

    const layer = this.biomeManager.getLayerAt(Math.max(0, km));
    this.debugText.setText(
      `Depth: ${km.toFixed(1)} km\n` +
      `Biome: ${layer.biomeEmoji} ${layer.biomeName}\n` +
      `Layer: ${layer.name}\n` +
      `Speed: ${this.driller.speed} px/s`
    );
  }
}
