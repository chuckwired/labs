// HKG Crossing: an isometric pixel-art Hong Kong street, drawn entirely in code (no image files).
// World: u runs along the road (down-right on screen), v runs across it (down-left). 1 tile = 32x16 px.
// Left-hand traffic: the far lane (small v) drives +u, the near lane (large v) drives -u.
// Static scenery is pre-rendered once; vehicles and props are pre-rendered sprites; pedestrians are tiny billboards.
// The lab (index.html) drives it with HKG_SCENE.setPhase(p) and HKG_SCENE.pulse().
(function () {
'use strict';
const cv = document.getElementById('scene');
if (!cv || !cv.getContext) return;
const g = cv.getContext('2d');

// ---------------------------------------------------------------- config
const CFG = {
  W: 512, H: 384, OX: 197, OY: 121, cx: 210,   // 4:3 canvas; where world (0,0,0) lands (the crossing sits left of and below centre, so buildings fill the view); cx = crossing x
  UL: -14, UR: 28,                       // the street runs past both edges of the canvas; these are where vehicles enter and leave
  plazaV: 25,                            // the near-side plaza runs off the bottom-left of the canvas
  kerb: 3, base: 10,                     // kerb height and diorama thickness in px
  farB: 2.5, farP: 4.5, road: 9, nearP: 11, // v boundaries: buildings | far pavement | road | near pavement
  zebra: [6, 9],                         // u range of the crossing
  laneFar: 5.55, laneNear: 7.95,         // v centre of each lane
  stopFar: 5.6, stopNear: 9.4,           // stop lines (u) for the +u lane and the -u lane
};
const { W, H, OX, OY, UL, UR } = CFG, LANE = UR - UL;

// ---------------------------------------------------------------- helpers
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function rgb(a) { return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function shade(c, f) { const a = hex(c); return rgb(a.map(v => v * f)); }
function mix(c1, c2, t) { const a = hex(c1), b = hex(c2); return rgb(a.map((v, i) => v + (b[i] - v) * t)); }

// pixel-exact convex polygon fill (no anti-aliasing)
function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  let y0 = 1e9, y1 = -1e9; const n = pts.length / 2;
  for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
  for (let y = Math.ceil(y0 - 0.5); y <= Math.floor(y1 - 0.5); y++) {
    const yc = y + 0.5; let xl = 1e9, xr = -1e9;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; let xa = pts[i * 2], ya = pts[i * 2 + 1], xb = pts[j * 2], yb = pts[j * 2 + 1];
      if (ya === yb) continue;
      if (ya > yb) { let t = xa; xa = xb; xb = t; t = ya; ya = yb; yb = t; }
      if (yc < ya || yc >= yb) continue;
      const x = xa + (xb - xa) * (yc - ya) / (yb - ya);
      if (x < xl) xl = x; if (x > xr) xr = x;
    }
    if (xr >= xl) { const a = Math.round(xl), b = Math.round(xr); ctx.fillRect(a, y, Math.max(1, b - a), 1); }
  }
}
function pline(ctx, x0, y0, x1, y1, color) { // 1px line
  ctx.fillStyle = color; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// projection: o = {x, y} is where local (0,0,0) lands
const P = (o, u, v, z) => [o.x + (u - v) * 16, o.y + (u + v) * 8 - (z || 0)];
function quad(ctx, o, a, b, c, d, color) { const A = P(o, ...a), B = P(o, ...b), C = P(o, ...c), D = P(o, ...d); poly(ctx, [A[0], A[1], B[0], B[1], C[0], C[1], D[0], D[1]], color); }
// flat rectangle at height z
function flat(ctx, o, u0, u1, v0, v1, z, col) { quad(ctx, o, [u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z], col); }
// vertical face on the +v side (the "left" face) and on the +u side (the "right" face)
function faceL(ctx, o, u0, u1, v, z0, z1, col) { quad(ctx, o, [u0, v, z0], [u1, v, z0], [u1, v, z1], [u0, v, z1], col); }
function faceR(ctx, o, v0, v1, u, z0, z1, col) { quad(ctx, o, [u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1], col); }
function box(ctx, o, u0, v0, z0, u1, v1, z1, col) {
  const c = typeof col === 'string' ? { t: col, l: shade(col, 0.82), r: shade(col, 0.66) } : col;
  faceL(ctx, o, u0, u1, v1, z0, z1, c.l); faceR(ctx, o, v0, v1, u1, z0, z1, c.r); flat(ctx, o, u0, u1, v0, v1, z1, c.t);
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
const O = { x: OX, y: OY };

// ---------------------------------------------------------------- palette
const PAL = {
  plaza1: '#d3ccba', plaza2: '#cbc4b1', asphalt: '#44464e', asphalt2: '#3f4149', line: '#e8e7e0', yellow: '#e2bb3a',
  pave1: '#cdc7b8', pave2: '#c4bead', kerb: '#aaa492', soil: '#8b8676', soil2: '#6e6a5d',
  glass: '#4d6671', glass2: '#6b8996', shop: '#2b2f37',
};
const NEON = ['#ff3d7f', '#29d3ff', '#ffd23d', '#7dff6b', '#ff7a2e'];


const peds = [];
const state = { phase: 'off', t: 0, from: 'off', car: 'green', ped: 'red', flashT: 0, pulse: 0, night: false, quietHours: false };

// ---------------------------------------------------------------- time of day and season
// Four 6-hour looks (morning 6-12, afternoon 12-18, evening 18-24, late night 0-6) and four seasons.
// ?hour=N, ?month=1-12 and ?season=spring|summer|autumn|winter override the clock for previews.
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const QS = new URLSearchParams(location.search);
function seasonOf(m) { return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }
function periodOf(h) { return h >= 6 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'afternoon' : h >= 18 ? 'evening' : 'late'; }
function clockHour() { const v = QS.get('hour'); return v !== null && v !== '' && !isNaN(+v) ? ((+v % 24) + 24) % 24 : new Date().getHours(); }
function clockSeason() {
  const s = QS.get('season'); if (SEASONS.includes(s)) return s;
  const m = QS.get('month'); if (m !== null && m !== '' && !isNaN(+m)) return seasonOf((((+m - 1) % 12) + 12) % 12);
  return seasonOf(new Date().getMonth());
}
const SKY = {
  morning: { top: '#a9cbe3', mid: '#e4eeeb', low: '#f3ead3' },
  afternoon: { top: '#8db8dc', mid: '#dde8e6', low: '#f3e4c0' },
  evening: { top: '#9fb0e0', mid: '#e0c0cf', low: '#ffcf9a' },
  late: { top: '#8f9fd8', mid: '#b8bde0', low: '#d8d0e8' },
};
const TINT = { morning: '#f2f7ff', afternoon: '#fff3dc', evening: '#4f5896', late: '#2c3774' };
const SEASON_TINT = { winter: '#e9eff7', spring: '#f5f8f1', summer: '#fffaf0', autumn: '#fff0dc' };
function mul(a, b) { const x = hex(a), y = hex(b); return rgb(x.map((v, i) => v * y[i] / 255)); }
function skyFor() {
  const { period, season } = state, k = { ...SKY[period] }, day = period === 'morning' || period === 'afternoon';
  if (day) {
    if (season === 'winter') for (const n in k) k[n] = mix(k[n], '#b9c3cc', 0.32);
    if (season === 'autumn') k.low = mix(k.low, '#f1c48a', 0.3);
    if (season === 'spring') k.mid = mix(k.mid, '#dfeadf', 0.3);
    if (season === 'summer') k.top = mix(k.top, '#6fa8dc', 0.2);
  }
  return k;
}
const tintFor = () => mul(TINT[state.period], SEASON_TINT[state.season]);
function applyClock() {
  const h = clockHour(), p = periodOf(h), se = clockSeason(), changed = p !== state.period || se !== state.season;
  state.hour = h; state.period = p; state.season = se; state.night = p === 'evening' || p === 'late'; state.quietHours = p === 'late';
  return changed;
}
applyClock();

// ---------------------------------------------------------------- static scene (pre-rendered once)
const buildings = (function () {
  const r = rng(2026), cols = ['#cfc1a2', '#b9cfc3', '#dbb9b1', '#b8c3d3', '#d8d2b2', '#d6c3b8', '#c3d0b8', '#cabfd0'], aws = ['#b5342a', '#2e7d6b', '#e0a030', '#c8342b', '#3b6fb0', '#7a4a9a'];
  const out = []; let u = UL - 5;
  while (u < UR + 5) {
    const w = 2.3 + r() * 1.2, fl = 6 + Math.floor(r() * 7);
    out.push({ u0: u, u1: u + w, fl, c: cols[Math.floor(r() * cols.length)], aw: aws[Math.floor(r() * aws.length)], roof: r() < 0.55 ? 'tank' : 'ant', scaf: r() < 0.12 });
    u += w;
  }
  return out;
})();
const FH = 7, GF = 11;           // floor height, ground floor height (px)
const lit = [];                  // lit windows / neon, for the night layer: {kind, ...}
const signs = [];                // neon signs {u, z0, z1, col}

function drawSky(ctx, sk) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, sk.top); sky.addColorStop(0.55, sk.mid); sky.addColorStop(1, sk.low);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
}
function drawSkyline(ctx) {            // transparent canvas: the peak and the hazy far towers
  const r = rng(7); ctx.save(); ctx.translate(0, OY - 36);
  poly(ctx, [0, 150, 70, 96, 130, 120, 210, 70, 300, 112, 380, 84, 470, 118, 512, 100, 512, 200, 0, 200], '#a9bdb8');
  for (let x = -10; x < W; x += 14 + Math.floor(r() * 16)) {
    const w = 12 + Math.floor(r() * 16), h = 40 + Math.floor(r() * 90);
    ctx.fillStyle = mix('#b6c4cc', '#9eb0bc', r()); ctx.fillRect(x, 175 - h, w, h + 60);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let yy = 175 - h + 4; yy < 175; yy += 6) ctx.fillRect(x + 2, yy, w - 4, 1);
  }
  ctx.restore();
}

