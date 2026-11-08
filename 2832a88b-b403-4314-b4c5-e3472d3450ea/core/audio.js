/* Defend Humanity core: all sound, synthesised with Web Audio (no files). */
'use strict';
/* ================= sound (all synthesised with Web Audio, no files) ================= */
const sfx = (() => {
  let ac = null, master = null, nbuf = null, active = 0, beat = 0, nextBeat = 0, muted = !!store.mute; const last = {};
  const init = () => {
    if (ac || headless) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C();
      master = ac.createGain(); master.gain.value = muted ? 0 : .85;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 8; comp.attack.value = .003; comp.release.value = .18;
      master.connect(comp); comp.connect(ac.destination);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  };
  const ready = () => ac && ac.state === 'running' && !muted;
  const out = x => { if (x == null || !ac.createStereoPanner) return master; const p = ac.createStereoPanner(); p.pan.value = clamp(x / W * 2 - 1, -1, 1) * .7; p.connect(master); return p; };
  const done = n => { active++; n.onended = () => { active--; }; };
  function noise(x, t, dur, type, f0, f1, q, vol, att) {
    const s = ac.createBufferSource(); s.buffer = nbuf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out(x)); s.start(t, Math.random() * .4, dur + .02); done(s);
  }
  function tone(x, t, type, f0, f1, dur, vol, att, lp) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (att || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let n = o; if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); n = f; }
    n.connect(g); g.connect(out(x)); o.start(t); o.stop(t + dur + .03); done(o);
  }
  const R = () => Math.random();
  const V = {   // name: [min gap in ms, voice]
    bow:    [26,  (x, t) => { noise(x, t, .09, 'bandpass', 2400, 750, 1.2, .08); tone(x, t, 'triangle', 250, 150, .07, .03); }],
    sling:  [40,  (x, t) => noise(x, t, .06, 'highpass', 2600, 1800, .7, .04)],
    bolt:   [60,  (x, t) => { noise(x, t, .06, 'bandpass', 1400, 500, 1, .16); tone(x, t, 'sine', 320, 90, .14, .2); }],
    cat:    [200, (x, t) => { noise(x, t, .3, 'bandpass', 260, 700, 3, .12, .05); tone(x, t + .22, 'sine', 140, 55, .12, .25); }],
    boom:   [90,  (x, t) => { tone(x, t, 'sine', 100, 30, .5, .5); noise(x, t, .45, 'lowpass', 500, 70, .7, .4); }],
    hitA:   [32,  (x, t) => noise(x, t, .05, 'lowpass', 1200, 500, .8, .055)],
    rain:   [38,  (x, t) => noise(x, t, .05, 'bandpass', 1800 + R() * 800, 900, 1, .05)],
    melee:  [28,  (x, t) => { noise(x, t, .07, 'bandpass', 500 + R() * 350, 250, 1, .09); tone(x, t, 'sine', 150 + R() * 30, 60, .08, .07); }],
    heavy:  [110, (x, t) => { noise(x, t, .22, 'lowpass', 700, 80, .7, .28); tone(x, t, 'sine', 100, 38, .26, .35); }],
    death:  [48,  (x, t) => tone(x, t, 'sawtooth', 190 + R() * 80, 75, .14, .04, .01, 650)],
    bigdeath:[150, (x, t) => { tone(x, t, 'sawtooth', 130, 38, .5, .12, .02, 500); noise(x, t, .4, 'lowpass', 500, 90, .7, .22); }],
    gate:   [140, (x, t) => { tone(null, t, 'sine', 90, 40, .25, .35); [190, 470, 730].forEach((f, i) => tone(null, t, 'triangle', f, f * .98, .35 - i * .08, .1 / (i + 1))); noise(null, t, .1, 'lowpass', 900, 200, .7, .2); }],
    volley: [400, (x, t) => { noise(null, t, .7, 'bandpass', 400, 2600, .9, .12, .12); tone(null, t, 'triangle', 180, 420, .5, .03, .1); }],
    horn:   [800, (x, t) => { [110, 165].forEach(f => { tone(null, t, 'sawtooth', f, f * 1.02, .9, .11, .12, 650); tone(null, t + .01, 'sawtooth', f * 1.005, f, .9, .08, .12, 650); }); }],
    warcry: [800, (x, t) => { [98, 147, 196].forEach(f => tone(null, t, 'sawtooth', f, f * 1.05, .8, .09, .1, 700)); noise(null, t, .6, 'bandpass', 500, 1200, .8, .08, .15); }],
    fanfare:[800, (x, t) => { [392, 494, 587, 784].forEach((f, i) => tone(null, t + i * .13, 'triangle', f, f, .35, .12, .01, 2500)); }],
    over:   [1000,(x, t) => { tone(null, t, 'sawtooth', 196, 60, 1.6, .14, .02, 500); tone(null, t, 'sine', 98, 40, 1.8, .2, .02); }],
    coin:   [60,  (x, t) => { tone(null, t, 'sine', 880, 880, .09, .08); tone(null, t + .07, 'sine', 1320, 1320, .14, .08); }],
    knock:  [60,  (x, t) => { noise(null, t, .08, 'lowpass', 600, 200, .8, .25); tone(null, t, 'sine', 130, 70, .1, .2); }],
    boon:   [200, (x, t) => { [523, 659, 784].forEach((f, i) => tone(null, t + i * .07, 'sine', f, f, .3, .09)); }],
    click:  [30,  (x, t) => tone(null, t, 'sine', 620, 520, .04, .07)],
    drum:   [0,   (x, t) => { tone(null, t, 'sine', 72, 38, .2, .28); noise(null, t, .05, 'lowpass', 260, 120, .7, .08); }],
    drum2:  [0,   (x, t) => { tone(null, t, 'sine', 90, 50, .12, .1); }],
  };
  return {
    unlock() { init(); if (ac && ac.state !== 'running') ac.resume().catch(() => {}); },
    play(name, x) { if (!ac || headless || !ready()) return; if (active > 34 && name !== 'horn' && name !== 'gate') return; const v = V[name]; if (!v) return; const n = performance.now(); if (n - (last[name] || 0) < v[0]) return; last[name] = n; v[1](x, ac.currentTime); },
    tick(now) { // war drums while a wave is on, quicker as the waves get worse
      if (!ac || headless || !G || G.phase !== 'battle' || paused || !ready()) return;
      if (now < nextBeat) return; const period = G.wave >= 8 ? 460 : 640; nextBeat = now + period; beat++;
      this.play(beat % 4 === 1 ? 'drum' : 'drum2');
    },
    toggle() { muted = !muted; store.mute = muted; persist(); if (master) master.gain.value = muted ? 0 : .85; this.unlock(); if (!muted) this.play('click'); return muted; },
    get muted() { return muted; },
    get state() { return ac ? ac.state + ' / voices ' + active : 'none'; },
    hold(b) { if (!ac) return; if (b) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); },
  };
})();

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
