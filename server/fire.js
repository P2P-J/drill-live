#!/usr/bin/env node
// CLI 헬퍼 — 빠르게 트리거 발사. 서버가 실행 중이어야 함.
// 사용:
//   node server/fire.js BOMB             # 후원자 이름 없이
//   node server/fire.js BOMB Alex        # 이름 지정
//   node server/fire.js LIKE BigDripz
//   node server/fire.js SUB Cookie5     # 신규 구독 (드릴 아래 10줄 광물 채움)

const PORT = process.env.PORT || 8080;

const [, , triggerId, donor] = process.argv;
if (!triggerId) {
  console.error('Usage: node server/fire.js <TRIGGER_ID> [donor]');
  console.error('Example: node server/fire.js BOMB Alex');
  process.exit(1);
}

const body = { triggerId };
if (donor) body.donor = donor;

try {
  const res = await fetch(`http://localhost:${PORT}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('FAIL:', json);
    process.exit(2);
  }
  console.log(`OK delivered to ${json.delivered} client(s):`, json.event);
} catch (e) {
  console.error('Could not reach server at port ' + PORT + ':', e.message);
  console.error('Did you run `npm run server`?');
  process.exit(3);
}
