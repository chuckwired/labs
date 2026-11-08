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
  W: 512, H: 288, OX: 232, OY: 74,      // canvas size and where world (0,0,0) lands
  U: 14,                                 // length of the street in tiles
  kerb: 3, base: 10,                     // kerb height and diorama thickness in px
  farB: 2.5, farP: 4.5, road: 9, nearP: 11, // v boundaries: buildings | far pavement | road | near pavement
  zebra: [6, 9],                         // u range of the crossing
  laneFar: 5.55, laneNear: 7.95,         // v centre of each lane
  stopFar: 5.6, stopNear: 9.4,           // stop lines (u) for the +u lane and the -u lane
};
const { W, H, OX, OY, U } = CFG;

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
  asphalt: '#44464e', asphalt2: '#3f4149', line: '#e8e7e0', yellow: '#e2bb3a',
  pave1: '#cdc7b8', pave2: '#c4bead', kerb: '#aaa492', soil: '#8b8676', soil2: '#6e6a5d',
  glass: '#4d6671', glass2: '#6b8996', shop: '#2b2f37',
};
const NEON = ['#ff3d7f', '#29d3ff', '#ffd23d', '#7dff6b', '#ff7a2e'];

// ---------------------------------------------------------------- static scene (pre-rendered once)
const buildings = [
  { u0: 0.0, u1: 2.8, fl: 10, c: '#cfc1a2', aw: '#b5342a', roof: 'tank' },
  { u0: 2.8, u1: 5.2, fl: 8, c: '#b9cfc3', aw: '#2e7d6b', roof: 'ant' },
  { u0: 5.2, u1: 8.4, fl: 11, c: '#dbb9b1', aw: '#e0a030', roof: 'tank', scaf: true },
  { u0: 8.4, u1: 10.8, fl: 7, c: '#b8c3d3', aw: '#c8342b', roof: 'ant' },
  { u0: 10.8, u1: 14.0, fl: 9, c: '#d8d2b2', aw: '#3b6fb0', roof: 'tank' },
];
const FH = 7, GF = 11;           // floor height, ground floor height (px)
const lit = [];                  // lit windows / neon, for the night layer: {kind, ...}
const signs = [];                // neon signs {u, z0, z1, col}

function drawBackdrop(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9fc0d6'); sky.addColorStop(0.55, '#d9e1e0'); sky.addColorStop(1, '#ece4cf');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const r = rng(7);
  // the peak
  ctx.fillStyle = '#9bb5ae';
  poly(ctx, [0, 150, 70, 96, 130, 120, 210, 70, 300, 112, 380, 84, 470, 118, 512, 100, 512, 200, 0, 200], '#a9bdb8');
  // far tower blocks (hazy)
  for (let x = -10; x < W; x += 14 + Math.floor(r() * 16)) {
    const w = 12 + Math.floor(r() * 16), h = 40 + Math.floor(r() * 90);
    ctx.fillStyle = mix('#b6c4cc', '#9eb0bc', r()); ctx.fillRect(x, 175 - h, w, h + 60);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let yy = 175 - h + 4; yy < 175; yy += 6) ctx.fillRect(x + 2, yy, w - 4, 1);
  }
  // haze
  const hz = ctx.createLinearGradient(0, 120, 0, 215); hz.addColorStop(0, 'rgba(236,228,207,0)'); hz.addColorStop(1, 'rgba(236,228,207,.85)');
  ctx.fillStyle = hz; ctx.fillRect(0, 120, W, 95);
  ctx.fillStyle = '#ece4cf'; ctx.fillRect(0, 215, W, H - 215);
}

