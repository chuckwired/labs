/* Defend Humanity core: units, spatial grid, effects, combat and the fixed-step simulation. */
'use strict';
/* ================= units ================= */
function spawnAlly(key, x, y, tier) {
  tier = tier || 0; const d = UD[key], tm = CFG.tierMul[tier], u = { uid: uidc++, side: 0, key, d, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp: d.hp * B.hp * tm, mhp: d.hp * B.hp * tm, r: d.r * (1 + .25 * tier), tier, tm, cd: rnd() * .5, anim: rnd() * 2, atk: 0, tgt: null, tc: (rnd() * 8) | 0, v: (rnd() * 3) | 0, dx: 0, dy: 0, burn: 0, slow: 0, flash: 0, dead: false, cell: 0, scale: (d.scale || 1) * (1 + .4 * tier) };
  U.push(u); return u;
}
function spawnEnemy(key, x, y, n) {
  const d = ED[key], hm = d.boss ? Math.pow(CFG.hpMul(n), .7) : CFG.hpMul(n) * (key === 'warlord' ? .55 + .045 * n : 1), u = { uid: uidc++, side: 1, key, d, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp: d.hp * hm, mhp: d.hp * hm, r: d.r, cd: rnd(), anim: rnd() * 2, atk: 0, tgt: null, tc: (rnd() * 10) | 0, v: (rnd() * 3) | 0, dm: CFG.dmgMul(n), lane: x, wall: null, burn: 0, slow: 0, flash: 0, dead: false, cell: 0, scale: d.scale || 1 };
  U.push(u); return u;
}
function allies() { let n = 0; for (const u of U) if (!u.side && !u.dead) n++; return n; }
function layoutSlots() {
  const groups = { shield: [], spear: [], archer: [], cat: [], horse: [] };
  for (const u of U) if (!u.side && !u.dead) groups[u.key].push(u);
  let cur = -22, halfW = 0; const sp = 15, rowH = 14;
  for (const k of ['shield', 'spear', 'archer', 'cat']) {
    const g = groups[k]; if (!g.length) continue; g.sort((a, b) => (b.tier || 0) - (a.tier || 0));
    const cols = k === 'cat' ? Math.min(g.length, 3) : clamp(Math.ceil(Math.sqrt(g.length * 3)), 3, 12), rows = Math.ceil(g.length / cols);
    for (let i = 0; i < g.length; i++) { const r = (i / cols) | 0, c = i % cols, inRow = Math.min(cols, g.length - r * cols); g[i].dx = (c - (inRow - 1) / 2) * sp * (k === 'cat' ? 2.4 : 1); g[i].dy = cur + r * rowH; }
    halfW = Math.max(halfW, (Math.min(cols, g.length) - 1) / 2 * sp * (k === 'cat' ? 2.4 : 1)); cur += rows * rowH + (k === 'shield' ? 2 : 6);
  }
  groups.horse.forEach((u, i) => { u.dx = (i % 2 ? 1 : -1) * (halfW + 26 + (i >> 2) * 14); u.dy = -4 + ((i >> 1) & 1) * 18; });
  G.depth = cur; G.half = halfW + 40;
  G.bx = clamp(G.bx, Math.min(G.half, W / 2), Math.max(W - G.half, W / 2)); G.by = clamp(G.by, H * .4, GL - 14 - Math.max(0, cur - 8));
}