function drawGround(ctx) {
  const { farB, farP, road, nearP, kerb, plazaV } = CFG, u0 = UL - 4, u1 = UR + 4;
  for (let u = u0; u < u1; u++) {
    for (let v = 0; v < 2; v++) flat(ctx, O, u, u + 1, farB + v, farB + v + 1, kerb, (u + v) & 1 ? PAL.pave1 : PAL.pave2);
    for (let v = 0; v < 2; v++) flat(ctx, O, u, u + 1, road + v, road + v + 1, kerb, (u + v) & 1 ? PAL.pave1 : PAL.pave2);
    for (let v = nearP; v < plazaV; v++) flat(ctx, O, u, u + 1, v, v + 1, kerb, (u + v) & 1 ? PAL.plaza1 : PAL.plaza2);
  }
  // a low hedge between the pavement and the plaza
  box(ctx, O, u0, 11.05, kerb, u1, 11.5, kerb + 2.5, { t: '#6f9a5a', l: '#557a46', r: '#466a3a' });
  // kerb face of the far pavement (faces the road)
  faceL(ctx, O, u0, u1, farP, 0, kerb, PAL.kerb);
  // road
  flat(ctx, O, u0, u1, farP, road, 0, PAL.asphalt);
  const r = rng(3);
  for (let i = 0; i < 190; i++) { const u = u0 + r() * (u1 - u0 - 1), v = farP + r() * (road - farP - 0.4); flat(ctx, O, u, u + 0.5 + r(), v, v + 0.25, 0, PAL.asphalt2); }
  // markings: yellow kerb lines, dashed centre line, zebra, stop lines
  flat(ctx, O, u0, u1, farP + 0.05, farP + 0.12, 0, PAL.yellow); flat(ctx, O, u0, u1, farP + 0.2, farP + 0.27, 0, PAL.yellow);
  flat(ctx, O, u0, u1, road - 0.12, road - 0.05, 0, PAL.yellow); flat(ctx, O, u0, u1, road - 0.27, road - 0.2, 0, PAL.yellow);
  for (let u = u0 + 0.3; u < u1 - 0.5; u += 1.5) { if (u + 0.8 > CFG.zebra[0] - 0.4 && u < CFG.zebra[1] + 0.4) continue; flat(ctx, O, u, u + 0.8, 6.72, 6.8, 0, PAL.line); }
  for (let v = farP + 0.4; v < road - 0.4; v += 0.52) flat(ctx, O, CFG.zebra[0], CFG.zebra[1], v, v + 0.3, 0, PAL.line);
  flat(ctx, O, CFG.stopFar - 0.15, CFG.stopFar, farP + 0.35, 6.7, 0, PAL.line);
  flat(ctx, O, CFG.stopNear, CFG.stopNear + 0.15, 6.85, road - 0.35, 0, PAL.line);
}

function drawBuilding(ctx, b, idx) {
  const r = rng(100 + idx * 17), v = CFG.farB, z0 = CFG.kerb, H1 = GF + (b.fl - 1) * FH, zt = z0 + H1;
  // main block
  box(ctx, O, b.u0, 0, z0, b.u1, v, zt, b.c);
  // floor slab lines
  for (let f = 1; f < b.fl; f++) faceL(ctx, O, b.u0, b.u1, v, z0 + GF + (f - 1) * FH, z0 + GF + (f - 1) * FH + 1, shade(b.c, 0.7));
  // shop front: dark glass, awning
  faceL(ctx, O, b.u0 + 0.2, b.u1 - 0.2, v, z0 + 0.5, z0 + GF - 2, PAL.shop);
  for (let u = b.u0 + 0.45; u < b.u1 - 0.5; u += 0.7) faceL(ctx, O, u, u + 0.28, v, z0 + 1, z0 + GF - 3, mix(PAL.shop, '#ffd98a', 0.18));
  box(ctx, O, b.u0 + 0.15, v, z0 + GF - 2, b.u1 - 0.15, v + 0.42, z0 + GF, { t: shade(b.aw, 1.1), l: b.aw, r: shade(b.aw, 0.7) });
  // window grid
  const cols = Math.max(2, Math.floor((b.u1 - b.u0) / 0.9));
  for (let f = 1; f < b.fl; f++) {
    for (let i = 0; i < cols; i++) {
      const uu = b.u0 + (i + 0.5) * (b.u1 - b.u0) / cols - 0.26, zz = z0 + GF + (f - 1) * FH + 2;
      const k = r(), col = k < 0.55 ? PAL.glass : k < 0.8 ? PAL.glass2 : k < 0.92 ? '#a99a78' : '#c9c2ad';
      faceL(ctx, O, uu, uu + 0.52, v, zz, zz + 3.6, col);
      if (r() < 0.5) box(ctx, O, uu + 0.1, v, zz - 2.2, uu + 0.42, v + 0.22, zz - 0.4, { t: '#d6d6d2', l: '#b9b9b6', r: '#8d8d8b' }); // air-con unit
      if (r() < 0.55) lit.push({ k: 'win', u0: uu, u1: uu + 0.52, v, z0: zz, z1: zz + 3.6 });
    }
  }
  // bamboo scaffolding
  if (b.scaf) {
    const bam = '#b8914f', top = z0 + GF + 5 * FH, vv = v + 0.35;
    for (let f = 0; f <= 5; f++) { const z = z0 + GF + f * FH; const A = P(O, b.u0 + 0.1, vv, z), B = P(O, b.u1 - 0.1, vv, z); pline(ctx, A[0], A[1], B[0], B[1], bam); }
    for (let u = b.u0 + 0.1; u <= b.u1 - 0.05; u += 0.55) { const A = P(O, u, vv, z0 + GF), B = P(O, u, vv, top); pline(ctx, A[0], A[1], B[0], B[1], bam); }
    for (let f = 0; f < 5; f++) { const A = P(O, b.u0 + 0.1, vv, z0 + GF + f * FH), B = P(O, b.u0 + 0.7, vv, z0 + GF + (f + 1) * FH); pline(ctx, A[0], A[1], B[0], B[1], '#9c7b3f'); }
    poly(ctx, [...P(O, b.u0 + 0.1, vv, top - 0.5), ...P(O, b.u1 - 0.1, vv, top - 0.5), ...P(O, b.u1 - 0.1, vv, top + 4.5), ...P(O, b.u0 + 0.1, vv, top + 4.5)], 'rgba(40,120,90,.55)'); // green netting
  }
  // roof
  if (b.roof === 'tank') { box(ctx, O, b.u0 + 0.6, 0.5, zt, b.u0 + 1.2, 1.1, zt + 6, '#8aa3b0'); box(ctx, O, b.u0 + 0.7, 0.6, zt + 6, b.u0 + 1.1, 1.0, zt + 8, '#6c8190'); }
  else { box(ctx, O, b.u0 + 0.5, 0.6, zt, b.u0 + 1.4, 1.5, zt + 3, '#a8a49a'); const A = P(O, b.u0 + 1.8, 1.0, zt), B = P(O, b.u0 + 1.8, 1.0, zt + 14); pline(ctx, A[0], A[1], B[0], B[1], '#555a60'); }
  // neon signs sticking out of the wall
  const ns = 1 + Math.floor(r() * 2);
  for (let i = 0; i < ns; i++) {
    const u = b.u0 + 0.5 + r() * (b.u1 - b.u0 - 1.1), zc = z0 + GF + 2 + r() * 14, h = 9 + Math.floor(r() * 8), col = NEON[Math.floor(r() * NEON.length)];
    signs.push({ u, z0: zc, z1: zc + h, col, v0: v, v1: v + 1.0 + r() * 0.5 });
  }
}

