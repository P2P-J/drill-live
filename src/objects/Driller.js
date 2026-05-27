import Phaser from "phaser";
import { GAME } from "../config/game.js";
import { gameState } from "../systems/GameState.js";
import { ensureDrillerTexture } from "./DrillerArt.js";

// 중력 — 1 타일 = 1m = 64px. 현실 g=627 px/s²의 약 2배(게임 페이스).
// ExplosionEffect의 GRAVITY_PX_S2와 일치시켜 드릴/폭탄이 같은 물리.
const GRAVITY_PX_S2 = 1250;
const MAX_FALL_SPEED = 2400;

export class Driller {
  constructor(
    scene,
    tileX,
    worldY,
    tileMap,
    upgradeSystem = null,
    buffSystem = null,
    soundManager = null,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.upgradeSystem = upgradeSystem;
    this.buffSystem = buffSystem;
    this.soundManager = soundManager;
    this.tileSize = GAME.tileSize;
    this.xOffset = Math.floor(
      (GAME.width - GAME.chunkTilesX * this.tileSize) / 2,
    );

    this.worldX = this.xOffset + tileX * this.tileSize + this.tileSize / 2;
    this.y = worldY;

    const drillerKey = ensureDrillerTexture(scene);

    // 컨테이너 안에 통합 텍스처 하나만 (본체 + 비트 + 헬멧 + 트랙이 한 이미지)
    this.container = scene.add.container(this.worldX, this.y);
    this.container.setDepth(50);

    // 본체 바닥 = 컨테이너 원점 (드릴 비트는 origin 아래로 돌출).
    // origin Y = 0.7 → 텍스처 70% 지점이 anchor (상단 70%=본체, 하단 30%=비트).
    this.sprite = scene.add.image(0, 0, drillerKey);
    this.sprite.setOrigin(0.5, 0.7);

    // 텍스처 native 크기와 무관하게 일정한 화면 크기로 표시.
    // 목표: 기본 상태에서 드릴 폭 ≈ 256px (4 타일). 큰 PNG여도 자동 축소.
    this._targetWidth = 256;
    this._concept = "rush"; // 'rush' | 'wood' | 'stone' | 'iron' | 'gold' | 'diamond'
    this._state = "normal"; // 'normal' | 'hurt'
    this._conceptResetTimer = null;
    this._recomputeBaseScale();
    this.sprite.setScale(this._baseScale);

    this.container.add(this.sprite);

    // 업그레이드 효과치
    this.speed = GAME.baseDrillSpeed;
    this.drillSpeedMult = 1.0;
    this.engineMult = 1.0;
    this.drillRange = 1;

    // 좌우 통통 튀기 (미미한 드리프트) + 주기적 랜덤 임펄스로 자유로운 움직임
    this.leftBound =
      this.xOffset +
      (GAME.wallLeftX + 1) * this.tileSize +
      this.tileSize * 0.46;
    this.rightBound =
      this.xOffset + GAME.wallRightX * this.tileSize - this.tileSize * 0.46;
    this.vx = GAME.bounceSpeed * (Math.random() < 0.5 ? -1 : 1);
    this._nextRandomKickAt = 0; // 첫 update에 바로 한 번 보정
    this._knockbackUntil = 0; // 폭탄 임펄스 받은 후 mining vy 리셋 잠시 무시

    this.mineProgress = 0;
    this.isMining = false;
    this._wobble = 0;
    this._displayedRange = 1;
    // 채굴 범위 전체에 크랙 표시 — 트래킹
    this._crackedTiles = [];
    this._lastCrackStage = 0;
    this.vy = 0;
  }

  _syncUpgrades() {
    if (!this.upgradeSystem) return;
    let drillSpeedMult = this.upgradeSystem.getDrillSpeedMult();
    let engineMult = this.upgradeSystem.getEngineMult();

    // drillPowerUp 버프 (DRILL UP / TURBO / OVERDRIVE / !fast)
    if (this.buffSystem) {
      const powerBuff = this.buffSystem.get("drillPowerUp");
      if (powerBuff) {
        drillSpeedMult *= powerBuff.params.mult;
        engineMult *= powerBuff.params.mult;
      }
    }

    this.drillSpeedMult = drillSpeedMult;
    this.engineMult = engineMult;

    // 드릴 파워 단계별 색 변화 (Wood→Stone→Iron→Gold→Diamond)
    // 드릴 등급별 tint/scale 시각 변화 비활성 — wood/stone/iron/... 채팅 명령에 시각 반응 X

    // 업그레이드 단계 + drillRangeUp 버프 = 효과 range
    const baseRange = this.upgradeSystem.getDrillRange();
    let bonus = 0;
    if (this.buffSystem) {
      const buff = this.buffSystem.get("drillRangeUp");
      if (buff) bonus = buff.params.bonus;
    }
    const newRange = baseRange + bonus;

    if (newRange !== this._displayedRange) {
      this._displayedRange = newRange;
      this._tweenScaleForRange(newRange);
    }
    this.drillRange = newRange;
  }