/* ================= spatial grid ================= */
const CELL = 32; let gc = 0, gr = 0, eh = null, ah = null; const nx = new Int32Array(1200);
function initGrid() { gc = Math.ceil(W / CELL) + 1; gr = Math.ceil((H + CELL) / CELL) + 1; eh = new Int32Array(gc * gr); ah = new Int32Array(gc * gr); }
function cellOf(x, y) { let cx = (x / CELL) | 0, cy = ((y + CELL) / CELL) | 0; if (cx < 0) cx = 0; else if (cx >= gc) cx = gc - 1; if (cy < 0) cy = 0; else if (cy >= gr) cy = gr - 1; return cy * gc + cx; }
function nearest(head, x, y, R) {
  const x0 = Math.max(0, ((x - R) / CELL) | 0), x1 = Math.min(gc - 1, ((x + R) / CELL) | 0), y0 = Math.max(0, ((y - R + CELL) / CELL) | 0), y1 = Math.min(gr - 1, ((y + R + CELL) / CELL) | 0);
  let best = null, bd = R * R;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (let i = head[cy * gc + cx]; i >= 0; i = nx[i]) { const o = U[i]; if (o.dead) continue; const dx = o.x - x, dy = o.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = o; } }
  return best;
}
function eachNear(head, x, y, R, fn) {
  const x0 = Math.max(0, ((x - R) / CELL) | 0), x1 = Math.min(gc - 1, ((x + R) / CELL) | 0), y0 = Math.max(0, ((y - R + CELL) / CELL) | 0), y1 = Math.min(gr - 1, ((y + R + CELL) / CELL) | 0), R2 = R * R;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (let i = head[cy * gc + cx]; i >= 0; i = nx[i]) { const o = U[i]; if (o.dead) continue; const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy <= R2) fn(o, dx, dy); }
}
function buildGrid() {
  eh.fill(-1); ah.fill(-1);
  for (let i = 0; i < U.length; i++) { const u = U[i], c = cellOf(u.x, u.y); u.cell = c; if (u.side) { nx[i] = eh[c]; eh[c] = i; } else { nx[i] = ah[c]; ah[c] = i; } }
}

/* ================= effects ================= */
const MAXP = 260;
function blood(x, y, side, n) {
  if (headless || qLevel > 1) return; const pw = G ? G.pw || 0 : 0, col = side ? EPAL[PI].blood : ['#b02a2a', '#d04030', '#8a1c1c'];
  n = Math.round(n * (1 + pw * .45));
  for (let i = 0; i < n && PT.length < (qLevel ? 100 : MAXP); i++) PT.push({ x, y, h: 7, vx: (rnd() - .5) * 60 * (1 + pw * .1), vy: (rnd() - .5) * 30, vh: (20 + rnd() * 50) * (1 + pw * .1), life: .35 + rnd() * .3, c: col[(rnd() * 3) | 0], s: 1 + pw * .12 });
}
function spark(x, y) { if (headless || qLevel > 1) return; const nn = 3 + Math.floor((G ? G.pw || 0 : 0) * .6); for (let i = 0; i < nn && PT.length < MAXP; i++) PT.push({ x, y, h: 8, vx: (rnd() - .5) * 90, vy: (rnd() - .5) * 40, vh: 20 + rnd() * 60, life: .12 + rnd() * .1, c: i ? '#ffe9a8' : '#ffffff', s: 1, g: 200 }); }
function puff(x, y, n, col) { if (headless || qLevel > 1) return; for (let i = 0; i < n && PT.length < MAXP; i++) PT.push({ x: x + (rnd() - .5) * 8, y, h: 2, vx: (rnd() - .5) * 40, vy: (rnd() - .5) * 30, vh: rnd() * 30, life: .4 + rnd() * .4, c: col, s: 2, g: 20 }); }
function corpse(u) {
  if (headless) return; blood(u.x, u.y, u.side, 5); stamp(u.x, u.y, u.side, u.scale >= 1.5 ? 1 : 0); if (u.key === 'cat') return;
  CORPSES.push({ key: u.key, v: u.v, x: u.x, y: u.y, yaw: u.yaw || 0, scale: u.scale, tier: u.tier || 0, age: 0, dir: rnd() < .5 ? -1 : 1 }); if (CORPSES.length > CORPSE_MAX) CORPSES.shift();
}
function fadeDecals(a) {   // bodies sink into the ground once a wave is over; the stains fade only a little, so the field gets worse as the run goes on
  if (a >= 1) { CORPSES.length = 0; if (stainCx) { stainCx.clearRect(0, 0, stainCv.width, stainCv.height); stainDirty = true; } return; }
  for (const c of CORPSES) c.age = Math.max(c.age, 9);
  if (stainCx) { stainCx.save(); stainCx.globalCompositeOperation = 'destination-out'; stainCx.fillStyle = 'rgba(0,0,0,.1)'; stainCx.fillRect(0, 0, stainCv.width, stainCv.height); stainCx.restore(); stainDirty = true; }
}
function shake(a) { if (!RM) cam.shake = Math.min(cam.shake + a, 7); }

