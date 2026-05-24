# 구현 결정 (spec 대비 차이점)

`docs/spec.md`를 기준으로 했을 때, 현 구현에서 의도적으로 다르게 가져간 결정들을 정리한다.
모든 결정은 "YouTube Live + Shorts 자동 진행 굴착 게임"이라는 운영 컨셉에 맞게 내린 것.

---

## 1. 화면 비율 — **9:16 세로 (1080×1920)**

- spec: 명시되어 있지 않음.
- 결정: 1080×1920 portrait. 게임 영역 상단 1080×1400, 하단 1080×520은 UIScene.
- 이유: YouTube Shorts/Live 모바일 시청자 비율이 9:16일 때 화면을 가득 채울 수 있고, 좌우로 채굴 채널 13타일이 자연스럽게 들어맞음.
- 영향: PC에서 시청하면 좌우에 검은 영역이 생기지만, 라이브 환경 자체가 모바일 우선이라 수용.

## 2. 타일 크기 — **64px**

- spec: 명시되어 있지 않음.
- 결정: 1타일 = 64px = 1m (게임 내 미터 단위와 1:1).
- 이유:
  - 광물 디자인(돌+크리스털 클러스터 2종)을 충분히 표현할 해상도.
  - 보스가 등장할 때 캐릭터성을 살릴 픽셀 공간 확보.
  - 13타일 폭(832px)이 1080px 화면에 좌우 124px 여백으로 안정적으로 배치됨.
- 영향: chunk = 16타일 × 24타일 = 1024px 높이. 약 12프레임 분량의 청크 사전로딩으로 스터터 방지.

## 3. 깊이 단위 — **km**

- spec: km (지구 반지름 6,371km 모티프).
- 결정: spec 준수. UIScene에 km 표시.
- 한때 m로 잠시 바꿨다가 spec 기준으로 복구함. `pxPerKm` 환산식은 `BiomeManager.yToKm()`에 일원화.

## 4. 업그레이드 — **자동 구매**

- spec: 자동 구매. 가장 저렴한 항목을 매 0.4초마다 1개 구매.
- 결정: spec 준수. `GameScene._autoBuyCheapest()`가 `UPGRADE_ORDER`에서 비용이 가장 낮은 구매 가능 항목을 골라 즉시 구매.
- 이유: 게임은 시청자 후원/명령어로만 영향을 받는 자동 진행 시뮬레이션이므로, 업그레이드도 자동화되어야 시청자 시점에서 "성장하고 있다"가 보임.

## 5. 보스 — **PNG 자산 준비될 때까지 일시 비활성화**

- spec: 5종 보스 + 아레나 + 핀볼 물리.
- 현재: `BossTracker.update()`와 B/N 디버그 키를 주석 처리. `BossTracker`/`ArenaSystem` 자체는 보존.
- 이유: 사용자가 보스 디자인은 PNG로 직접 제공하기로 결정. 임시 procedural 그림은 "그림판 같다"는 피드백을 받음.
- 재활성화 시점: `public/assets/bosses/{id}.png`가 모두 채워지면 `GameScene.update`의 주석 한 줄과 키 핸들러 두 줄을 해제하면 됨.

## 6. 좋아요(LIKE) 트리거 — **TNT 합산 + 3초 sizzle**

- spec: 좋아요는 별도 트리거 종류로 정의되어 있지 않음 (4-3, 4-4에 후원/채팅/구독만 있음).
- 결정: 가장 작은 BOMB(radius 1.2, scale 0.75)을 좋아요 TNT로 사용. **sizzle 3초** 동안 좋아요가 추가되면 같은 TNT에 누른 사람 이름을 누적하여 표시. 3초 후 일반 폭발.
- 이유: 좋아요는 후원처럼 1:1 이벤트화하면 화면이 폭탄으로 가득 차서 게임이 망가짐. "3초 동안 누른 사람들" 단위로 묶어서 한 번에 터트리면 시청 경험이 좋아짐.
- 구현 위치:
  - `TRIGGER_DEFS.LIKE` (TriggerSystem.js:26)
  - `TriggerSystem._handleLike` — 활성 LIKE TNT 핸들 유지 + addName
  - `ExplosionEffect.drop` — `names[]`/`sizzleDurationMs` 옵션 + 반환 핸들 `addName(name)`

## 6-2. DRILL UP 효과치 — **×1.5 (spec 명시는 +20%)**

- spec 5-3: "DRILL UP — 드릴 파워 임시 1단계 업 (+20% 속도)".
- 결정: `mult: 1.5` (=+50%) 사용.
- 이유:
  - +20%는 후원 $2를 결제한 시청자 입장에서 효과 체감이 약함. 화면에서 드릴이 눈에 띄게 빨라져야 "내가 후원한 게 동작했다"가 시각적으로 전달됨.
  - 후원 단가별 강도 단계: DRILL_UP $2(×1.5) → TURBO $5(×3.0) → OVERDRIVE $10(×5.0). 1.5→3.0→5.0 비율이 자연스러워 그대로 둠.
  - !fast (무료 채팅 트리거)도 ×1.5라 후원자 입장에서 손해는 아님. !fast는 10초/쿨다운 30초, DRILL_UP은 30초/쿨다운 없음으로 가치 차별화.

