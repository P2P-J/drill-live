import { GAME } from '../config/game.js';
import { ensureWallTexture } from '../objects/TileArt.js';

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

    const topTileY = Math.floor(centerWorldY / T) + 1;
    const arenaTop = topTileY * T;
    const arenaBottom = arenaTop + heightTiles * T;

    const xOffset = this.tileMap.xOffset;
    const innerLeft = xOffset + (GAME.wallLeftX + 1) * T;
    const innerRight = xOffset + GAME.wallRightX * T;

    this.bounds = {
      left:   innerLeft + this.driller.tileSize * 0.46,
      right:  innerRight - this.driller.tileSize * 0.46,
      top:    arenaTop + T,                  // 위쪽 벽 1타일 두께 안쪽부터
      bottom: arenaBottom - T,               // 아래쪽 벽 1타일 두께 안쪽까지
      groundY: arenaBottom - T,              // 보스가 발을 딛는 floor
      cx: (innerLeft + innerRight) / 2,
      cyArena: (arenaTop + arenaBottom) / 2,
    };

    // 내부 타일 제거
    for (let dy = 0; dy < heightTiles; dy++) {
      for (let dx = GAME.wallLeftX + 1; dx < GAME.wallRightX; dx++) {
        this.tileMap.destroyTile(dx, topTileY + dy);
      }
    }

    // === 상/하 벽: 채굴 벽과 동일한 회색 벽 텍스처 사용 ===
    // wallVariant 4종 중 랜덤. 한 줄 = 채굴 채널 폭만큼 가로로 깔기.
    const tileCount = GAME.wallRightX - (GAME.wallLeftX + 1) + 1;  // 채굴 가능 영역 + 양쪽 1칸씩 = 11 보통

    for (let i = 0; i < tileCount; i++) {
      const variant = (i + topTileY) % 4;
      const wallKey = ensureWallTexture(this.scene, variant);
      const wallX = innerLeft + i * T + T / 2;
      // 위쪽 벽
      const topTile = this.scene.add.image(wallX, arenaTop + T / 2, wallKey);
      topTile.setDepth(40);
      this._walls.push(topTile);
      // 아래쪽 벽
      const variantB = (i + topTileY + heightTiles - 1) % 4;
      const bottomTile = this.scene.add.image(wallX, arenaBottom - T / 2, ensureWallTexture(this.scene, variantB));
      bottomTile.setDepth(40);
      this._walls.push(bottomTile);
    }

    // 등장 트윈 (위/아래에서 슬라이드 인)
    const topTiles = this._walls.filter((_, i) => i % 2 === 0);
    const bottomTiles = this._walls.filter((_, i) => i % 2 === 1);
    for (const t of topTiles) t.y -= 100;
    for (const t of bottomTiles) t.y += 100;
    this.scene.tweens.add({ targets: topTiles, y: '+= 100', duration: 400, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: bottomTiles, y: '-= 100', duration: 400, ease: 'Back.easeOut' });

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