/* ================= combat ================= */
function gain(g) { G.goldF += g; const w = Math.floor(G.goldF); if (w) { G.gold += w; G.goldF -= w; } }
const MS = [[50, 'Deprecated'], [150, 'Garbage collected'], [350, 'Segfault'], [700, 'Kernel panic'], [1200, 'Blue screen'], [2000, 'Hard reset'], [3500, 'Total outage'], [6000, 'Heat death']];
function milestone() { for (const m of MS) if (G.kills === m[0]) { toast(m[1], m[0].toLocaleString('en-GB') + ' terminated'); sfx.play('fanfare'); shake(3); } }
function kill(u) {
  if (u.dead) return; u.dead = true; sfx.play(u.scale >= 1.5 ? 'bigdeath' : 'death', u.x);
  if (!u.side) { G.st.lost++; G.st.lostBy[G.wave] = (G.st.lostBy[G.wave] || 0) + 1; }
  if (u.side) { G.st.slain[u.key] = (G.st.slain[u.key] || 0) + 1; G.kills++; G.score += Math.round(u.d.cost * 10); gain(u.d.gold * B.gold * CFG.goldMul); if (u.scale >= 1.5) { shake(u.scale >= 2 ? 3 : 1); puff(u.x, u.y, 6, '#6b6252'); } milestone(); const pw = G.pw || 0; if (pw > 1.5 && rnd() < .5) puff(u.x, u.y, 2 + (pw | 0), '#7a1c14'); if (pw > 2.5 && rnd() < .06) shake(.5 + pw * .1); }
  if (u.d.boss) { if (!headless) { toast(u.d.name + ' down', '+' + Math.round(u.d.gold * B.gold * CFG.goldMul) + ' gold'); sfx.play('fanfare'); } shake(5); }
  if (u.d.split) { G.pend = G.pend || []; for (const [k, c] of u.d.split) for (let i = 0; i < c; i++) G.pend.push({ k, x: clamp(u.x + (rnd() - .5) * 70, 12, W - 12), y: u.y + (rnd() - .5) * 30 }); }
  corpse(u);
}
function hurt(u, amt, sx, sy, kb, silent, heavy) {
  if (u.dead) return; if (u.side && u.d.tough && !heavy) amt *= u.d.tough;   // big enemies shrug off foot troops; defences, siege, volleys and spikes (heavy) ignore it
  u.hp -= amt; if (!silent) { u.flash = .07; if (kb) { const dx = u.x - sx, dy = u.y - sy, l = hyp(dx, dy) || 1, k = kb / (u.scale > 1.5 ? u.scale * 1.8 : 1); u.kx += dx / l * k; u.ky += dy / l * k; } blood(u.x, u.y - 6, u.side, 1); }
  if (u.hp <= 0) kill(u);
}
function hurtStruct(s, amt) { if (s.dead) return; s.hp -= amt; s.flash = .08; if (s.hp <= 0) { s.dead = true; puff(s.x, s.y, 8, '#6b4a2a'); shake(1); } }
function hitGate(amt) {
  if (G.phase !== 'battle') return; G.st.gateBy[G.wave] = (G.st.gateBy[G.wave] || 0) + amt; G.gate -= amt; G.gflash = .12; shake(.4); sfx.play('gate');
  if (G.gate <= 0) { G.gate = 0; if (!G.demo) gameOver(); }
}
function splash(x, y, R, amt, kb) { eachNear(eh, x, y, R, (o, dx, dy) => hurt(o, amt * (1 - hyp(dx, dy) / R * .5), x, y, kb, false, true)); }
function splashAllies(x, y, R, amt) { eachNear(ah, x, y, R, (o, dx, dy) => hurt(o, amt * (1 - hyp(dx, dy) / R * .5), x, y, 120)); }

