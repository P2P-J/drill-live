import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 기본(rush) — 채팅 컨셉 미지정 시 사용. normal/hurt 두 상태.
    this.load.image('driller',       '/assets/drill-rush.png');
    this.load.image('driller-cry',   '/assets/drill-cry.png');
    // 5개 컨셉 (wood/stone/iron/gold/diamond) × normal/hurt
    // Driller가 setTexture 후 baseScale 재계산해서 동일 화면 크기로 정규화하므로
    // 원본 PNG 크기가 달라도 OK.
    for (const c of ['wood', 'stone', 'iron', 'gold', 'diamond']) {
      this.load.image(`drill-${c}`,      `/assets/drill_v3_${c}_normal_final.png`);
      this.load.image(`drill-${c}-hurt`, `/assets/drill_v3_${c}_hurt_final.png`);
    }

    // 사운드는 manifest 기반으로 lazy load. /assets/audio/manifest.json에
    // 등록된 키만 시도해서 404 noise 방지. (없으면 procedural fallback).
    this.load.json('audioManifest', '/assets/audio/manifest.json');

    // 로드 실패는 조용히 무시 (procedural 폴백 동작)
    this.load.on('loaderror', () => {});
  }

  create() {
    const manifest = this.cache.json.get('audioManifest');
    if (manifest?.files && Array.isArray(manifest.files) && manifest.files.length > 0) {
      // manifest에 등록된 사운드 파일만 추가 로딩 후 GameScene 시작
      this.load.on('loaderror', () => {});
      for (const { key, file } of manifest.files) {
        if (key && file) this.load.audio(key, `/assets/audio/${file}`);
      }
      this.load.once('complete', () => this.scene.start('GameScene'));
      this.load.start();
      return;
    }
    this.scene.start('GameScene');
  }
}
