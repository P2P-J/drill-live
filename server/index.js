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

const PORT = process.env.PORT || 8080;

// TRIGGER_IDS — TriggerSystem.TRIGGER_DEFS와 일치해야 함. 잘못된 ID 거부용.
const VALID_TRIGGER_IDS = new Set([
  'BOMB', 'ULTRA_BOMB', 'MEGA_BLAST', 'NUKE',
  'LIKE',
  'DRILL_UP', 'TURBO', 'OVERDRIVE',
  'GOLD_RUSH', 'GEM_DROP', 'DIAMOND', 'SPECIAL',
  'RANGE_UP', 'FAST',
  'SUB',
  'RESET', 'JACKPOT',  // 스트리머 전용
]);

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

// LIKE 배치 — { donors: [name, name, ...] } → 각 이름마다 LIKE 트리거 1개씩 broadcast
app.post('/like-batch', (req, res) => {
  const donors = Array.isArray(req.body?.donors) ? req.body.donors : [];
  if (donors.length === 0) return res.status(400).json({ error: 'donors[] required' });
  for (const donor of donors) {
    broadcast({ type: 'trigger', triggerId: 'LIKE', donor, at: Date.now() });
  }
  console.log(`[FIRE] LIKE × ${donors.length} → ${clients.size} clients`);
  res.json({ ok: true, count: donors.length, delivered: clients.size });
});

app.get('/status', (_req, res) => {
  res.json({ ok: true, clients: clients.size, validTriggers: [...VALID_TRIGGER_IDS] });
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
