import { BOSSES, BOSS_WARNING_STEPS } from '../config/bosses.js';
import { Boss } from '../objects/Boss.js';

// 깊이 추적 → 보스 등장 예고 / 소환 / 처치·실패 후처리
export class BossTracker {
  constructor(scene, deps) {
    this.scene = scene;
    this.driller = deps.driller;
    this.tileMap = deps.tileMap;
    this.buffSystem = deps.buffSystem;

    this.activeBoss = null;
    this._defeatedIds = new Set();
    this._warningsShown = new Set();  // 보스별로 발동한 경고 단계
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (set) for (const fn of set) fn(payload);
  }

  // 매 프레임 호출
  update(depthM) {
    if (this.activeBoss) return;  // 보스 활성 중에는 새 보스 안 봄

    const next = this._nextBoss(depthM);
    if (!next) return;

    const remaining = next.depthM - depthM;

    // 단계별 경고
    for (const step of BOSS_WARNING_STEPS) {
      const key = `${next.id}-${step.remainingM}`;
      if (remaining <= step.remainingM && !this._warningsShown.has(key)) {
        this._warningsShown.add(key);
        this._emit('warning', { boss: next, step, remaining });
      }
    }

    // 도달 → 소환
    if (remaining <= 0) {
      this.spawn(next);
    }
  }

  _nextBoss(depthM) {
    return BOSSES.find(b => !this._defeatedIds.has(b.id) && b.depthM > depthM - 200) ??
           BOSSES.find(b => !this._defeatedIds.has(b.id));
  }

  spawn(def) {
    if (this.activeBoss) return;

    // 드릴 아래쪽에 빈 공간(아레나) 만들기 — 6타일 폭 × 8타일 깊이
    const T = 64;
    const drillTileX = Math.floor((this.driller.worldX - this.tileMap.xOffset) / T);
    const arenaTopTileY = Math.floor((this.driller.y + T) / T);
    const halfW = 3;
    for (let dy = 0; dy <= 8; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        this.tileMap.destroyTile(drillTileX + dx, arenaTopTileY + dy);
      }
    }

    // 보스를 아레나 중앙에 배치
    const bossX = this.tileMap.xOffset + drillTileX * T + T / 2;
    const bossY = (arenaTopTileY + 4) * T;

    const boss = new Boss(this.scene, def, bossX, bossY, {
      tileMap: this.tileMap,
      onDefeated: (b) => this._onBossDefeated(b),
      onFailed: (b) => this._onBossFailed(b),
    });

    this.activeBoss = boss;
    this._emit('spawn', { boss });
  }

  _onBossDefeated(boss) {
    this._defeatedIds.add(boss.def.id);
    this.activeBoss = null;
    this._emit('defeated', { boss });
  }

  _onBossFailed(boss) {
    this._defeatedIds.add(boss.def.id);
    this.activeBoss = null;
    // 페널티 — 드릴 속도 일시 감소
    if (boss.def.failPenalty && this.buffSystem) {
      this.buffSystem.apply('drillPowerUp', {
        mult: boss.def.failPenalty.speedMult,
        label: 'PENALTY',
      }, boss.def.failPenalty.durationMs);
    }
    this._emit('failed', { boss });
  }

  // 디버그 — 다음 보스 강제 소환
  forceSpawnNext() {
    const next = BOSSES.find(b => !this._defeatedIds.has(b.id));
    if (next) this.spawn(next);
  }

  // 디버그 — 처치 기록 리셋
  resetDefeated() {
    this._defeatedIds.clear();
    this._warningsShown.clear();
  }
}
