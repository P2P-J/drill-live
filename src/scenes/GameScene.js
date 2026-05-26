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
      remoteTrigger: this.remoteTrigger,
    });

    this._setupDebugKeys();

    gameState.setDepth(0);
  }

  _setupDebugKeys() {
    // G: DRILL_GOLD (드릴 컨셉 변경). SHIFT+G: 골드 +100,000 디버그
    this.input.keyboard.on('keydown-G', (e) => {
      if (e.shiftKey) {
        gameState.addGold(100000);
      } else {
        this.triggerSystem.fire('DRILL_GOLD');
      }
    });

    // D: DRILL_DIAMOND. SHIFT+D: 깊이 +50,000km 점프 (바이옴 빠른 확인용)
    this.input.keyboard.on('keydown-D', (e) => {
      if (e.shiftKey) {
        const jumpKm = 50000;
        this.driller.y += jumpKm * GAME.pxPerKm;
        this.driller.container.y = this.driller.y;
        this.tileMap.update(this.driller.y);
      } else {
        this.triggerSystem.fire('DRILL_DIAMOND');
      }
    });

    // W: DRILL_WOOD (FAST는 Q로 옮김)
    this.input.keyboard.on('keydown-Q', () => this.triggerSystem.fire('FAST'));

    // R: drillRange 채팅 업그레이드 시뮬레이션 — 디버그용이라 골드 자동 충전 후 발동
    this.input.keyboard.on('keydown-R', () => {
      if (gameState.gold < 1000000) gameState.addGold(1000000);
      this.triggerSystem.fire('UPGRADE_RANGE');
    });
    // U: engine 채팅 업그레이드 시뮬레이션 — 같이 자동 충전
    this.input.keyboard.on('keydown-U', () => {
      if (gameState.gold < 500000) gameState.addGold(500000);
      this.triggerSystem.fire('UPGRADE_ENGINE');
    });
    // 드릴 컨셉 변경 — 무료(컨셉만 바뀜, 3초 유지)
    const DRILL_KEYS = {
      'W': 'DRILL_WOOD',
      'S': 'DRILL_STONE',
      'I': 'DRILL_IRON',
      // G, D는 위에서 shiftKey 분기로 처리
    };
    for (const [key, triggerId] of Object.entries(DRILL_KEYS)) {
      this.input.keyboard.on(`keydown-${key}`, () => this.triggerSystem.fire(triggerId));
    }

    // === 후원 시뮬레이션 키보드 매핑 (Phase 3 테스트용) ===
    const KEY_TRIGGERS = {
      'ONE':   'BOMB',         // $1  — ULTRA BOMB ×5
      'TWO':   'ULTRA_BOMB',   // $3  — MEGA BOMB ×5
      'THREE': 'MEGA_BLAST',   // $5  — GIGA BLAST ×5
      'FOUR':  'NUKE',         // $20 — NUKE ×5
      'FIVE':  'DRILL_UP',     // $2  — ×2.0 / 30s
      'SEVEN': 'OVERDRIVE',    // $10 — ×7.0 / 30s
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