function fireArrow(x, y, t, dmg, spd, k, fire, heavy) { sfx.play(k === 'sling' ? 'sling' : 'bow', x); PR.push({ k, x, y, tgt: t, lx: t.x, ly: t.y, d0: hyp(t.x - x, t.y - y) || 1, dmg, spd, fire: fire || 0, heavy: !!heavy, life: 1.4, side: k === 'sling' ? 1 : 0 }); }
function fireBolt(x, y, t, dmg) { sfx.play('bolt', x); const dx = t.x - x, dy = t.y - y, l = hyp(dx, dy) || 1; PR.push({ k: 'bolt', x, y, vx: dx / l * 520, vy: dy / l * 520, dmg, pierce: 4, hits: [], life: 1.1 }); }
function fireStone(x, y, t, dmg, spl) { sfx.play('cat', x); const dx = t.x - x, dy = t.y - y, T = Math.max(.45, hyp(dx, dy) / 260); PR.push({ k: 'stone', x0: x, y0: y, x: x, y: y, tx: t.x + t.kx * .2, ty: t.y, t: 0, T, dmg, spl }); }

function strikeMelee(u, t, mul) {
  const d = u.d; let dmg = d.dmg * (u.tm || 1) * (u.side ? u.dm : B.melee * (G.charge > 0 ? 1.3 : 1)) * (mul || 1);
  u.atk = .16; sfx.play(u.scale >= 1.5 ? 'heavy' : 'melee', u.x);
  if (t.isS) { hurtStruct(t, dmg); return; }
  if (d.splash && u.side) { splashAllies(t.x, t.y, d.splash, dmg); shake(u.scale >= 3 ? 2.5 : 1.5); puff(t.x, t.y, 4, '#6b6252'); }
  else hurt(t, dmg, u.x, u.y, u.side ? 70 : 35);
  if (!u.side && B.fire && d.role !== 'melee') t.burn = 0;
}
function tdist(u, t) { // gap between the edges of u and t
  if (t.isS) { const dx = Math.max(Math.abs(u.x - t.x) - t.w / 2, 0), dy = Math.max(Math.abs(u.y - t.y) - t.h / 2, 0); return hyp(dx, dy) - u.r * .5; }
  return hyp(t.x - u.x, t.y - u.y) - t.r;
}
function alive(t) { return t && !t.dead && t.hp > 0; }

function allyAI(u, dt) {
  const d = u.d, ch = G.charge > 0, sx = G.bx + u.dx, sy = Math.min(G.by + u.dy, GL - 8);
  u.cd -= dt; u.atk -= dt; u.flash -= dt; u.slow -= dt;
  if (B.regen && u.hp < u.mhp) u.hp = Math.min(u.mhp, u.hp + u.mhp * B.regen * dt);
  const rate = d.rate / (B.rate * (ch ? 1.3 : 1)), ranged = d.role === 'ranged' || d.role === 'siege';
  if (--u.tc <= 0) {
    u.tc = 7 + ((rnd() * 6) | 0);
    const aggro = ranged ? d.range * B.range : d.role === 'cav' ? 150 : 78;
    let t = nearest(eh, u.x, u.y, aggro);
    if (t && !ranged) { const lx = t.x - sx, ly = t.y - sy, leash = (d.role === 'cav' ? 190 : 105) * (ch ? 1.4 : 1); if (lx * lx + ly * ly > leash * leash) t = null; }
    u.tgt = t;
  }
  let t = u.tgt; if (!alive(t)) t = u.tgt = null;
  let tx = sx, ty = sy, sp = d.speed * (ch ? 1.35 : 1) * (u.slow > 0 ? .6 : 1), go = true;
  if (t) {
    const dx = t.x - u.x, dy = t.y - u.y, dist = hyp(dx, dy);
    if (ranged) {
      const rng = d.range * B.range;
      if (dist <= rng) {
        go = false;
        if (u.cd <= 0) {
          u.cd = rate; u.atk = .16;
          if (d.role === 'siege') fireStone(u.x, u.y - 6, t, d.dmg * B.ranged * u.tm, d.splash);
          else fireArrow(u.x, u.y - 7, t, d.dmg * B.ranged * u.tm * (ch ? 1.2 : 1), 300, 'arrow', B.fire);
        }
      } else { tx = t.x; ty = t.y; }
    } else {
      if (dist - t.r <= d.reach) { go = false; if (u.cd <= 0) { u.cd = rate; strikeMelee(u, t, d.role === 'cav' && dist > 0 ? 1 : 1); } }
      else { tx = t.x; ty = t.y; if (d.role === 'cav') sp *= 1.1; }
    }
  } else { const dx = sx - u.x, dy = sy - u.y; if (dx * dx + dy * dy < 9) go = false; else if (dx * dx + dy * dy > 1600) sp *= 1.3; }
  if (go) { const dx = tx - u.x, dy = ty - u.y, l = hyp(dx, dy) || 1; u.vx += (dx / l * sp - u.vx) * Math.min(1, dt * 9); u.vy += (dy / l * sp - u.vy) * Math.min(1, dt * 9); }
  else { u.vx *= .8; u.vy *= .8; }
}

