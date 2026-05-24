# Driller Live — 사운드 작업 리스트

> 모든 BGM·SFX는 **상업적 라이브 스트림에 사용 가능한 라이센스** 확보 필수.
> 추천 소스:
> - **BGM (유료)**: Epidemic Sound, Artlist, Soundstripe — 유튜브 라이브 적합
> - **BGM (무료)**: YouTube Audio Library, Free Music Archive
> - **SFX (무료)**: freesound.org, pixabay.com, zapsplat (가입), mixkit
> - **SFX (유료)**: AudioJungle (envato), Boom Library

---

## 1. 채굴 / 광물 (SFX)

| 키 | 파일명 | 설명 | 트리거 |
|---|---|---|---|
| `mine_dirt` | `mine_dirt.mp3` | 흙 타일 깨질 때 — 짧은 "툭" | Driller가 흙 타일 destroy |
| `mine_stone` | `mine_stone.mp3` | 돌/벽 타일 깨질 때 — 둔탁한 "쾅" | Driller가 단단한 타일 destroy |
| `ore_common` | `ore_common.mp3` | coal/copper/iron 채굴 시 — 짧은 차징 | Common 광물 |
| `ore_rare` | `ore_rare.mp3` | gold/crystal 채굴 시 — 살짝 화려한 차링 | Uncommon/Rare 광물 |
| `ore_epic` | `ore_epic.mp3` | sapphire/emerald/diamond 채굴 시 — 반짝 | Epic 광물 |
| `ore_legendary` | `ore_legendary.mp3` | lavaCrystal/voidStone 채굴 시 — 웅장한 효과 | Legendary 광물 |

## 2. 드릴 본체 (SFX)

| 키 | 파일명 | 설명 | 비고 |
|---|---|---|---|
| `drill_loop` | `drill_loop.mp3` | 드릴 회전음 (looping) — 채굴 중 | volume 0.4, loop |
| `drill_idle` | `drill_idle.mp3` | 드릴 대기 / 낙하 모터음 | volume 0.2, loop |
| `bounce_hit` | `bounce_hit.mp3` | 좌우 벽 부딫칠 때 — 통통 | 매 바운스마다 1회 |

## 3. 후원 트리거 (SFX)

| 키 | 파일명 | 설명 | PRD 트리거 |
|---|---|---|---|
| `bomb_small` | `bomb_small.mp3` | $1 BOMB 폭발 (3×3) | BOMB |
| `bomb_ultra` | `bomb_ultra.mp3` | $3 ULTRA BOMB (5×5) | ULTRA BOMB |
| `bomb_mega` | `bomb_mega.mp3` | $5 MEGA BLAST (7×7, 바위 포함) | MEGA BLAST |
| `nuke` | `nuke.mp3` | $20 NUKE — 가장 큰 폭발 | NUKE |
| `drill_up` | `drill_up.mp3` | $2 DRILL UP — 파워업 효과음 | DRILL UP |
| `turbo` | `turbo.mp3` | $5 TURBO — 3× 가속 | TURBO |
| `overdrive` | `overdrive.mp3` | $10 OVERDRIVE — 강한 파워업 + 잔향 | OVERDRIVE |
| `range_up` | `range_up.mp3` | 드릴 범위 확장 (커지는 효과) | (자체 추가) |
| `gold_rush` | `gold_rush.mp3` | $3 GOLD RUSH — 금화 떨어지는 톤 | GOLD RUSH |
| `gem_drop` | `gem_drop.mp3` | $5 GEM DROP — 보석 떨어지는 톤 | GEM DROP |
| `diamond_spawn` | `diamond_spawn.mp3` | $10 DIAMOND — 빛나는 챠밍 | DIAMOND |
| `special_ore` | `special_ore.mp3` | $15 SPECIAL — 신비로운 톤 | SPECIAL ORE |

## 4. 채팅 / 구독 (SFX)

