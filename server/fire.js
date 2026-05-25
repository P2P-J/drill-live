#!/usr/bin/env node
// CLI 헬퍼 — 트리거 또는 overlay 발사.
// 사용:
//   node server/fire.js BOMB                     # 트리거
//   node server/fire.js BOMB Alex
//   node server/fire.js overlay SUB NewbieFox
//   node server/fire.js overlay LIKE CoolGuy
//   node server/fire.js overlay SUPERCHAT Whale99 5 DIAMOND

const PORT = process.env.PORT || 8080;
const args = process.argv.slice(2);

function usage() {
  console.error('Usage:');
  console.error('  node server/fire.js <TRIGGER_ID> [donor]');
  console.error('  node server/fire.js overlay <KIND> <name> [amount] [tier]');
  process.exit(1);
}

if (args.length === 0) usage();

let path, body;
if (args[0] === 'overlay') {
  const [, kind, name, amount, tier] = args;
  if (!kind || !name) usage();
  path = '/overlay';
  body = { kind, name };
  if (amount !== undefined) body.amount = Number(amount);
  if (tier !== undefined) body.tier = tier;
} else {
  const [triggerId, donor] = args;
  path = '/trigger';
  body = { triggerId };
  if (donor) body.donor = donor;
}

try {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('FAIL:', json);
    process.exit(2);
  }
  console.log(`OK ${path}:`, json);
} catch (e) {
  console.error('Could not reach server at port ' + PORT + ':', e.message);
  console.error('Did you run `npm run server`?');
  process.exit(3);
}