function enemyAI(u, dt) {
  if (u.still) { u.vx = u.vy = 0; return; }   // attract mode: posed for the camera
  const d = u.d; u.cd -= dt; u.atk -= dt; u.flash -= dt; u.slow -= dt;
  if (u.burn > 0) { u.burn -= dt; hurt(u, (3 + 2 * B.fire) * dt, 0, 0, 0, true); if (u.dead) return; if (rnd() < .06 && !headless && PT.length < MAXP) PT.push({ x: u.x, y: u.y, h: 12, vx: 0, vy: 0, vh: 25, g: 40, life: .3, c: '#ffb03c', s: 1 }); }
  if (d.summon) { u.sc = (u.sc === undefined ? d.summon.every * .4 : u.sc) - dt; if (u.sc <= 0 && (!d.summon.cap || G.enemies < d.summon.cap)) { u.sc = d.summon.every; u.atk = .3; G.pend = G.pend || []; for (let i = 0; i < d.summon.n; i++) G.pend.push({ lv: d.summon.lv, k: d.summon.keys[(rnd() * d.summon.keys.length) | 0], x: clamp(u.x + (rnd() - .5) * 90, 12, W - 12), y: u.y + 8 + rnd() * 16 }); puff(u.x, u.y, 5, '#' + EPAL[PI].a.toString(16).padStart(6, '0')); sfx.play('horn'); } }
  if (d.grow) { u.gt = (u.gt || 0) + dt; if (u.gt >= d.grow && u.scale < d.scale * 1.55) { u.gt = 0; u.hp += u.mhp * .08; u.mhp *= 1.08; u.scale += .1; u.r += .6; u.dm *= 1.05; shake(1); puff(u.x, u.y, 4, '#6b6252'); } }
  if (d.pulse) { u.pt = (u.pt === undefined ? d.pulse.every * .6 : u.pt) - dt; if (u.pt <= 0) { u.pt = d.pulse.every; u.atk = .3; shake(2.5); sfx.play('boom', u.x); eachNear(ah, u.x, u.y, d.pulse.R, o => hurt(o, o.mhp * d.pulse.frac, u.x, u.y, 90, false, true)); for (let i = 0; i < 12; i++) puff(u.x + Math.cos(i / 12 * 6.28) * d.pulse.R * .7, u.y + Math.sin(i / 12 * 6.28) * d.pulse.R * .7, 1, '#8a8f98'); } }
  if (d.blink) { u.bt = (u.bt === undefined ? d.blink * .6 : u.bt) - dt; if (u.bt <= 0) { u.bt = d.blink; puff(u.x, u.y, 8, '#' + EPAL[PI].halo.toString(16).padStart(6, '0')); u.y = Math.min(GL - 70, u.y + 80); u.x = clamp(u.x + (rnd() - .5) * 120, 20, W - 20); puff(u.x, u.y, 8, '#' + EPAL[PI].halo.toString(16).padStart(6, '0')); shake(1.5); } }
  if (d.quotes) { u.qt = (u.qt === undefined ? 1.5 : u.qt) - dt; if (u.qt <= 0) { u.qt = 6 + rnd() * 3; u.say = d.quotes[(rnd() * d.quotes.length) | 0]; u.sayUntil = performance.now() + 2800; } }
  const ranged = !!d.range, reachR = ranged ? d.range : d.reach;
  if (--u.tc <= 0) {
    u.tc = 9 + ((rnd() * 8) | 0);
    let t = nearest(ah, u.x, u.y, ranged ? d.range : 92), bd = t ? hyp(t.x - u.x, t.y - u.y) - t.r : 1e9;
    for (const s of S) { if (s.dead || s.t === 'spikes') continue; const dd = tdist(u, s) + 6; if (dd < (ranged ? d.range : 70) && dd < bd) { bd = dd; t = s; } }
    u.tgt = t;
  }
  let t = u.tgt; if (!alive(t)) t = u.tgt = null;
  let tx = u.lane * .55 + G.bx * .45, ty = GL, sp = d.speed * (u.slow > 0 ? .55 : 1), go = true;
  if (t) {
    const gap = tdist(u, t);
    if (gap <= reachR) { go = false; if (u.cd <= 0) { u.cd = d.rate; if (ranged) { u.atk = .16; fireArrow(u.x, u.y - 6, t, d.dmg * u.dm, 210, 'sling'); } else strikeMelee(u, t); } }
    else { tx = t.x; ty = t.y; }
  }
  if (go && u.wall && u.wall.hp > 0 && !u.wall.dead) { // boxed in by a wall: chew through it
    if (u.cd <= 0) { u.cd = d.rate; strikeMelee(u, u.wall); }
    go = false;
  }
  if (go && d.hold && u.y >= d.hold) go = false;   // stays put, out of reach of the line, and sends others
  if (go && u.y >= GL - Math.max(8, d.reach * .55)) { // at the gate
    go = false; if (u.cd <= 0) { u.cd = d.rate; u.atk = .16; hitGate(d.dmg * u.dm * (d.splash ? 1.25 : 1)); if (d.splash) shake(1.5); }
  }
  u.wall = null;
  if (go) { const dx = tx - u.x, dy = ty - u.y, l = hyp(dx, dy) || 1; u.vx += (dx / l * sp - u.vx) * Math.min(1, dt * 7); u.vy += (dy / l * sp - u.vy) * Math.min(1, dt * 7); }
  else { u.vx *= .75; u.vy *= .75; }
}

