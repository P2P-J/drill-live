import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { BiomeManager } from '../objects/BiomeManager.js';
import { OreLayer } from '../objects/OreLayer.js';
import { TileMap } from '../objects/TileMap.js';
import { Driller } from '../objects/Driller.js';
import { gameState } from '../systems/GameState.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { UPGRADE_ORDER } from '../config/upgrades.js';

const DRILLER_TILE_X = 6;

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

    // 배경 — 매 프레임 현재 바이옴 색을 어둡게 칠해 깊이감 부여
    this.bg = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x111111)
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

    this._setupDebugKeys();

    gameState.setDepth(0);
  }

  _setupDebugKeys() {
    // G: 골드 +10,000
    this.input.keyboard.on('keydown-G', () => {
      gameState.addGold(10000);
    });

    // D: 깊이 +1,000km 점프 (driller 위치도 함께 이동)
    this.input.keyboard.on('keydown-D', () => {
      const jumpPx = 1000 * GAME.pxPerKm;
      this.driller.y += jumpPx;
      this.driller.container.y = this.driller.y;
      // 점프 후 청크 재로딩
      this.tileMap.update(this.driller.y);
    });

    // SHIFT+D: 깊이 +50,000km 점프 (바이옴 빠른 확인용)
    this.input.keyboard.on('keydown-D', (e) => {
      if (e.shiftKey) {
        const jumpPx = 49000 * GAME.pxPerKm;
        this.driller.y += jumpPx;
        this.driller.container.y = this.driller.y;
        this.tileMap.update(this.driller.y);
      }
    });

    // R: drillRange 토글 (1 → 2 → 3 → 1)
    this.input.keyboard.on('keydown-R', () => {
      const curr = gameState.upgrades.drillRange;
      const next = curr >= 3 ? 1 : curr + 1;
      gameState.setUpgrade('drillRange', next);
    });

    // P: drillPower 토글 (1 → 5 → 1)
    this.input.keyboard.on('keydown-P', () => {
      const curr = gameState.upgrades.drillPower;
      const next = curr >= 5 ? 1 : curr + 1;
      gameState.setUpgrade('drillPower', next);
    });
  }

  update(_time, delta) {
    this.driller.update(delta);
    this.tileMap.update(this.driller.y);

    const km = this.biomeManager.yToKm(this.driller.y);
    gameState.setDepth(km);

    // 배경 색상: 현재 바이옴 색의 25% 밝기로
    const biomeColor = this.biomeManager.getColorAt(Math.max(0, km));
    this.bg.setFillStyle(darken(biomeColor, 0.25));

    // 자동 업그레이드 — 가장 저렴한 구매 가능 항목을 매 0.4초마다 1개씩 구매
    this._autoBuyTimer = (this._autoBuyTimer ?? 0) + delta;
    if (this._autoBuyTimer >= 400) {
      this._autoBuyTimer = 0;
      this._autoBuyCheapest();
    }
  }

  _autoBuyCheapest() {
    let cheapest = null;
    let cheapestCost = Infinity;
    for (const name of UPGRADE_ORDER) {
      const cost = this.upgradeSystem.nextCost(name);
      if (cost === null) continue;
      if (this.upgradeSystem.canBuy(name) && cost < cheapestCost) {
        cheapest = name;
        cheapestCost = cost;
      }
    }
    if (cheapest) this.upgradeSystem.buy(cheapest);
  }
}

function darken(hex, factor) {
  const r = Math.round(((hex >> 16) & 0xff) * factor);
  const g = Math.round(((hex >> 8) & 0xff) * factor);
  const b = Math.round((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
