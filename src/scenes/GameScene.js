import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { BiomeManager } from '../objects/BiomeManager.js';
import { OreLayer } from '../objects/OreLayer.js';
import { TileMap } from '../objects/TileMap.js';
import { Driller } from '../objects/Driller.js';
import { gameState } from '../systems/GameState.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { UPGRADE_ORDER } from '../config/upgrades.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { TriggerSystem, TRIGGER_DEFS } from '../systems/TriggerSystem.js';
import { BossTracker } from '../systems/BossTracker.js';
import { ArenaSystem } from '../systems/ArenaSystem.js';
import { CooldownManager } from '../systems/CooldownManager.js';
import { SoundManager } from '../systems/SoundManager.js';
import { RemoteTrigger } from '../systems/RemoteTrigger.js';

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
    this.buffSystem = new BuffSystem(this);
    this.soundManager = new SoundManager(this);

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
    this.driller = new Driller(this, DRILLER_TILE_X, -GAME.tileSize / 2, this.tileMap, this.upgradeSystem, this.buffSystem, this.soundManager);

    // 채팅 트리거 전체 채널 쿨다운 관리
    this.cooldownManager = new CooldownManager(this);

    // 트리거 시스템 (후원/채팅/구독 이벤트 핸들러)
    this.triggerSystem = new TriggerSystem(this, {
      driller: this.driller,
      tileMap: this.tileMap,
      biomeManager: this.biomeManager,
      buffSystem: this.buffSystem,
      oreLayer: this.oreLayer,
      cooldownManager: this.cooldownManager,
      soundManager: this.soundManager,
    });

    // 보스 아레나 + 추적기
    this.arenaSystem = new ArenaSystem(this, this.tileMap, this.driller);
    this.bossTracker = new BossTracker(this, {
      driller: this.driller,
      tileMap: this.tileMap,
      buffSystem: this.buffSystem,
      arenaSystem: this.arenaSystem,
    });
    this.triggerSystem.bossTracker = this.bossTracker;

    // 외부 트리거 브리지 — 서버가 실행 중이면 자동 연결, 아니면 silently retry.
    this.remoteTrigger = new RemoteTrigger(this.triggerSystem);
    this.remoteTrigger.connect();

    // 카메라 follow
    this.cameras.main.setBounds(0, -GAME.height, GAME.width, Number.MAX_SAFE_INTEGER);
    // lerpY 0.1 → 0.35: 카메라가 드릴 낙하를 더 빠르게 따라가서 잔상/스터터 감소.
    this.cameras.main.startFollow(this.driller.container, true, 0, 0.35);
    this.cameras.main.setFollowOffset(0, 250);  // driller가 화면 상단 1/3에 머물게

    // UIScene 런치 (병행 실행)
    this.scene.launch('UIScene', {
      upgradeSystem: this.upgradeSystem,
      biomeManager: this.biomeManager,
      buffSystem: this.buffSystem,
      triggerSystem: this.triggerSystem,
      bossTracker: this.bossTracker,
    });

    this._setupDebugKeys();

    gameState.setDepth(0);
  }

  _setupDebugKeys() {
    // G: 골드 +10,000
    this.input.keyboard.on('keydown-G', () => {
      gameState.addGold(10000);
    });

    // D: 깊이 +1,000km 점프. SHIFT+D: +50,000km 점프 (바이옴 빠른 확인용)
    this.input.keyboard.on('keydown-D', (e) => {
      const jumpKm = e.shiftKey ? 50000 : 1000;
      this.driller.y += jumpKm * GAME.pxPerKm;
      this.driller.container.y = this.driller.y;
      this.tileMap.update(this.driller.y);
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

    // SPACE: 후원 시뮬레이션 — DRILL RANGE +2, 10초 (드릴이 커지고 반경 확장)
    this.input.keyboard.on('keydown-SPACE', () => {
      this.triggerSystem.fire('RANGE_UP');
    });

    // === 후원 시뮬레이션 키보드 매핑 (Phase 3 테스트용) ===
    const KEY_TRIGGERS = {
      'ONE':   'BOMB',         // $1
      'TWO':   'ULTRA_BOMB',   // $3
      'THREE': 'MEGA_BLAST',   // $5
      'FOUR':  'NUKE',         // $20
      'FIVE':  'DRILL_UP',     // $2
      'SIX':   'TURBO',        // $5
      'SEVEN': 'OVERDRIVE',    // $10
      'EIGHT': 'GOLD_RUSH',    // $3
      'NINE':  'GEM_DROP',     // $5
      'ZERO':  'DIAMOND',      // $10
      'Q':     'SPECIAL',      // $15
      'W':     'FAST',         // !fast
      'E':     'SUB',          // 신규 구독
      'M':     'MEMBER',       // 멤버 가입
      'L':     'LIKE',         // 좋아요 (3초 sizzle, 이름 합산)
      'T':     'GIFT_SUB',     // $5+ 선물 구독 → NUKE + DIAMOND 동시
      'F':     'JACKPOT',      // !jackpot — 전 레이어 다이아 파티 (스트리머)
      'Z':     'RESET',        // !reset — 새 맵 생성 (스트리머)
    };
    for (const [key, triggerId] of Object.entries(KEY_TRIGGERS)) {
      this.input.keyboard.on(`keydown-${key}`, () => {
        this.triggerSystem.fire(triggerId);
      });
    }

    // 보스 디버그 키
    this.input.keyboard.on('keydown-B', () => this.bossTracker.forceSpawnNext());
    this.input.keyboard.on('keydown-N', () => this.bossTracker.activeBoss?.forceDefeat());

    // 사운드 mute 토글
    this.input.keyboard.on('keydown-SEMICOLON', () => {
      const muted = this.soundManager.toggleMute();
      console.log('Sound', muted ? 'muted' : 'unmuted');
    });
  }

  update(_time, delta) {
    this.buffSystem.update();
    this.driller.update(delta);
    this.tileMap.update(this.driller.y);
    this.triggerSystem.explosionEffect.step(delta);

    const km = this.biomeManager.yToKm(this.driller.y);
    gameState.setDepth(km);
    this.bossTracker.update(km, delta);

    // 배경 색상: 1km 단위로만 갱신 (매 프레임 lerpColor + setFillStyle 부담 제거)
    const kmRounded = Math.max(0, Math.floor(km));
    if (kmRounded !== this._lastBgKm) {
      this._lastBgKm = kmRounded;
      const biomeColor = this.biomeManager.getColorAt(kmRounded);
      this.bg.setFillStyle(darken(biomeColor, 0.25));
    }

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
    if (cheapest) {
      this.upgradeSystem.buy(cheapest);
      this.soundManager?.play('upgrade_buy');
    }
  }
}

function darken(hex, factor) {
  const r = Math.round(((hex >> 16) & 0xff) * factor);
  const g = Math.round(((hex >> 8) & 0xff) * factor);
  const b = Math.round((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