## 6-3. 선물 구독(GIFT_SUB) — **NUKE + DIAMOND 동시 발동**

- spec 5-3: "GIFT_SUB ($5 이상 선물 구독) → NUKE + DIAMOND 동시".
- 결정: spec 준수. `TRIGGER_DEFS.GIFT_SUB` = `{ type: 'composite', triggers: ['NUKE', 'DIAMOND'] }`.
- 구현: `TriggerSystem._handleComposite`가 child triggers를 같은 donor로 재발사.
- 테스트 키: `T`.

## 7. 채팅 트리거 쿨다운 — **CooldownManager**

- spec 5-1: "채팅 트리거는 전체 채널 쿨다운, 효과 지속 중 동일 커맨드 무시."
- 결정: `CooldownManager.tryFire(id, ms)`로 채널 전체 쿨다운 관리. `!fast` = 30초.
- 이유: 누구라도 `!fast`를 치면 30초간 채널 전체가 막힘. 효과(10초) 중에는 어차피 buff가 갱신되더라도 쿨다운으로 추가 발동 자체가 차단됨.

## 8. 채굴 모션 — **반경 전체에 crack 4단계**

- spec 3-2: "드릴은 접근→접촉→반동→파괴 4단계 모션".
- 결정: spec 모션 + crack 오버레이를 **드릴 반경(반원) 안의 모든 살아있는 타일**에 동시에 적용. 타일별로 contactCount가 누적되면서 1→2→3→4단계 crack을 단계적으로 표시.
- 이유: 큰 드릴 후원(RANGE_UP)을 받았을 때 한 타일만 깨지는 모션이 나오면 후원의 효과가 시각적으로 약함. 반경 전체가 갈라지고 함께 깨져야 후원의 값어치가 보임.
- 구현 위치:
  - `Driller._crackedTiles` — 진행 중인 crack 타일 추적 (해제 시 일괄 정리)
  - `TileMap.setCrackStage(tile, stage)` — depth 7 (광물 5, 드릴 50 사이)

## 9. 드릴 본체 vs 비트 충돌 — **비트만 땅에 박힘**

- spec: 명시되어 있지 않음 (그림 기준으로는 본체는 지상).
- 결정: `Driller.sprite` origin `(0.5, 0.7)` — y좌표가 본체 바닥(=지면 라인). 비트(아래 30%)만 지면 아래로 들어감. `_tweenScaleForRange`로 드릴 비주얼이 커져도 본체 바닥 라인은 변하지 않음.
- 이유: 후원으로 드릴이 커졌을 때 본체까지 지면 아래로 들어가면 "드릴이 땅 속에 묻혔다"로 보임. 비트만 박혀야 굴착 중이라는 신호가 명확.

## 10. 드릴 색상 — **drillPower 레벨에 따라 5단계 틴트**

- spec: 명시되어 있지 않음.
- 결정: drillPower Lv1=흰색(기본) → Lv2=돌 회색 → Lv3=철 푸른 회색 → Lv4=금 노랑 → Lv5=다이아 시안.
- 이유: 자동 업그레이드 진행 상황을 시청자가 한눈에 알 수 있는 시각적 신호. PNG 한 장으로 5종 드릴을 표현하기 위해 setTint 사용 (별도 에셋 불필요).

---

## 11. 흙 텍스처 색 양자화 — **채널당 6bit (64단계)**

- 문제: `transitionTo` 구간(예: Earth Layer 1 → 2)에서 km마다 색이 lerp됨. 그대로 두면 `dirt-{hex}-v{variant}` 텍스처 키가 km마다 4종(variant 0~3)씩 생성되어 장시간 라이브에서 GPU 메모리에 텍스처가 무한 누적.
- 결정: `ensureDirtTexture` 진입 시 `quantizeColor`로 채널당 하위 2bit를 마스킹(`& 0xfc`). 64단계 × 3채널 = 최대 262,144 키지만, 실제 바이옴 lerp 경로상 한 layer당 ~수십 개로 수렴.
- 영향: 색 전환이 64단계로 양자화되지만 화면에서 구분 안 됨 (배경 darken 0.25 적용으로 더 둔감).

## 향후 정렬 (TODO)

- 보스 PNG 채워지면 활성화 (`megaMole-left.png`, `megaMole-right.png` 등).
- WebSocket 실연결 (Phase 4): Streamer.bot → Node → 게임. 현재는 키보드 시뮬레이션.
- 채팅 명령어 화이트리스트/스팸 필터 (spec 5-2).
- `!reset`/`!jackpot` 같은 스트리머/특수 채팅 트리거 (spec 5-2) — 현재 미구현.
- BOSS_BOMB / BOSS_NUKE 분리 (현재는 일반 BOMB이 보스 데미지도 동시에 처리).