function drawSign(ctx, s, glow) {
  const c = glow ? s.col : shade(s.col, 0.78);
  box(ctx, O, s.u, s.v0, s.z0, s.u + 0.16, s.v1, s.z1, { t: c, l: shade(c, 0.86), r: shade(c, 0.7) });
  // lettering (illegible by design): little light bars on the +u face
  for (let z = s.z0 + 2; z < s.z1 - 1; z += 3) { const a = P(O, s.u + 0.16, s.v0 + 0.15, z), b = P(O, s.u + 0.16, s.v1 - 0.15, z); pline(ctx, a[0], a[1], b[0], b[1], glow ? '#ffffff' : shade(s.col, 0.45)); }
}

let staticDay = null, maskSky = null, maskWorld = null;
const lanterns = [];
function buildStatic() {
  const sk = skyFor(), [c, x] = canvasOf(W, H), [sl, sx] = canvasOf(W, H), [wc, wx] = canvasOf(W, H);
  drawSky(x, sk); drawSkyline(sx); x.drawImage(sl, 0, 0);
  const dy = OY - 36, hz = x.createLinearGradient(0, 120 + dy, 0, 215 + dy); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, sk.low); x.fillStyle = hz; x.fillRect(0, 120 + dy, W, 95);
  x.fillStyle = sk.low; x.fillRect(0, 215 + dy, W, H - 215 - dy);
  drawGround(wx);
  lit.length = 0; signs.length = 0; lanterns.length = 0;
  buildings.forEach((b, i) => drawBuilding(wx, b, i));
  signs.forEach(sg => drawSign(wx, sg, false));
  // festive lanterns: red in winter (Lunar New Year), amber in autumn (Mid-Autumn)
  if (state.season === 'winter' || state.season === 'autumn') buildings.forEach((b, i) => {
    if (i % 3 !== 1) return; const col = state.season === 'winter' ? '#d8342b' : '#f0a030';
    for (let k = 0; k < 3; k++) { const u = b.u0 + 0.3 + k * (b.u1 - b.u0 - 0.95) / 2, z = CFG.kerb + GF + 4; lanterns.push({ u, z, col }); const v0 = CFG.farB + 0.04; box(wx, O, u, v0, z, u + 0.42, v0 + 0.42, z + 6.5, col); box(wx, O, u + 0.06, v0 + 0.06, z + 6.5, u + 0.36, v0 + 0.36, z + 7.6, '#e8c24a'); box(wx, O, u + 0.06, v0 + 0.06, z - 1.2, u + 0.36, v0 + 0.36, z, '#e8c24a'); box(wx, O, u + 0.19, v0 + 0.19, z - 4.5, u + 0.23, v0 + 0.23, z - 1.2, '#e8c24a'); }
  });
  x.drawImage(wc, 0, 0);
  staticDay = c; maskSky = sx.getImageData(0, 0, W, H).data; maskWorld = wx.getImageData(0, 0, W, H).data;
}

// ---------------------------------------------------------------- sprites (pre-rendered iso boxes)
function sprite(w, h, ax, ay, fn) { const [c, x] = canvasOf(w, h); fn(x, { x: ax, y: ay }); return { c, ax, ay }; }
const GLASS = '#26333d', TYRE = '#17181c', BLACK = '#1b1c20';

const VT = {
  taxi:    { len: 1.9, wid: 1.0, bh: 4.5, ch: 3.5, cab: [0.45, 1.45], vmax: 2.7, w: 5 },
  car:     { len: 1.8, wid: 0.95, bh: 4.5, ch: 3.5, cab: [0.4, 1.4], vmax: 2.5, w: 5 },
  van:     { len: 2.2, wid: 1.05, bh: 9, ch: 0, vmax: 2.2, w: 2 },
  minibus: { len: 2.5, wid: 1.1, bh: 10, ch: 0, vmax: 2.7, w: 3 },
  bus:     { len: 4.0, wid: 1.25, bh: 24, ch: 0, vmax: 1.9, w: 3 },
};
const CAR_COLS = ['#e9e9ec', '#9aa3ad', '#2a2e36', '#3a5f9a', '#7d8a74', '#a3322e', '#d8d2b8'];

function vehSprite(type, col, dir) {
  const t = VT[type], z0 = 1.5, zb = z0 + t.bh, zmax = zb + t.ch + 4;
  const w = Math.ceil((t.len + t.wid) * 16) + 8, h = Math.ceil((t.len + t.wid) * 8 + zmax) + 8;
  return sprite(w, h, Math.round(t.wid * 16) + 4, Math.round(zmax) + 4, (x, o) => {
    const front = dir > 0 ? '#fff0b0' : '#d4262a';
    // body
    if (type === 'minibus') box(x, o, 0, 0, z0, t.len, t.wid, zb, { t: col.roof, l: shade(col.body, 0.82), r: shade(col.body, 0.66) });
    else if (type === 'bus') {
      box(x, o, 0, 0, z0, t.len, t.wid, z0 + 10, { t: '#b3322b', l: shade('#b3322b', 0.82), r: shade('#b3322b', 0.66) });
      box(x, o, 0, 0.03, z0 + 10, t.len, t.wid - 0.03, zb, { t: '#c9ccd0', l: shade(col.body, 0.82), r: shade(col.body, 0.66) });
    } else box(x, o, 0, 0, z0, t.len, t.wid, zb, col.body);
    // lower body paint (bus: cream waist; van: blue stripe)
    if (type === 'van') faceL(x, o, 0.02, t.len - 0.02, t.wid, z0 + 2.5, z0 + 4.2, '#2f6db3');
    // glazing
    if (type === 'taxi' || type === 'car') {
      const [a, b] = t.cab, zt = zb + t.ch;
      box(x, o, a, 0.08, zb, b, t.wid - 0.08, zt, { t: type === 'taxi' ? '#d6dade' : shade(col.body, 1.05), l: shade(col.body, 0.82), r: shade(col.body, 0.66) });
      faceL(x, o, a + 0.07, (a + b) / 2 - 0.03, t.wid - 0.08, zb + 0.7, zt - 0.5, GLASS);
      faceL(x, o, (a + b) / 2 + 0.03, b - 0.07, t.wid - 0.08, zb + 0.7, zt - 0.5, GLASS);
      faceR(x, o, 0.16, t.wid - 0.16, b, zb + 0.7, zt - 0.5, GLASS);
      if (type === 'taxi') box(x, o, 0.85, 0.35, zt, 1.1, 0.65, zt + 1.6, '#f4f2e8');
    } else if (type === 'minibus') {
      faceL(x, o, 0.15, t.len - 0.15, t.wid, zb - 6.6, zb - 2.4, GLASS);
      for (let u = 0.6; u < t.len - 0.2; u += 0.55) faceL(x, o, u, u + 0.07, t.wid, zb - 6.6, zb - 2.4, col.body);
      faceR(x, o, 0.1, t.wid - 0.1, t.len, zb - 6.6, zb - 2.6, GLASS);
    } else if (type === 'van') {
      faceR(x, o, 0.1, t.wid - 0.1, t.len, zb - 5.2, zb - 1.6, GLASS);
    } else if (type === 'bus') {
      const cream = '#efe6c8', rw = t.len - 0.12;
      faceL(x, o, 0.12, rw, t.wid, z0 + 3.2, z0 + 9.2, cream);                                   // lower deck: cream band with windows
      faceL(x, o, 0.14, rw - 0.02, t.wid, z0 + 4.6, z0 + 8.4, GLASS);
      faceL(x, o, 0.12, rw, t.wid - 0.03, z0 + 12, z0 + 21, GLASS);                              // upper deck: tall window band
      for (let u = 0.5; u < t.len - 0.2; u += 0.5) { faceL(x, o, u, u + 0.06, t.wid, z0 + 4.6, z0 + 8.4, cream); faceL(x, o, u, u + 0.06, t.wid - 0.03, z0 + 12, z0 + 21, cream); }
      faceL(x, o, 0.12, rw, t.wid, z0 + 9.2, z0 + 10.8, '#cf3a30');                              // red waist band
      faceL(x, o, 0.12, rw, t.wid - 0.03, z0 + 21, z0 + 22.4, '#cf3a30');                         // red band under the roof line
      faceL(x, o, 0.12, rw, t.wid, z0 + 2.2, z0 + 3.2, shade('#b3322b', 0.8));                    // skirt
      faceR(x, o, 0.1, t.wid - 0.1, t.len, z0 + 4, z0 + 9, GLASS);                               // lower windscreen
      faceR(x, o, 0.1, t.wid - 0.1, t.len, z0 + 12, z0 + 21, GLASS);                             // upper windscreen
      faceR(x, o, 0.1, t.wid - 0.1, t.len, z0 + 10.2, z0 + 11.4, '#ffb347');                     // destination blind
    }
    // lights on the +u end
    const lz = type === 'bus' ? z0 + 4 : zb - 2.6;
    faceR(x, o, 0.1, 0.32, t.len, lz, lz + 1.2, front); faceR(x, o, t.wid - 0.32, t.wid - 0.1, t.len, lz, lz + 1.2, front);
    // near-side wheels
    const ws = type === 'bus' ? [[0.45, 0.85], [t.len - 0.85, t.len - 0.45]] : [[0.3, 0.7], [t.len - 0.7, t.len - 0.3]];
    ws.forEach(([a, b]) => { faceL(x, o, a, b, t.wid + 0.02, 0, 3.4, TYRE); faceL(x, o, a + 0.12, b - 0.12, t.wid + 0.03, 1, 2.3, '#8a8d94'); });
  });
}
const vehCache = {};
function vehSpr(type, colKey, col, dir) { const k = type + colKey + dir; return vehCache[k] || (vehCache[k] = vehSprite(type, col, dir)); }

