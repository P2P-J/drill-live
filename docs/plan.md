# Driller Live — Phase 1 구현 계획

> **목표:** PRD Phase 1 범위(오프라인 동작 가능한 무한 채굴 코어)를 처음부터 끝까지 완성한다.
> 후원/서버 연동(Phase 2~3)은 이 단계에서 다루지 않는다.

---

## 0. 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 게임 해상도 | **1080 × 1920 (9:16 세로)** — YouTube Shorts/모바일 친화 |
| 드릴 이동 | **수직 직진**. 좌우 이동 없음 |
| 드릴 폭 확장 | 후원으로 `drillRange` 단계 증가 → 한 번에 파는 가로 타일 수 ↑ (1 → 2 → 3) |
| MVP 범위 | Phase 1 (오프라인 채굴 게임)만 완성, 서버는 후속 |
| 화면 구성 | 위쪽 9:13 정도 = 게임 영역 / 아래 9:3 정도 = HUD/업그레이드 패널 |
| 단위 | PRD 그대로 `km` 표시 (내부 깊이는 px → km 변환) |
| 테스트 | 순수 로직(config 검증, 색상 보간, 광물 확률, 업그레이드 산식)은 **vitest** 단위 테스트. Phaser 시각 부분은 수동 검증 |
| 커밋 | 작은 단위로 자주. 메시지에 `Co-Authored-By` 라인 **금지** (CLAUDE.md 룰) |

---

## 1. 아키텍처

```
src/
├── main.js                      # Phaser 게임 부팅
├── config/
│   ├── game.js                  # 화면/타일 크기, 기본 속도
│   ├── biomes.js                # 6 바이옴 깊이 구간 + HEX 색상
│   ├── ores.js                  # 광물 12종 + 가치 + 등장 확률
│   └── upgrades.js              # 5대 업그레이드 비용/효과 단계
├── scenes/
│   ├── BootScene.js             # 에셋 로딩 (Phase 1은 도형만이라 거의 비어있음)
│   ├── GameScene.js             # 메인 채굴 씬
│   └── UIScene.js               # HUD 오버레이 (DOM 또는 Phaser Text)
├── objects/
│   ├── Driller.js               # 드릴 머신: 수직 자동 이동 + 드릴 폭
│   ├── TileMap.js               # 무한 타일맵: 청크 생성/제거
│   ├── OreLayer.js              # 광물 분포: 깊이별 확률
│   └── BiomeManager.js          # 깊이 → 바이옴 + 색상 블렌딩
└── systems/
    ├── GameState.js             # 골드/깊이/업그레이드 단계 (단일 진실의 원천)
    └── UpgradeSystem.js         # 업그레이드 적용 로직 + 비용 계산
tests/
├── biomes.test.js
├── ores.test.js
├── biomeManager.test.js
├── upgradeSystem.test.js
└── gameState.test.js
docs/
└── plan.md (이 파일)
vite.config.js
index.html
```

### 좌표/단위 변환 규칙
- 게임 내부 좌표 단위는 px. Driller가 1초에 `n` px 하강.
- **표시용 km = depthPx / pxPerKm**. 기본값 `pxPerKm = 64` (1 km = 1 타일 = 64 px). 후에 밸런스 조정 가능.
- Earth 9,500 km = 9500 × 64 = 608,000 px. 무한맵이므로 절대 좌표는 큰 수가 정상.

### 타일맵 청크 전략
- 한 청크 = `16 가로 × 32 세로` 타일.
- 항상 드릴 현재 청크 ±2 청크만 메모리 유지. 그 외 destroy.
- 청크 생성 시 해당 청크의 시작 깊이를 기준으로 `BiomeManager` + `OreLayer`로 타일 종류 결정.

### 무한 채굴 루프 (라이브 게임 적용)
- 지상 귀환/연료/인벤토리 칸 **없음**.
- 채굴 즉시 골드 자동 환금 (광물 1개 = 가치만큼 골드 누적).
- 업그레이드는 GameScene UI의 버튼(스트리머 클릭). Phase 3에서 슈퍼챗과도 연동 예정.

---

## 2. 단계별 작업

