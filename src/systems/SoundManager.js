// 중앙 사운드 디스패처. 키별로 Phaser audio 파일이 로드돼있으면 그걸 재생,
// 없으면 Web Audio API로 동기적으로 톤/노이즈를 합성해서 재생(procedural fallback).
// 후원 트리거나 채굴 시점에서 단일 진입점으로 호출하면 됨.
//
// 사용 예:
//   this.soundManager.play('mine_dirt');
//   this.soundManager.play('bomb_mega');
//   const loop = this.soundManager.playLoop('drill_loop', { volume: 0.4 });
//   loop.stop();

const THROTTLE_DEFAULT_MS = 60;

// 사운드별 procedural 합성 레시피. file override가 있으면 무시됨.
// 각 recipe는 (ctx, dest, opts) → AudioNode 시퀀스를 만들고 자동으로 stop 되도록 schedule.
const RECIPES = {
  // ── 채굴 ─────────────────────────────────────
  mine_dirt:     (c, d) => percussiveThud(c, d, { freq: 110, dur: 0.10, noise: 0.4, vol: 0.35 }),
  mine_stone:    (c, d) => percussiveThud(c, d, { freq: 70,  dur: 0.18, noise: 0.6, vol: 0.45 }),

  // 광물 등급별 — 점점 화려해짐
  ore_common:    (c, d) => brightPluck(c, d, { freqs: [600, 900], dur: 0.18, vol: 0.30 }),
  ore_uncommon:  (c, d) => brightPluck(c, d, { freqs: [700, 1050, 1300], dur: 0.22, vol: 0.35 }),
  ore_rare:      (c, d) => brightPluck(c, d, { freqs: [800, 1200, 1600], dur: 0.30, vol: 0.40, shimmer: true }),
  ore_epic:      (c, d) => brightPluck(c, d, { freqs: [900, 1350, 1800, 2400], dur: 0.40, vol: 0.45, shimmer: true }),
  ore_legendary: (c, d) => brightPluck(c, d, { freqs: [1100, 1650, 2200, 3300], dur: 0.55, vol: 0.50, shimmer: true, reverb: true }),

  // ── 드릴 ─────────────────────────────────────
  drill_loop:    (c, d) => buzzLoop(c, d, { freq: 90, mod: 25, vol: 0.18 }),
  bounce_hit:    (c, d) => shortPing(c, d, { freq: 320, dur: 0.08, vol: 0.30 }),

  // ── 폭탄 ─────────────────────────────────────
  bomb_small:    (c, d) => explosion(c, d, { dur: 0.45, lowFreq: 90,  vol: 0.45 }),
  bomb_ultra:    (c, d) => explosion(c, d, { dur: 0.60, lowFreq: 70,  vol: 0.55 }),
  bomb_mega:     (c, d) => explosion(c, d, { dur: 0.80, lowFreq: 55,  vol: 0.70 }),
  nuke:          (c, d) => explosion(c, d, { dur: 1.40, lowFreq: 38,  vol: 0.85, rumbleBoost: true }),
  tnt_sizzle:    (c, d, o) => sizzleBurst(c, d, { vol: 0.22, dur: (o.duration ?? 1.0) }),

  // ── 버프 / 드릴 강화 ────────────────────────
  drill_up:      (c, d) => arpUp(c, d, { freqs: [400, 600, 800], dur: 0.45, vol: 0.40 }),
  turbo:         (c, d) => arpUp(c, d, { freqs: [350, 525, 700, 1050], dur: 0.50, vol: 0.50 }),
  overdrive:     (c, d) => arpUp(c, d, { freqs: [300, 450, 600, 900, 1200], dur: 0.70, vol: 0.55 }),
  range_up:      (c, d) => sweepUp(c, d, { from: 200, to: 1200, dur: 0.50, vol: 0.40 }),
  chat_fast:     (c, d) => sweepUp(c, d, { from: 600, to: 1400, dur: 0.30, vol: 0.30 }),
  buff_apply:    (c, d) => shortPing(c, d, { freq: 880, dur: 0.18, vol: 0.25 }),
  buff_expire:   (c, d) => sweepDown(c, d, { from: 600, to: 300, dur: 0.25, vol: 0.25 }),

  // ── 광물 스폰 ────────────────────────────────
  gold_rush:     (c, d) => sparkle(c, d, { freqs: [800, 1200, 1600],         vol: 0.45 }),
  gem_drop:      (c, d) => sparkle(c, d, { freqs: [900, 1400, 1900, 2400],   vol: 0.50 }),
  diamond_spawn: (c, d) => sparkle(c, d, { freqs: [1000, 1500, 2000, 2800, 3600], vol: 0.55, shimmer: true }),
  special_ore:   (c, d) => sparkle(c, d, { freqs: [700, 1050, 1400, 1800, 2400, 3200], vol: 0.55, shimmer: true }),

  // ── 구독/멤버 ────────────────────────────────
  sub_jingle:    (c, d) => arpUp(c, d, { freqs: [523, 659, 784], dur: 0.55, vol: 0.45 }),       // C5 E5 G5
  member_jingle: (c, d) => arpUp(c, d, { freqs: [523, 659, 784, 1047, 1319], dur: 0.75, vol: 0.50 }),
  gift_sub:      (c, d) => arpUp(c, d, { freqs: [392, 523, 659, 784, 1047, 1319], dur: 1.0, vol: 0.60, shimmer: true }),

  // ── UI ───────────────────────────────────────
  upgrade_buy:   (c, d) => shortPing(c, d, { freq: 1320, dur: 0.10, vol: 0.20 }),
};