// ---------------------------------------------------------------- props
function guardSprite() {
  return sprite(48, 24, 8, 20, (x, o) => {
    for (let u = 0; u <= 1.0001; u += 0.5) box(x, o, u, 0, 0, u + 0.06, 0.06, 6, '#7d8893');
    box(x, o, 0, 0.01, 4.5, 1.06, 0.05, 5.5, '#aab3bb'); box(x, o, 0, 0.01, 2.2, 1.06, 0.05, 3.2, '#aab3bb');
  });
}
function lampSprite() {
  return sprite(40, 64, 20, 58, (x, o) => {
    box(x, o, 0, 0, 0, 0.1, 0.1, 30, '#5d6a74'); box(x, o, -0.5, 0, 28, 0.1, 0.1, 30, '#5d6a74'); box(x, o, -0.65, -0.05, 26.6, -0.3, 0.17, 28, '#e8e4cc');
  });
}
const FOLIAGE = {
  spring: { tones: ['#86c870', '#66ad5c', '#468f4c'], dots: '#f2a7c3', dp: 0.16 },
  summer: { tones: ['#4f8f45', '#3f7a3c', '#2f6234'], dots: '#79b25a', dp: 0.04 },
  autumn: { tones: ['#e6a842', '#cf8430', '#a85c26'], dots: '#c4462a', dp: 0.07 },
  winter: { tones: ['#8aa086', '#728a72', '#5c735e'], dots: '#f2a7c3', dp: 0.11, sparse: 0.28 },
};
const treeCache = {};
function treeSprite(seed) {
  const key = seed + state.season; if (treeCache[key]) return treeCache[key];
  const r = rng(seed), F = FOLIAGE[state.season];
  return (treeCache[key] = sprite(64, 70, 32, 62, (x, o) => {
    box(x, o, 0, 0, 0, 0.16, 0.16, 12, '#6b5640');
    const blobs = [[0, -18, 11], [-8, -14, 8], [8, -14, 8], [-3, -24, 8], [5, -23, 7], [0, -10, 9]];
    blobs.forEach(([bx, by, br]) => {
      for (let yy = -br; yy <= br; yy++) {
        const hw = Math.round(Math.sqrt(br * br - yy * yy)), tone = yy < -br / 3 ? F.tones[0] : yy < br / 3 ? F.tones[1] : F.tones[2];
        if (F.sparse) { for (let k = 0; k < hw * 2; k++) if (r() > F.sparse) { x.fillStyle = tone; x.fillRect(o.x + bx - hw + k, o.y + by + yy, 1, 1); } }
        else { x.fillStyle = tone; x.fillRect(o.x + bx - hw, o.y + by + yy, hw * 2, 1); }
        for (let k = 0; k < hw * 2; k++) if (r() < F.dp) { x.fillStyle = F.dots; x.fillRect(o.x + bx - hw + k, o.y + by + yy, 1, 1); }
      }
    });
  }));
}
function poleSprite() { return sprite(24, 56, 12, 52, (x, o) => { box(x, o, 0, 0, 0, 0.1, 0.1, 22, '#59636d'); }); }
function shelterSprite() {
  return sprite(100, 60, 28, 50, (x, o) => {
    [[0, 0], [2.4, 0], [0, 0.9], [2.4, 0.9]].forEach(([u, v]) => box(x, o, u, v, 0, u + 0.08, v + 0.08, 15, '#5d6a74'));
    box(x, o, -0.1, -0.1, 15, 2.6, 1.1, 16.5, { t: '#c9ccd0', l: '#8f949b', r: '#70757c' });
    faceR(x, o, 0.1, 0.9, 2.48, 3, 13, 'rgba(120,170,190,.45)'); faceL(x, o, 0.1, 2.4, 0.98, 3, 13, 'rgba(120,170,190,.35)');
    box(x, o, 0.2, 0.15, 0, 2.2, 0.45, 3.5, '#8f949b');
  });
}
// signal heads (billboards)
function headSprite(kind, state) {
  if (kind === 'ped') {
    return sprite(11, 20, 5, 19, (x) => {
      x.fillStyle = '#16171b'; x.fillRect(0, 0, 11, 20); x.fillStyle = '#26282e'; x.fillRect(1, 1, 9, 8); x.fillRect(1, 10, 9, 9);
      const on = state === 'red', og = state === 'green';
      const fig = (px, py, c, run) => { x.fillStyle = c; x.fillRect(px + 2, py, 2, 2); x.fillRect(px + 1, py + 2, 4, 3); if (run) { x.fillRect(px, py + 5, 2, 2); x.fillRect(px + 4, py + 5, 2, 2); } else { x.fillRect(px + 1, py + 5, 1, 3); x.fillRect(px + 4, py + 5, 1, 3); } };
      fig(2, 2, on ? '#ff4d3d' : '#3a1d1b', false); fig(2, 11, og ? '#47d16b' : '#16301e', true);
    });
  }
  return sprite(7, 22, 3, 21, (x) => {
    x.fillStyle = '#16171b'; x.fillRect(0, 0, 7, 22);
    [['#ff3b30', 'red'], ['#ffb000', 'amber'], ['#38d66b', 'green']].forEach(([c, n], i) => { x.fillStyle = state === n ? c : shade(c, 0.22); x.fillRect(1, 1 + i * 7, 5, 5); });
  });
}
const heads = { ped: { red: headSprite('ped', 'red'), green: headSprite('ped', 'green'), off: headSprite('ped', 'off') }, car: { red: headSprite('car', 'red'), amber: headSprite('car', 'amber'), green: headSprite('car', 'green') } };

const props = [], lamps = [];
function addProp(spr, u, v, z) { props.push({ spr, u, v, z: z || 0 }); }
function benchSprite() { return sprite(48, 28, 12, 22, (x, o) => { box(x, o, 0, 0, 3, 1.2, 0.45, 4.5, '#8a6a46'); box(x, o, 0, 0, 4.5, 1.2, 0.08, 8, '#7a5c3c'); box(x, o, 0.05, 0.05, 0, 0.12, 0.35, 3, '#444a52'); box(x, o, 1.05, 0.05, 0, 1.17, 0.35, 3, '#444a52'); }); }
function stallSprite(col) { // a dai pai dong: striped awning over a counter
  return sprite(80, 56, 20, 46, (x, o) => {
    box(x, o, 0, 0, 0, 2.0, 1.1, 7, '#8f949b'); box(x, o, 0.1, 0.1, 7, 1.9, 1.0, 8.4, '#c9c2ad');
    for (let u = 0; u < 2.0; u += 0.4) box(x, o, u - 0.1, -0.15, 15, u + 0.3, 1.35, 16.4, { t: (u / 0.4) & 1 ? '#f2f2f2' : col, l: (u / 0.4) & 1 ? '#d8d8d8' : shade(col, 0.82), r: shade(col, 0.66) });
    [[0, 0], [1.9, 0], [0, 1.05], [1.9, 1.05]].forEach(([u, v]) => box(x, o, u, v, 7, u + 0.07, v + 0.07, 15, '#59636d'));
    box(x, o, 0.5, 0.2, 8.4, 1.1, 0.7, 10.4, '#d8453a');
  });
}
function buildProps() {
  props.length = 0; lamps.length = 0;
  const K = CFG.kerb, gs = guardSprite(), seen = (u, v) => { const [x, y] = [OX + (u - v) * 16, OY + (u + v) * 8]; return x > -70 && x < W + 70 && y > -40 && y < H + 90; };
  const add = (spr, u, v, z) => { if (seen(u, v)) addProp(spr, u, v, z); };
  for (let u = Math.floor(UL - 2); u < UR + 2; u++) { const inZ = u + 1 > 5.8 && u < 9.2; if (!inZ) { add(gs, u, CFG.farP - 0.16, K); add(gs, u, CFG.road + 0.1, K); } }
  const ls = lampSprite();
  for (let u = -9.4; u < UR; u += 9) { if (seen(u, 3.0)) { addProp(ls, u, 3.0, K); lamps.push([u - 0.5, 3.0]); } const un = u + 4.3; if (seen(un, 10.6)) { addProp(ls, un, 10.6, K); lamps.push([un - 0.5, 10.6]); } }
  [-8.5, -2.4, 3.1, 11.7, 17.4, 23].forEach((u, i) => add(treeSprite(11 + i * 7), u, 3.3 + (i % 2) * 0.15, K));
  [-7.2, -1.1, 14.6, 20.8].forEach((u, i) => add(treeSprite(41 + i * 5), u, 10.3, K));
  add(shelterSprite(), 10.2, 9.5, K);
  const pl = poleSprite();
  [[5.5, 4.25], [9.4, 4.25], [5.5, 9.4], [9.4, 9.4]].forEach(([u, v]) => addProp(pl, u, v, K));
  // the plaza: trees, benches, a couple of dai pai dong, scattered with a seeded rng
  const r = rng(77), spots = [], bs = benchSprite(), sc = ['#d8453a', '#3a9a5c', '#e0a030'];
  for (let i = 0, n = 0; i < 160 && n < 40; i++) {
    const u = UL + 2 + r() * (LAND_U() ), v = 13 + r() * 9; if (!seen(u, v) || spots.some(([a, b]) => Math.hypot(a - u, (b - v) * 1.2) < 2.4)) continue;
    spots.push([u, v]); n++; const k = r();
    if (k < 0.55) addProp(treeSprite(100 + n * 13), u, v, K); else if (k < 0.8) addProp(bs, u, v, K); else if (k < 0.92) addProp(stallSprite(sc[n % 3]), u, v, K); else { addProp(ls, u, v, K); lamps.push([u - 0.5, v]); }
  }
}
function LAND_U() { return UR - UL - 4; }
buildProps();



