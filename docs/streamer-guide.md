# 🎮 Driller Live — 스트리머 가이드

> 라이브 방송 중 **단축키 / 후원 / 채팅** 매핑과 현재 진행 상황 한 페이지 요약.

---

## 1. 단축키 (게임 창 포커스 상태에서)

### 💣 후원 시뮬레이션 (테스트용 — 시청자에게는 실제 후원으로 보임)

| 키 | 트리거 | 후원 금액 | 효과 |
|---|---|---|---|
| `1` | BOMB | **$1** | TNT 1개 (반경 1.6타일) |
| `2` | ULTRA BOMB | **$3** | 큰 TNT (반경 2.6) |
| `3` | MEGA BLAST | **$5** | 다이너마이트 (반경 3.6) |
| `4` | NUKE | **$20** | 핵폭탄 (반경 6.0, 화면 흔들림 + 벽도 깸) |
| `5` | DRILL UP | **$2** | 드릴 속도 ×1.5 / **30초** |
| `6` | TURBO | **$5** | 드릴 속도 ×3.0 / **15초** |
| `7` | OVERDRIVE | **$10** | 드릴 속도 ×5.0 / **20초** |
| `8` | GOLD RUSH | **$3** | 금괴 12개 강제 생성 |
| `9` | GEM DROP | **$5** | 사파이어 8개 클러스터 |
| `0` | DIAMOND | **$10** | 다이아 5개 + 빛 이펙트 |
| `Q` | SPECIAL | **$15** | 현재 바이옴 특수 광물 8개 |
| `SPACE` | RANGE UP | 후원 | 드릴 폭 +2단계 / 10초 (드릴 커짐) |

### 💬 채팅 / 좋아요 / 구독 시뮬레이션

| 키 | 트리거 | 무엇 |
|---|---|---|
| `W` | FAST | `!fast` 채팅 (드릴 ×1.5 / 10초, 채널 쿨다운 30초) |
| `L` | LIKE | YouTube 좋아요 (작은 TNT, 3초 sizzle, 이름 누적) |
| `E` | SUB | 신규 구독 (바이옴 특수 광물 6개) |
| `M` | MEMBER | 멤버 가입 (다이아 8개) |
| `T` | GIFT SUB | 선물 구독 $5+ (**NUKE + DIAMOND** 동시) |

### 👨‍✈️ 스트리머 전용

| 키 | 트리거 | 채팅 명령어 | 효과 |
|---|---|---|---|
| `F` | JACKPOT | `!jackpot` | 화면 흙 타일 40%를 **다이아몬드로 변환** + 금색 플래시 |
| `Z` | RESET | `!reset` | **새 맵 생성** (드릴 위치·골드·인벤은 유지) |
| `B` | BOSS_SPAWN | `!boss_spawn` | 다음 보스 강제 소환 |

### 🛠️ 개발/디버그

| 키 | 효과 |
|---|---|
| `G` | 골드 +10,000 즉시 추가 |
| `D` | 깊이 +1,000km 점프 (바이옴 빠른 확인). Shift+D = +50,000km |
| `R` | 드릴 폭 단계 토글 (1→2→3→1) |
| `P` | 드릴 파워 단계 토글 (1→5→1, 드릴 색도 변함) |
| `N` | 현재 활성 보스 즉시 처치 |
| `;` | 사운드 mute/unmute |

---

## 2. 시청자 이벤트별 게임 효과

### ❤️ 좋아요 (LIKE)
- 가장 작은 TNT가 드릴 위로 떨어짐 (반경 1.2)
- **3초 동안** 도화선 치지직 → 폭발
- sizzle 중에 다른 시청자도 좋아요 누르면 **같은 TNT에 이름 누적** (최근 5명 노란 글씨)
- 3초 후 폭발 → 새 좋아요는 다음 TNT로
- 의도: 좋아요 1개당 폭탄 1개면 화면이 가득 차서, 묶어서 한 번에 보여줌

### 💰 슈퍼챗 (Superchat)
금액별 자동 매핑 (USD 기준, 원/엔 자동 환산):

| USD | 트리거 |
|---|---|
| ≥ $20 | NUKE |
| $15 ~ | SPECIAL |
| $10 ~ | DIAMOND |
| $5 ~ | MEGA BLAST |
| $3 ~ | GOLD RUSH |
| $2 | DRILL UP |
| $1 | BOMB |

**키워드 우선** — 메시지에 `nuke`, `diamond`, `turbo`, `drill`, `gold`, `gem`, `mega`, `ultra`, `bomb` 같은 단어 있으면 그 트리거 사용 (단, 결제 금액 한도 안에서만).

### 💬 채팅 명령어
- `!fast` (누구나) — 드릴 ×1.5 / 10초. 채널 전체 30초 쿨다운.
- `!reset` / `!jackpot` / `!boss_spawn` (스트리머·모더레이터만)
- `!boss` — 봇 응답용 (향후 챗봇 구현 시)

