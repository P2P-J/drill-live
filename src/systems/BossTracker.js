import { BOSSES, BOSS_WARNING_STEPS } from '../config/bosses.js';
import { Boss } from '../objects/Boss.js';

// 깊이 추적 → 보스 예고 / 아레나 소환 / 처치·실패 후처리.
// 보스 등장 시 깨지지 않는 벽으로 둘러싸인 공간 생성 (ArenaSystem 활용).
export class BossTracker {
  constructor(scene, deps) {
    this.scene = scene;
    this.driller = deps.driller;
    this.tileMap = deps.tileMap;
    this.buffSystem = deps.buffSystem;
    this.arenaSystem = deps.arenaSystem;

    this.activeBoss = null;
    this._defeatedIds = new Set();
    this._warningsShown = new Set();
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

  update(depthM, delta) {
    // 활성 보스가 있으면 follow + damage 처리
    if (this.activeBoss) {
      if (this.activeBoss.alive) {
        this.activeBoss.update(delta, this.driller);
      }
      return;
    }

    // 미처치 보스 중 가장 가까운 것 찾아 경고
    const next = this._nextBoss(depthM);
    if (!next) return;

    const remaining = next.depthM - depthM;

    for (const step of BOSS_WARNING_STEPS) {
      const key = `${next.id}-${step.remainingM}`;
      if (remaining <= step.remainingM && !this._warningsShown.has(key)) {
        this._warningsShown.add(key);
        this._emit('warning', { boss: next, step, remaining });
      }
    }

    if (remaining <= 0) {
      this.spawn(next);
    }
  }

  _nextBoss(depthM) {
    return BOSSES.find(b => !this._defeatedIds.has(b.id));
  }

  spawn(def) {
    if (this.activeBoss) return;

    // 아레나 활성화 — 드릴 위치 기준으로 아래쪽에 닫힌 공간 생성
    this.arenaSystem.activate(this.driller.y, {
      heightTiles: 14,
      wallColor: 0x37474F,
      accent: 0xFFD700,
    });

    // 보스 위치 = 아레나 중앙 하단 (드릴은 위에서 튀어다님)
    const arena = this.arenaSystem.bounds;
    const bossX = arena.cx;
    const bossY = arena.bottom - 120;

    const boss = new Boss(this.scene, def, bossX, bossY, {
      tileMap: this.tileMap,
      driller: this.driller,
      arenaBounds: arena,
      onDefeated: (b) => this._onBossDefeated(b),
      onFailed: (b) => this._onBossFailed(b),
      onDamage: (amount, b) => this._emit('damage', { boss: b, amount }),
    });

    this.activeBoss = boss;
    this._emit('spawn', { boss });
  }

  _onBossDefeated(boss) {
    this._defeatedIds.add(boss.def.id);
    this.activeBoss = null;
    this.arenaSystem?.deactivate();
    this._emit('defeated', { boss });
  }

  _onBossFailed(boss) {
    this._defeatedIds.add(boss.def.id);
    this.activeBoss = null;
    this.arenaSystem?.deactivate();
    // 페널티 디버프 — 드릴 속도 감소 (BuffSystem이 디버프 채널도 처리)
    if (boss.def.failPenalty && this.buffSystem) {
      this.buffSystem.apply('penalty', {
        mult: boss.def.failPenalty.speedMult,
        label: `${boss.def.name} ESCAPED`,
        isDebuff: true,
      }, boss.def.failPenalty.durationMs);
    }
    this._emit('failed', { boss });
  }

  forceSpawnNext() {
    const next = BOSSES.find(b => !this._defeatedIds.has(b.id));
    if (next) this.spawn(next);
  }

  resetDefeated() {
    this._defeatedIds.clear();
    this._warningsShown.clear();
  }
}