// 키별 throttle override (ms). 짧을수록 더 자주 트리거 가능.
const THROTTLE_MS = {
  mine_dirt: 50,
  mine_stone: 60,
  bounce_hit: 80,
  ore_common: 80,
  ore_uncommon: 100,
  ore_rare: 120,
  ore_epic: 150,
  ore_legendary: 200,
  upgrade_buy: 100,
};

export class SoundManager {
  constructor(scene) {
    this.scene = scene;
    this._lastPlayedAt = new Map();   // key -> timestamp ms
    this._loops = new Map();          // key -> { source, gain } for stop
    this.masterVolume = 1.0;
    this.muted = false;
  }

  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
  }

  toggleMute() {
    this.muted = !this.muted;
    // 진행 중 loop도 즉시 mute
    for (const { gain } of this._loops.values()) {
      gain.gain.value = this.muted ? 0 : gain.gain._configuredVolume;
    }
    return this.muted;
  }

  // 단발 재생. opts.volume 0~1.
  play(key, opts = {}) {
    if (this.muted) return;
    // throttle — 같은 키 연발 방지
    const now = performance.now();
    const last = this._lastPlayedAt.get(key) ?? -Infinity;
    const minGap = THROTTLE_MS[key] ?? THROTTLE_DEFAULT_MS;
    if (now - last < minGap) return;
    this._lastPlayedAt.set(key, now);

    // 1) 파일 override
    if (this.scene.cache.audio.exists(key)) {
      const config = { volume: (opts.volume ?? 1.0) * this.masterVolume };
      this.scene.sound.play(key, config);
      return;
    }

    // 2) procedural
    const ctx = this._ctx();
    if (!ctx) return;
    const recipe = RECIPES[key];
    if (!recipe) return;

    const dest = ctx.createGain();
    dest.gain.value = (opts.volume ?? 1.0) * this.masterVolume;
    dest.connect(ctx.destination);
    recipe(ctx, dest, opts);
  }

  // 반복 재생. 반환된 핸들의 stop() 호출로 종료.
  playLoop(key, opts = {}) {
    if (this.muted) return { stop() {} };
    // 이미 같은 loop 돌고 있으면 그대로 반환
    if (this._loops.has(key)) return this._loops.get(key).handle;

    // 1) 파일 override
    if (this.scene.cache.audio.exists(key)) {
      const sound = this.scene.sound.add(key, {
        loop: true,
        volume: (opts.volume ?? 0.3) * this.masterVolume,
        rate: opts.rate ?? 1.0,
      });
      sound.play();
      const handle = {
        stop: () => { sound.stop(); this._loops.delete(key); },
        setRate: (rate) => { try { sound.setRate?.(rate); } catch (_e) { sound.rate = rate; } },
        setVolume: (v) => { try { sound.setVolume?.(v * this.masterVolume); } catch (_e) { sound.volume = v * this.masterVolume; } },
      };
      this._loops.set(key, { handle });
      return handle;
    }

    // 2) procedural
    const ctx = this._ctx();
    if (!ctx) return { stop() {} };
    const recipe = RECIPES[key];
    if (!recipe) return { stop() {} };

    const gain = ctx.createGain();
    const vol = (opts.volume ?? 0.3) * this.masterVolume;
    gain.gain.value = vol;
    gain.gain._configuredVolume = vol;   // for mute restore
    gain.connect(ctx.destination);
    const nodes = recipe(ctx, gain, { ...opts, loop: true });
    const handle = {
      stop: () => {
        try {
          if (Array.isArray(nodes)) for (const n of nodes) n.stop?.();
          else nodes?.stop?.();
        } catch (_e) { /* already stopped */ }
        gain.disconnect();
        this._loops.delete(key);
      },
      // procedural loop은 rate/volume 동적 변경 미지원 — no-op (파일 override 시에만 동작)
      setRate: (_r) => {},
      setVolume: (v) => { gain.gain.value = v * this.masterVolume; gain.gain._configuredVolume = v * this.masterVolume; },
    };
    this._loops.set(key, { handle, gain });
    return handle;
  }

  stopLoop(key) {
    const entry = this._loops.get(key);
    entry?.handle?.stop();
  }

  // 광물 등급 → 사운드 키 매핑. rarity 외 케이스는 ore_common.
  playOreByRarity(rarity) {
    const map = {
      common:    'ore_common',
      uncommon:  'ore_uncommon',
      rare:      'ore_rare',
      epic:      'ore_epic',
      legendary: 'ore_legendary',
    };
    this.play(map[rarity] ?? 'ore_common');
  }

  _ctx() {
    // Phaser는 첫 user interaction 전까지 ctx를 suspend 상태로 둠. autoplay 정책.
    const sound = this.scene.sound;
    return sound?.context ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Procedural synthesis helpers (Web Audio API)
// ─────────────────────────────────────────────────────────────────

function envGain(ctx, dest, { attack = 0.005, decay, sustain = 0, release = 0.02, peak = 1 }) {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(sustain, t + attack + decay);
  g.gain.linearRampToValueAtTime(0, t + attack + decay + release);
  g.connect(dest);
  return { node: g, endAt: t + attack + decay + release };
}

function osc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function whiteNoise(ctx, durationSec) {
  const sampleRate = ctx.sampleRate;
  const samples = Math.floor(sampleRate * durationSec);
  const buf = ctx.createBuffer(1, samples, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function percussiveThud(ctx, dest, { freq, dur, noise, vol }) {
  // 짧은 sine + 노이즈 burst
  const sineEnv = envGain(ctx, dest, { decay: dur * 0.7, release: dur * 0.3, peak: vol });
  const o = osc(ctx, 'sine', freq);
  o.connect(sineEnv.node);
  o.start();
  o.stop(sineEnv.endAt + 0.02);

  if (noise > 0) {
    const noiseEnv = envGain(ctx, dest, { decay: dur * 0.4, release: dur * 0.2, peak: vol * noise });
    const n = whiteNoise(ctx, dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq * 4;
    n.connect(filt).connect(noiseEnv.node);
    n.start();
    n.stop(noiseEnv.endAt + 0.02);
  }
}

function brightPluck(ctx, dest, { freqs, dur, vol, shimmer = false, reverb = false }) {
  const t0 = ctx.currentTime;
  const stagger = 0.03;
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i];
    const env = envGain(ctx, dest, { attack: 0.005, decay: dur * 0.4, release: dur * 0.6, peak: vol * (1 - i * 0.12) });
    const o = osc(ctx, shimmer ? 'triangle' : 'sine', f);
    o.connect(env.node);
    const startAt = t0 + i * stagger;
    o.start(startAt);
    o.stop(env.endAt + 0.02);
  }
  if (reverb) {
    // 간이 reverb: 같은 음을 약하게 늦춰 한 번 더
    setTimeout(() => brightPluck(ctx, dest, { freqs: freqs.map(f => f * 0.5), dur: dur * 0.6, vol: vol * 0.3 }), 80);
  }
}

function shortPing(ctx, dest, { freq, dur, vol }) {
  const env = envGain(ctx, dest, { attack: 0.002, decay: dur * 0.3, release: dur * 0.7, peak: vol });
  const o = osc(ctx, 'sine', freq);
  o.connect(env.node);
  o.start();
  o.stop(env.endAt + 0.02);
}

function explosion(ctx, dest, { dur, lowFreq, vol, rumbleBoost = false }) {
  // 노이즈 burst + 저음 sine drop
  const noiseEnv = envGain(ctx, dest, { attack: 0.002, decay: dur * 0.3, release: dur * 0.7, peak: vol });
  const n = whiteNoise(ctx, dur);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(2400, ctx.currentTime);
  filt.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + dur);
  n.connect(filt).connect(noiseEnv.node);
  n.start();
  n.stop(noiseEnv.endAt + 0.02);

  // 저음 sine — 충격
  const sineEnv = envGain(ctx, dest, { attack: 0.003, decay: dur * 0.6, release: dur * 0.4, peak: vol * 0.9 });
  const o = osc(ctx, 'sine', lowFreq);
  o.frequency.setValueAtTime(lowFreq * 2, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(lowFreq * 0.5, ctx.currentTime + dur);
  o.connect(sineEnv.node);
  o.start();
  o.stop(sineEnv.endAt + 0.02);

  if (rumbleBoost) {
    // NUKE — 추가 sub-bass 잔향
    const subEnv = envGain(ctx, dest, { attack: 0.01, decay: dur * 0.9, release: dur * 0.5, peak: vol * 0.7 });
    const sub = osc(ctx, 'sine', lowFreq * 0.5);
    sub.connect(subEnv.node);
    sub.start();
    sub.stop(subEnv.endAt + 0.02);
  }
}

function arpUp(ctx, dest, { freqs, dur, vol, shimmer = false }) {
  const stagger = dur / Math.max(2, freqs.length);
  const t0 = ctx.currentTime;
  for (let i = 0; i < freqs.length; i++) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0 + i * stagger);
    env.gain.linearRampToValueAtTime(vol * (0.7 + 0.3 * (i / freqs.length)), t0 + i * stagger + 0.01);
    env.gain.linearRampToValueAtTime(0, t0 + i * stagger + stagger * 0.95);
    env.connect(dest);
    const o = osc(ctx, shimmer ? 'triangle' : 'sine', freqs[i]);
    o.connect(env);
    o.start(t0 + i * stagger);
    o.stop(t0 + i * stagger + stagger);
  }
}

