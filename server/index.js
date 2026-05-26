// Drill Live 트리거 브리지 서버.
// HTTP POST /trigger로 받은 이벤트를 WebSocket으로 게임에 push.
// 향후 youtube-chat / Streamer.bot 연동 모듈이 이 서버의 /trigger를 호출하면 됨.
//
// 실행: npm run server
// 테스트: curl -X POST http://localhost:8080/trigger -H "Content-Type: application/json" \
//                 -d '{"triggerId":"BOMB","donor":"Alex"}'
// 또는: node server/fire.js BOMB Alex

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { OverlayThrottle } from './overlay.js';

const PORT = process.env.PORT || 8080;

// TRIGGER_IDS — TriggerSystem.TRIGGER_DEFS와 일치해야 함. 잘못된 ID 거부용.
const VALID_TRIGGER_IDS = new Set([
  'CHAT_BOMB',                                    // 채팅 !bomb
  'BOMB', 'ULTRA_BOMB', 'MEGA_BLAST', 'NUKE',     // 후원 폭발 4종 (각 5개씩)
  'LIKE',
  'DRILL_UP', 'OVERDRIVE',                        // 후원 속도 버프 2종
  'FAST',                                          // 채팅 !fast
  'SUB',
  'DRILL_WOOD', 'DRILL_STONE', 'DRILL_IRON', 'DRILL_GOLD', 'DRILL_DIAMOND',   // 채팅 드릴 변경
  'UPGRADE_RANGE', 'UPGRADE_ENGINE',                                            // 채팅 범위/엔진 업그레이드
  'RESET', 'JACKPOT',                                                           // 스트리머 전용
]);

// 화면 표시 전용 오버레이 kind 목록 (게임 메커니즘과 분리)
const VALID_OVERLAY_KINDS = new Set(['SUB', 'MEMBER', 'SUPERCHAT', 'LIKE']);
const overlayThrottle = new OverlayThrottle();

function sanitizeName(raw) {
  return String(raw ?? '').slice(0, 80).trim();
}

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set();
wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[WS] client connected — total ${clients.size}`);
  ws.send(JSON.stringify({ type: 'welcome', clients: clients.size }));
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] client disconnected — total ${clients.size}`);
  });
  ws.on('error', (e) => console.warn('[WS] socket error:', e.message));
});

// 모든 활성 클라이언트에게 메시지 broadcast
function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);   // 1 = OPEN
  }
}

// 단일 트리거 — { triggerId, donor? }
app.post('/trigger', (req, res) => {
  const { triggerId, donor } = req.body ?? {};
  if (!VALID_TRIGGER_IDS.has(triggerId)) {
    return res.status(400).json({ error: 'invalid triggerId', got: triggerId, valid: [...VALID_TRIGGER_IDS] });
  }
  const event = { type: 'trigger', triggerId, donor: donor ?? null, at: Date.now() };
  broadcast(event);
  console.log(`[FIRE] ${triggerId}${donor ? ` from ${donor}` : ''} → ${clients.size} clients`);
  res.json({ ok: true, delivered: clients.size, event });
});

// 표시 전용 오버레이 — 게임 메커니즘에 영향 없음.
// LIKE는 서버에서 dedupe(5s/name) + rate limit(10/s) 적용.
app.post('/overlay', (req, res) => {
  const { kind, name, amount, tier, text } = req.body ?? {};
  if (!VALID_OVERLAY_KINDS.has(kind)) {
    return res.status(400).json({ error: 'invalid kind', got: kind, valid: [...VALID_OVERLAY_KINDS] });
  }
  const cleanName = sanitizeName(name);
  if (!cleanName) return res.status(400).json({ error: 'name required' });

  const admitted = kind === 'LIKE'
    ? overlayThrottle.admitLike(cleanName)
    : overlayThrottle.admitOther();

  if (!admitted) {
    return res.json({ ok: true, throttled: true, delivered: 0 });
  }

  const event = {
    type: 'overlay',
    kind,
    name: cleanName,
    amount: typeof amount === 'number' ? amount : null,
    tier: typeof tier === 'string' ? tier : null,
    text: typeof text === 'string' ? text.slice(0, 200) : null,
    at: Date.now(),
  };
  broadcast(event);
  res.json({ ok: true, delivered: clients.size, event });
});

// LIKE 배치 — 각 이름마다 LIKE 트리거 + overlay 둘 다 broadcast (overlay만 throttle).
app.post('/like-batch', (req, res) => {
  const donors = Array.isArray(req.body?.donors) ? req.body.donors : [];
  if (donors.length === 0) return res.status(400).json({ error: 'donors[] required' });
  let overlayDelivered = 0;
  for (const raw of donors) {
    const donor = sanitizeName(raw);
    if (!donor) continue;
    broadcast({ type: 'trigger', triggerId: 'LIKE', donor, at: Date.now() });
    if (overlayThrottle.admitLike(donor)) {
      broadcast({
        type: 'overlay',
        kind: 'LIKE',
        name: donor,
        amount: null, tier: null, text: null,
        at: Date.now(),
      });
      overlayDelivered++;
    }
  }
  console.log(`[FIRE] LIKE × ${donors.length} (overlay ${overlayDelivered}) → ${clients.size} clients`);
  res.json({ ok: true, count: donors.length, overlayDelivered, delivered: clients.size });
});

app.get('/status', (_req, res) => {
  res.json({
    ok: true,
    clients: clients.size,
    validTriggers: [...VALID_TRIGGER_IDS],
    validOverlayKinds: [...VALID_OVERLAY_KINDS],
  });
});

server.listen(PORT, () => {
  console.log(`╔════════════════════════════════════════════════════════╗`);
  console.log(`║  Drill Live trigger bridge`);
  console.log(`║  HTTP  → http://localhost:${PORT}`);
  console.log(`║  WS    → ws://localhost:${PORT}/ws`);
  console.log(`║`);
  console.log(`║  Try:`);
  console.log(`║    curl -X POST http://localhost:${PORT}/trigger \\`);
  console.log(`║         -H "Content-Type: application/json" \\`);
  console.log(`║         -d '{"triggerId":"BOMB","donor":"Alex"}'`);
  console.log(`╚════════════════════════════════════════════════════════╝`);
});
