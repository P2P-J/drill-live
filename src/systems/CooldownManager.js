// 채팅 트리거 전체 채널 쿨다운 관리.
// PRD 5-1: 채팅 트리거는 전체 채널 쿨다운, 효과 지속 중 동일 커맨드 무시.

export class CooldownManager {
  constructor(scene) {
    this.scene = scene;
    this.cooldowns = new Map();   // id -> readyAt timestamp (ms)
  }

  // 발동 시도. 가능하면 true 반환 + 쿨다운 등록. 불가하면 false.
  tryFire(id, cooldownMs) {
    const now = this.scene.time.now;
    const readyAt = this.cooldowns.get(id) ?? 0;
    if (now < readyAt) return false;
    this.cooldowns.set(id, now + cooldownMs);
    return true;
  }

  remainingMs(id) {
    const now = this.scene.time.now;
    const readyAt = this.cooldowns.get(id) ?? 0;
    return Math.max(0, readyAt - now);
  }

  isReady(id) {
    return this.remainingMs(id) <= 0;
  }
}