각 Task는 **2~5분짜리 step** 단위로 쪼개져 있고, 매 Task 끝에 commit. TDD가 자연스러운 곳은 테스트 먼저.

---

### Task 0: 프로젝트 부트스트랩

**파일:**
- 생성: `vite.config.js`, `index.html`, `src/main.js`, `.gitignore`
- 수정: `package.json` (scripts 추가)

- [ ] **Step 0-1**: `git init` 후 `.gitignore`에 `node_modules`, `dist`, `.DS_Store` 추가
- [ ] **Step 0-2**: `package.json`에 `"type": "module"`, scripts `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`, `"test": "vitest run"` 추가, vitest devDep 설치 (`npm install -D vitest`)
- [ ] **Step 0-3**: `vite.config.js` 작성 — root는 프로젝트 루트, `server.port: 3000`
- [ ] **Step 0-4**: `index.html` — `<div id="game">` + 모듈 `<script src="/src/main.js">`. body 배경 검정. canvas 9:16 fit.
- [ ] **Step 0-5**: `src/main.js` — Phaser game config (width 1080, height 1920, scale FIT, backgroundColor #000). 빈 `BootScene` + `GameScene` 등록만.
- [ ] **Step 0-6**: `src/scenes/BootScene.js` — `create()`에서 즉시 `this.scene.start('GameScene')`
- [ ] **Step 0-7**: `src/scenes/GameScene.js` — `create()`에서 "Driller Live" 텍스트만 중앙 표시
- [ ] **Step 0-8**: `npm run dev` → http://localhost:3000 에서 텍스트가 9:16 화면에 보이는지 확인
- [ ] **Step 0-9**: commit — `chore: bootstrap vite + phaser empty scene`

---

### Task 1: 게임 상수 + 광물 데이터

**파일:**
- 생성: `src/config/game.js`, `src/config/ores.js`
- 테스트: `tests/ores.test.js`

- [ ] **Step 1-1**: `src/config/game.js` 작성
  ```js
  export const GAME = {
    width: 1080,
    height: 1920,
    tileSize: 64,         // 1 타일 = 64 px
    pxPerKm: 64,          // 1 km = 1 타일 (현재 밸런스)
    gameAreaHeight: 1400, // 위쪽 게임 영역 (HUD는 1400~1920)
    chunkTilesX: 16,      // 한 청크 가로 16타일
    chunkTilesY: 32,      // 한 청크 세로 32타일
    mapTilesX: 14,        // 화면 가로에 보이는 타일 수 = 14 (1080/64 ≈ 16.8 → 안전한 14)
    baseDrillSpeed: 60,   // 초당 60px 하강 = 0.94 km/s
  };
  ```
- [ ] **Step 1-2**: `src/config/ores.js` 작성. 12종 광물을 PRD 3-4 그대로:
  ```js
  export const ORES = {
    coal:       { name: 'Coal',        value: 5,     color: 0x1a1a1a, rarity: 'common' },
    copper:     { name: 'Copper',      value: 12,    color: 0xb87333, rarity: 'common' },
    iron:       { name: 'Iron',        value: 25,    color: 0x9e9e9e, rarity: 'common' },
    gold:       { name: 'Gold',        value: 60,    color: 0xffd700, rarity: 'uncommon' },
    crystal:    { name: 'Crystal',     value: 100,   color: 0xb39ddb, rarity: 'uncommon' },
    amethyst:   { name: 'Amethyst',    value: 200,   color: 0x9c27b0, rarity: 'rare' },
    sapphire:   { name: 'Sapphire',    value: 400,   color: 0x2196f3, rarity: 'rare' },
    emerald:    { name: 'Emerald',     value: 800,   color: 0x4caf50, rarity: 'epic' },
    diamond:    { name: 'Diamond',     value: 2000,  color: 0xb9f6ca, rarity: 'epic' },
    ruby:       { name: 'Ruby',        value: 2500,  color: 0xe53935, rarity: 'epic' },
    lavaCrystal:{ name: 'Lava Crystal',value: 5000,  color: 0xff5722, rarity: 'legendary' },
    voidStone:  { name: 'Void Stone',  value: 10000, color: 0xede7f6, rarity: 'legendary' },
  };
  ```
- [ ] **Step 1-3**: `tests/ores.test.js` — 모든 광물에 `name/value/color/rarity` 존재 + `value > 0` 검증
- [ ] **Step 1-4**: `npm test` → green
- [ ] **Step 1-5**: commit — `feat(config): add game constants and ore catalog`

---

### Task 2: 바이옴 데이터 + BiomeManager

**파일:**
- 생성: `src/config/biomes.js`, `src/objects/BiomeManager.js`
- 테스트: `tests/biomes.test.js`, `tests/biomeManager.test.js`

PRD 3-2 표를 그대로 데이터화. 각 바이옴 = `{ id, name, startKm, endKm, layers: [...] }`.
각 레이어 = `{ name, startKm, endKm, color, oreProbabilities }`.

- [ ] **Step 2-1**: `src/config/biomes.js` 작성 — Earth/Crystal/Abyssal/Forest/Magma/Void 6개. 각 바이옴의 레이어 1-1~6-3 모두 PRD 3-2 그대로. `oreProbabilities`는 `{ coal: 0.4, copper: 0.2, ... }` 합 = 1 미만(나머지는 빈 타일).
  - 광물 분포 원칙 (Phase 1 초기 밸런스):
    - 표토층: coal 0.15, copper 0.05 (나머지 0.8 = 흙)
    - 점토층: coal 0.12, copper 0.10, iron 0.03
    - 자갈층: copper 0.10, iron 0.10
    - 연암~심층: iron 0.10, gold 0.05~0.10
    - Crystal Cave: crystal 0.15 ~ amethyst 0.10
    - Abyssal: sapphire 0.15
    - Forest: emerald 0.15
    - Magma: diamond/ruby/lavaCrystal 0.10~0.20
    - Void: 모든 광물 균등 + voidStone 0.05
- [ ] **Step 2-2**: `tests/biomes.test.js` — 바이옴 6개 존재, 깊이 구간 연속(이전 endKm = 다음 startKm), oreProb 합 < 1
- [ ] **Step 2-3**: `tests/biomeManager.test.js` 작성 (RED)
  ```js
  import { BiomeManager } from '../src/objects/BiomeManager.js';
  test('returns Earth biome at 0km', () => { expect(new BiomeManager().getBiomeAt(0).id).toBe('earth') });
  test('returns Crystal at 25000km', () => { expect(new BiomeManager().getBiomeAt(25000).id).toBe('crystal') });
  test('returns Void at 1500000km', () => { expect(new BiomeManager().getBiomeAt(1500000).id).toBe('void') });
  test('returns layer 1-2 at 1000km', () => { expect(new BiomeManager().getLayerAt(1000).name).toMatch(/점토/) });
  test('color at exact layer start equals layer color', () => { /* exact match */ });
  test('color in 9500~9999km is interpolated toward Crystal color', () => { /* RGB interpolation check */ });
  ```
- [ ] **Step 2-4**: `src/objects/BiomeManager.js` 구현
  - `getBiomeAt(km)` — biomes 배열 선형 검색 (6개라 O(n) OK)
  - `getLayerAt(km)` — 해당 바이옴의 layers 검색
  - `getColorAt(km)` — 현재 레이어 색상. 단 레이어 마지막 `transition` 구간이면 다음 레이어/바이옴 색상과 RGB 보간
  - Void(1,000,000km~)는 무한 반복: `(km - 1000000) % cycleLength`로 1~5 바이옴 색상 사이클
- [ ] **Step 2-5**: `npm test` → green
- [ ] **Step 2-6**: commit — `feat(biome): add 6 biomes data + BiomeManager with color blending`

---

### Task 3: GameState (전역 상태)

**파일:**
- 생성: `src/systems/GameState.js`
- 테스트: `tests/gameState.test.js`

스트리머 + 후원 트리거 + UI가 다 같은 상태를 본다. 간단한 pub/sub.

- [ ] **Step 3-1**: `tests/gameState.test.js` (RED)
  ```js
  test('starts with 0 gold and 0 depth', () => { const s = new GameState(); expect(s.gold).toBe(0); expect(s.depthKm).toBe(0); });
  test('addGold emits change event', () => { ... });
  test('setDepth updates and emits', () => { ... });
  test('upgrades start at level 1', () => { expect(s.upgrades.drillPower).toBe(1); });
  ```
- [ ] **Step 3-2**: `src/systems/GameState.js` 구현
  - `gold`, `depthKm`, `upgrades: { drillPower, drillRange, fuelTank, cargo, engine }` (각 1로 시작)
  - `on(event, fn)`, `emit(event, payload)`, `addGold(n)`, `setDepth(km)`, `setUpgrade(name, level)`
  - 단일 인스턴스로 export: `export const gameState = new GameState();`
- [ ] **Step 3-3**: `npm test` → green
- [ ] **Step 3-4**: commit — `feat(state): add GameState pub/sub`

---

### Task 4: TileMap 무한 생성

**파일:**
- 생성: `src/objects/TileMap.js`
- 수정: `src/scenes/GameScene.js`

청크 단위 생성/파괴. 우선은 광물 없이 흙/돌만.

- [ ] **Step 4-1**: `src/objects/TileMap.js` 스켈레톤
  - 클래스 `TileMap(scene, biomeManager)`
  - `tiles: Map<"cx,cy", Chunk>` 청크 캐시
  - `update(drillerY)` — 드릴 y에 따라 필요 청크 생성, 멀어진 청크 destroy
  - `getTileAt(tileX, tileY)` — 현재 타일 객체 반환
  - `destroyTile(tileX, tileY)` — 채굴 시 호출, 광물이면 골드 반환
- [ ] **Step 4-2**: 청크 생성 로직
  - 한 청크는 `Phaser.GameObjects.Container` + `chunkTilesX × chunkTilesY` 개 `Rectangle`
  - 각 타일 색은 `biomeManager.getColorAt(km)` (해당 타일의 y → km 변환)
  - 화면 가로 14타일만 채굴 가능 영역. 좌우 끝 1타일씩은 "벽" (회색, 채굴 불가)
- [ ] **Step 4-3**: `GameScene.create()`에서 `this.tileMap = new TileMap(this, this.biomeManager)` + 초기 청크 생성
- [ ] **Step 4-4**: `npm run dev` → 화면에 흙 타일 격자가 보이는지 수동 확인
- [ ] **Step 4-5**: commit — `feat(tilemap): infinite chunk-based tile generation`

---

### Task 5: Driller 객체 + 수직 자동 이동

**파일:**
- 생성: `src/objects/Driller.js`
- 수정: `src/scenes/GameScene.js`

- [ ] **Step 5-1**: `src/objects/Driller.js`
  - 클래스 `Driller(scene, x, startY)`
  - 외형: 우선 `Rectangle` (64×64, 노란색 #FFC107). 위쪽에 작은 검정 도형으로 헬멧 흉내. 아래에 드릴 비트 흉내 삼각형.
  - `update(delta)` — y 좌표를 `speed * delta / 1000` 만큼 증가시킴. 단 아래 타일이 있으면 채굴 트리거 (Task 6)
  - `speed = GAME.baseDrillSpeed * upgrades.drillPower` (Task 8에서 연결)
  - `drillWidth = upgrades.drillRange` (1=1타일, 2=좌우 1씩 = 3타일, 3=좌우 2씩 = 5타일)
- [ ] **Step 5-2**: `GameScene.create()`에 driller 추가. 화면 가로 중앙 x = 7타일째 (448px).
- [ ] **Step 5-3**: `GameScene.update(time, delta)` — `driller.update(delta)`, `tileMap.update(driller.y)`, `gameState.setDepth(driller.y / GAME.pxPerKm)`
- [ ] **Step 5-4**: 카메라 follow — `this.cameras.main.startFollow(driller, true, 0.1, 0.1)`. y만 추적, x는 고정.
- [ ] **Step 5-5**: `npm run dev` → 드릴이 아래로 천천히 움직이고 카메라 따라가는지 확인
- [ ] **Step 5-6**: commit — `feat(driller): vertical auto-move with camera follow`

---

### Task 6: 채굴 로직 (타일 파괴)

**파일:**
- 수정: `src/objects/Driller.js`, `src/objects/TileMap.js`

수직 직진이라 드릴 아래 타일이 항상 파괴 대상. `drillRange`에 따라 좌우 타일도 동시에.

- [ ] **Step 6-1**: `TileMap.destroyTile(tileX, tileY)` 구현 — 해당 타일 비주얼 제거 + `removed` 상태 마킹. 광물이면 `{ ore: '...', value: N }` 반환, 아니면 null.
- [ ] **Step 6-2**: `Driller`에서 채굴 누적 시간 `mineProgress`. 한 타일당 `1 / drillPower` 초 누적되면 그 타일 + drillRange 좌우 타일 destroy.
  - 채굴 도중에는 y 이동 멈춤, 타일 파괴 직후 y는 정확히 다음 타일 윗변으로 스냅.
- [ ] **Step 6-3**: 타일 파괴 시 작은 파티클 (Phaser `add.particles` 또는 짧게 깜빡이는 도형) — 우선 간단히 흰색 작은 사각형 3개를 0.2초 동안 튀게.
- [ ] **Step 6-4**: 드릴 파괴 결과 광물이면 `gameState.addGold(value)`
- [ ] **Step 6-5**: `npm run dev` → 드릴이 한 타일씩 파먹으며 내려가는지, drillRange가 작동하는지 (Task 8 후 변경 가능하지만 우선 하드코딩 1로 확인)
- [ ] **Step 6-6**: commit — `feat(driller): tile destruction + mining progress`

---

### Task 7: 광물 분포 (OreLayer)

**파일:**
- 생성: `src/objects/OreLayer.js`
- 수정: `src/objects/TileMap.js`
- 테스트: `tests/oreLayer.test.js`

- [ ] **Step 7-1**: `tests/oreLayer.test.js` (RED)
  ```js
  test('returns null for empty roll', () => { const o = new OreLayer(biomeManager); /* mock random */ expect(o.rollOreAt(0, /*rand=*/0.99)).toBeNull(); });
  test('returns coal at Earth layer 1-1 for low roll', () => { expect(o.rollOreAt(100, 0.05).id).toBe('coal') });
  test('returns crystal at Crystal Cave', () => { expect(o.rollOreAt(15000, 0.05).id).toMatch(/crystal|amethyst/) });
  ```
- [ ] **Step 7-2**: `src/objects/OreLayer.js` 구현
  - `rollOreAt(km, rand = Math.random())` — 현재 레이어의 `oreProbabilities` 순회하며 누적 확률로 광물 결정. 합 미만이면 null(흙).
- [ ] **Step 7-3**: `TileMap` 청크 생성 시 각 타일에 대해 `oreLayer.rollOreAt(km)` 호출. 광물 타일은 `ORES[id].color`로 색칠 + 작은 보석 모양 오버레이.
- [ ] **Step 7-4**: 테스트 green
- [ ] **Step 7-5**: `npm run dev` → 깊이 따라 다양한 광물이 나오고, 드릴이 파면서 골드가 누적되는지 확인 (콘솔에서 `gameState.gold` 출력)
- [ ] **Step 7-6**: commit — `feat(ore): depth-based ore distribution`

---

### Task 8: UpgradeSystem

**파일:**
- 생성: `src/config/upgrades.js`, `src/systems/UpgradeSystem.js`
- 테스트: `tests/upgradeSystem.test.js`

PRD 3-5:

| 장비 | 효과 | 최대 단계 |
|---|---|---|
| Drill Power | 채굴 속도 ×1, ×1.3, ×1.7, ×2.2, ×3.0 | 5 |
| Drill Range | 한 번에 파는 가로 폭 1 → 3 → 5 | 3 |
| Fuel Tank | (Phase 1에선 비활성, 슬롯만) | 5 |
| Cargo | (Phase 1에선 비활성, 슬롯만) | 5 |
| Engine | 추가 하강 속도 +0%, +20%, +50% | 3 |

> Phase 1에서는 연료/카고 의미 없음. 후속 Phase에서 의미 부여. 우선 UI 슬롯은 잡되 효과는 noop.

- [ ] **Step 8-1**: `src/config/upgrades.js`
  ```js
  export const UPGRADES = {
    drillPower: { name:'Drill Power', maxLevel:5,
      effectMultiplier:[1, 1.3, 1.7, 2.2, 3.0],
      cost:[0, 100, 400, 1500, 6000] },
    drillRange: { name:'Drill Range', maxLevel:3,
      effectTiles:[1, 3, 5],
      cost:[0, 500, 5000] },
    engine:     { name:'Engine',      maxLevel:3,
      effectMultiplier:[1.0, 1.2, 1.5],
      cost:[0, 200, 2000] },
    fuelTank:   { name:'Fuel Tank',   maxLevel:5, cost:[0,100,300,1000,3000] },
    cargo:      { name:'Cargo',       maxLevel:5, cost:[0,100,300,1000,3000] },
  };
  ```
- [ ] **Step 8-2**: `tests/upgradeSystem.test.js`
  - `canBuy(name)` — 골드 ≥ 다음 단계 비용 && 현재 < max
  - `buy(name)` — 골드 차감, 단계 +1, 이벤트 발행
  - `getDrillSpeed()` — `baseDrillSpeed × drillPower.effect × engine.effect`
- [ ] **Step 8-3**: `src/systems/UpgradeSystem.js` 구현. `gameState`를 주입받아 골드/upgrades 변경.
- [ ] **Step 8-4**: `Driller`가 매 프레임 `upgradeSystem.getDrillSpeed()` 참조, `drillRange`도 참조
- [ ] **Step 8-5**: 테스트 green
- [ ] **Step 8-6**: commit — `feat(upgrade): 5-slot upgrade system with effects`

---

### Task 9: UIScene + HUD + 업그레이드 버튼

**파일:**
- 수정: `src/scenes/UIScene.js`, `src/main.js`

PRD 화면 도식 + 9:16 세로 적용. 게임 영역 위 1080×1400, HUD 아래 1080×520.

- [ ] **Step 9-1**: `src/main.js`에 `UIScene` 등록 (overlay scene으로 GameScene과 병행)
- [ ] **Step 9-2**: `UIScene.create()` — 카메라 고정. 다음을 텍스트/사각형으로 그림:
  - 상단(y=20): `Depth: 1,234.5 km`, 우측 `Gold: 12,345`
  - 상단 좌측 작게: `Biome: 🌍 Earth - Layer 1-2`
  - 하단(y=1420 이하 520px 영역):
    - 가로로 5개 업그레이드 버튼 (Drill Power / Drill Range / Engine / Fuel Tank / Cargo)
    - 각 버튼: 이름, 현재 단계, 다음 단계 비용. 클릭 시 `upgradeSystem.buy(name)`. 못 사면 회색.
- [ ] **Step 9-3**: `gameState.on('change', ...)` 구독해 UI 라이브 갱신
- [ ] **Step 9-4**: `npm run dev` → 깊이가 올라가고 골드가 쌓이며 업그레이드 버튼이 활성화/비활성화 작동하는지 확인
- [ ] **Step 9-5**: commit — `feat(ui): HUD + upgrade panel`

---

### Task 10: BiomeManager 시각 통합 + 배경 색상

**파일:**
- 수정: `src/objects/TileMap.js`, `src/scenes/GameScene.js`

청크 타일은 이미 색상 적용했지만 배경(드릴 양옆 벽 너머)도 깊이에 따라 색상 변화 필요.

- [ ] **Step 10-1**: `GameScene`에 배경 `Rectangle` (화면 전체) — 매 프레임 `biomeManager.getColorAt(driller.km).darken(0.5)`로 갱신
- [ ] **Step 10-2**: 좌우 "벽" 타일도 동일 로직으로 색상 갱신 (혹은 살짝 어둡게)
- [ ] **Step 10-3**: 바이옴 전환 구간(예: Earth 9500~9999km)에서 색상이 부드럽게 보라색으로 블렌딩되는지 수동 확인 — 개발 시간 단축 위해 임시로 `pxPerKm = 0.5` 등으로 줄여 빠르게 깊이 도달 가능하게 함. 확인 후 원상복구.
- [ ] **Step 10-4**: commit — `feat(biome): scene background + tile blending`

---

### Task 11: 통합 정리 + 개발용 디버그 키

**파일:**
- 수정: `src/scenes/GameScene.js`

- [ ] **Step 11-1**: 개발 편의 키 (Phase 1에서만 유지, 나중에 제거)
  - `G` 키 → 골드 +10,000 (업그레이드 테스트용)
  - `D` 키 → 깊이 +1,000 km 점프 (바이옴 전환 빠르게 확인)
  - `B` 키 → 드릴 폭 임시 토글 (직접 buy 우회)
- [ ] **Step 11-2**: README 업데이트는 생략. 작동 방법은 plan.md에 기록되어 있음.
- [ ] **Step 11-3**: commit — `chore: add dev hotkeys for testing`

---

### Task 12: Phase 1 통합 검증

- [ ] **Step 12-1**: `npm run dev`로 1분간 플레이. 다음 항목 체크:
  - [ ] 드릴이 끊김 없이 하강하며 광물을 캠
  - [ ] 골드가 누적되고 HUD에 즉시 반영
  - [ ] 업그레이드 버튼 클릭 시 즉시 효과 (드릴 속도/범위 변화 체감)
  - [ ] 깊이 1,000+ km 도달 시 색상 변화 확인
  - [ ] `D` 키로 9,500 km 점프 → Earth → Crystal 바이옴 전환 색상 블렌딩 확인
- [ ] **Step 12-2**: `npm run build` → `npm run preview` → 빌드 결과도 동일 동작 확인
- [ ] **Step 12-3**: OBS Studio에서 브라우저 소스로 `http://localhost:4173` 추가 → 캡처되는지 확인 (OBS는 사용자 환경에서 직접)
- [ ] **Step 12-4**: 모든 vitest 통과 (`npm test`)
- [ ] **Step 12-5**: commit — `feat: phase 1 mvp complete`

---

## 3. Phase 1에서 의도적으로 빠진 것

| 제외 항목 | 이유 |
|---|---|
| 보스 시스템 | Phase 2 |
| WebSocket / 후원 트리거 | Phase 3 |
| youtube-chat 연동 | Phase 3 |
| 사운드 / BGM | 후속 (자체 제작 또는 라이선스 음원 필요) |
| 스프라이트 그래픽 | 도형 프리미티브로 진행, 후속 단계에서 일러스트로 교체 |
| 인벤토리 화면 | 라이브 게임 컨셉상 불필요 |
| 연료 게이지 | 라이브 게임 컨셉상 비활성 (UI 슬롯만 자리) |
| 좌우 드릴 이동 | 보류 (사용자 결정) |

## 4. Phase 1 완료 후 자연스러운 다음 작업

1. **드릴 외형 업그레이드 시각화** — drillPower/drillRange 단계에 따라 머신 외형 변화
2. **드릴 자동 좌우 우회** (보류 옵션) — 시야 내 광물 자동 추적 로직 추가
3. **Phase 2: 보스 시스템** — `BossTracker`, `Boss.js`, 보스 등장 연출
4. **Phase 3: WebSocket 서버 + 트리거** — `server/`, `EventBus.js`, `TriggerQueue.js`
5. **그래픽 에셋 교체** — Phaser 도형 → 카툰 벡터 PNG/SVG

---

## 5. 리스크 / 주의

- **무한 좌표 정밀도**: y가 수십~수백만 px이 되면 부동소수점 정밀도가 떨어질 수 있음. 100만 km(64M px)에서 문제가 생기면 카메라 기준 상대 좌표로 리포지셔닝 필요. Phase 1에서는 큰 문제 없을 것이지만, 디버깅 시 확인.
- **청크 누수**: `Map`에서 destroy한 청크의 key 제거 누락하면 메모리 누수. Task 4 구현 시 주의.
- **드릴이 광물 위에 정확히 스냅 안 되면** 미세한 타일 잔여가 보일 수 있음. y 스냅 로직(Task 6-2)을 정확히.
