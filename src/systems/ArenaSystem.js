import { GAME } from '../config/game.js';

const T = GAME.tileSize;

// 보스 만남 시 깨지지 않는 벽으로 둘러싸인 아레나 생성.
// 드릴은 그 안에서 핀볼처럼 튕기며, 보스도 그 안에서 함께 싸움.
// 정해진 시간 안에 못 잡으면 아레나 해제 + 페널티.
export class ArenaSystem {
  constructor(scene, tileMap, driller) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.driller = driller;
    this.active = false;
    this.bounds = null;
    this._walls = [];
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

  activate(centerWorldY, opts = {}) {
    if (this.active) return;

    const heightTiles = opts.heightTiles ?? 14;
    const wallColor = opts.wallColor ?? 0x37474F;
    const accent = opts.accent ?? 0xFFD700;

    // 드릴 위치 바로 아래에서 아레나 시작
    const topTileY = Math.floor(centerWorldY / T) + 1;
    const arenaTop = topTileY * T;
    const arenaBottom = arenaTop + heightTiles * T;

    const xOffset = this.tileMap.xOffset;
    // 채굴 가능 영역 (좌측 벽 안 ~ 우측 벽 안)
    const innerLeft = xOffset + (GAME.wallLeftX + 1) * T;
    const innerRight = xOffset + GAME.wallRightX * T;

    this.bounds = {
      left:   innerLeft + this.driller.tileSize * 0.46,
      right:  innerRight - this.driller.tileSize * 0.46,
      top:    arenaTop + 30,
      bottom: arenaBottom - 30,
      cx: (innerLeft + innerRight) / 2,
      cyArena: (arenaTop + arenaBottom) / 2,
    };

    // 아레나 내부 타일 모두 제거 (싸움할 공간 확보)
    for (let dy = 0; dy < heightTiles; dy++) {
      for (let dx = GAME.wallLeftX + 1; dx < GAME.wallRightX; dx++) {
        this.tileMap.destroyTile(dx, topTileY + dy);
      }
    }

    // 상/하 벽 (깨지지 않는 시각 표시 — 채굴 영역 막음)
    const wallSpanW = innerRight - innerLeft;
    const wallH = 30;

    const topBar = this.scene.add.rectangle(innerLeft, arenaTop, wallSpanW, wallH, wallColor);
    topBar.setOrigin(0, 0).setDepth(40).setStrokeStyle(3, 0x000000);
    const topGlow = this.scene.add.rectangle(innerLeft, arenaTop + wallH - 4, wallSpanW, 4, accent);
    topGlow.setOrigin(0, 0).setDepth(41);

    const bottomBar = this.scene.add.rectangle(innerLeft, arenaBottom - wallH, wallSpanW, wallH, wallColor);
    bottomBar.setOrigin(0, 0).setDepth(40).setStrokeStyle(3, 0x000000);
    const bottomGlow = this.scene.add.rectangle(innerLeft, arenaBottom - wallH, wallSpanW, 4, accent);
    bottomGlow.setOrigin(0, 0).setDepth(41);

    // 벽 위에 룬 표시 (작은 점들)
    const rune1 = this.scene.add.text(innerLeft + wallSpanW / 2, arenaTop + 12, '◆ BOSS BATTLE ◆', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '16px',
      color: '#FFEB3B',
    }).setOrigin(0.5, 0).setDepth(42);
    const rune2 = this.scene.add.text(innerLeft + wallSpanW / 2, arenaBottom - 22, '◆ BOSS BATTLE ◆', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '16px',
      color: '#FFEB3B',
    }).setOrigin(0.5, 0).setDepth(42);

    this._walls = [topBar, topGlow, bottomBar, bottomGlow, rune1, rune2];

    // 등장 트윈 (벽이 위/아래에서 슬라이드 인)
    topBar.y -= 100; topGlow.y -= 100; rune1.y -= 100;
    bottomBar.y += 100; bottomGlow.y += 100; rune2.y += 100;
    this.scene.tweens.add({
      targets: [topBar, topGlow, rune1],
      y: '+= 100',
      duration: 400,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: [bottomBar, bottomGlow, rune2],
      y: '-= 100',
      duration: 400,
      ease: 'Back.easeOut',
    });

    this.active = true;
    this.driller.enterArena(this.bounds);
    this._emit('activate', { bounds: this.bounds });
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    // 벽 페이드 아웃
    for (const w of this._walls) {
      this.scene.tweens.add({
        targets: w,
        alpha: 0,
        duration: 400,
        onComplete: () => w.destroy(),
      });
    }
    this._walls = [];
    this.driller.exitArena();
    this._emit('deactivate', {});
  }
}
