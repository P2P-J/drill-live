import Phaser from 'phaser';
import { GAME } from '../config/game.js';

const BODY_COLOR = 0xFFC107;
const HELMET_COLOR = 0xFF6F00;
const DRILL_COLOR = 0xCFD8DC;
const SHADOW_COLOR = 0x000000;

export class Driller {
  constructor(scene, tileX, worldY = 0) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor((GAME.width - GAME.chunkTilesX * this.tileSize) / 2);

    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    // 외형: Phaser Container
    this.container = scene.add.container(this.worldX, this.y);
    this.container.setDepth(50);

    // 본체 (노란 박스)
    this.body = scene.add.rectangle(0, 0, this.tileSize * 0.92, this.tileSize * 0.78, BODY_COLOR);
    this.body.setStrokeStyle(2, SHADOW_COLOR);

    // 헬멧 (위쪽)
    this.helmet = scene.add.rectangle(0, -this.tileSize * 0.32, this.tileSize * 0.5, this.tileSize * 0.18, HELMET_COLOR);
    this.helmet.setStrokeStyle(2, SHADOW_COLOR);

    // 드릴 비트 (아래 삼각형)
    const t = this.tileSize;
    this.drillBit = scene.add.triangle(0, t * 0.42, -t * 0.32, 0, t * 0.32, 0, 0, t * 0.25, DRILL_COLOR);
    this.drillBit.setStrokeStyle(2, SHADOW_COLOR);

    this.container.add([this.body, this.helmet, this.drillBit]);

    // 속도 (Task 8에서 업그레이드 시스템과 연결)
    this.speed = GAME.baseDrillSpeed;
  }

  update(delta) {
    // delta = ms
    this.y += this.speed * (delta / 1000);
    this.container.y = this.y;
  }

  // 현재 driller가 점유하고 있는 타일 좌표
  getTileY() {
    return Math.floor(this.y / this.tileSize);
  }
}
