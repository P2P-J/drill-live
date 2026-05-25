# Drill Live 트리거 브리지

YouTube Live 이벤트(후원/채팅/구독/좋아요)를 받아 게임에 push 하는 Node WebSocket 서버.

## 구조

```
브라우저 게임 (Phaser)
        ↑ WebSocket
        |
   server/index.js   ← HTTP POST /trigger
        ↑
        |
   (Phase 4-B에서 youtube-chat / Streamer.bot 연동 모듈이 여기 호출)
```

## 실행

```bash
# 게임과 별도 터미널에서
npm run server          # 포트 8080
```

서버 시작되면 게임(`npm run dev`)이 자동으로 `ws://localhost:8080/ws`에 연결.
서버 미실행 상태로도 게임은 키보드 시뮬레이션으로 잘 작동 (RemoteTrigger가 silently retry).

## 트리거 발사 (테스트)

### 방법 1: CLI 헬퍼
```bash
npm run fire BOMB Alex
npm run fire NUKE
npm run fire LIKE BigDripz
npm run fire GIFT_SUB Cookie5
```

### 방법 2: curl
```bash
curl -X POST http://localhost:8080/trigger \
     -H "Content-Type: application/json" \
     -d '{"triggerId":"BOMB","donor":"Alex"}'
```

### 방법 3: LIKE 배치 (좋아요 여러 명 한번에)
```bash
curl -X POST http://localhost:8080/like-batch \
     -H "Content-Type: application/json" \
     -d '{"donors":["Alex","Sarah","Mike"]}'
```

## 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/trigger` | `{triggerId, donor?}` — 단일 트리거 발사 |
| POST | `/like-batch` | `{donors: [...]}` — LIKE 트리거 N개 발사 |
| GET | `/status` | 연결된 클라이언트 수 + 유효 triggerId 목록 |
| WS | `/ws` | 게임 클라이언트가 연결. 트리거 이벤트 push 수신 |

## 유효한 triggerId

`BOMB`, `ULTRA_BOMB`, `MEGA_BLAST`, `NUKE`,
`LIKE`,
`DRILL_UP`, `TURBO`, `OVERDRIVE`,
`GOLD_RUSH`, `GEM_DROP`, `DIAMOND`, `SPECIAL`,
`RANGE_UP`, `FAST`,
`SUB`, `MEMBER`, `GIFT_SUB`

자세한 효과는 [docs/test-commands.md](../docs/test-commands.md) 참조.

## 다음 단계 (Phase 4-B)

`server/youtube-bridge.js` 같은 모듈을 추가해서:
1. `youtube-chat` 라이브러리로 라이브 채팅 폴링 (또는 Streamer.bot WS 구독)
2. 채팅 메시지 / 슈퍼챗 / 구독 이벤트 파싱
3. 적절한 triggerId로 변환 후 `/trigger`에 POST

이렇게 하면 현재 게임 코드 변경 없이 실제 YouTube와 연동.