| 키 | 파일명 | 설명 |
|---|---|---|
| `chat_fast` | `chat_fast.mp3` | !fast 발동 — 짧은 휘파람 |
| `sub_jingle` | `sub_jingle.mp3` | 신규 구독자 — 짧고 밝은 징글 |
| `member_jingle` | `member_jingle.mp3` | 멤버십 가입 — 약간 더 길고 화려 |
| `gift_sub` | `gift_sub.mp3` | 선물 구독 — 화려한 트럼펫 |

## 5. UI / 일반 (SFX)

| 키 | 파일명 | 설명 |
|---|---|---|
| `upgrade_buy` | `upgrade_buy.mp3` | 자동 업그레이드 구매 시 — 부드러운 "딩" |
| `buff_apply` | `buff_apply.mp3` | 버프 적용 |
| `buff_expire` | `buff_expire.mp3` | 버프 만료 — 잠긴 페이드 |
| `boss_warning` | `boss_warning.mp3` | 보스 1000m 전 — 사이렌 짧게 |
| `boss_appear` | `boss_appear.mp3` | 보스 등장 — 임팩트 + 사운드 폭발 |
| `boss_hit` | `boss_hit.mp3` | 보스 타격 |
| `boss_defeat` | `boss_defeat.mp3` | 보스 처치 — 승리 트럼펫 |

## 6. BGM (배경음악)

> 각 바이옴마다 다른 BGM. 바이옴 전환 시 5초 크로스페이드.

| 키 | 파일명 | 분위기 | 예상 길이 |
|---|---|---|---|
| `bgm_earth` | `bgm_earth.mp3` | 따뜻한 카툰 모험 (드럼 + 우쿨렐레?) | 2~3분 (loop) |
| `bgm_crystal` | `bgm_crystal.mp3` | 신비로운 보라 — 차이밍 + 신스 패드 | 2~3분 |
| `bgm_abyssal` | `bgm_abyssal.mp3` | 깊은 해저 — 잔잔, 약간 음울 | 2~3분 |
| `bgm_forest` | `bgm_forest.mp3` | 고대 숲 — 자연음 + 신비 멜로디 | 2~3분 |
| `bgm_magma` | `bgm_magma.mp3` | 마그마 — 긴장감 비트 + 베이스 | 2~3분 |
| `bgm_void` | `bgm_void.mp3` | 공허 — 우주 앰비언트 | 2~3분 |
| `bgm_boss` | `bgm_boss.mp3` | 보스전 — 긴장감 폭발 (오케스트라+드럼) | 1.5~2분 |

---

## 구현 노트

### Phaser 사용 방식
```js
// BootScene에서 미리 로딩
this.load.audio('mine_dirt', '/assets/audio/mine_dirt.mp3');

// Driller에서 채굴 시
this.scene.sound.play('mine_dirt', { volume: 0.4 });

// 드릴 회전 loop
this.drillSound = this.scene.sound.add('drill_loop', { loop: true, volume: 0.3 });
this.drillSound.play();
// 채굴 멈출 때
this.drillSound.pause();
```

### 볼륨 가이드라인 (스트리밍 OBS 마스터 -6dB 기준)
- BGM: 0.2 ~ 0.3 (배경)
- SFX 일반: 0.3 ~ 0.5
- 후원 트리거 SFX: 0.5 ~ 0.7 (시청자 즉각 인지)
- 보스 / NUKE: 0.7 ~ 0.9 (큰 임팩트)

### 파일 포맷
- **MP3 128kbps**: 일반 SFX (작은 사이즈)
- **OGG vorbis**: BGM (Phaser 호환 좋음)
- 모바일 데이터 절약을 위해 BGM은 64~96kbps도 OK

### 폴더 구조 제안
```
public/assets/audio/
├── sfx/
│   ├── mining/
│   ├── drill/
│   ├── triggers/
│   └── ui/
└── bgm/
    ├── bgm_earth.ogg
    ├── bgm_crystal.ogg
    └── ...
```

### 우선순위
1. **Phase 3 시작 전 필수**: drill_loop, mine_dirt, ore_common~legendary, bomb_small, nuke
2. **Phase 3 중반**: 모든 트리거 SFX
3. **Phase 4 (방송 세팅)**: BGM 6종 + 보스 SFX
4. **추후 다듬기**: UI SFX, 디테일 사운드
