// Demo player for the "Behind the design" page: replays the sound at each stage of the build.
// The synthesis below is copied from ../index.html (voiceTick, the space effects, ensureAudio); keep them in step if the voice changes.
'use strict';
const CONFIG = { volume: 0.2 };   // same level as the lab's CONFIG.volume, so demos aren't louder than the lab
const DEFAULTS = { voice: 'blend', pitch: 1600, ms: 30, drop: 0.8, snap: 0.5, bell: 0, hi: 1600, hiMix: 0, lo: 700, loMix: 0,
  human: 0, drift: 0, shift: 0, verb: 0, room: 0.5, hollow: 0, hollowMs: 4 };
const state = { ...DEFAULTS, ctx: null };

function makeIR(ctx, secs) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * secs)), ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n, w = Math.random() * 2 - 1;
      lp += (w - lp) * (0.9 - 0.75 * k);                 // highs die away first
      d[i] = lp * Math.pow(1 - k, 3.5) * (i < 80 ? i / 80 : 1);
    }
  }
  return ir;
}

function applySpace() {
  if (!state.ctx) return;
  const t = state.ctx.currentTime;
  state.wet.gain.setTargetAtTime(state.verb * 1.6, t, 0.02);
  state.dry.gain.setTargetAtTime(1 - 0.35 * Math.min(1, state.verb), t, 0.02);
  state.comb.delayTime.setTargetAtTime(state.hollowMs / 1000, t, 0.02);
  state.combFb.gain.setTargetAtTime(Math.min(0.85, state.hollow * 0.8), t, 0.02);
  state.combOut.gain.setTargetAtTime(state.hollow * 0.7, t, 0.02);
}

function applyRoom() { if (state.ctx) state.conv.buffer = makeIR(state.ctx, state.room); }

