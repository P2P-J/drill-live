import Phaser from 'phaser';
import { GAME } from '../config/game.js';
import { BiomeManager } from '../objects/BiomeManager.js';
import { OreLayer } from '../objects/OreLayer.js';
import { TileMap } from '../objects/TileMap.js';
import { Driller } from '../objects/Driller.js';
import { gameState } from '../systems/GameState.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { TriggerSystem, TRIGGER_DEFS } from '../systems/TriggerSystem.js';
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
    this.upgradeSystem = new UpgradeSystem(this, gameState);
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
      upgradeSystem: this.upgradeSystem,
    });

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

    // R: drillRange 채팅 업그레이드 시뮬레이션 (UPGRADE_RANGE 트리거)
    this.input.keyboard.on('keydown-R', () => this.triggerSystem.fire('UPGRADE_RANGE'));
    // P: drillPower 채팅 업그레이드 시뮬레이션 (UPGRADE_POWER 트리거)
    this.input.keyboard.on('keydown-P', () => this.triggerSystem.fire('UPGRADE_POWER'));
    // U: engine 채팅 업그레이드 시뮬레이션 (UPGRADE_ENGINE 트리거)
    this.input.keyboard.on('keydown-U', () => this.triggerSystem.fire('UPGRADE_ENGINE'));

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
      'E':     'SUB',          // 신규 구독 — 드릴 아래 10줄 바이옴 특수광물 채우기
      'L':     'LIKE',         // 좋아요 (3초 sizzle, 이름 합산)
      'F':     'JACKPOT',      // !jackpot — 전 레이어 다이아 파티 (스트리머)
      'Z':     'RESET',        // !reset — 새 맵 생성 (스트리머)
    };
    for (const [key, triggerId] of Object.entries(KEY_TRIGGERS)) {
      this.input.keyboard.on(`keydown-${key}`, () => {
        this.triggerSystem.fire(triggerId);
      });
    }

    // 사운드 mute 토글
    this.input.keyboard.on('keydown-SEMICOLON', () => {
      const muted = this.soundManager.toggleMute();
      console.log('Sound', muted ? 'muted' : 'unmuted');
    });
  }

  update(_time, delta) {
    this.buffSystem.update();
    this.upgradeSystem.update();
    this.driller.update(delta);
    this.tileMap.update(this.driller.y);
    this.triggerSystem.explosionEffect.step(delta);

    const km = this.biomeManager.yToKm(this.driller.y);
    gameState.setDepth(km);

    // 배경 색상: 1km 단위로만 갱신 (매 프레임 lerpColor + setFillStyle 부담 제거)
    const kmRounded = Math.max(0, Math.floor(km));
    if (kmRounded !== this._lastBgKm) {
      this._lastBgKm = kmRounded;
      const biomeColor = this.biomeManager.getColorAt(kmRounded);
      this.bg.setFillStyle(darken(biomeColor, 0.25));
    }

  }
}

function darken(hex, factor) {
  const r = Math.round(((hex >> 16) & 0xff) * factor);
  const g = Math.round(((hex >> 8) & 0xff) * factor);
  const b = Math.round((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