### 👤 신규 구독 (SUB)
- 현재 바이옴 특수 광물 6개 강제 스폰
- 화면 상단 "NEW SUB!" 이름 표시

### 💎 멤버십 가입 (MEMBER)
- 다이아몬드 8개 + 발광 이펙트
- 화면 상단 "NEW MEMBER!" 이름 표시

### 🎁 선물 구독 $5+ (GIFT SUB)
- **NUKE + DIAMOND 동시 발동**
- 가장 화려한 이벤트

---

## 3. 현재 시스템 동작 흐름

```
┌────────────────────┐    HTTP POST     ┌─────────────────────┐    WebSocket    ┌─────────────────┐
│ YouTube 라이브      │ ──────────────> │ 트리거 브리지        │ ─────────────> │ 게임 (Phaser)   │
│ (채팅/슈퍼챗)       │                  │ Node WS 서버         │                 │ 1080×1920       │
│                    │   server/        │ :8080                │                 │ :3000           │
│  youtube-bridge.js │   youtube-bridge │ /trigger             │   RemoteTrigger │ TriggerSystem   │
└────────────────────┘                  │ /like-batch          │   .fire(id)     └─────────────────┘
                                        │ /ws                  │
                                        └─────────────────────┘
                                              ↑
                                              │ curl / npm run fire
                                              │ (테스트용)
```

### 라이브 시작 흐름 (3개 터미널)
```bash
npm run server                          # 1) 트리거 브리지 (8080)
npm run dev                             # 2) 게임 (3000)
npm run yt <liveVideoId>                # 3) YouTube 연결
```

OBS에 `localhost:3000` 브라우저 소스 추가 → 송출.

### 테스트 (서버만 켜놓고)
```bash
npm run fire BOMB Alex                  # CLI로 트리거 발사
curl -X POST http://localhost:8080/trigger \
     -H "Content-Type: application/json" \
     -d '{"triggerId":"NUKE","donor":"Whale"}'
```

---

## 4. 진행 상황

### ✅ 완료
- **게임 코어**: 무한 굴착, 6 바이옴, 12 광물, 채굴 4단계 모션 + crack 오버레이
- **드릴**: 5×80% 사이즈, drillPower 레벨별 색상, 좌우 반사 랜덤화, 중력 가속 낙하
- **폭탄 물리**: 중력 + 스택 + 지지대 사라지면 재낙하 + 도화선 잔여시간 보존
- **트리거 17종**: 후원 11개 + 채팅 1개 + 좋아요 1개 + 구독 2개 + 선물 구독 1개 + 스트리머 3개
- **자동 업그레이드**: 0.4초마다 가장 저렴한 항목 1개 구매
- **사운드 시스템**: Web Audio API procedural 합성 (mp3 파일 없이도 작동) + 매니페스트 기반 파일 override
- **보스 시스템**: 5종 정의됨, megaMole PNG 적용 (나머지 procedural), 깊이 기반 자동 등장
- **WebSocket 브리지**: HTTP/curl/CLI 테스트 가능 + YouTube Live 실연동 (youtube-chat 라이브러리)

### 🚧 남은 작업
1. **YouTube 통합 보완** — 신규 구독·멤버 가입 이벤트는 youtube-chat API 한계로 별도 처리 필요 (정식 YouTube Live Streaming API + OAuth)
2. **보스 깊이 재설계** — 5종 모두 단일 10시간 라이브에서 도달 가능하게 (현재: 보스 4·5는 도달 불가)
3. **나머지 보스 4종 PNG** (crystalGolem, abyssKraken, ancientTreant, magmaDragon)
4. **광고/리워드 시청 무료 트리거** (spec 5-3)
5. **BOSS_BOMB / BOSS_NUKE 분리** (현재 일반 BOMB이 보스 데미지도 같이 처리)
6. **깊이 마일스톤 축하** (1000km, 10000km 등 도달 시 화면 알림)
7. **누적 통계 표시** (총 후원 수, 총 광물 수)
8. **BGM 6종** (바이옴별)

### ⚠️ 알려진 제약
- 페이지 로드 직후 첫 키 입력 전엔 AudioContext가 suspend 상태 → 소리 안 남. OBS에서 'Interact'로 한 번 키 입력하면 됨.
- 보스 4·5(Ancient Treant 450,000km, Magma Dragon 950,000km)는 단일 10시간 라이브 내 도달 불가. 다회차 라이브 / 깊이 재설계 필요.
- LIKE 이벤트는 youtube-chat API가 못 받음. 게임 내에선 작동하지만 실 YouTube 좋아요 자동 연결은 별도 처리 필요.

---

## 5. 빠른 참고

- 단축키 전체: [docs/test-commands.md](./test-commands.md)
- 후원/시청자 효과 자세히: [docs/spec.md](./spec.md) 5장
- 사운드 시스템: [docs/sounds.md](./sounds.md)
- spec 대비 결정 차이: [docs/decisions.md](./decisions.md)
- 서버 사용법: [../server/README.md](../server/README.md)