// ---------------------------------------------------------------- pedestrians (tiny billboards, 12px tall adults)
const SKIN = ['#f1cba2', '#e2b186', '#c99067', '#8d5d3f'];
const HAIR = ['#1b1b1f', '#1b1b1f', '#2a211c', '#3a2a20', '#b9b5ae'];
const CASUAL = ['#e05a4a', '#4a90d9', '#59b36a', '#e9c445', '#9a6ad8', '#2e2e36', '#d9d9d9', '#f08a4b'];
const FLORAL = ['#d98aa5', '#7fb069', '#e0c05a', '#6aa0d0', '#c97dc4'];
const UMB = ['#26262c', '#26262c', '#e8e0c8', '#d98aa5', '#4a6fa5'];
const SEASON_CLOTHES = {
  spring: { casual: ['#f0a8b8', '#a8d8a0', '#f0e08a', '#a8c8f0', '#d8b0e8', '#ffffff', '#4a90d9'], umb: 0.25, shorts: 0.15, scarf: 0 },
  summer: { casual: ['#ff6a5a', '#3aa0e8', '#ffd23d', '#59d27a', '#ffffff', '#ff8fc0', '#f08a4b'], umb: 0.38, shorts: 0.5, scarf: 0 },
  autumn: { casual: ['#c9702e', '#8a4a2a', '#d8a838', '#6b7a3a', '#4a3f35', '#b8503a', '#2e2e36'], umb: 0.12, shorts: 0.05, scarf: 0.15 },
  winter: { casual: ['#2e2e36', '#4a3f35', '#6b2f35', '#3a4a5a', '#7a7a82', '#8a5a3a', '#1f2a44'], umb: 0.08, shorts: 0, scarf: 0.55 },
};
let LOOKS = [];
function makeLooks() {
  const C = SEASON_CLOTHES[state.season], r = rng(99), out = [], pick = (a) => a[Math.floor(r() * a.length)];
  for (let i = 0; i < 36; i++) {
    const k = r(), kind = k < 0.28 ? 'worker' : k < 0.42 ? 'school' : k < 0.55 ? 'auntie' : k < 0.65 ? 'tourist' : k < 0.72 ? 'rider' : 'casual';
    const L = { kind, skin: pick(SKIN), hair: kind === 'auntie' && r() < 0.6 ? '#b9b5ae' : pick(HAIR), umb: r() < C.umb ? pick(UMB) : null, kid: kind === 'school' };
    if (kind === 'worker') { L.top = r() < 0.5 ? '#2b3140' : '#e6e6ea'; L.tie = pick(['#c8342b', '#3a5f9a', '#2a2e36']); L.pants = '#262a35'; }
    else if (kind === 'school') { L.top = '#ececf0'; L.pants = '#56627a'; L.pack = pick(['#d8453a', '#3a6fb0', '#e0a030', '#3a9a5c']); L.shorts = r() < C.shorts; }
    else if (kind === 'auntie') { L.top = pick(FLORAL); L.pants = '#48455f'; L.bag = r() < 0.6; }
    else if (kind === 'tourist') { L.top = pick(C.casual); L.pants = '#c9b88c'; L.hat = '#e8d9a0'; L.pack = '#3b5f9a'; L.shorts = r() < C.shorts; }
    else if (kind === 'rider') { L.top = r() < 0.5 ? '#ff2b85' : '#00b8a9'; L.pants = '#26262c'; L.hat = '#26262c'; L.pack = L.top; L.box = true; }
    else { L.top = pick(C.casual); L.pants = state.season === 'winter' ? pick(['#2c3a5a', '#3a3a40', '#2a2a30']) : pick(['#2c3a5a', '#3a3a40', '#6b5a4a']); L.shorts = r() < C.shorts; }
    if (!L.kid && kind !== 'rider' && r() < C.scarf) L.scarf = pick(['#c8342b', '#3a5f9a', '#e0c05a', '#59b36a']);
    out.push(L);
  }
  return out;
}
LOOKS = makeLooks();

const pedCache = {};
function pedSprite(li, facing, frame) {
  const key = li + facing + frame; if (pedCache[key]) return pedCache[key];
  const L = LOOKS[li], AX = 9, AY = 28; // feet row is AY, sprite x centre AX
  const [c, x] = canvasOf(18, 32);
  const kid = L.kid, legH = kid ? 3 : 5, torH = kid ? 3 : 4, top = AY - (3 + torH + legH) + 1;
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(AX - 3 + px, top + py, w, h); };
  const shoes = '#1d1d22', side = facing === 's';
  const lA = frame === 0 ? legH : frame === 2 ? legH - 1 : legH, lB = frame === 2 ? legH : frame === 0 ? legH - 1 : legH, gap = frame === 1 || frame === 3;
  // legs
  const ty = 3 + torH;
  const leg = (px, h, col) => { const ph = L.shorts ? Math.min(2, h) : h; R(px, ty, 2, ph, col); if (L.shorts && h > ph) R(px, ty + ph, 2, h - ph, L.skin); R(px, ty + h - 1, 2, 1, shoes); };
  if (side) { leg(1 + (gap ? 1 : 0), lA, shade(L.pants, 0.85)); leg(3 - (gap ? 1 : 0), lB, L.pants); }
  else { leg(1, lA, L.pants); leg(3, lB, L.pants); }
  // backpack / box behind or in front
  const back = facing === 'b';
  if (L.pack && back) R(L.box ? -1 : 0, 3, L.box ? 8 : 6, L.box ? 6 : 5, L.box ? shade(L.pack, 0.8) : L.pack);
  if (L.pack && side) R(L.box ? -1 : 0, 3, L.box ? 3 : 2, L.box ? 6 : 5, L.box ? shade(L.pack, 0.8) : L.pack);
  // torso + arms
  const sleeve = L.kind === 'worker' && L.top === '#2b3140' ? L.top : shade(L.top, 0.88);
  if (side) { R(1, 3, 4, torH, L.top); R(2 + (frame === 0 ? 1 : frame === 2 ? -1 : 0), 3, 2, torH, sleeve); R(2 + (frame === 0 ? 1 : frame === 2 ? -1 : 0), 3 + torH - 1, 2, 1, L.skin); }
  else {
    R(0, 3, 6, torH, L.top); R(0, 3 + torH - 1, 1, 1, L.skin); R(5, 3 + torH - 1, 1, 1, L.skin);
    if (L.kind === 'worker' && L.top !== '#2b3140' && facing === 'f') R(2, 3, 2, torH - 1, L.tie);
    if (L.kind === 'worker' && L.top === '#2b3140' && facing === 'f') R(2, 3, 2, 2, '#e6e6ea');
    if (L.pack && facing === 'f' && !L.box) { R(1, 3, 1, torH - 1, shade(L.pack, 0.9)); R(4, 3, 1, torH - 1, shade(L.pack, 0.9)); }
    if (L.pack && L.box && facing === 'f') R(1, 3, 4, 1, L.pack);
    if (L.kind === 'auntie' && L.bag && facing === 'f') { R(5, 3 + torH, 1, 1, '#d8453a'); R(5, 3 + torH + 1, 1, 1, '#f2f2f2'); R(5, 3 + torH + 2, 1, 1, '#3a6fb0'); R(6, 3 + torH, 1, 3, '#d8453a'); }
  }
  if (L.scarf) R(side ? 1 : 0, 3, side ? 4 : 6, 1, L.scarf);
  // head
  if (side) { R(1, 0, 4, 1, L.hair); R(1, 1, 3, 1, L.hair); R(4, 1, 1, 1, L.skin); R(1, 2, 1, 1, L.hair); R(2, 2, 3, 1, L.skin); }
  else if (back) { R(1, 0, 4, 3, L.hair); }
  else { R(1, 0, 4, 1, L.hair); R(1, 1, 4, 2, L.skin); R(1, 1, 1, 1, L.hair); R(4, 1, 1, 1, L.hair); }
  if (L.hat) { if (L.kind === 'rider') { R(1, -1, 4, 1, L.hat); R(1, 0, 4, 1, L.hat); } else { R(0, 0, 6, 1, L.hat); R(1, -1, 4, 1, L.hat); } }
  // umbrella
  if (L.umb) { R(-3, -1, 12, 1, L.umb); R(-2, -2, 10, 1, L.umb); R(0, -3, 6, 1, L.umb); R(3, 0, 1, 3, '#54565c'); }
  if (facing === 's-flip') {}
  const out = { c, ax: AX, ay: AY + 1 };
  return (pedCache[key] = out);
}
function pedSpriteDir(li, facing, frame, flip) {
  if (!flip) return pedSprite(li, facing, frame);
  const key = li + facing + frame + 'F'; if (pedCache[key]) return pedCache[key];
  const base = pedSprite(li, facing, frame), [c, x] = canvasOf(18, 32); x.translate(18, 0); x.scale(-1, 1); x.drawImage(base.c, 0, 0);
  return (pedCache[key] = { c, ax: 18 - base.ax, ay: base.ay });
}