function ensureAudio() {
  if (state.ctx) { if (state.ctx.state === 'suspended') state.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = state.ctx = new AC({ latencyHint: 'interactive' });
  state.master = ctx.createGain(); state.master.gain.value = CONFIG.volume;
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  // Space: dry + convolution reverb (generated room) + a short feedback delay for a hollow, boxy/tube ring.
  state.dry = ctx.createGain(); state.master.connect(state.dry); state.dry.connect(comp);
  state.conv = ctx.createConvolver(); state.wet = ctx.createGain();
  state.master.connect(state.conv); state.conv.connect(state.wet); state.wet.connect(comp);
  state.comb = ctx.createDelay(0.05); state.combFb = ctx.createGain(); state.combOut = ctx.createGain();
  const combLp = ctx.createBiquadFilter(); combLp.type = 'lowpass'; combLp.frequency.value = 3500;
  state.master.connect(state.comb); state.comb.connect(combLp); combLp.connect(state.combFb); state.combFb.connect(state.comb);
  combLp.connect(state.combOut); state.combOut.connect(comp);
  applyRoom(); applySpace();
  const len = ctx.sampleRate * 0.1, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  state.noise = buf;
  ctx.resume();
}

function ensureAudio() {
  if (state.ctx) { if (state.ctx.state === 'suspended') state.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = state.ctx = new AC({ latencyHint: 'interactive' });
  state.master = ctx.createGain(); state.master.gain.value = CONFIG.volume;
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  // Space: dry + convolution reverb (generated room) + a short feedback delay for a hollow, boxy/tube ring.
  state.dry = ctx.createGain(); state.master.connect(state.dry); state.dry.connect(comp);
  state.conv = ctx.createConvolver(); state.wet = ctx.createGain();
  state.master.connect(state.conv); state.conv.connect(state.wet); state.wet.connect(comp);
  state.comb = ctx.createDelay(0.05); state.combFb = ctx.createGain(); state.combOut = ctx.createGain();
  const combLp = ctx.createBiquadFilter(); combLp.type = 'lowpass'; combLp.frequency.value = 3500;
  state.master.connect(state.comb); state.comb.connect(combLp); combLp.connect(state.combFb); state.combFb.connect(state.comb);
  combLp.connect(state.combOut); state.combOut.connect(comp);
  applyRoom(); applySpace();
  const len = ctx.sampleRate * 0.1, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  state.noise = buf;
  ctx.resume();
}

function voiceTick(t, gain) {
  // Imperfection (state.human, 0 = machine-perfect): each tick gets a slightly different
  // pitch (shared slow drift + small per-tick wobble), length, level and per-strike detune.
  const H = state.human, r = () => Math.random() * 2 - 1;
  state.drift = state.drift * 0.92 + r() * 0.004 * H;
  const wob = Math.pow(2, state.shift / 12) * (1 + state.drift + r() * 0.008 * H), jit = () => wob * (1 + r() * 0.006 * H);
  gain *= 1 + r() * 0.18 * H;
  const ctx = state.ctx, dur = (state.ms / 1000) * (1 + r() * 0.12 * H), f = state.pitch * wob;
  const env = ctx.createGain();
  env.connect(state.master);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  if (state.voice === 'click') {
    const src = ctx.createBufferSource(); src.buffer = state.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2.5;
    src.connect(bp); bp.connect(env); src.start(t); src.stop(t + dur + 0.01);
    return;
  }
  if (state.voice === 'blend') {
    // wood body (sine, pitch falls by `drop`) + a short triangle overtone + bandpassed noise snap
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    o1.frequency.setValueAtTime(f, t); o1.frequency.exponentialRampToValueAtTime(f * state.drop, t + dur);
    o1.connect(env); o1.start(t); o1.stop(t + dur + 0.01);
    if (state.loMix > 0) {   // third strike, deeper, same instant
      const el = ctx.createGain(); el.connect(state.master);
      el.gain.setValueAtTime(0.0001, t); el.gain.exponentialRampToValueAtTime(gain * state.loMix, t + 0.001);
      el.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const ol = ctx.createOscillator(); ol.type = 'sine';
      { const fl = state.lo * jit(); ol.frequency.setValueAtTime(fl, t); ol.frequency.exponentialRampToValueAtTime(fl * state.drop, t + dur); }
      ol.connect(el); ol.start(t); ol.stop(t + dur + 0.01);
    }
    if (state.hiMix > 0) {   // second strike struck at the same instant, at the higher pitch
      const eh = ctx.createGain(); eh.connect(state.master);
      eh.gain.setValueAtTime(0.0001, t); eh.gain.exponentialRampToValueAtTime(gain * state.hiMix, t + 0.001);
      eh.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const oh = ctx.createOscillator(); oh.type = 'sine';
      { const fh = state.hi * jit(); oh.frequency.setValueAtTime(fh, t); oh.frequency.exponentialRampToValueAtTime(fh * state.drop, t + dur); }
      oh.connect(eh); oh.start(t); oh.stop(t + dur + 0.01);
    }
    const e2 = ctx.createGain(); e2.connect(state.master);
    e2.gain.setValueAtTime(gain * 0.35, t); e2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.4);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 1.5;
    o2.connect(e2); o2.start(t); o2.stop(t + dur);
    if (state.bell > 0) {   // inharmonic partials (bell-ish ratios), ringing a little past the body
      [[2.76, 1.6, 0.5], [5.4, 0.9, 0.25]].forEach(([r, len, a]) => {
        const e = ctx.createGain(); e.connect(state.master);
        e.gain.setValueAtTime(gain * state.bell * a, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur * len);
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
        o.connect(e); o.start(t); o.stop(t + dur * len + 0.01);
      });
    }
    const src = ctx.createBufferSource(); src.buffer = state.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain * state.snap * 1.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
    src.connect(bp); bp.connect(g); g.connect(state.master); src.start(t); src.stop(t + 0.012);
    return;
  }
  const o = ctx.createOscillator();
  o.type = state.voice === 'beep' ? 'square' : state.voice === 'wood' ? 'sine' : 'triangle';
  o.frequency.setValueAtTime(f, t);
  if (state.voice === 'wood') o.frequency.exponentialRampToValueAtTime(f * 0.55, t + dur);
  if (state.voice === 'beep') {                    // square softened so it isn't harsh
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 2.2;
    o.connect(lp); lp.connect(env);
  } else o.connect(env);
  o.start(t); o.stop(t + dur + 0.01);
  if (state.voice === 'wood' || state.voice === 'tick') {   // a touch of noise for the attack
    const src = ctx.createBufferSource(); src.buffer = state.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.004);
    src.connect(hp); hp.connect(g); g.connect(state.master); src.start(t); src.stop(t + 0.01);
  }
}

