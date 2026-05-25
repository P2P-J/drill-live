// YouTube Live 채팅/슈퍼챗을 받아 트리거 브리지 서버에 POST 하는 어댑터.
//
// 사용:
//   1) `npm run server`   (포트 8080 띄움)
//   2) `npm run dev`      (게임)
//   3) `node server/youtube-bridge.js <liveVideoId>`  (실 라이브 연결)
//      또는 환경변수: YOUTUBE_LIVE_ID=<id> npm run yt
//
// liveVideoId는 YouTube 라이브 URL의 v= 파라미터 값. 예: https://www.youtube.com/watch?v=ABC123 → ABC123.
//
// 동작:
//   - 슈퍼챗: 금액 tier에 따라 자동 트리거 (메시지 키워드 우선)
//   - 채팅 명령어(!fast 등): 채팅 트리거 발사
//   - 모든 발사는 localhost:8080/trigger로 POST. 결과적으로 WS broadcast → 게임 fire().
//
// 제약 (youtube-chat 라이브러리 API 한계):
//   - 좋아요(LIKE) 이벤트는 채팅 API에 없음. 별도 처리 필요.
//   - 신규 구독 이벤트도 별도 시스템 필요. 멤버 가입은 시스템 메시지로 와도 형식 불안정.
//   - 현재는 슈퍼챗 + 채팅 커맨드만 처리.

import { LiveChat } from 'youtube-chat';

const SERVER_URL = process.env.BRIDGE_URL || 'http://localhost:8080';
const POLL_INTERVAL_MS = Number(process.env.YT_POLL_MS) || 4000;  // youtube-chat 기본 1초, 4초로 완화

// 슈퍼챗 금액(USD) → 기본 트리거. 메시지에 키워드 있으면 그게 우선.
function tierFromAmount(usd) {
  if (usd >= 20) return 'NUKE';
  if (usd >= 15) return 'SPECIAL';
  if (usd >= 10) return 'DIAMOND';
  if (usd >= 5)  return 'MEGA_BLAST';
  if (usd >= 3)  return 'GOLD_RUSH';
  if (usd >= 2)  return 'DRILL_UP';
  return 'BOMB';
}

// 메시지 텍스트에 명시적 트리거 이름이 있으면 우선 사용 (가격대 안에서만 허용 — 시청자가 더 비싼 트리거를 요구할 순 없음).
function keywordFromText(text, maxTier) {
  const t = String(text || '').toLowerCase();
  const order = ['BOMB','DRILL_UP','ULTRA_BOMB','GOLD_RUSH','MEGA_BLAST','TURBO','GEM_DROP','RANGE_UP','OVERDRIVE','DIAMOND','SPECIAL','NUKE'];
  const tierIdx = order.indexOf(maxTier);
  const tokenMap = {
    'nuke':'NUKE', 'special':'SPECIAL', 'diamond':'DIAMOND', 'overdrive':'OVERDRIVE',
    'range':'RANGE_UP', 'range up':'RANGE_UP',
    'gem':'GEM_DROP', 'gemdrop':'GEM_DROP', 'gem drop':'GEM_DROP',
    'turbo':'TURBO',
    'mega':'MEGA_BLAST', 'mega blast':'MEGA_BLAST',
    'gold':'GOLD_RUSH', 'goldrush':'GOLD_RUSH', 'gold rush':'GOLD_RUSH',
    'ultra':'ULTRA_BOMB', 'ultra bomb':'ULTRA_BOMB',
    'drill':'DRILL_UP', 'drill up':'DRILL_UP', 'drillup':'DRILL_UP',
    'bomb':'BOMB',
  };
  for (const [kw, id] of Object.entries(tokenMap)) {
    if (t.includes(kw)) {
      const kwIdx = order.indexOf(id);
      if (kwIdx <= tierIdx) return id;  // 금액 한도 안에서만
    }
  }
  return null;
}

// "$5.00", "₩5,000", "USD 3.50" 같은 표기를 USD 숫자로 환산. 정밀할 필요는 없음 (tier만 결정).
function parseAmountToUsd(raw) {
  const s = String(raw || '');
  const num = parseFloat(s.replace(/[^\d.]/g, '')) || 0;
  // 원/엔 등은 ~1000:1로 단순 환산 (USD 기준)
  if (/[₩₩]|KRW|won/i.test(s)) return num / 1300;
  if (/[¥]|JPY|円/i.test(s)) return num / 150;
  return num;
}

async function postTrigger(triggerId, donor) {
  try {
    const res = await fetch(`${SERVER_URL}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerId, donor }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[YT] /trigger ${res.status}:`, body);
    }
  } catch (e) {
    console.warn('[YT] POST error:', e.message);
  }
}

function messageText(msg) {
  return msg.message?.map(m => m.text ?? m.emojiText ?? '').join('') ?? '';
}

const CHAT_COMMANDS = {
  '!fast': 'FAST',
  // 추가 채팅 트리거 (!reset, !jackpot 등) 구현 시 여기 추가
};

function chatCommandFromText(text) {
  const lower = String(text || '').toLowerCase().trim();
  for (const [cmd, id] of Object.entries(CHAT_COMMANDS)) {
    if (lower.startsWith(cmd)) return id;
  }
  return null;
}

function buildId(input) {
  if (!input) return null;
  // URL 형태로 들어와도 v=... 부분만 추출
  const urlMatch = input.match(/[?&]v=([^&]+)/);
  if (urlMatch) return { liveId: urlMatch[1] };
  if (input.startsWith('@')) return { handle: input };
  if (input.startsWith('UC') && input.length > 20) return { channelId: input };
  return { liveId: input };
}

const arg = process.argv[2] || process.env.YOUTUBE_LIVE_ID;
const id = buildId(arg);
if (!id) {
  console.error('Usage: node server/youtube-bridge.js <liveVideoId | URL | @handle | UC channelId>');
  console.error('Or set YOUTUBE_LIVE_ID env var.');
  process.exit(1);
}

const chat = new LiveChat(id, POLL_INTERVAL_MS);

chat.on('start', (liveId) => {
  console.log(`[YT] connected. liveId=${liveId}`);
  console.log(`[YT] forwarding events to ${SERVER_URL}/trigger`);
});

chat.on('chat', (item) => {
  const author = item.author?.name ?? 'Viewer';
  const text = messageText(item);

  // 1) 슈퍼챗
  if (item.superchat) {
    const usd = parseAmountToUsd(item.superchat.amount);
    const defaultTier = tierFromAmount(usd);
    const triggerId = keywordFromText(text, defaultTier) ?? defaultTier;
    console.log(`[YT] superchat ${item.superchat.amount} (~$${usd.toFixed(2)}) from ${author} → ${triggerId}`);
    postTrigger(triggerId, author);
    return;
  }

  // 2) 채팅 명령어
  const cmd = chatCommandFromText(text);
  if (cmd) {
    console.log(`[YT] chat command "${cmd}" from ${author}`);
    postTrigger(cmd, author);
    return;
  }

  // 3) 일반 채팅은 로그만
  // console.log(`[YT] chat: ${author}: ${text}`);
});

chat.on('end', (reason) => {
  console.log(`[YT] live ended. reason=${reason ?? 'unknown'}`);
});

chat.on('error', (err) => {
  console.warn('[YT] error:', err?.message ?? err);
});

(async () => {
  const ok = await chat.start();
  if (!ok) {
    console.error('[YT] failed to start. live id may be invalid or not live.');
    process.exit(2);
  }
})();

process.on('SIGINT', () => {
  console.log('\n[YT] stopping...');
  chat.stop('user');
  process.exit(0);
});