const PU0 = -11, PU1 = 25;   // pedestrians enter and leave just outside the canvas
const PED = { nearV: [9.3, 10.6], farV: [3.0, 4.2], kerbNear: 9.25, kerbFar: 4.35, cap: 80 };
function newPed(o) { return Object.assign({ u: 0, v: 0, look: Math.floor(rnd() * LOOKS.length), spd: 1.3, mode: 'walkU', du: 1, dv: 0, delay: 0, a: 0, t: rnd() * 10, sway: rnd() * 6.28, side: 'near' }, o); }
function baseSpeed(look) { const k = LOOKS[look].kind; return k === 'auntie' ? 0.85 + rnd() * 0.3 : k === 'school' ? 1.5 + rnd() * 0.5 : k === 'rider' ? 1.7 + rnd() * 0.5 : k === 'tourist' ? 1.0 + rnd() * 0.3 : 1.3 + rnd() * 0.5; }
function slot(side) {
  for (let tries = 0; tries < 12; tries++) {
    const u = CFG.zebra[0] + 0.05 + rnd() * (CFG.zebra[1] - CFG.zebra[0] - 0.1), v = side === 'near' ? 9.3 + rnd() * 1.1 : 3.1 + rnd() * 1.15;
    let ok = true; for (const q of peds) if (q.mode === 'wait' && q.side === side && Math.abs(q.u - u) < 0.28 && Math.abs(q.v - v) < 0.32) { ok = false; break; }
    if (ok) return [u, v];
  }
  return [CFG.zebra[0] + rnd() * 3, side === 'near' ? 9.4 + rnd() : 3.2 + rnd()];
}
function spawnStroller(side, dir) {
  const v = side === 'near' ? 9.5 + rnd() * 1.0 : 3.1 + rnd() * 1.0, look = Math.floor(rnd() * LOOKS.length);
  peds.push(newPed({ u: dir > 0 ? PU0 : PU1, v, look, side, mode: 'walkU', du: dir, spd: 0.55 + rnd() * 0.45 }));
}
function spawnGather(side) {                         // arrives from the pavement and joins the crowd at the kerb
  const dir = rnd() < 0.5 ? 1 : -1, [u, v] = slot(side), look = Math.floor(rnd() * LOOKS.length);
  peds.push(newPed({ u: u - dir * (2 + rnd() * 3), v: v, look, side, mode: 'gather', tu: u, tv: v, du: dir, spd: 1.0 + rnd() * 0.5 }));
}
function release(p, delay) {
  const dv = p.side === 'near' ? -1 : 1;
  Object.assign(p, { mode: 'cross', dv, delay, spd: baseSpeed(p.look), v0: p.v });
}
function onPhase(p) {
  if (p === 'walk') { peds.forEach((q) => { if (q.mode === 'wait' || q.mode === 'gather') release(q, rnd() * 1.2); }); state.rush = 3.2; }
  if (p === 'clear') { state.rush = 0; for (let i = 0; i < 4; i++) { const side = rnd() < 0.5 ? 'near' : 'far', [u] = slot(side); peds.push(newPed({ u, v: side === 'near' ? 9.6 : 3.9, side, mode: 'cross', dv: side === 'near' ? -1 : 1, spd: 2.2 + rnd() * 0.4, delay: i * 0.5, a: 0 })); } }
  if (p === 'wait') state.rush = 0;
}
function stepPeds(dt) {
  const waiting = { near: 0, far: 0 }; let strollers = 0;
  peds.forEach((q) => { if (q.mode === 'wait' || q.mode === 'gather') waiting[q.side]++; if (q.mode === 'walkU') strollers++; });
  // targets for who is hanging around the kerb
  const want = state.phase === 'wait' ? 11 : state.phase === 'off' ? 3 : 0;
  ['near', 'far'].forEach((side) => { if (waiting[side] < want && peds.length < PED.cap && rnd() < dt * (state.phase === 'wait' ? 3 : 0.7)) spawnGather(side); });
  if (strollers < 9 && rnd() < dt * 0.8) spawnStroller(rnd() < 0.5 ? 'near' : 'far', rnd() < 0.5 ? 1 : -1);
  if (state.phase === 'walk' && state.rush > 0 && peds.length < PED.cap) {          // the scramble: HK crowds pour onto the crossing
    state.rush -= dt;
    if (rnd() < dt * 7) { const side = rnd() < 0.5 ? 'near' : 'far', [u, v] = slot(side); const q = newPed({ u, v: side === 'near' ? 9.4 : 4.1, side, mode: 'cross', dv: side === 'near' ? -1 : 1, a: 0 }); q.spd = baseSpeed(q.look); peds.push(q); }
  }
  for (let i = peds.length - 1; i >= 0; i--) {
    const q = peds[i]; q.t += dt;
    if (q.a < 1) q.a = Math.min(1, q.a + dt * 2.5);
    if (q.mode === 'walkU' || q.mode === 'exit') {
      q.u += q.du * q.spd * dt;
      if (q.mode === 'exit') { const tv = q.side === 'near' ? 9.4 + (q.look % 5) * 0.2 : 3.2 + (q.look % 5) * 0.2; q.v += Math.max(-1, Math.min(1, tv - q.v)) * dt * 0.8; }
      if (q.u < PU0 - 0.5 || q.u > PU1 + 0.5) peds.splice(i, 1);
    } else if (q.mode === 'gather') {
      const dx = q.tu - q.u, dy = q.tv - q.v, d = Math.hypot(dx, dy);
      if (d < 0.06) { q.mode = 'wait'; q.u = q.tu; q.v = q.tv; } else { q.u += dx / d * q.spd * dt; q.v += dy / d * q.spd * dt; }
    } else if (q.mode === 'cross') {
      if (q.delay > 0) { q.delay -= dt; continue; }
      const boost = state.phase === 'clear' ? 1.3 : 1;
      q.v += q.dv * q.spd * boost * dt; q.u += Math.sin(q.t * 2 + q.sway) * 0.05 * dt * 3;
      const end = q.dv < 0 ? PED.kerbFar - 0.15 : PED.kerbNear + 0.2;
      if ((q.dv < 0 && q.v <= end) || (q.dv > 0 && q.v >= end)) { q.mode = 'exit'; q.side = q.dv < 0 ? 'far' : 'near'; q.du = (rnd() < 0.5 ? 1 : -1) * (q.u < 7.5 ? -1 : 1) >= 0 ? 1 : -1; q.spd = 0.7 + rnd() * 0.4; }
    }
  }
}