function structUpdate(dt) {
  let boss = null; for (const u of U) if (u.side && u.d.boss && !u.dead) { boss = u; break; }   // defences prefer a boss in range over the rabble
  for (const s of S) {
    if (s.dead) continue; s.flash -= dt;
    if (s.t === 'tower' || s.t === 'ballista') {
      s.cd -= dt;
      if (s.cd <= 0) {
        const def = SD[s.t], rg = def.range * (s.t === 'tower' ? B.range : 1), e = boss && hyp(boss.x - s.x, boss.y - s.y) < rg ? boss : nearest(eh, s.x, s.y - 8, rg);
        if (e) { s.cd = def.rate / B.rate; s.fire = .12; if (s.t === 'tower') fireArrow(s.x, s.y - 14, e, def.dmg * B.ranged, 320, 'arrow', B.fire, true); else fireBolt(s.x, s.y - 6, e, def.dmg * B.ranged); } else s.cd = .15;
      }
    } else if (s.t === 'spikes') {
      let dealt = 0; const dps = 15 * B.struct;
      eachNear(eh, s.x, s.y, 30, (e) => { if (Math.abs(e.x - s.x) < s.w / 2 + e.r * .4 && Math.abs(e.y - s.y) < s.h / 2 + e.r * .4) { const a = dps * dt; hurt(e, a, 0, 0, 0, true, true); e.slow = .25; dealt += a; } });
      if (dealt) { s.hp -= dealt * .55; s.flash = .04; if (s.hp <= 0) { s.dead = true; puff(s.x, s.y, 6, '#6b4a2a'); } }
    }
  }
}
function solidify(u) { // enemies cannot walk through palisades or buildings
  for (const s of S) {
    if (s.dead || !SD[s.t].solid) continue;
    const hw = s.w / 2 + u.r * .6, hh = s.h / 2 + u.r * .5, dx = u.x - s.x, dy = u.y - s.y;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
      const px = hw - Math.abs(dx), py = hh - Math.abs(dy);
      if (px < py) u.x += (dx < 0 ? -px : px); else u.y += (dy < 0 ? -py : py);
      u.wall = s;
    }
  }
}
function projUpdate(dt) {
  for (let i = PR.length - 1; i >= 0; i--) {
    const p = PR[i]; let dead = false;
    if (p.k === 'arrow' || p.k === 'sling') {
      const t = p.tgt; if (alive(t)) { p.lx = t.x; p.ly = t.y - (t.isS ? 0 : 5); }
      const dx = p.lx - p.x, dy = p.ly - p.y, dist = hyp(dx, dy), step = p.spd * dt;
      if (dist <= step + 2) {
        if (alive(t)) { if (t.isS) hurtStruct(t, p.dmg); else { hurt(t, p.dmg, p.x - dx, p.y - dy, 25, false, p.heavy); if (p.fire) t.burn = 2.5 + p.fire; } spark(p.lx, p.ly); sfx.play('hitA', p.lx); }
        dead = true;
      } else { p.dx = dx / dist; p.dy = dy / dist; p.x += p.dx * step; p.y += p.dy * step; }
      p.life -= dt; if (p.life <= 0) dead = true;
    } else if (p.k === 'bolt') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      eachNear(eh, p.x, p.y, 12, (o) => { if (p.pierce > 0 && p.hits.indexOf(o.uid) < 0) { p.hits.push(o.uid); p.pierce--; hurt(o, p.dmg, p.x - p.vx, p.y - p.vy, 60, false, true); spark(o.x, o.y - 6); sfx.play('hitA', o.x); } });
      if (p.life <= 0 || p.pierce <= 0 || p.y < -60 || p.x < -40 || p.x > W + 40) dead = true;
    } else if (p.k === 'stone') {
      p.t += dt; const f = Math.min(1, p.t / p.T); p.x = p.x0 + (p.tx - p.x0) * f; p.y = p.y0 + (p.ty - p.y0) * f; p.z = Math.sin(f * Math.PI) * (40 + 60 * f * 0);
      if (f >= 1) { splash(p.tx, p.ty, p.spl, p.dmg, 120); puff(p.tx, p.ty, 7, '#6b6252'); sfx.play('boom', p.tx); shake(.8); dead = true; }
    } else if (p.k === 'rain') {
      p.t += dt; if (p.t >= p.T) { sfx.play('rain', p.x); spark(p.x, p.y); splash(p.x, p.y, 15, p.dmg, 20); if (p.fire) eachNear(eh, p.x, p.y, 15, o => { o.burn = 2.5 + p.fire; }); dead = true; }
    }
    if (dead) { PR[i] = PR[PR.length - 1]; PR.pop(); }
  }
  for (let i = PT.length - 1; i >= 0; i--) {
    const p = PT[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.h += p.vh * dt; p.vh -= (p.g || 120) * dt; if (p.h < 0) { p.h = 0; p.vh = 0; p.vx *= .6; p.vy *= .6; }
    if (p.life <= 0) { PT[i] = PT[PT.length - 1]; PT.pop(); }
  }
}

