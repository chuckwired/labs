/* Defend mode: attract mode. Leave the title screen alone for a while and it plays a loop of short film scenes, run on the real simulation and
   shot with scripted cameras: the field, the enemies lined up, a wave breaking on the line, a boss, a wave won, the data centre overrun.
   Any tap or key goes back to the title. The demo state is a throwaway `G` flagged `demo` (no saving, no wave clearing, no game over). */
'use strict';
const attEl = $('#att'), attCap = attEl.querySelector('.cap');
const ATT = { on: false, i: 0, t0: 0, fade: 0, dur: 0, scene: null, shots: [], boss: 0, last: performance.now(), done: false };
const ATT_IDLE = 14000;
function demoWorld(o) {
  U = []; S = []; PR = []; PT = []; FT.length = 0; fadeDecals(1); G = { phase: 'battle', demo: true, wave: o.wave, gold: 0, goldF: 0, score: 0, kills: o.kills || 0, gate: o.gate || 400, gateMax: 400, boons: o.boons || {}, bx: W / 2, by: GL - 100, taken: '-', offer: null, rerolls: 0, time: 0, charge: 0, cdVolley: 0, cdCharge: 0, cdVolleyMax: 1, cdChargeMax: 1, enemies: 0, plan: { n: o.wave, queue: [], counts: {}, t: 0, dur: 1, total: 0 }, gflash: 0, depth: 0, half: 100, mark: null, volleyQ: null, fx: 0, pw: o.kills ? 4 : 0, won: false, st: { slain: {}, lost: 0, lostBy: {}, gateBy: {}, peak: 0, time: 0 } };
  calcB(); initGrid(); for (const k in o.army || {}) { const [kk, tt] = k.split('#'); for (let i = 0; i < o.army[k]; i++) spawnAlly(kk, G.bx, G.by, +tt || 0); }
  layoutSlots(); for (const u of U) { u.x = G.bx + u.dx; u.y = G.by + u.dy; }
  for (const [t, x, y] of o.structs || []) S.push({ isS: true, uid: uidc++, t, x, y, w: SD[t].w, h: SD[t].h, hp: SD[t].hp * B.struct, mhp: SD[t].hp * B.struct, cd: .5, flash: 0, dead: false, fresh: false, r: SD[t].w / 2, paid: SD[t].cost, fire: 0 });
  for (const [k, c, x0, x1, y0, y1] of o.foes || []) for (let i = 0; i < c; i++) { const u = spawnEnemy(k, x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), o.wave); if (o.still) { u.still = true; u.x = x0 + (x1 - x0) * (i + .5) / c; u.y = y0; } }
  G.st.peak = allies();
}
const TWR = [['tower', 90, 690], ['tower', 330, 690], ['ballista', 210, 700], ['palisade', 140, 640], ['palisade', 280, 640]];
const SCENES = [
  { cap: 'Defend Humanity', sub: 'Hold the line. Defend the data centre.', dur: 7500,
    setup() { demoWorld({ wave: 12, army: { spear: 16, shield: 6, archer: 10, horse: 3, cat: 2 }, structs: TWR, boons: { plate: 2, fletch: 1 } }); return [
      { dur: 3800, tx: 0, tz: -15, yaw: .35, pitch: .42, dist: 54, dy: .00008, dd: -.0025 },
      { dur: 3700, tx: wx(G.bx), ty: 1.3, tz: wz(G.by), yaw: Math.PI - .45, pitch: .2, dist: 12, dy: .00018 }]; } },
  { cap: 'Know your enemy', sub: 'Vibe coders, crawlers, chatbots, AI-native workers, foundation models, AGIs.', dur: 10000,
    setup() { demoWorld({ wave: 10, still: true, army: {}, foes: [['raider', 1, 40, 40, 520, 520], ['hound', 1, 40, 40, 520, 520], ['slinger', 1, 40, 40, 520, 520], ['brute', 1, 40, 40, 520, 520], ['giant', 1, 40, 40, 520, 520], ['warlord', 1, 40, 40, 520, 520]] });
      const ks = ['raider', 'hound', 'slinger', 'brute', 'giant', 'warlord']; U.forEach((u, i) => { u.x = 36 + i * 69; u.y = 500; }); return [
      { dur: 6200, tx: wx(20), ty: .9, tz: wz(500), yaw: .05, pitch: .1, dist: 12, vx: .0030 },
      { dur: 3800, tx: 0, ty: .6, tz: wz(500), yaw: .6, pitch: .45, dist: 24, dy: -.00018 }]; } },
  { cap: 'Wave 12', sub: 'Spears and archers hold. Towers do the heavy lifting.', dur: 17000,
    setup() { demoWorld({ wave: 12, army: { spear: 20, shield: 6, archer: 14, horse: 4, cat: 2 }, structs: TWR, boons: { plate: 1, fletch: 1, drill: 1 }, foes: [['raider', 26, 30, 390, 330, 520], ['hound', 10, 20, 400, 260, 380], ['slinger', 8, 60, 360, 360, 500], ['brute', 4, 100, 320, 280, 400], ['giant', 1, 190, 230, 240, 260]] }); return [
      { dur: 4200, tx: 0, ty: .5, tz: -15, yaw: 0, pitch: .45, dist: 14, dy: .00005 },
      { dur: 4400, tx: 0, ty: .4, tz: wz(560), yaw: .5, pitch: .55, dist: 20, dy: -.00006 },
      { dur: 4200, tx: 0, tz: wz(600), yaw: .1, pitch: 1.05, dist: 36, dy: .0001 },
      { dur: 4200, tx: 0, ty: .6, tz: wz(620), yaw: Math.PI - .5, pitch: .75, dist: 26, dy: .00008 }]; } },
  { boss: 1, dur: 14000,
    setup() { const keys = ['claw', 'layoff', 'mythos', 'ipo', 'hype'], k = keys[ATT.boss++ % keys.length]; demoWorld({ wave: 15, army: { spear: 18, shield: 6, archer: 12, horse: 3, cat: 2 }, structs: TWR, boons: { plate: 1 }, foes: [['raider', 14, 40, 380, 260, 380]] });
      const b = spawnEnemy(k, 210, 330, 11); ATT.b = b; this.cap = 'Boss'; this.sub = ED[k].name; const f = () => b.dead ? null : [wx(b.x), wz(b.y)], sc = figScale(k, b.scale), hh = sc * 1.1; return [
      { dur: 5200, f, ty: hh, yaw: .55, pitch: .24, dist: sc * 6.2, dy: -.00008 },
      { dur: 4400, f, ty: hh, yaw: Math.PI - .35, pitch: .22, dist: sc * 5.2, dy: .00006 },
      { dur: 4400, f, ty: sc * .6, yaw: -.25, pitch: .7, dist: sc * 8 }]; } },
  { cap: 'Wave 21', sub: 'Cleared.', dur: 12500,
    setup() { this.cap = 'Wave 21'; this.sub = 'The line holds.'; this.won = false; demoWorld({ wave: 21, army: { 'spear#1': 6, spear: 10, shield: 8, 'archer#1': 4, archer: 8, horse: 4, cat: 3 }, structs: TWR, boons: { plate: 3, sharp: 2, fletch: 2 }, kills: 300, foes: [['raider', 22, 40, 380, 470, 600], ['hound', 8, 20, 400, 400, 500], ['slinger', 6, 80, 340, 450, 560]] }); return [
      { dur: 4800, tx: 0, ty: .6, tz: -16, yaw: -.3, pitch: .62, dist: 17, dy: .00012 },
      { dur: 7700, tx: 0, ty: 1.3, tz: -6, yaw: Math.PI - .5, pitch: .26, dist: 18, dy: .00012 }]; },
    tick(el) { if (!this.won && el > 3000 && G.enemies === 0) { this.won = true; this.cap = 'Wave cleared'; this.sub = '+gold, and a breath.'; attCap.firstElementChild.textContent = this.cap; attCap.lastElementChild.textContent = this.sub; sfx.play('fanfare'); } } },
  { cap: 'Some nights it falls', sub: 'Every wave is worse than the last.', dur: 11500,
    setup() { demoWorld({ wave: 26, gate: 120, kills: 1800, army: { spear: 5, archer: 2 }, structs: [['tower', 90, 690]], foes: [['raider', 60, 20, 400, 560, 780], ['hound', 24, 20, 400, 600, 800], ['brute', 10, 40, 380, 520, 760], ['giant', 3, 120, 300, 540, 700]] }); return [
      { dur: 4200, tx: 0, ty: 1.5, tz: -8, yaw: Math.PI - .55, pitch: .5, dist: 30, dy: .00012 },
      { dur: 3800, tx: 0, ty: 1, tz: -2, yaw: Math.PI + .25, pitch: .42, dist: 38, dy: .00012 },
      { dur: 3500, tx: 0, tz: -4, yaw: -.3, pitch: 1.0, dist: 28, dy: .00012 }]; } },
];
function attractScene(i) {
  const sc = SCENES[i % SCENES.length]; ATT.scene = sc; ATT.t0 = performance.now(); ATT.shots = sc.setup();
  roamOn(true); roam.dir = now => {
    const el = now - ATT.t0; let acc = 0, s = ATT.shots[ATT.shots.length - 1], se = s.dur;
    for (const x of ATT.shots) { if (el < acc + x.dur) { s = x; se = el - acc; break; } acc += x.dur; if (x === ATT.shots[ATT.shots.length - 1]) se = x.dur; }
    let tx = s.tx || 0, tz = s.tz || 0; if (s.f) { const p = s.f(); if (p) { s.lp = p; } tx = (s.lp || [0, 0])[0]; tz = (s.lp || [0, 0])[1]; } tx += (s.vx || 0) * se; tz += (s.vz || 0) * se;
    roam.tx = tx; roam.ty = s.ty || 0; roam.tz = tz; roam.yaw = s.yaw + (s.dy || 0) * se; roam.pitch = s.pitch; roam.dist = s.dist + (s.dd || 0) * se; roam.fov = s.fov || 42; roam.shift = 0;
  };
  attCap.firstElementChild.textContent = sc.cap; attCap.lastElementChild.textContent = sc.sub; attCap.classList.remove('in'); void attCap.offsetWidth; attCap.classList.add('in');
}
function attractStart() {
  if (ATT.on) return; ATT.on = true; ATT.i = 0; ATT.boss = (Math.random() * 5) | 0; scr.hidden = true; picking = false; pickEl.hidden = true; sheet.hidden = true;
  document.body.className = 'attract'; attEl.hidden = false; attEl.classList.remove('black'); attractScene(0); ATT.fade = 0;
}
function attractStop() {
  if (!ATT.on) return; ATT.on = false; attEl.hidden = true; attEl.classList.remove('black'); ATT.last = performance.now(); showTitle();
}
function attractTick(now) {
  if (!ATT.on) {
    if (!G && !q.has('noattract') && !document.hidden && document.body.className === 'menu' && !scr.hidden && scr.querySelector('#new') && now - ATT.last > ATT_IDLE) attractStart();
    return;
  }
  const el = now - ATT.t0, sc = ATT.scene; if (sc.tick) sc.tick.call(sc, el);
  if (!ATT.fade && el > sc.dur) { ATT.fade = now; attEl.classList.add('black'); }
  else if (ATT.fade && now - ATT.fade > 550) { ATT.fade = 0; ATT.i++; attractScene(ATT.i); attEl.classList.remove('black'); }
}
for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, e => {
  if (ATT.on) { e.preventDefault(); e.stopPropagation(); if (ev !== 'wheel') { sfx.unlock(); attractStop(); } } else ATT.last = performance.now();
}, { capture: true, passive: false });
addEventListener('click', e => { if (ATT.on) { e.preventDefault(); e.stopPropagation(); } }, true);
addEventListener('mousemove', () => { if (!ATT.on) ATT.last = performance.now(); }, { passive: true });