// ---------------------------------------------------------------- traffic
const lanes = [
  { dir: 1, v: CFG.laneFar, stopS: CFG.stopFar - UL, list: [], next: 0.5 },
  { dir: -1, v: CFG.laneNear, stopS: UR - CFG.stopNear, list: [], next: 1.5 },
];
function pickVehicle(r) {
  const k = r();
  const type = k < 0.34 ? 'taxi' : k < 0.58 ? 'car' : k < 0.72 ? 'minibus' : k < 0.84 ? 'van' : 'bus';
  let col, ck;
  if (type === 'taxi') { col = { body: '#c8342b' }; ck = 'r'; }
  else if (type === 'car') { ck = Math.floor(r() * CAR_COLS.length); col = { body: CAR_COLS[ck] }; }
  else if (type === 'minibus') { const gr = r() < 0.5; col = { body: '#ece5cf', roof: gr ? '#3a9a5c' : '#c8342b' }; ck = gr ? 'g' : 'r'; }
  else if (type === 'van') { col = { body: '#e8e8ea' }; ck = 'w'; }
  else { col = { body: '#efe6c8' }; ck = 'k'; }
  return { type, col, ck };
}
const rnd = rng(Date.now() & 0xffff);
function spawn(l) {
  const v = pickVehicle(rnd), t = VT[v.type];
  const last = l.list[l.list.length - 1];
  if (last && last.s - last.len < t.len * 0 + 0.6 + 0.4) return false;
  l.list.push({ type: v.type, len: t.len, wid: t.wid, vmax: t.vmax * (0.9 + rnd() * 0.2), s: -0.2, sp: Math.min(t.vmax, 1.5), spr: vehSpr(v.type, v.ck, v.col, l.dir), lane: l });
  return true;
}
function pedsOnRoad() { for (const p of peds) if (p.v > CFG.farP - 0.25 && p.v < CFG.road + 0.25 && p.u > CFG.zebra[0] - 0.5 && p.u < CFG.zebra[1] + 0.5 && p.mode === 'cross') return true; return false; }
function stepTraffic(dt) {
  const block = pedsOnRoad();
  lanes.forEach((l) => {
    l.next -= dt;
    const gap = state.quietHours ? 6 : 2.2;
    if (l.next <= 0 && spawn(l)) l.next = (0.8 + rnd() * gap) * (state.night ? 1.4 : 1);
    for (let i = 0; i < l.list.length; i++) {
      const c = l.list[i], lead = l.list[i - 1];
      let d = 99;
      if (lead) d = Math.min(d, (lead.s - lead.len) - c.s - 0.45);
      const stopActive = state.car !== 'green' || block;
      const toStop = l.stopS - c.s;
      if (stopActive && toStop > -0.05) {
        const brake = c.sp * c.sp / (2 * 5.5);
        const mustStop = state.car === 'red' || block ? true : toStop > brake * 1.1;   // amber: carry on if too late to stop
        if (mustStop || toStop > 0) { if (mustStop) d = Math.min(d, toStop - 0.02); }
      }
      const allowed = Math.min(c.vmax, Math.sqrt(2 * 4.0 * Math.max(0, d)));
      c.sp += Math.max(-7 * dt, Math.min(2.4 * dt, allowed - c.sp));
      if (c.sp < 0) c.sp = 0;
      c.s += c.sp * dt;
    }
    while (l.list.length && l.list[0].s - l.list[0].len > LANE + 0.3) l.list.shift();
  });
}

// ---------------------------------------------------------------- time of day (same ?hour= override as the lab's quiet hours)

// ---------------------------------------------------------------- phase logic
function setPhase(p) { if (p === state.phase) return; state.from = state.phase; state.phase = p; state.t = 0; onPhase(p); }
function carSignal() {
  const p = state.phase, t = state.t;
  if (p === 'wait') return t < 1.0 ? 'green' : t < 2.0 ? 'amber' : 'red';
  if (p === 'walk' || p === 'clear') return 'red';
  if (state.from === 'clear' || state.from === 'walk') return t < 1.2 ? 'red' : 'green';
  return 'green';
}
function stepPhase(dt) {
  state.t += dt; state.car = carSignal();
  state.ped = state.phase === 'walk' ? 'green' : state.phase === 'clear' ? ((Math.floor(state.t * 2.5) & 1) ? 'off' : 'green') : 'red';
  if (state.pulse > 0) state.pulse -= dt;
}


