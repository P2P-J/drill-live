import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 드릴 텍스처 두 종 — 'driller'(평소, drill-rush.png) + 'driller-cry'(폭발 넉백 시).
    // 크기는 Driller가 setTexture 후 baseScale 재계산해서 동일 화면 크기로 정규화.
    this.load.image('driller', '/assets/drill-rush.png');
    this.load.image('driller-cry', '/assets/drill-cry.png');

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
