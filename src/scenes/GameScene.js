import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { BiomeManager } from '../objects/BiomeManager.js';
import { OreLayer } from '../objects/OreLayer.js';
import { TileMap } from '../objects/TileMap.js';
import { Driller } from '../objects/Driller.js';
import { gameState } from '../systems/GameState.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';

const DRILLER_TILE_X = 8;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.biomeManager = new BiomeManager();
    this.oreLayer = new OreLayer(this.biomeManager);
    this.tileMap = new TileMap(this, this.biomeManager, this.oreLayer);
    this.upgradeSystem = new UpgradeSystem(gameState);

    // 게임 카메라는 위쪽 1400px만 사용. 하단은 UIScene이 차지.
    this.cameras.main.setViewport(0, 0, GAME.width, GAME.gameAreaHeight);

    // 배경 (타일 너머)
    this.bg = this.add.rectangle(0, 0, GAME.width, GAME.height * 100, 0x111111)
      .setOrigin(0, 0)
      .setDepth(-10)
      .setScrollFactor(0);

    // 초기 청크 로드
    this.tileMap.update(0);

    // 드릴러 생성
    this.driller = new Driller(this, DRILLER_TILE_X, -GAME.tileSize / 2, this.tileMap, this.upgradeSystem);

    // 카메라 follow
    this.cameras.main.setBounds(0, -GAME.height, GAME.width, Number.MAX_SAFE_INTEGER);
    this.cameras.main.startFollow(this.driller.container, true, 0, 0.1);
    this.cameras.main.setFollowOffset(0, 250);  // driller가 화면 상단 1/3에 머물게

    // UIScene 런치 (병행 실행)
    this.scene.launch('UIScene', {
      upgradeSystem: this.upgradeSystem,
      biomeManager: this.biomeManager,
    });

    gameState.setDepth(0);
  }

  update(_time, delta) {
    this.driller.update(delta);
    this.tileMap.update(this.driller.y);

    const km = this.biomeManager.yToKm(this.driller.y);
    gameState.setDepth(km);
  }
}