function drawGround(ctx) {
  const { farB, farP, road, nearP, kerb, base } = CFG;
  // diorama base (soil) faces
  faceL(ctx, O, 0, U, nearP, -base, kerb, PAL.soil);
  const segs = [[0, farB, kerb], [farB, farP, kerb], [farP, road, 0], [road, nearP, kerb]];
  segs.forEach(([a, b, z]) => faceR(ctx, O, a, b, U, -base, z, PAL.soil2));
  // lower rim shadow line
  faceL(ctx, O, 0, U, nearP, -base, -base + 1, shade(PAL.soil, 0.7));
  // buildings plot + pavements (checker tiles)
  for (let u = 0; u < U; u++) {
    for (let v = 0; v < 2; v++) {
      flat(ctx, O, u, u + 1, farB + v, farB + v + 1, kerb, (u + v) & 1 ? PAL.pave1 : PAL.pave2);
      flat(ctx, O, u, u + 1, road + v, road + v + 1, kerb, (u + v) & 1 ? PAL.pave1 : PAL.pave2);
    }
  }
  // kerb face of the far pavement (faces the road)
  faceL(ctx, O, 0, U, farP, 0, kerb, PAL.kerb);
  // road
  flat(ctx, O, 0, U, farP, road, 0, PAL.asphalt);
  const r = rng(3);
  for (let i = 0; i < 70; i++) { const u = r() * (U - 1), v = farP + r() * (road - farP - 0.4); flat(ctx, O, u, u + 0.5 + r(), v, v + 0.25, 0, PAL.asphalt2); }
  // markings: yellow kerb lines, dashed centre line, zebra, stop lines
  flat(ctx, O, 0, U, farP + 0.05, farP + 0.12, 0, PAL.yellow); flat(ctx, O, 0, U, farP + 0.2, farP + 0.27, 0, PAL.yellow);
  flat(ctx, O, 0, U, road - 0.12, road - 0.05, 0, PAL.yellow); flat(ctx, O, 0, U, road - 0.27, road - 0.2, 0, PAL.yellow);
  for (let u = 0.3; u < U - 0.5; u += 1.5) { if (u + 0.8 > CFG.zebra[0] - 0.4 && u < CFG.zebra[1] + 0.4) continue; flat(ctx, O, u, u + 0.8, 6.72, 6.8, 0, PAL.line); }
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
  // end wall (visible on the last building)
  if (b.u1 >= U - 0.01) for (let f = 1; f < b.fl; f++) for (let w = 0; w < 2; w++) { const vv = 0.45 + w * 1.0, zz = z0 + GF + (f - 1) * FH + 2; faceR(ctx, O, vv, vv + 0.5, U, zz, zz + 3.6, PAL.glass); }
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

let staticDay = null;
function buildStatic() {
  const [c, x] = canvasOf(W, H);
  drawBackdrop(x); drawGround(x);
  lit.length = 0; signs.length = 0;
  buildings.forEach((b, i) => drawBuilding(x, b, i));
  signs.forEach(s => drawSign(x, s, false));
  staticDay = c;
}

// ---------------------------------------------------------------- sprites (pre-rendered iso boxes)
function sprite(w, h, ax, ay, fn) { const [c, x] = canvasOf(w, h); fn(x, { x: ax, y: ay }); return { c, ax, ay }; }
const GLASS = '#26333d', TYRE = '#17181c', BLACK = '#1b1c20';

const VT = {
  taxi:    { len: 1.9, wid: 1.0, bh: 4.5, ch: 3.5, cab: [0.45, 1.45], vmax: 2.7, w: 5 },
  car:     { len: 1.8, wid: 0.95, bh: 4.5, ch: 3.5, cab: [0.4, 1.4], vmax: 2.5, w: 5 },
  van:     { len: 2.2, wid: 1.05, bh: 9, ch: 0, vmax: 2.2, w: 2 },
  minibus: { len: 2.5, wid: 1.1, bh: 10, ch: 0, vmax: 2.7, w: 3 },
  bus:     { len: 4.0, wid: 1.25, bh: 17, ch: 0, vmax: 1.9, w: 3 },
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
      box(x, o, 0, 0, z0, t.len, t.wid, z0 + 8.5, { t: '#b3322b', l: shade('#b3322b', 0.82), r: shade('#b3322b', 0.66) });
      box(x, o, 0, 0.03, z0 + 8.5, t.len, t.wid - 0.03, zb, { t: '#c9ccd0', l: shade(col.body, 0.82), r: shade(col.body, 0.66) });
    } else box(x, o, 0, 0, z0, t.len, t.wid, zb, col.body);
    // lower body paint (bus: cream waist; van: blue stripe)
    if (type === 'bus') faceL(x, o, 0.02, t.len - 0.02, t.wid, z0 + 2, z0 + 6.2, shade('#efe6c8', 0.82));
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
      faceL(x, o, 0.12, t.len - 0.12, t.wid, z0 + 2.2 + 0.0, z0 + 0.0 + 6.1, '#efe6c8');
      [[z0 + 9.5, z0 + 13.2], [z0 + 13.8, z0 + 16.2]].forEach(([a, b], k) => { if (k === 0) { faceL(x, o, 0.12, t.len - 0.12, t.wid - 0.03, a, b, GLASS); for (let u = 0.5; u < t.len - 0.2; u += 0.5) faceL(x, o, u, u + 0.06, t.wid - 0.03, a, b, '#efe6c8'); } });
      faceL(x, o, 0.12, t.len - 0.12, t.wid, z0 + 6.2, z0 + 7.2, '#cf3a30');            // red waist band
      faceL(x, o, 0.12, t.len - 0.12, t.wid, z0 + 2.2, z0 + 3.0, shade('#b3322b', 0.8)); // skirt
      faceR(x, o, 0.1, t.wid - 0.1, t.len, z0 + 9.5, z0 + 15.5, GLASS);
      faceR(x, o, 0.1, t.wid - 0.1, t.len, z0 + 3, z0 + 8.0, '#b3322b');
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
function treeSprite(seed) {
  const r = rng(seed);
  return sprite(64, 70, 32, 62, (x, o) => {
    box(x, o, 0, 0, 0, 0.16, 0.16, 12, '#6b5640');
    const blobs = [[0, -18, 11], [-8, -14, 8], [8, -14, 8], [-3, -24, 8], [5, -23, 7], [0, -10, 9]];
    blobs.forEach(([bx, by, br]) => {
      for (let yy = -br; yy <= br; yy++) { const hw = Math.round(Math.sqrt(br * br - yy * yy)); const tone = yy < -br / 3 ? '#4f8f45' : yy < br / 3 ? '#3f7a3c' : '#2f6234'; x.fillStyle = r() < 0.04 ? '#79b25a' : tone; x.fillRect(o.x + bx - hw, o.y + by + yy, hw * 2, 1); }
    });
  });
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
(function buildProps() {
  const gs = guardSprite(), K = CFG.kerb;
  for (let u = 0; u < U; u++) {
    const inZ = u + 1 > 5.8 && u < 9.2;
    if (!inZ) { addProp(gs, u, CFG.farP - 0.16, K); addProp(gs, u, CFG.road + 0.1, K); }
  }
  const ls = lampSprite(); [[1.6, 3.0], [12.4, 3.0], [2.6, 10.6], [11.8, 10.6]].forEach(([u, v]) => { addProp(ls, u, v, K); lamps.push([u - 0.5, v]); });
  addProp(treeSprite(11), 3.9, 3.3, K); addProp(treeSprite(23), 11.6, 3.5, K); addProp(treeSprite(5), 1.2, 10.2, K); addProp(treeSprite(31), 12.9, 10.5, K);
  addProp(shelterSprite(), 10.2, 9.5, K);
  const pl = poleSprite();
  addProp(pl, 5.5, 4.25, K); addProp(pl, 9.4, 4.25, K); addProp(pl, 5.5, 9.4, K); addProp(pl, 9.4, 9.4, K);
})();


// ---------------------------------------------------------------- pedestrians (tiny billboards, 12px tall adults)
const SKIN = ['#f1cba2', '#e2b186', '#c99067', '#8d5d3f'];
const HAIR = ['#1b1b1f', '#1b1b1f', '#2a211c', '#3a2a20', '#b9b5ae'];
const CASUAL = ['#e05a4a', '#4a90d9', '#59b36a', '#e9c445', '#9a6ad8', '#2e2e36', '#d9d9d9', '#f08a4b'];
const FLORAL = ['#d98aa5', '#7fb069', '#e0c05a', '#6aa0d0', '#c97dc4'];
const UMB = ['#26262c', '#26262c', '#e8e0c8', '#d98aa5', '#4a6fa5'];
const LOOKS = (function () {
  const r = rng(99), out = [], pick = (a) => a[Math.floor(r() * a.length)];
  for (let i = 0; i < 36; i++) {
    const k = r(), kind = k < 0.28 ? 'worker' : k < 0.42 ? 'school' : k < 0.55 ? 'auntie' : k < 0.65 ? 'tourist' : k < 0.72 ? 'rider' : 'casual';
    const L = { kind, skin: pick(SKIN), hair: kind === 'auntie' && r() < 0.6 ? '#b9b5ae' : pick(HAIR), umb: r() < 0.2 ? pick(UMB) : null, kid: kind === 'school' };
    if (kind === 'worker') { L.top = r() < 0.5 ? '#2b3140' : '#e6e6ea'; L.tie = pick(['#c8342b', '#3a5f9a', '#2a2e36']); L.pants = '#262a35'; }
    else if (kind === 'school') { L.top = '#ececf0'; L.pants = '#56627a'; L.pack = pick(['#d8453a', '#3a6fb0', '#e0a030', '#3a9a5c']); }
    else if (kind === 'auntie') { L.top = pick(FLORAL); L.pants = '#48455f'; L.bag = r() < 0.6; }
    else if (kind === 'tourist') { L.top = pick(CASUAL); L.pants = '#c9b88c'; L.hat = '#e8d9a0'; L.pack = '#3b5f9a'; }
    else if (kind === 'rider') { L.top = r() < 0.5 ? '#ff2b85' : '#00b8a9'; L.pants = '#26262c'; L.hat = '#26262c'; L.pack = L.top; L.box = true; }
    else { L.top = pick(CASUAL); L.pants = pick(['#2c3a5a', '#3a3a40', '#6b5a4a']); }
    out.push(L);
  }
  return out;
})();
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
  if (side) { R(1 + (gap ? 1 : 0), ty, 2, lA, shade(L.pants, 0.85)); R(3 - (gap ? 1 : 0), ty, 2, lB, L.pants); R(1 + (gap ? 1 : 0), ty + lA - 1, 2, 1, shoes); R(3 - (gap ? 1 : 0), ty + lB - 1, 2, 1, shoes); }
  else { R(1, ty, 2, lA, L.pants); R(3, ty, 2, lB, L.pants); R(1, ty + lA - 1, 2, 1, shoes); R(3, ty + lB - 1, 2, 1, shoes); }
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
  peds.push(newPed({ u: dir > 0 ? -0.3 : U + 0.3, v, look, side, mode: 'walkU', du: dir, spd: 0.55 + rnd() * 0.45 }));
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
      if (q.u < -0.5 || q.u > U + 0.5) peds.splice(i, 1);
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
const peds = [];
const state = { phase: 'off', t: 0, from: 'off', car: 'green', ped: 'red', flashT: 0, pulse: 0, night: false, quietHours: false };
const lanes = [
  { dir: 1, v: CFG.laneFar, stopS: CFG.stopFar, list: [], next: 0.5 },
  { dir: -1, v: CFG.laneNear, stopS: U - CFG.stopNear, list: [], next: 1.5 },
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
    while (l.list.length && l.list[0].s - l.list[0].len > U + 0.3) l.list.shift();
  });
}