  // 현재 드릴이 위치한 tileX (트리거 시스템에서 사용)
  getCurrentTileX() {
    return Math.floor((this.worldX - this.xOffset) / this.tileSize);
  }

  // 드릴 크기를 채굴 반경에 맞춰 확장.
  // baseScale (텍스처 크기 보정) × rangeMultiplier 로 최종 scale 계산.
  // baseScale이 커진 만큼(5x) rangeMultiplier는 줄여서 13타일 채널 안에 머물게 함.
  _tweenScaleForRange(range) {
    // 컨셉별 scaleMult를 곱해서 어떤 드릴이든 동일한 비율로 커지게
    const scaleMult = this._currentConceptScaleMult();
    const mult = (1.0 + (range - 1) * 0.55) * scaleMult;
    const targetScale = (this._baseScale ?? 1.0) * mult;
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: 350,
      ease: "Back.easeOut",
    });
  }

  update(delta) {
    this._syncUpgrades();
    // dt cap: FPS가 20fps 아래로 떨어져도 한 프레임 물리가 폭주하지 않도록 50ms 상한.
    const dt = Math.min(0.05, delta / 1000);

    // 주기적 랜덤 vx 임펄스 — 벽 안 부딫쳐도 방향/속도가 불규칙하게 변함
    const now = this.scene.time.now;
    if (now >= this._nextRandomKickAt) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const strength = 30 + Math.random() * 60; // 30~90 px/s 임펄스
      this.vx += dir * strength;
      this._nextRandomKickAt = now + 1200 + Math.random() * 1800; // 1.2~3초 간격
    }

    // 좌우 + 벽 반사 (매 반사마다 속도 랜덤화 0.7~1.3배)
    let newX = this.worldX + this.vx * dt * this.engineMult;
    if (newX <= this.leftBound) {
      newX = this.leftBound;
      this.vx = Math.abs(this.vx) * (0.7 + Math.random() * 0.6);
      this._spawnBounceParticles(newX, this.y, -1);
      this._squashBounce();
    } else if (newX >= this.rightBound) {
      newX = this.rightBound;
      this.vx = -Math.abs(this.vx) * (0.7 + Math.random() * 0.6);
      this._spawnBounceParticles(newX, this.y, +1);
      this._squashBounce();
    }
    // 공기 저항 — 폭탄 임펄스 받으면 한참 빠르게 움직이다가 서서히 진정
    this.vx *= 0.992;
    // 최대 속도 — 너무 빨라지면 화면 밖으로 튕겨나가지 않게 clamp
    const MAX_VX = 360;
    if (Math.abs(this.vx) > MAX_VX) this.vx = Math.sign(this.vx) * MAX_VX;
    this.worldX = newX;

    // 회전 없음. 채굴 중 상하 반동(드릴 두들기는 느낌) — sprite.y로 표현.
    this.container.rotation = 0;
    if (this.isMining) {
      // 1 타일 = 5번 타격 사이클. 각 타격: 빠르게 내려가서 contact → 위로 튕김
      const cyclesPerTile = 5;
      const t =
        ((this.mineProgress / GAME.minePerTileSeconds) * cyclesPerTile) % 1;
      // contact = t==0, peak rebound = t≈0.4, 다시 내려 = t→1
      // sin(t * PI) → 0 at 0/1, 1 at 0.5
      const reboundOffset = -Math.sin(t * Math.PI) * 8; // 위로 8px 튕김
      this.sprite.y = reboundOffset;
      this.sprite.x = 0;
    } else {
      this.sprite.y = 0;
      this.sprite.x = 0;
    }

    // 아래쪽 타일 검사 — drill.y = 본체 바닥 = 비트 시작점.
    // 본체 바닥이 타일 윗변에 닿거나 그 아래로 가면 mining 시작 (비트가 타일을 파고듦).
    const currentTileX = Math.floor(
      (this.worldX - this.xOffset) / this.tileSize,
    );
    const epsilon = 1;
    const nextTileY = Math.floor((this.y + epsilon) / this.tileSize);

    const blocker = this.tileMap.getTileAt(currentTileX, nextTileY);
    const inKnockback = this.scene.time.now < this._knockbackUntil;

    if (
      !inKnockback &&
      blocker &&
      !blocker.destroyed &&
      !blocker.isWall &&
      nextTileY >= 0
    ) {
      if (!this.isMining) {
        // 채굴 시작 — drill_loop 시작. 1.0으로 크게 (라이브 송출 시 다른 소리에 묻히지 않게).
        this._drillLoop = this.soundManager?.playLoop("drill_loop", {
          volume: 1.0,
        });
        // 현재 속도에 맞춰 즉시 rate 설정
        this._drillLoop?.setRate?.(this.drillSpeedMult);
        this._lastLoopRate = this.drillSpeedMult;
      }
      // 채굴 중에도 drillSpeedMult가 바뀌면 rate 갱신 (TURBO/OVERDRIVE 발동 등)
      if (
        this._drillLoop &&
        Math.abs((this._lastLoopRate ?? 1.0) - this.drillSpeedMult) > 0.01
      ) {
        this._drillLoop.setRate?.(this.drillSpeedMult);
        this._lastLoopRate = this.drillSpeedMult;
      }
      this.isMining = true;
      // 채굴 진행 — 바이옴 hardness가 분모 (깊이 갈수록 더 오래 걸림)
      const hardness = this._currentBiomeHardness();
      this.mineProgress += (dt * this.drillSpeedMult) / hardness;

      // 크랙 단계 갱신 — 깨질 범위 (반원) 전체에 크랙 표시 (0 → 4)
      const crackStage = Math.min(
        4,
        Math.floor((this.mineProgress / GAME.minePerTileSeconds) * 5),
      );
      if (crackStage !== this._lastCrackStage) {
        this._lastCrackStage = crackStage;
        this._applyCracksToSemicircle(nextTileY, currentTileX, crackStage);
      }

      // 채굴 중에는 vy 리셋 — 단, 폭탄 임펄스 직후 350ms는 보호 (드릴이 정말 튕겨나가게)
      if (this.scene.time.now > this._knockbackUntil) this.vy = 0;

      if (this.mineProgress >= GAME.minePerTileSeconds) {
        this._mineSemicircle(nextTileY, currentTileX);
        this.mineProgress = 0;
        // 모두 destroy 됐으니 트래킹 초기화
        this._crackedTiles = [];
        this._lastCrackStage = 0;
      } else {
        const snapY = nextTileY * this.tileSize;
        if (this.y > snapY) {
          this.y = this.y - (this.y - snapY) * 0.5;
        }
      }
    } else {
      if (this.isMining && this._drillLoop) {
        this._drillLoop.stop();
        this._drillLoop = null;
      }
      this.isMining = false;
      // 자유낙하 / 자유비행 — 중력 가속 + sub-step 충돌 검사.
      // 폭탄 임펄스로 위로 날아갈 수도 있어서 하강/상승 둘 다 처리.
      this.vy = Math.min(
        MAX_FALL_SPEED,
        this.vy + GRAVITY_PX_S2 * this.engineMult * dt,
      );
      const moveDist = this.vy * dt;
      const T = this.tileSize;
      if (moveDist >= 0) {
        // 하강 — sub-step 충돌 검사 (FPS 저하나 vy 클 때 중간 타일 놓치지 않게)
        let remaining = moveDist;
        const subStep = T * 0.5;
        while (remaining > 0) {
          const step = Math.min(remaining, subStep);
          const probeTileY = Math.floor((this.y + step + epsilon) / T);
          const probeTile = this.tileMap.getTileAt(currentTileX, probeTileY);
          if (
            probeTile &&
            !probeTile.destroyed &&
            !probeTile.isWall &&
            probeTileY >= 0
          ) {
            this.y = probeTileY * T;
            this.vy = 0;
            break;
          }
          this.y += step;
          remaining -= step;
        }
      } else {
        // 상승 — 폭탄 임펄스로 위로 튕겼을 때. 위쪽은 보통 mined 영역이라 충돌 검사 생략.
        // 너무 위로(화면 밖)는 못 가게 clamp.
        this.y = Math.max(-T * 4, this.y + moveDist);
        if (this.y <= -T * 4) this.vy = 0;
      }
      // 채굴 중이 아니면 남은 크랙 정리
      if (this._crackedTiles && this._crackedTiles.length > 0) {
        for (const t of this._crackedTiles) {
          if (t && !t.destroyed) this.tileMap.setCrackStage(t, 0);
        }
        this._crackedTiles = [];
        this._lastCrackStage = 0;
      }
    }

    this.container.x = this.worldX;
    this.container.y = this.y;
  }

  // 반원 채굴 반경 계산 (drillRange 1=1.8 ... 5=7.5 타일)
  _miningRadius() {
    return 1.8 + (Math.max(1, this.drillRange) - 1) * 1.5;
  }

  // 깨질 범위 전체에 크랙 오버레이 표시. drill이 움직이면 이전 크랙 지우고 새 위치에 다시.
  _applyCracksToSemicircle(tileY, centerTileX, stage) {
    // 이전에 크랙 칠한 타일들 정리 (지금 범위 밖일 수 있음)
    if (this._crackedTiles) {
      for (const t of this._crackedTiles) {
        if (t && !t.destroyed) this.tileMap.setCrackStage(t, 0);
      }
    }
    this._crackedTiles = [];
    if (stage <= 0) return;

    const r = this._miningRadius();
    const r2 = r * r;
    const ir = Math.ceil(r);
    for (let dy = 0; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const tx = centerTileX + dx;
        const ty = tileY + dy;
        const tile = this.tileMap.getTileAt(tx, ty);
        if (!tile || tile.destroyed || tile.isWall) continue;
        this.tileMap.setCrackStage(tile, stage);
        this._crackedTiles.push(tile);
      }
    }
  }

  // 반원 범위 채굴 — drillRange가 커질수록 반지름이 늘어남.
  // (기본 1=1.8, 2=3.0, 3=4.5, 4=6.0, 5=7.5, 6=9.0 타일 반경)
  _mineSemicircle(tileY, centerTileX) {
    const r = this._miningRadius();
    const r2 = r * r;
    const ir = Math.ceil(r);
    let totalGold = 0;

    for (let dy = 0; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const tx = centerTileX + dx;
        const ty = tileY + dy;
        const tile = this.tileMap.getTileAt(tx, ty);
        if (!tile || tile.destroyed || tile.isWall) continue;

        const px = tile.worldX + this.tileSize / 2;
        const py = tile.worldY + this.tileSize / 2;
        const ore = this.tileMap.destroyTile(tx, ty);
        this._spawnParticles(px, py, ore ? ore.color : 0x8b5a2b);

        if (ore) {
          totalGold += ore.value;
          gameState.addOre(ore.id);
          // 광물 먹는 사운드 — 50% 볼륨 (기본 대비 절반)
          this.soundManager?.playOreByRarity(ore.rarity, { volume: 0.5 });
        }
      }
    }

    // mine_dirt 사운드 제거 — drill_loop와 광물 사운드만 나도록
    if (totalGold > 0) gameState.addGold(totalGold);
  }

  _spawnParticles(x, y, color = 0x8b5a2b) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const p = this.scene.add.rectangle(x, y, 8, 8, color);
      p.setStrokeStyle(1, 0x000000, 0.8);
      p.setDepth(60);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 30 + Math.random() * 36;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 14,
        alpha: 0,
        angle: 360 * (Math.random() < 0.5 ? -1 : 1),
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 320 + Math.random() * 180,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  _spawnBounceParticles(x, y, dirX) {
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.circle(
        x,
        y + (Math.random() - 0.5) * 20,
        4,
        0xffeb3b,
      );
      p.setStrokeStyle(1, 0xff6f00, 1);
      p.setDepth(60);
      const angle = -Math.PI / 4 + (i / 4) * (Math.PI / 2);
      const dist = 22 + Math.random() * 18;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist * dirX,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  _squashBounce() {
    // 너무 강한 squash는 큰 드릴이 출렁임 → 부드럽게.
    this.scene.tweens.killTweensOf(this.container);
    this.container.scaleX = 0.92;
    this.container.scaleY = 1.06;
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 150,
      ease: "Quad.easeOut",
    });
  }

  getTileY() {
    return Math.floor(this.y / this.tileSize);
  }

  // 현재 바이옴의 채굴 hardness — 깊은 바이옴일수록 1보다 커서 같은 드릴 파워로도 더 오래 걸림
  _currentBiomeHardness() {
    const bm = this.tileMap?.biomeManager;
    if (!bm) return 1.0;
    const km = bm.yToKm(this.y);
    const biome = bm.getBiomeAt(km);
    return biome?.hardness ?? 1.0;
  }

  // 폭탄 폭발로부터 드릴 넉백. ExplosionEffect에서 거리/반경 기반으로 호출.
  // 임펄스를 vx/vy에 더하고, 350ms 동안 mining 진입을 막아서 자유 비행 유지.
  applyKnockback(impulseX, impulseY) {
    this.vx += impulseX;
    this.vy += impulseY;
    this._knockbackUntil = this.scene.time.now + 350;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.15,
      scaleY: 0.88,
      duration: 90,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    // 부상 표정 — 현재 컨셉의 hurt 텍스처로 350ms, 자동 normal 복귀
    this.setHurt();
  }

  // 채팅 컨셉 변경 (wood/stone/iron/gold/diamond) — 3초 유지 후 rush 복귀
  // 같은 컨셉이 다시 들어오면 타이머만 리프레시.
  setConcept(concept) {
    const valid = ["rush", "wood", "stone", "iron", "gold", "diamond"];
    if (!valid.includes(concept)) return;
    if (this._concept === concept) {
      this._resetConceptTimer();
      return;
    }
    this._concept = concept;
    this._applyTexture();
    if (concept !== "rush") this._resetConceptTimer();
  }

  _resetConceptTimer() {
    if (this._conceptResetTimer) this._conceptResetTimer.remove();
    this._conceptResetTimer = this.scene.time.delayedCall(3000, () => {
      this._concept = "rush";
      this._applyTexture();
      this._conceptResetTimer = null;
    });
  }

  // 폭탄 부딪침 — 현재 컨셉의 hurt 텍스처로 350ms, 자동 normal 복귀
  setHurt() {
    this._state = "hurt";
    this._applyTexture();
    this.scene.time.delayedCall(350, () => {
      this._state = "normal";
      this._applyTexture();
    });
  }

  // 현재 concept + state에 맞는 텍스처 적용 + native 크기 정규화
  // 컨셉별 시각 보정: drill-rush(1024×1536)는 캔버스 꽉 참, drill_v3_*(1248×1248)는
  // 정사각이라 시각적으로 작고 origin도 다름. scaleMult/originY로 맞춤.
  // 미세조정: 아래 CONCEPT_VISUAL_TUNE 값만 수정하면 됨.
  _applyTexture() {
    const keys = {
      rush: { normal: "driller", hurt: "driller-cry" },
      wood: { normal: "drill-wood", hurt: "drill-wood-hurt" },
      stone: { normal: "drill-stone", hurt: "drill-stone-hurt" },
      iron: { normal: "drill-iron", hurt: "drill-iron-hurt" },
      gold: { normal: "drill-gold", hurt: "drill-gold-hurt" },
      diamond: { normal: "drill-diamond", hurt: "drill-diamond-hurt" },
    };
    // scaleMult: 시각적 크기 보정 (drill-rush 기준 1.0)
    // originY:   anchor 위치 (sprite 안에서 비트 끝 y 비율). 클수록 sprite가 anchor 위쪽으로 그려져 땅 위로 떠 보임.
    const CONCEPT_VISUAL_TUNE = {
      rush: { scaleMult: 1.0, originY: 0.69 },
      wood: { scaleMult: 1.2, originY: 0.82 },
      stone: { scaleMult: 1.1, originY: 0.9 },
      iron: { scaleMult: 1.2, originY: 0.83 },
      gold: { scaleMult: 1.16, originY: 0.85 },
      diamond: { scaleMult: 1.18, originY: 0.86 },
    };
    let key = keys[this._concept]?.[this._state];
    if (!key || !this.scene.textures.exists(key)) {
      key = keys[this._concept]?.normal;
    }
    if (!key || !this.scene.textures.exists(key)) {
      key = "driller";
    }
    const tune = CONCEPT_VISUAL_TUNE[this._concept] ?? CONCEPT_VISUAL_TUNE.rush;
    this.sprite.setTexture(key);
    this.sprite.setOrigin(0.5, tune.originY);
    this._recomputeBaseScale(key);
    const mult = (1.0 + (this.drillRange - 1) * 0.55) * tune.scaleMult;
    this.sprite.setScale(this._baseScale * mult);
  }

  _recomputeBaseScale(key) {
    const useKey = key ?? "driller";
    const srcImg = this.scene.textures.get(useKey)?.getSourceImage?.();
    const naturalW = (srcImg && srcImg.width) || 64;
    this._baseScale = this._targetWidth / naturalW;
  }

  // 현재 컨셉의 scaleMult — _applyTexture와 _tweenScaleForRange가 공유
  _currentConceptScaleMult() {
    const tunes = {
      rush: 1.0,
      wood: 1.5,
      stone: 1.5,
      iron: 1.5,
      gold: 1.5,
      diamond: 1.5,
    };
    return tunes[this._concept] ?? 1.0;
  }
}