// ---- stages: what I heard at each point of the build (ids are referenced by the buttons on the page) ----
const BASE = { voice: 'blend', pitch: 1300, ms: 120, bell: 0.4, hi: 1450, hiMix: 0.8, lo: 750, loMix: 0.8 };
const SETTLED = { ...BASE, shift: -1, verb: 0.2, room: 0.5, hollow: 0.3, hollowMs: 4 };   // the shipped sound, minus imperfection
const FINAL = { ...SETTLED, human: 0.5 };                                                  // the shipped sound
const STAGES = {
  beep:      { p: { voice: 'beep', pitch: 2400, ms: 28 } },
  click:     { p: { voice: 'click', pitch: 3200, ms: 10 } },
  wood:      { p: { voice: 'wood', pitch: 1300, ms: 45 } },
  tick:      { p: { voice: 'tick', pitch: 1800, ms: 18 } },
  blend:     { p: { voice: 'blend', pitch: 1600, ms: 30 } },
  bell:      { p: { voice: 'blend', pitch: 1600, ms: 30, bell: 0.4 } },
  two:       { p: { voice: 'blend', pitch: 1300, ms: 30, bell: 0.4, hi: 1600, hiMix: 0.8 } },
  three:     { p: { voice: 'blend', pitch: 1300, ms: 30, bell: 0.4, hi: 1600, hiMix: 0.8, lo: 700, loMix: 0.8 } },
  longer:    { p: { ...BASE } },
  down:      { p: { ...BASE, shift: -1.15 } },
  hollow:    { p: { ...BASE, shift: -1.15, verb: 0.3, hollow: 0.3 } },
  settled:   { p: SETTLED, rate: 10, ticks: 10 },
  perfect:   { p: SETTLED, rate: 10, ticks: 10 },
  imperfect: { p: FINAL, rate: 10, ticks: 10 },
  burst:     { p: FINAL, rate: 10, burst: 5, pause: 0.71, ticks: 15 },
};
const JOURNEY = ['beep', 'click', 'wood', 'tick', 'blend', 'bell', 'two', 'three', 'longer', 'down', 'hollow', 'settled'];
let playing = null, stopTimer = 0, onEnd = null;
function stageTimes(s) {
  const rate = s.rate || 7, n = s.ticks || 8, out = []; let t = 0.05;
  for (let i = 0; i < n; i++) { out.push(t); t += 1 / rate; if (s.burst && (i + 1) % s.burst === 0) t += Math.max(0, s.pause - 1 / rate); }
  return { out, end: t + 0.9 };
}
function stop() {
  clearTimeout(stopTimer);
  if (state.ctx) { try { state.ctx.close(); } catch (e) {} state.ctx = null; }
  const was = playing; playing = null;
  if (onEnd) onEnd(was);
}
function play(id, done) {
  stop(); onEnd = done;
  const s = STAGES[id]; Object.assign(state, DEFAULTS, { drift: 0 }, s.p);
  ensureAudio();
  const { out, end } = stageTimes(s), t0 = state.ctx.currentTime;
  out.forEach(t => voiceTick(t0 + t, 0.8));
  playing = id; stopTimer = setTimeout(stop, end * 1000);
}
window.HKG_DEMO = { play, stop, journey: JOURNEY, ids: Object.keys(STAGES), isPlaying: () => playing };