function sweepUp(ctx, dest, { from, to, dur, vol }) {
  const env = envGain(ctx, dest, { attack: 0.01, decay: dur * 0.5, release: dur * 0.4, peak: vol });
  const o = osc(ctx, 'sawtooth', from);
  o.frequency.setValueAtTime(from, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur * 0.8);
  o.connect(env.node);
  o.start();
  o.stop(env.endAt + 0.02);
}

function sweepDown(ctx, dest, { from, to, dur, vol }) {
  const env = envGain(ctx, dest, { attack: 0.005, decay: dur * 0.3, release: dur * 0.6, peak: vol });
  const o = osc(ctx, 'sine', from);
  o.frequency.setValueAtTime(from, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
  o.connect(env.node);
  o.start();
  o.stop(env.endAt + 0.02);
}

function sparkle(ctx, dest, { freqs, vol, shimmer = false }) {
  // 빠른 arpeggio + 반짝이 톤
  const stagger = 0.025;
  const dur = 0.4;
  const t0 = ctx.currentTime;
  for (let i = 0; i < freqs.length; i++) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0 + i * stagger);
    env.gain.linearRampToValueAtTime(vol, t0 + i * stagger + 0.005);
    env.gain.linearRampToValueAtTime(0, t0 + i * stagger + dur * 0.6);
    env.connect(dest);
    const o = osc(ctx, shimmer ? 'triangle' : 'sine', freqs[i]);
    o.connect(env);
    o.start(t0 + i * stagger);
    o.stop(t0 + i * stagger + dur);
  }
}

function buzzLoop(ctx, dest, { freq, mod, vol }) {
  // 드릴 회전음 — 톱니파 + amplitude modulation
  const env = ctx.createGain();
  env.gain.value = vol;
  env.gain._configuredVolume = vol;
  env.connect(dest);

  const carrier = osc(ctx, 'sawtooth', freq);
  const lfo = osc(ctx, 'sine', mod);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = vol * 0.3;
  lfo.connect(lfoGain).connect(env.gain);
  carrier.connect(env);
  carrier.start();
  lfo.start();
  return [carrier, lfo];
}

function sizzleBurst(ctx, dest, { vol, dur }) {
  // TNT 도화선 — 지정 duration만큼만 노이즈 crackle 재생 후 자동 종료
  const sampleRate = ctx.sampleRate;
  const samples = Math.max(1, Math.floor(sampleRate * dur));
  const buf = ctx.createBuffer(1, samples, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    const r = Math.random() * 2 - 1;
    data[i] = r * (0.5 + 0.5 * Math.random());
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 1200;
  const env = envGain(ctx, dest, { attack: 0.05, decay: dur * 0.7, release: dur * 0.3, peak: vol });
  src.connect(filt).connect(env.node);
  src.start();
  src.stop(env.endAt + 0.02);
}