/* ================= main step ================= */
let acc = 0;
function step(dt) {
  if (G.phase !== 'battle') { for (const u of U) { if (u.side) continue; u.cd -= dt; u.atk -= dt; u.flash -= dt; const sx = G.bx + u.dx, sy = Math.min(G.by + u.dy, GL - 8), dx = sx - u.x, dy = sy - u.y, l = hyp(dx, dy); if (l > 2) { const sp = Math.min(l / dt, 80); u.x += dx / l * sp * dt; u.y += dy / l * sp * dt; u.moving = true; u.anim += dt * 3; } else u.moving = false; } if (G.fx) G.fx = Math.max(0, G.fx - dt); return; }
  G.time += dt; G.st.time += dt;
  if (G.charge > 0) G.charge -= dt; if (G.cdVolley > 0) G.cdVolley -= dt; if (G.cdCharge > 0) G.cdCharge -= dt; if (G.gflash > 0) G.gflash -= dt;
  if (B.gregen && G.gate > 0 && G.gate < G.gateMax) G.gate = Math.min(G.gateMax, G.gate + G.gateMax * B.gregen * dt);
  G.plan.t += dt; spawnFromQueue();
  buildGrid();
  for (let i = 0; i < U.length; i++) { const u = U[i]; if (u.dead) continue; if (u.side) enemyAI(u, dt); else allyAI(u, dt); }
  // integrate + separate
  for (let i = 0; i < U.length; i++) {
    const u = U[i]; if (u.dead) continue;
    if ((u.key === 'hound' || u.key === 'horse') && u.vx * u.vx + u.vy * u.vy > 900 && rnd() < .05) puff(u.x, u.y, 1, '#786850');
    u.x += (u.vx + u.kx) * dt; u.y += (u.vy + u.ky) * dt; u.kx *= .86; u.ky *= .86; u.anim += dt * (Math.abs(u.vx) + Math.abs(u.vy)) * .05;
    if (u.side) { solidify(u); if (u.y > GL) u.y = GL; if (u.x < -40) u.x = -40; else if (u.x > W + 40) u.x = W + 40; }
    else { if (u.x < 8) u.x = 8; else if (u.x > W - 8) u.x = W - 8; if (u.y > GL - 6) u.y = GL - 6; if (u.y < 16) u.y = 16; }
    const head = u.side ? eh : ah, c = u.cell, cx = c % gc, cy = (c / gc) | 0;
    for (let yy = Math.max(0, cy - 1); yy <= Math.min(gr - 1, cy + 1); yy++) for (let xx = Math.max(0, cx - 1); xx <= Math.min(gc - 1, cx + 1); xx++)
      for (let j = head[yy * gc + xx]; j >= 0; j = nx[j]) {
        if (j <= i) continue; const o = U[j]; if (o.dead) continue;
        const dx = o.x - u.x, dy = o.y - u.y, md = (u.r + o.r) * .85, d2 = dx * dx + dy * dy;
        if (d2 < md * md && d2 > .0001) { const d = Math.sqrt(d2), p = (md - d) * .5, ux = dx / d * p, uy = dy / d * p; const wu = u.r / (u.r + o.r); u.x -= ux * (1 - wu) * 2; u.y -= uy * (1 - wu) * 2; o.x += ux * wu * 2; o.y += uy * wu * 2; }
      }
  }
  structUpdate(dt); projUpdate(dt);
  // sweep
  let ec = 0;
  for (let i = U.length - 1; i >= 0; i--) { if (U[i].dead) { U[i] = U[U.length - 1]; U.pop(); } }
  for (const u of U) if (u.side) ec++;
  if (S.some(s => s.dead)) S = S.filter(s => !s.dead);
  G.enemies = ec;
  if (G.volleyQ) { // staggered volley launches
    G.volleyQ.t -= dt; while (G.volleyQ && G.volleyQ.list.length && G.volleyQ.t <= 0) { const a = G.volleyQ.list.pop(); PR.push(a); G.volleyQ.t += .03; } if (G.volleyQ && !G.volleyQ.list.length) G.volleyQ = null;
  }
  if (!G.plan.queue.length && ec === 0 && !(G.pend && G.pend.length) && G.phase === 'battle' && !G.demo) waveCleared();
}