// ---------------------------------------------------------------- night layer: lit windows, neon, lamps (pre-rendered), plus per-frame lights
let emis = null;
function glow(ctx, x, y, r, col, a) { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function buildEmissive() {
  const [c, x] = canvasOf(W, H);
  lit.forEach((w) => faceL(x, O, w.u0, w.u1, w.v, w.z0, w.z1, '#ffd98a'));
  buildings.forEach((b) => { faceL(x, O, b.u0 + 0.2, b.u1 - 0.2, CFG.farB, CFG.kerb + 0.5, CFG.kerb + GF - 2, '#ffcf80'); for (let u = b.u0 + 0.45; u < b.u1 - 0.5; u += 0.7) faceL(x, O, u, u + 0.28, CFG.farB, CFG.kerb + 1, CFG.kerb + GF - 3, '#ffe9b8'); });
  lanterns.forEach((l) => { const [px, py] = P(O, l.u + 0.21, CFG.farB + 0.25, l.z + 3.2); x.fillStyle = l.col; x.fillRect(Math.round(px) - 4, Math.round(py) - 3, 8, 7); });
  x.globalCompositeOperation = 'lighter';
  lanterns.forEach((l) => { const [px, py] = P(O, l.u + 0.21, CFG.farB + 0.25, l.z + 3.2), h = hex(l.col); glow(x, px, py, 18, `rgba(${h[0]},${h[1]},${h[2]},A)`, 0.55); });
  signs.forEach((sg) => { const [px, py] = P(O, sg.u + 0.1, (sg.v0 + sg.v1) / 2, (sg.z0 + sg.z1) / 2); const h = hex(sg.col); glow(x, px, py, 26, `rgba(${h[0]},${h[1]},${h[2]},A)`, 0.45); });
  lamps.forEach(([u, v]) => { const [px, py] = P(O, u, v, CFG.kerb + 27); glow(x, px, py, 22, 'rgba(255,240,190,A)', 0.55); const [gx, gy] = P(O, u, v, CFG.kerb); glow(x, gx, gy + 2, 34, 'rgba(255,236,170,A)', 0.22); });
  x.globalCompositeOperation = 'source-over';
  signs.forEach((sg) => drawSign(x, sg, true));
  // late night: a moon and a few stars, only where the sky is actually showing
  if (state.period === 'late') {
    const open = (px, py) => px >= 0 && px < W && py >= 0 && py < H && !maskSky[(py * W + px) * 4 + 3] && !maskWorld[(py * W + px) * 4 + 3];
    const r = rng(5); let n = 0;
    for (let i = 0; i < 700 && n < 60; i++) { const px = Math.floor(r() * W), py = Math.floor(r() * 230); if (open(px, py)) { x.fillStyle = r() < 0.25 ? '#ffffff' : 'rgba(255,255,255,.7)'; x.fillRect(px, py, 1, 1); n++; } }
    for (const [mx, my] of [[440, 70], [470, 120], [400, 45], [300, 40], [450, 170]]) if (open(mx, my) && open(mx + 8, my + 8) && open(mx - 8, my - 8)) {
      x.globalCompositeOperation = 'lighter'; glow(x, mx, my, 26, 'rgba(235,240,255,A)', 0.35); x.globalCompositeOperation = 'source-over';
      x.fillStyle = '#f4f1de'; for (let yy = -7; yy <= 7; yy++) { const hw = Math.round(Math.sqrt(49 - yy * yy)); x.fillRect(mx - hw, my + yy, hw * 2, 1); }
      x.fillStyle = '#d9d5bd'; x.fillRect(mx - 3, my - 3, 2, 2); x.fillRect(mx + 2, my + 2, 3, 2); break;
    }
  }
  emis = c;
}
function drawLights() {
  g.globalCompositeOperation = 'lighter';
  lanes.forEach((l) => l.list.forEach((c) => {
    const umin = l.dir > 0 ? UL + c.s - c.len : UR - c.s, vc = l.v, fu = l.dir > 0 ? umin + c.len : umin;
    const a = fadeOf(c);
    g.globalAlpha = a;
    // headlight beam on the road
    const bl = 2.6 * l.dir, q = [P(O, fu, vc - 0.28, 0), P(O, fu, vc + 0.28, 0), P(O, fu + bl, vc + 0.95, 0), P(O, fu + bl, vc - 0.95, 0)];
    poly(g, [q[0][0] - camX, q[0][1], q[1][0] - camX, q[1][1], q[2][0] - camX, q[2][1], q[3][0] - camX, q[3][1]], 'rgba(255,238,170,.16)');
    // lamps on the visible +u end: white at the front, red at the back
    const back = l.dir < 0, zb = c.type === 'bus' ? 5.5 : c.type === 'taxi' || c.type === 'car' ? 4 : 8;
    const col = back ? '#ff3b30' : '#fff4c0', ue = umin + c.len;
    [vc - c.wid / 2 + 0.2, vc + c.wid / 2 - 0.2].forEach((vv) => { const [px, py] = P(O, ue, vv, zb); g.fillStyle = col; g.fillRect(Math.round(px) - 1 - camX, Math.round(py) - 1, 3, 2); glow(g, px - camX, py, 9, back ? 'rgba(255,60,40,A)' : 'rgba(255,240,190,A)', 0.5); });
    g.globalAlpha = 1;
  }));
  g.globalCompositeOperation = 'source-over';
}


// ---------------------------------------------------------------- seasonal particles (petals in spring, leaves in autumn)
const fx = [];
function resetFx() {
  fx.length = 0; const n = state.season === 'spring' ? 22 : state.season === 'autumn' ? 18 : 0, r = rng(21);
  const cols = state.season === 'spring' ? ['#f6b5cc', '#f2a7c3', '#ffffff'] : ['#d9782c', '#c4462a', '#e0a030', '#8a5a2a'];
  for (let i = 0; i < n; i++) fx.push({ x: r() * W, y: r() * H, vy: 7 + r() * 9, vx: 4 + r() * 6, ph: r() * 6.28, col: cols[i % cols.length], w: r() < 0.5 ? 2 : 1 });
}
function stepFx(dt) { for (const f of fx) { f.y += f.vy * dt; f.x += (f.vx + Math.sin(f.ph + f.y * 0.05) * 6) * dt; if (f.y > H) { f.y = -2; f.x = Math.random() * W; } if (f.x > W) f.x = 0; } }
function drawFx() { for (const f of fx) { g.fillStyle = f.col; g.fillRect(Math.round(f.x) - camX, Math.round(f.y), f.w, 1); } }

// ---------------------------------------------------------------- draw
const items = [], headItems = [];
let camX = 0;
function toScreen(u, v, z) { return [OX + (u - v) * 16, OY + (u + v) * 8 - (z || 0)]; }
function fadeOf(c) { return Math.max(0, Math.min(1, Math.min(c.s / 1.0, (LANE + 0.2 - c.s) / 1.0))); }   // (ends are off-canvas; this only guards the edge)
function collect() {
  items.length = 0; headItems.length = 0;
  props.forEach((p) => { const [x, y] = toScreen(p.u, p.v, p.z); items.push({ k: p.u + p.v, c: p.spr.c, x: Math.round(x - p.spr.ax), y: Math.round(y - p.spr.ay), a: 1 }); });
  // signal heads on top of the poles
  const hp = state.ped === 'green' ? heads.ped.green : state.ped === 'off' ? heads.ped.off : heads.ped.red;
  [[5.5, 4.25], [9.4, 4.25]].forEach(([u, v]) => { const [x, y] = toScreen(u + 0.05, v + 0.05, CFG.kerb + 22); const it = { k: u + v + 0.01, c: hp.c, x: Math.round(x - hp.ax), y: Math.round(y - hp.ay + 8), a: 1 }; items.push(it); headItems.push(it); });
  const ch = heads.car[state.car];
  [[9.7, 4.5], [5.3, 9.2]].forEach(([u, v]) => { const [x, y] = toScreen(u, v, CFG.kerb + 22); const it = { k: u + v + 0.01, c: ch.c, x: Math.round(x - ch.ax), y: Math.round(y - ch.ay + 8), a: 1 }; items.push(it); headItems.push(it); });
  peds.forEach((q) => {
    if (q.mode === 'cross' && q.delay > 0 && false) return;
    const onPave = q.v > CFG.road || q.v < CFG.farP, kz = CFG.kerb;
    let z = onPave ? kz : 0; const e1 = Math.abs(q.v - CFG.road), e2 = Math.abs(q.v - CFG.farP);
    if (e1 < 0.3 || e2 < 0.3) z = kz * Math.min(1, Math.min(e1, e2) / 0.3 * 0 + (onPave ? 1 : 0)) ;
    const [x, y] = toScreen(q.u, q.v, z);
    const walking = q.mode === 'walkU' || q.mode === 'exit' || q.mode === 'gather' || (q.mode === 'cross' && q.delay <= 0);
    const frame = walking ? Math.floor(q.t * q.spd * 2.4) & 3 : 1;
    const along = q.mode === 'walkU' || q.mode === 'exit' || (q.mode === 'gather');
    let facing, flip = false;
    if (q.mode === 'cross') facing = q.dv > 0 ? 'f' : 'b';
    else if (q.mode === 'wait') facing = q.side === 'near' ? 'b' : 'f';
    else { facing = 's'; flip = q.du < 0; }
    const sp = pedSpriteDir(q.look, facing, frame, flip), bob = walking && (frame & 1) === 0 ? 0 : 0;
    items.push({ k: q.u + q.v + 0.02, c: sp.c, x: Math.round(x - sp.ax), y: Math.round(y - sp.ay + bob), a: Math.min(q.a, Math.max(0, Math.min(1, Math.min(q.u - PU0 + 0.3, PU1 + 0.3 - q.u) / 1.0))) });
  });
  lanes.forEach((l) => l.list.forEach((c) => {
    const umin = l.dir > 0 ? UL + c.s - c.len : UR - c.s, [x, y] = toScreen(umin, l.v - c.wid / 2, 0);
    const a = fadeOf(c);
    items.push({ k: umin + c.len / 2 + l.v, c: c.spr.c, x: Math.round(x - c.spr.ax), y: Math.round(y - c.spr.ay), a });
  }));
  items.sort((a, b) => a.k - b.k);
}
function render() {
  g.drawImage(staticDay, -camX, 0);
  collect();
  for (const it of items) { if (it.a < 1) g.globalAlpha = it.a; g.drawImage(it.c, it.x - camX, it.y); if (it.a < 1) g.globalAlpha = 1; }
  drawFx();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = tintFor(); g.fillRect(0, 0, cv.width, H); g.globalCompositeOperation = 'source-over';
  if (state.night) {
    g.drawImage(emis, -camX, 0);
    for (const it of headItems) g.drawImage(it.c, it.x - camX, it.y);
    drawLights();
  }
}

// ---------------------------------------------------------------- loop
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = 0, raf = 0, visible = true;
function step(dt) { stepPhase(dt); stepTraffic(dt); stepPeds(dt); stepFx(dt); }
function frame(now) {
  raf = 0; if (!visible || document.hidden) { last = 0; return; }
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
  step(dt); render(); raf = requestAnimationFrame(frame);
}
function start() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
function warm(sec) { for (let t = 0; t < sec; t += 0.05) step(0.05); }
if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) start(); }).observe(cv);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; start(); } });

resetFx(); buildStatic(); buildEmissive();
warm(32);
{ // ?phase=wait|walk|clear: preview a moment of the crossing (silent), for screenshots
  const q = new URLSearchParams(location.search).get('phase');
  if (q === 'wait' || q === 'walk' || q === 'clear') {
    setPhase('wait'); warm(q === 'wait' ? 3.4 : 4.2);
    if (q !== 'wait') { setPhase('walk'); warm(q === 'walk' ? 3.2 : 7); }
    if (q === 'clear') { setPhase('clear'); warm(1.6); }
  }
}
render();
if (reduce) { /* static: render again after each phase change */ } else start();

const DESC = {
  off: 'Traffic flows past a pedestrian crossing while a few people wait on the pavements.',
  wait: 'The car lights are turning red as a crowd gathers at both kerbs.',
  walk: 'Cars are stopped at the lights. A crowd of pedestrians crosses the zebra crossing.',
  clear: 'The green man is flashing. The last pedestrians hurry across.',
};
function describe() { const t = { morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening with neon signs lit', late: 'late at night with neon signs lit' }[state.period]; cv.setAttribute('aria-label', 'An isometric pixel-art street in Hong Kong in ' + state.season + ', ' + t + '. ' + (DESC[state.phase] || '')); }
// phones get a tighter crop of the same scene so the pixels stay close to 1:1
function fit() {
  const w = cv.parentElement.clientWidth, vw = w >= 600 ? W : 360;
  if (cv.width !== vw) { cv.width = vw; cv.height = H; camX = Math.max(0, Math.min(W - vw, CFG.cx - vw / 2)); g.imageSmoothingEnabled = false; render(); }
}
function rebuildClock() {          // the look follows the clock: rebuild when the period or season changes
  treeCache && Object.keys(treeCache).forEach((k) => delete treeCache[k]); Object.keys(pedCache).forEach((k) => delete pedCache[k]);
  LOOKS = makeLooks(); buildProps(); resetFx(); buildStatic(); buildEmissive(); describe(); render();
}
setInterval(() => { if (applyClock()) rebuildClock(); }, 30000);
if ('ResizeObserver' in window) new ResizeObserver(fit).observe(cv.parentElement); fit(); describe();

window.HKG_SCENE = {
  setPhase(p) { setPhase(p); describe(); if (reduce) { warm(3); render(); } },
  pulse() { state.pulse = 0.05; },
  // debug: put a vehicle of a given type on lane li at progress s (used to check sprites)
  force(li, type, s0) { const l = lanes[li], t = VT[type], col = type === 'bus' ? { body: '#efe6c8' } : type === 'taxi' ? { body: '#c8342b' } : { body: '#e8e8ea', roof: '#c8342b' }; l.list.push({ type, len: t.len, wid: t.wid, vmax: t.vmax, s: s0, sp: 0, spr: vehSpr(type, 'dbg', col, l.dir), lane: l }); l.list.sort((a, b) => b.s - a.s); render(); },
  setClock(hour, season) { if (hour !== undefined) QS.set('hour', hour); if (season) QS.set('season', season); if (applyClock()) rebuildClock(); else render(); },
  render, warm, state, lanes, peds, CFG,
};
})();