// ---------------------------------------------------------------- time of day (same ?hour= override as the lab's quiet hours)
function localHour() { const q = new URLSearchParams(location.search).get('hour'); return q !== null && q !== '' && !isNaN(+q) ? +q : new Date().getHours(); }
state.hour = localHour(); state.night = state.hour >= 19 || state.hour < 6; state.quietHours = state.hour < 6;

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
  x.globalCompositeOperation = 'lighter';
  signs.forEach((sg) => { const [px, py] = P(O, sg.u + 0.1, (sg.v0 + sg.v1) / 2, (sg.z0 + sg.z1) / 2); const h = hex(sg.col); glow(x, px, py, 26, `rgba(${h[0]},${h[1]},${h[2]},A)`, 0.45); });
  lamps.forEach(([u, v]) => { const [px, py] = P(O, u, v, CFG.kerb + 27); glow(x, px, py, 22, 'rgba(255,240,190,A)', 0.55); const [gx, gy] = P(O, u, v, CFG.kerb); glow(x, gx, gy + 2, 34, 'rgba(255,236,170,A)', 0.22); });
  x.globalCompositeOperation = 'source-over';
  signs.forEach((sg) => drawSign(x, sg, true));
  emis = c;
}
function drawLights() {
  g.globalCompositeOperation = 'lighter';
  lanes.forEach((l) => l.list.forEach((c) => {
    const umin = l.dir > 0 ? c.s - c.len : U - c.s, vc = l.v, fu = l.dir > 0 ? umin + c.len : umin;
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

// ---------------------------------------------------------------- draw
const items = [], headItems = [];
let camX = 0;
function toScreen(u, v, z) { return [OX + (u - v) * 16, OY + (u + v) * 8 - (z || 0)]; }
function fadeOf(c) { return Math.max(0, Math.min(1, Math.min(c.s / 1.0, (U + 0.2 - c.s) / 1.0))); }   // dissolve at the two ends of the slab
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
    items.push({ k: q.u + q.v + 0.02, c: sp.c, x: Math.round(x - sp.ax), y: Math.round(y - sp.ay + bob), a: Math.min(q.a, Math.max(0, Math.min(1, Math.min(q.u + 0.3, U + 0.3 - q.u) / 1.0))) });
  });
  lanes.forEach((l) => l.list.forEach((c) => {
    const umin = l.dir > 0 ? c.s - c.len : U - c.s, [x, y] = toScreen(umin, l.v - c.wid / 2, 0);
    const a = fadeOf(c);
    items.push({ k: umin + c.len / 2 + l.v, c: c.spr.c, x: Math.round(x - c.spr.ax), y: Math.round(y - c.spr.ay), a });
  }));
  items.sort((a, b) => a.k - b.k);
}
function render() {
  g.drawImage(staticDay, -camX, 0);
  collect();
  for (const it of items) { if (it.a < 1) g.globalAlpha = it.a; g.drawImage(it.c, it.x - camX, it.y); if (it.a < 1) g.globalAlpha = 1; }
  if (state.night) {
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#3e4c8a'; g.fillRect(0, 0, cv.width, H); g.globalCompositeOperation = 'source-over';
    g.drawImage(emis, -camX, 0);
    for (const it of headItems) g.drawImage(it.c, it.x - camX, it.y);
    drawLights();
  }
}

// ---------------------------------------------------------------- loop
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = 0, raf = 0, visible = true;
function step(dt) { stepPhase(dt); stepTraffic(dt); stepPeds(dt); }
function frame(now) {
  raf = 0; if (!visible || document.hidden) { last = 0; return; }
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
  step(dt); render(); raf = requestAnimationFrame(frame);
}
function start() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
function warm(sec) { for (let t = 0; t < sec; t += 0.05) step(0.05); }
if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) start(); }).observe(cv);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; start(); } });

buildStatic(); buildEmissive();
warm(14);
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
function describe() { cv.setAttribute('aria-label', 'An isometric pixel-art street in Hong Kong' + (state.night ? ' at night, with neon signs lit' : '') + '. ' + (DESC[state.phase] || '')); }
// phones get a tighter crop of the same scene so the pixels stay close to 1:1
function fit() {
  const w = cv.parentElement.clientWidth, vw = w >= 600 ? W : 360;
  if (cv.width !== vw) { cv.width = vw; camX = (W - vw) / 2; g.imageSmoothingEnabled = false; render(); }
}
if ('ResizeObserver' in window) new ResizeObserver(fit).observe(cv.parentElement); fit(); describe();

window.HKG_SCENE = {
  setPhase(p) { setPhase(p); describe(); if (reduce) { warm(3); render(); } },
  pulse() { state.pulse = 0.05; },
  render, warm, state, lanes, peds, CFG,
};
})();
