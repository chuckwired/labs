/* Defend Humanity core: the three.js world, figures, enemy palettes, the data centre, camera and the flat overlay. */
'use strict';
/* ================= 3D scene (three.js) =================
   The simulation is flat (x across, y down toward the gate). Here it becomes a ground plane: x -> X, y -> Z, gate line at Z = 0.
   Figures are low-poly instanced boxes, one draw call per body part for everyone on the field. */
const VS = 1.4, KY = K * 1.4;                         // VS: figures are drawn a little larger than their sim footprint
const wx = x => (x - W / 2) * K, wz = y => (y - GL) * K;
const FWW = W * K, ZF = -GL * K;                       // field width and the far edge in world units
const FOGC = 0x0a0a10, HT = { palisade: 1.7, spikes: .5, tower: 4.1, ballista: 2 };
let auraLight, vig = null, vigKey = -1, killTier = -1, stainCv, stainCx, stainTex, stainDirty = false, stainTick = 0;
const KCOL = ['#e8e6df', '#e0b04a', '#ff9a3c', '#ff5a3c', '#ff3030', '#ffffff'];
let mists = [], leds = null, ledT = 0, renderer = null, scene, camera, torchA, torchB, flames = [], wallMats = [], matGate, zone, zoneLine, banner, flag, markRing, ghostG, ghostMesh, ghostFoot, ghostRing, ghostKey = '';
const tV = new THREE.Vector3(), tS = new THREE.Vector3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4(), tL = new THREE.Matrix4(), tE = new THREE.Euler(), tC = new THREE.Color(), tP = new THREE.Vector3(), tD = new THREE.Vector3();
const QI = new THREE.Quaternion(), UZ = new THREE.Vector3(0, 0, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const BOX = new THREE.BoxGeometry(1, 1, 1), CONE = new THREE.ConeGeometry(.5, 1, 5), CYL = new THREE.CylinderGeometry(.5, .5, 1, 6);
const CC = {}; const cc = h => CC[h] || (CC[h] = new THREE.Color(h));
const GEO = {}, structObjs = new Map(); let matS, matSF, matGhostOK, matGhostBad;
const NU = 520, NPR = 420, NPT = 320, CORPSE_MAX = 120, CORPSES = [];
let mBody, mHead, mHat, mLegL, mLegR, mWpn, mAcc, mBlob, mCatB, mCatA, mArrow, mPart;

function mergeParts(parts) {      // bake many boxes into one geometry with vertex colours: one draw call per building
  const pos = [], nor = [], col = [], idx = []; let off = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (const p of parts) {
    const g = (p.g || BOX).clone(); e.set(...(p.r || [0, 0, 0])); q.setFromEuler(e); m.compose(new THREE.Vector3(...p.p), q, new THREE.Vector3(...(p.s || [1, 1, 1]))); g.applyMatrix4(m); c.set(p.c);
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); nor.push(na.getX(i), na.getY(i), na.getZ(i)); col.push(c.r, c.g, c.b); }
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); off += pa.count;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}
function buildGeos() {
  const wood = [0x7a5630, 0x6b4a2a, 0x85602f], r = mulberry(11);
  { const P = [], n = 8, w = SD.palisade.w * K, d = SD.palisade.h * K;
    for (let i = 0; i < n; i++) { const h = 1.25 + (i % 3 === 1 ? .35 : (i % 2) * .15), x = -w / 2 + (i + .5) * w / n; P.push({ p: [x, h / 2, 0], s: [w / n * .86, h, d * .8], c: wood[i % 3] }, { g: CONE, p: [x, h + .12, 0], s: [w / n * .8, .3, d * .75], c: 0xa47a44 }); }
    P.push({ p: [0, .45, d * .42], s: [w, .1, .1], c: 0x2b1d16 }, { p: [0, .9, d * .42], s: [w, .1, .1], c: 0x2b1d16 }); GEO.palisade = mergeParts(P); }
  { const P = [], w = SD.spikes.w * K, d = SD.spikes.h * K; P.push({ p: [0, .03, 0], s: [w, .06, d], c: 0x2a2118 }, { p: [0, .065, 0], s: [w * .8, .02, d * .8], c: 0x1c150f });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = (i - 1.5) * w / 4.4 + (r() - .5) * .12, z = (j - 1) * d / 3.6 + (r() - .5) * .12; P.push({ g: CONE, p: [x, .3, z], s: [.13, .56, .13], r: [(r() - .5) * .3, 0, (r() - .5) * .3], c: 0xcfc9b0 }); }
    GEO.spikes = mergeParts(P); }
  { const P = [], w = SD.tower.w * K, d = SD.tower.h * K;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push({ p: [sx * w * .4, 1.05, sz * d * .4], s: [.14, 2.1, .14], c: 0x4a3320 });
    P.push({ p: [0, 1.0, d * .42], s: [w * .9, .08, .08], c: 0x3a2a1c }, { p: [0, 1.0, -d * .42], s: [w * .9, .08, .08], c: 0x3a2a1c }, { p: [0, 2.12, 0], s: [w * 1.15, .14, d * 1.15], c: 0x7a5630 },
      { p: [0, 2.58, 0], s: [w * 1.0, .8, d * 1.0], c: 0x6b4a2a }, { p: [0, 2.62, -d * .52], s: [w * .5, .22, .06], c: 0x2b1d16 }, { g: CONE, p: [0, 3.35, 0], s: [w * 1.5, .8, d * 1.5], r: [0, Math.PI / 4, 0], c: 0x8a3a2c }, { p: [0, 3.95, 0], s: [.05, .6, .05], c: 0x5a3d22 }, { p: [.16, 4.1, 0], s: [.3, .2, .03], c: 0x3d6ab0 });
    GEO.tower = mergeParts(P); }
  { const P = [], w = SD.ballista.w * K, d = SD.ballista.h * K;
    for (const sx of [-1, 1]) P.push({ g: CYL, p: [sx * w * .42, .32, d * .1], s: [.12, .64, .64], r: [0, 0, Math.PI / 2], c: 0x2a2420 });
    P.push({ p: [0, .62, 0], s: [w * .5, .38, d * .85], c: 0x6b4a2a }, { p: [0, .98, -d * .12], s: [w * .22, .5, .2], c: 0x5a3d22 }, { p: [0, 1.28, -d * .12], s: [w * 1.15, .12, .14], c: 0x5a3d22 }, { p: [0, 1.28, -d * .12], s: [w * 1.1, .03, .03], c: 0xd8d8c8 },
      { p: [0, 1.12, -d * .38], s: [.07, .07, 1.3], c: 0xcfd6df }, { g: CONE, p: [0, 1.12, -d * .38 - .72], s: [.18, .26, .18], r: [-Math.PI / 2, 0, 0], c: 0xe9eef4 });
    GEO.ballista = mergeParts(P); }
}

/* a stand-in look for each figure: body colours by variant, skin, a hat/helm slot, a held weapon (pivots at the hand) and an accessory slot (shield, cape, saddle cloth) */
const WHITE = new THREE.Color(0xffffff), FIRE = new THREE.Color(0xff8a30), CRIM = new THREE.Color(0x2a0f0a), TIERC = [null, new THREE.Color(0xe0b04a), new THREE.Color(0xfff0b0)], CAPE = { p: [0, .85, .24], s: [.62, .95, .05], cc: new THREE.Color(0x7a1c1c) };
const figScale = (key, scale, tier) => VS * (key === 'horse' ? 1 + .4 * (tier || 0) : scale);
const SKA = [0xe0b48a, 0xc28c5f, 0x8d5a3b], SKE = [0x7da35a, 0x6c9150, 0x93b36a];
const LOOK = {};
function look(key, o) {
  const L = Object.assign({ sh: [1, 1, 1], leg: 0x2b2622, hp: [0, 1.38, 0], hs: [1, 1, 1], wp: null, hat: null, acc: null, skin: SKA }, o);
  L.bodyC = L.body.map(h => new THREE.Color(h)); L.skinC = L.skin.map(h => new THREE.Color(h)); L.legC = new THREE.Color(L.leg);
  for (const k of ['hat', 'wp', 'acc']) if (L[k]) L[k].cc = new THREE.Color(L[k].c);
  LOOK[key] = L;
}
const helm = (c, s) => ({ c, p: [0, 1.6, 0], s: s || [.46, .2, .46] }), horns = c => ({ c, p: [0, 1.58, 0], s: [.9, .12, .16] });
look('spear',   { body: [0x3d6ab0, 0x3563a6, 0x456fb8], hat: helm(0x8e98a8), wp: { c: 0xcfd6df, th: .07, len: 1.75, p: [.38, .95, -.05], rx: .55, sw: .6 } });
look('shield',  { body: [0x2f56a0, 0x2b5099, 0x3560ac], sh: [1.12, 1, 1.1], hat: helm(0xaab4c2, [.5, .24, .5]), acc: { c: 0x3d6ab0, p: [-.44, .85, -.1], s: [.1, .58, .56] }, wp: { c: 0xcfd6df, th: .07, len: .9, p: [.4, .95, -.05], rx: .4, sw: 1 } });
look('archer',  { body: [0x46805a, 0x3f7652, 0x4d8a62], hat: helm(0x2f5a40), leg: 0x4a3d2e, wp: { c: 0x7a5a30, th: .06, len: 1.0, p: [-.36, .98, -.1], rx: .1, sw: .25 } });
look('horse',   { body: [0x8a5a3a, 0xd8d4cc, 0x4a3526], sh: [1.4, 1, 2.7], hp: [0, 1.38, -.12], hs: [.72, 1, .38], hat: { c: 0xaab4c2, p: [0, 1.6, -.12], s: [.33, .2, .17] }, acc: { c: 0x3d6ab0, p: [0, 1.2, .05], s: [.72, .1, .38] }, leg: 0x2a2018, wp: { c: 0xcfd6df, th: .05, len: .7, p: [.3, 1.05, -.2], rx: .4, sw: .5 } });
/* enemy colours follow the prestige: blue coolant, then green, then purple, then smoky black with a red glow */
const EPAL = [
  { a: 0x39d0e0, a2: 0x5ae0ff, scr: [0x1d3a5a, 0x183150, 0x24466a], hnd: [0x14354a, 0x102c3f, 0x1b4259], pale: [0xbfd8f0, 0xaecbe6, 0xcfe4f6], face: 0x2a6ad0, brute: [0x10283c, 0x0c2133, 0x15324a], arm: 0x2a6a8a, mono: [0x0a1018, 0x0d141e, 0x080c14], garm: 0x1a4a6a, eye: 0xd8fbff, halo: 0x7ae8ff, beam: 0xbff6ff, ink: 0x0a1c28, blood: ['#2a9aa8', '#38c8d0', '#1a5a66'], stain: 'rgba(20,70,80,.5)', fade: 'rgba(10,30,36,0)' },
  { a: 0x4cf07a, a2: 0x8affa8, scr: [0x1d4a2e, 0x183f27, 0x24583a], hnd: [0x14402a, 0x103522, 0x1b4c32], pale: [0xcfe8c8, 0xbcdcb4, 0xdcf0d4], face: 0x2aa05a, brute: [0x10331c, 0x0c2916, 0x153f24], arm: 0x2a8a4a, mono: [0x0a180e, 0x0d1f12, 0x08140b], garm: 0x1a6a3a, eye: 0xe0ffe8, halo: 0x8affa8, beam: 0xd0ffd8, ink: 0x0a2814, blood: ['#2aa84a', '#48d070', '#1a6630'], stain: 'rgba(20,80,40,.5)', fade: 'rgba(10,36,20,0)' },
  { a: 0xb06cf0, a2: 0xd2a0ff, scr: [0x3a1d5a, 0x311850, 0x44246a], hnd: [0x2e1a4a, 0x25143e, 0x38205a], pale: [0xdccaf0, 0xcdb8e6, 0xe8d8f8], face: 0x7a3ad0, brute: [0x24103c, 0x1c0c33, 0x2c154a], arm: 0x6a2a8a, mono: [0x140a18, 0x190d1f, 0x10080f], garm: 0x4a1a6a, eye: 0xf2e0ff, halo: 0xd2a0ff, beam: 0xe8d0ff, ink: 0x1c0a28, blood: ['#8a3ad0', '#b060f0', '#4a1a7a'], stain: 'rgba(60,20,90,.5)', fade: 'rgba(24,10,36,0)' },
  { a: 0xff3b2a, a2: 0xff7a5a, scr: [0x1a1a1e, 0x141418, 0x222226], hnd: [0x18181c, 0x121216, 0x202024], pale: [0x56565e, 0x4a4a52, 0x62626a], face: 0x8a1c14, brute: [0x101012, 0x0c0c0e, 0x161618], arm: 0x5a1a14, mono: [0x08080a, 0x0b0b0d, 0x060608], garm: 0x3a1410, eye: 0xffd0c0, halo: 0xff3b2a, beam: 0xff6a4a, ink: 0x0a0a0c, blood: ['#2a2a30', '#c42a1c', '#101014'], stain: 'rgba(10,10,12,.6)', fade: 'rgba(8,8,10,0)' },
];
let PI = 0;
function enemyLooks(pi) {
  PI = Math.min(pi || 0, EPAL.length - 1); const P = EPAL[PI];
  look('raider',  { body: P.scr, skin: [P.a, P.a2, P.a], sh: [.75, .8, .75], fl: .45, nolegs: true, hp: [0, .82, -.22], hs: [.95, .5, .4], hat: { c: P.a, p: [0, 1.4, 0], s: [.06, .4, .06] }, wp: { c: P.a, th: .08, len: .6, p: [0, .55, -.2], rx: .2, sw: .9 } });
  look('hound',   { body: P.hnd, skin: [P.ink, P.ink, P.ink], leg: P.ink, sh: [.85, .55, 1.7], hp: [0, 1.0, -.3], hs: [.99, 1.44, .53], hat: { c: P.a, p: [0, 1.22, -.3], s: [.5, .08, .3] } });
  look('slinger', { body: P.pale, skin: [P.face, P.face, P.face], sh: [.95, .75, .95], fl: .5, nolegs: true, hp: [0, .85, -.2], hs: [1.2, .45, .2], hat: { c: P.pale[0], p: [-.2, .32, 0], s: [.18, .2, .18] }, wp: { c: P.a, th: .05, len: .5, p: [.3, .8, -.1], rx: .6, sw: 1.3 } });
  look('brute',   { body: P.brute, skin: [0x061018, 0x061018, 0x061018], leg: P.ink, sh: [1.5, 1.15, 1.35], hp: [0, 1.05, -.3], hs: [1.0, .6, .7], hat: { c: P.a, p: [0, 1.05, -.5], s: [.35, .1, .05] }, acc: { c: P.a, p: [0, 1.3, .2], s: [.5, .2, .5] }, wp: { c: P.arm, th: .2, len: .9, p: [.5, .8, -.1], rx: .9, sw: 1.6 } });
  look('giant',   { body: P.mono, skin: [P.a, P.a, P.a], sh: [1.3, 1.6, 1.0], fl: -.64, nolegs: true, hp: [0, 1.1, -.2], hs: [1.2, .5, .3], hat: horns(P.a), acc: { c: P.a2, p: [0, .7, -.2], s: [.35, .8, .02] }, wp: { c: P.garm, th: .22, len: 1.0, p: [.55, .9, -.05], rx: .9, sw: 1.6 } });
  look('hype',    { body: [0x1a1f2a, 0x1a1f2a, 0x1a1f2a], skin: [P.eye, P.eye, P.eye], sh: [1.2, 1.3, 1.1], fl: .35, nolegs: true, hp: [0, .95, -.2], hs: [1.1, .6, .4], hat: { c: 0x07090d, p: [0, .98, -.25], s: [1.3, .3, .4] }, acc: { c: P.a, p: [0, .5, .35], s: [.9, .55, .22] }, wp: { c: P.beam, th: .2, len: .8, p: [.6, 1.0, -.15], rx: .5, sw: 1.2 } });
  look('claw',    { body: [0x3a1612, 0x3a1612, 0x3a1612], skin: [0xff6a4a, 0xff8a6a, 0xff6a4a], sh: [1.3, 1.2, 1.1], fl: .2, nolegs: true, hp: [0, .95, -.2], hs: [1.0, .55, .4], hat: { c: 0xff6a4a, p: [0, 1.6, 0], s: [.7, .1, .12] }, acc: { c: 0xff6a4a, p: [-.7, .9, -.2], s: [.5, .28, .8] }, wp: { c: 0xff6a4a, th: .3, len: 1.1, p: [.7, .9, -.2], rx: .5, sw: 1.6 } });
  look('layoff',  { body: [0x2b2f38, 0x2b2f38, 0x2b2f38], skin: [0xe0c8b0, 0xe0c8b0, 0xe0c8b0], leg: 0x1c1e24, sh: [1.2, 1.3, 1.1], hp: [0, 1.0, -.1], hs: [.9, .8, .6], hat: { c: 0x8a1c14, p: [0, .55, .32], s: [.14, .7, .06] }, acc: { c: 0x6a4a2a, p: [-.7, .5, 0], s: [.55, .4, .2] }, wp: { c: 0xe8ecf0, th: .08, len: .7, p: [.5, .9, -.1], rx: .6, sw: 1.3 } });
  look('ipo',     { body: [0x0c1018, 0x131a26, 0x0a0e16], skin: [0xe0b04a, 0xf4cc6a, 0xe0b04a], sh: [1.7, 1.9, 1.5], fl: -.45, nolegs: true, hp: [0, 1.15, -.2], hs: [1.5, .45, .3], hat: { c: 0xe0b04a, p: [0, 2.0, 0], s: [.8, .6, .8] }, acc: { c: 0xf4cc6a, p: [0, 1.2, -.6], s: [2.2, .06, .06] }, wp: { c: 0xe0b04a, th: .25, len: 1.0, p: [.7, .9, -.05], rx: .9, sw: 1.7 } });
  look('mythos',  { body: [0x180c28, 0x20103a, 0x140a22], skin: [P.halo, P.a2, P.halo], sh: [1.4, 1.8, 1.2], fl: .1, nolegs: true, hp: [0, 1.2, -.2], hs: [1.4, .6, .3], hat: { c: 0xb06cf0, p: [0, 2.1, 0], s: [.4, .9, .4] }, acc: { c: P.halo, p: [0, 1.2, 0], s: [2.6, .06, 2.6] }, wp: { c: P.beam, th: .12, len: 1.8, p: [.7, 1.0, -.05], rx: .2, sw: 1.0 } });
  look('sam',     { body: [0x2a2e36, 0x2a2e36, 0x2a2e36], skin: [0xe8cdb0, 0xe8cdb0, 0xe8cdb0], leg: 0x1c1e24, sh: [1.1, 1.2, 1], hp: [0, 1.0, -.1], hs: [.9, .8, .6], hat: { c: 0x6a5238, p: [0, 1.62, 0], s: [.5, .14, .5] }, acc: { c: P.halo, p: [0, 2.3, 0], s: [1.5, .05, 1.5] }, wp: { c: P.beam, th: .1, len: .45, p: [.38, .95, -.1], rx: .5, sw: .6 } });
  look('warlord', { body: [0x04060a, 0x04060a, 0x04060a], skin: [P.eye, P.eye, P.eye], sh: [1.2, 1.2, 1.2], fl: .8, nolegs: true, hp: [0, .8, -.25], hs: [1.5, .5, .3], hat: horns(P.halo), acc: { c: P.halo, p: [0, 1.7, 0], s: [1.8, .05, 1.8] }, wp: { c: P.beam, th: .12, len: 1.6, p: [.5, .9, -.05], rx: .9, sw: 1.8 } });
}
enemyLooks(store.prestige || 0);
look('cat', { body: [0x6b4a2a, 0x6b4a2a, 0x6b4a2a] });


/* the data centre hardens with every prestige: 1 barbed wire and hazard bollards, 2 sweeping spotlights and barriers, 3 gun turrets and dishes, 4 antenna masts with warning lights, 5 floodlight poles and a third beam */
let dcGroup = null, dcBeams = [], dcBlink = [];
function buildDefences(n) {
  if (dcGroup) { scene.remove(dcGroup); dcGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  dcGroup = new THREE.Group(); dcBeams = []; dcBlink = []; scene.add(dcGroup); const lv = Math.min(n || 0, 5); if (lv < 1) return;
  const ww = FWW + 8, wf = .55, d = new THREE.Object3D(), er = mulberry(23), lam = c => new THREE.MeshLambertMaterial({ color: c }), bas = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: o !== undefined, opacity: o === undefined ? 1 : o, depthWrite: o === undefined, blending: o === undefined ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false });
  const box = (w, h, dp, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), lam(c)); m.position.set(x, y, z); dcGroup.add(m); return m; };
  const inst = (g, m, pts) => { const im = new THREE.InstancedMesh(g, m, pts.length); pts.forEach((q, i) => { d.position.set(q[0], q[1], q[2]); d.rotation.set(q[3] || 0, q[4] || 0, q[5] || 0); d.scale.setScalar(q[6] || 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); dcGroup.add(im); return im; };
  const towerX = ww / 2 - .6, xs = []; for (let x = -ww / 2 + 3; x < ww / 2 - 3; x += .9) if (Math.abs(x) > 3.4) xs.push(x);
  // 1: barbed wire along the foot of the wall, hazard-striped bollards at the door
  { inst(new THREE.BoxGeometry(.08, .75, .08).translate(0, .37, 0), lam(0x3a4048), xs.map(x => [x, 0, .18]));
    for (const y of [.3, .58]) for (const sd of [-1, 1]) { const len = ww / 2 - 3.4 - 3, m = new THREE.Mesh(new THREE.BoxGeometry(len, .03, .03), lam(0x9aa1aa)); m.position.set(sd * (3.4 + len / 2 + 3), y, .18); dcGroup.add(m); }
    inst(new THREE.BoxGeometry(.13, .13, .13), lam(0xb4bbc4), xs.flatMap(x => [[x + .45, .3, .18, er() * 3, er() * 3, er() * 3], [x + .45, .58, .18, er() * 3, er() * 3, er() * 3]]));
    for (const sd of [-1, 1]) { box(.5, 1.2, .5, 0x1a1c20, sd * 2.7, .6, .75); box(.52, .28, .52, 0xe0b020, sd * 2.7, .35, .75); box(.52, .28, .52, 0xe0b020, sd * 2.7, .95, .75); }
    box(5.9, .3, .5, 0x1a1c20, 0, 1.3, .75); for (let i = -2; i <= 2; i++) box(.5, .3, .52, 0xe0b020, i * 1.1, 1.3, .75); }
  // 2: spotlights on the towers that sweep the field, and concrete barriers
  if (lv >= 2) {
    const mkBeam = (x, y, z, ph) => { const g = new THREE.Group(); g.position.set(x, y, z); const lamp = new THREE.Mesh(new THREE.BoxGeometry(.7, .5, .7), lam(0x2a2f36)); g.add(lamp);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 17, 14, 1, true).translate(0, -8.5, 0), bas(0xdcecff, .075)); cone.rotation.x = 1.22; g.add(cone); g.userData.ph = ph; dcGroup.add(g); dcBeams.push(g); };
    for (const sx of [-1, 1]) mkBeam(sx * towerX, 5.75, wf + .6, sx * 1.4);
    inst(new THREE.BoxGeometry(1.5, .55, .5).translate(0, .27, 0), lam(0x6c727a), xs.filter((x, i) => i % 3 === 1).map(x => [x, 0, -.55, 0, (er() - .5) * .08])); }
  // 3: gun turrets on the wall and dishes on the roof line
  if (lv >= 3) {
    for (const x of [-9, -5.6, 5.6, 9]) { box(.9, .35, .9, 0x2a2f36, x, 2.5, wf + .9); box(.6, .4, .8, 0x4a525c, x, 2.88, wf + .85); const b = box(.12, .12, 1.1, 0x14171b, x, 2.9, wf + .1); b.rotation.x = .05; }
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(1.0, .5, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0xcfd6df, side: THREE.DoubleSide })); m.position.set(sx * (towerX - 3.4), 2.8, wf + 1.1); m.rotation.set(-1.1, 0, 0); dcGroup.add(m); box(.1, .6, .1, 0x2a2f36, sx * (towerX - 3.4), 2.55, wf + 1.1); } }
  // 4: antenna masts with blinking warning lights
  if (lv >= 4) {
    for (const x of [-12, -2.2, 2.2, 12]) { box(.12, 4.2, .12, 0x3a4048, x, 4.3, wf + 1.4); const l = new THREE.Mesh(new THREE.SphereGeometry(.17, 6, 6), bas(0xff3030)); l.position.set(x, 6.5, wf + 1.4); dcGroup.add(l); dcBlink.push(l); } }
  // 5: floodlight poles along the front and a third beam over the gate
  if (lv >= 5) {
    for (const x of [-7, -3.6, 3.6, 7]) { box(.14, 2.4, .14, 0x3a4048, x, 1.2, -1.5); box(.7, .3, .4, 0x2a2f36, x, 2.5, -1.5); const c = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.4, 12, 1, true).translate(0, -1.7, 0), bas(0xdcecff, .06)); c.position.set(x, 2.45, -1.5); c.rotation.x = .5; dcGroup.add(c); }
    const g = new THREE.Group(); g.position.set(0, 2.6, wf - .1); g.add(new THREE.Mesh(new THREE.BoxGeometry(.7, .5, .7), lam(0x2a2f36))); const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 20, 14, 1, true).translate(0, -10, 0), bas(0xdcecff, .075)); cone.rotation.x = 1.3; g.add(cone); g.userData.ph = 3; dcGroup.add(g); dcBeams.push(g); }
}
function applyPrestigeLook() { enemyLooks(store.prestige || 0); if (scene) buildDefences(store.prestige || 0); }

/* free camera on the game-over screen: drag to orbit, scroll or pinch to zoom, it drifts on its own until touched */
/* `roam.dir` (optional) is a function a mode sets to script the camera: it is called each frame and writes tx, ty, tz, yaw, pitch, dist, fov and shift (pixels to push the picture up, to clear a panel). `roam.auto` marks the game-over cinema, which a touch hands back to the player. */
const roam = { on: false, yaw: 0, pitch: .85, dist: 42, tx: 0, ty: 0, tz: -18, fov: 42, shift: 0, touched: false, t: 0, dir: null, auto: false };
function roamOn(on) { roam.on = on; roam.touched = false; roam.t = performance.now(); roam.dir = null; roam.auto = false; roam.ty = 0; roam.fov = 42; roam.shift = 0; if (on) { roam.yaw = .0; roam.pitch = .85; roam.dist = 42; } cam.key = ''; }

const sheet = $('#sheet'), scr = $('#scr');
const cam = { shake: 0, v: 0, from: 0, to: 0, t0: 0, dur: 1, lo: null, hi: null, key: '', w: 1, h: 1 };
const easeIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function ndc(x, y, z, P, asp) {      // where a ground point lands on screen for a pose (camera looks at (0,0,tz) from elevation e at distance D)
  const se = Math.sin(P.e), ce = Math.cos(P.e), dy = y - P.D * se, dz = z - (P.tz + P.D * ce), zc = -dy * se - dz * ce, yc = dy * ce - dz * se, tf = Math.tan(P.fov * Math.PI / 360);
  return [x / (zc * tf * asp), yc / (zc * tf)];
}
function fits(P, pts, w, h, top, bot, pad) {
  const asp = w / h, ys = (bot - top) / 2, yMax = h / 2 - top - pad, yMin = -(h / 2 - bot) + pad;
  for (const p of pts) { const q = ndc(p[0], p[1], p[2], P, asp), py = q[1] * h / 2 + ys; if (Math.abs(q[0]) * w / 2 > w / 2 - pad || py > yMax || py < yMin) return false; }
  return true;
}
function solvePose(hi, w, h, top, bot) {
  const P = { e: (hi ? 58 : 54) * Math.PI / 180, fov: hi ? 34 : 30, D: 30, tz: 0, ys: (bot - top) / 2 }, pad = 8, F2 = FWW / 2, asp = w / h;
  const bis = pts => { let a = 10, b = 900; for (let i = 0; i < 40; i++) { P.D = (a + b) / 2; if (fits(P, pts, w, h, top, bot, pad)) b = P.D; else a = P.D; } P.D = b; };
  if (hi) {
    const zf = wz(Math.max(90, H * .22) - 14); P.tz = zf / 2 + .6; bis([[-F2, 0, zf], [F2, 0, zf], [-F2, 0, 1.2], [F2, 0, 1.2], [-F2, 2.7, 1.2], [F2, 2.7, 1.2]]);
  } else {                           // battle: the wall at the bottom, and the field out to about a sixth of the way from the far edge, so archer and tower range reads true
    const zf = wz(150); P.tz = zf / 2 + .6; bis([[-F2 - .6, 0, zf], [F2 + .6, 0, zf], [-F2 - .6, 0, 1.2], [F2 + .6, 0, 1.2], [-F2, 2.7, 1.2], [F2, 2.7, 1.2]]);
  }
  return P;
}
function resize() {
  const vw = innerWidth, vh = innerHeight; if (!vw || !vh || !renderer) return;
  dpr = Math.min(devicePixelRatio || 1, qDpr);
  renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false); cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
  ov.width = Math.round(vw * dpr); ov.height = Math.round(vh * dpr); ov.style.width = vw + 'px'; ov.style.height = vh + 'px'; ox.setTransform(dpr, 0, 0, dpr, 0, 0);
  cam.w = vw; cam.h = vh; cam.key = ''; setCamTarget(true);
}
function setCamTarget(snap) {
  const w = innerWidth, h = innerHeight, top = w < 500 ? 56 : 60, over = !!(G && G.phase === 'over' && !scr.hidden), pnl = over && scr.querySelector('.panel'), shopH = over ? Math.min((pnl ? pnl.offsetHeight : 320) + 34, h * .64) : Math.min(sheet.offsetHeight || 260, h * .6), key = w + 'x' + h + 'x' + shopH;
  if (key !== cam.key) { cam.key = key; cam.lo = solvePose(false, w, h, top, 0); cam.hi = solvePose(true, w, h, top, shopH); }
  const tv = (G && G.phase === 'build' && !sheet.hidden) || over ? 1 : 0;
  $('#app').style.setProperty('--shopH', (tv && !over ? shopH : 0) + 'px');
  if (snap || RM) { cam.v = cam.from = cam.to = tv; cam.dur = 1; cam.t0 = -1e9; }
  else if (tv !== cam.to) { cam.from = cam.v; cam.to = tv; cam.t0 = performance.now(); cam.dur = tv ? 1700 : 1200; }
}
new ResizeObserver(() => setCamTarget(false)).observe(sheet);
addEventListener('resize', () => { if (headless) return; resize(); });
function toWorld(cx, cy) {            // a tap on the screen -> the spot on the ground, in sim coordinates
  tV.set(cx / cam.w * 2 - 1, -(cy / cam.h * 2 - 1), .5).unproject(camera); tD.copy(tV).sub(camera.position);
  const t = tD.y ? -camera.position.y / tD.y : 0; tP.copy(camera.position).addScaledVector(tD, t);
  return [tP.x / K + W / 2, tP.z / K + GL];
}
function toScreen(x, y, z, out) { tV.set(x, y, z).project(camera); out[0] = (tV.x * .5 + .5) * cam.w; out[1] = (-tV.y * .5 + .5) * cam.h; out[2] = tV.z; return out; }

/* ---- the world ---- */
function inst(g, mat, n) { const m = new THREE.InstancedMesh(g, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.setColorAt(0, tC.set(0xffffff)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.count = 0; scene.add(m); return m; }
function initScene() {
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' }); }
  catch (e) { renderer = null; document.body.insertAdjacentHTML('beforeend', '<p style="position:absolute;z-index:9;inset:0;display:grid;place-items:center;margin:0;padding:24px;color:#8b8a93;text-align:center">Defend Humanity needs WebGL, and this browser has it turned off.</p>'); return; }
  scene = new THREE.Scene(); scene.background = new THREE.Color(FOGC); scene.fog = new THREE.FogExp2(FOGC, .011);
  camera = new THREE.PerspectiveCamera(30, 1, .5, 260);
  scene.add(new THREE.HemisphereLight(0xb4c0e4, 0x5a4a34, 2.6));
  const moon = new THREE.DirectionalLight(0xc4d0ff, 1.6); moon.position.set(-8, 16, 10); scene.add(moon);
  torchA = new THREE.PointLight(0x58c0ff, 90, 22, 2); torchB = torchA.clone(); torchA.position.set(-3.4, 3, 1.4); torchB.position.set(3.4, 3, 1.4); scene.add(torchA, torchB);
  const rng = mulberry(7);
  // ground
  { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#3d3326'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = rng(); g.fillStyle = v < .5 ? 'rgba(78,92,44,.55)' : v < .8 ? 'rgba(24,17,10,.5)' : 'rgba(120,98,64,.4)'; g.fillRect(rng() * 256, rng() * 256, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 26); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 200), new THREE.MeshLambertMaterial({ map: t })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -90); scene.add(m);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(6, 130), new THREE.MeshBasicMaterial({ color: 0x120d08, transparent: true, opacity: .28, depthWrite: false })); lane.rotation.x = -Math.PI / 2; lane.position.set(0, .01, -60); scene.add(lane); }
  // the data centre: concrete shell, cooling stacks, a blast door, and racks that blink along the face
  { const stone = new THREE.MeshLambertMaterial({ color: 0x4a525c }), stoneD = new THREE.MeshLambertMaterial({ color: 0x2e343c }), roofM = new THREE.MeshLambertMaterial({ color: 0x59636e }); matGate = new THREE.MeshLambertMaterial({ color: 0x2c3a46 }); wallMats = [stone, stoneD, matGate, roofM];
    const ww = FWW + 8, wf = .55, add = (g, m, x, y, z, ry) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; scene.add(o); return o; };
    add(new THREE.BoxGeometry(ww, 2.2, 1.7), stone, 0, 1.1, wf + .85); add(new THREE.BoxGeometry(ww, .12, 1.7), stoneD, 0, 2.26, wf + .85);
    const n = Math.floor(ww / 1), mer = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .6, .5), stoneD, n), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) { d.position.set(-ww / 2 + .5 + i * (ww - 1) / (n - 1), 2.6, wf + .25); d.updateMatrix(); mer.setMatrixAt(i, d.matrix); } scene.add(mer);
    for (const sx of [-1, 1]) { const x = sx * (ww / 2 - .6); add(new THREE.BoxGeometry(3.2, 5, 3.2), stoneD, x, 2.5, wf + 1.3); add(new THREE.BoxGeometry(3.6, .5, 3.6), stone, x, 5.2, wf + 1.3); add(new THREE.CylinderGeometry(1.0, 1.2, 1.6, 8), roofM, x, 6.2, wf + 1.3); add(new THREE.SphereGeometry(.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }), x, 7.2, wf + 1.3); }
    add(new THREE.BoxGeometry(4.2, 2.7, .5), matGate, 0, 1.35, wf - .05); add(new THREE.BoxGeometry(5, 3.3, .3), stoneD, 0, 1.65, wf + .12);
    const rows = [.5, 1.0, 1.5, 2.0], cols = []; for (let x = -ww / 2 + 3.4; x < ww / 2 - 3.4; x += .55) if (Math.abs(x) > 3.2) cols.push(x);
    leds = new THREE.InstancedMesh(new THREE.BoxGeometry(.14, .14, .06), new THREE.MeshBasicMaterial({ fog: false }), rows.length * cols.length); let k = 0;
    for (const y of rows) for (const x of cols) { d.position.set(x, y, wf - .02); d.updateMatrix(); leds.setMatrixAt(k, d.matrix); leds.setColorAt(k++, tC.setHex([0x39e07a, 0x4ac8ff, 0xffb02e, 0x1a2630][(Math.random() * 4) | 0])); }
    scene.add(leds);
    for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(.18, 1.3, .18), new THREE.MeshLambertMaterial({ color: 0x20262e }), sx * 3.5, 1.6, wf - .05); flames.push(add(new THREE.SphereGeometry(.24, 6, 6), new THREE.MeshBasicMaterial({ color: 0x4ad0ff }), sx * 3.5, 2.4, wf - .05)); } }
  buildDefences(store.prestige || 0);
  // trees and grass
  { const n = 130, crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.2, 6).translate(0, 3.2, 0), new THREE.MeshLambertMaterial({ color: 0x16301c }), n), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .3, 1.4, 5).translate(0, .7, 0), new THREE.MeshLambertMaterial({ color: 0x3a2815 }), n), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const far = i >= 100, side = i % 2 ? 1 : -1, x = far ? (rng() - .5) * 46 : side * (FWW / 2 + 2.6 + rng() * 11), z = far ? ZF - 6 - rng() * 22 : 4 - rng() * (-ZF + 40), s = .8 + rng() * .8;
      d.position.set(x, 0, z); d.scale.set(s, s * (.9 + rng() * .4), s); d.rotation.y = rng() * 6; d.updateMatrix(); crown.setMatrixAt(i, d.matrix); trunk.setMatrixAt(i, d.matrix);
    }
    scene.add(crown, trunk);
    const gn = 1000, gr = new THREE.InstancedMesh(new THREE.ConeGeometry(.07, .45, 3).translate(0, .22, 0), new THREE.MeshLambertMaterial({ color: 0x4d5a2a }), gn);
    for (let i = 0; i < gn; i++) { d.position.set((rng() - .5) * (FWW + 14), 0, 2 - rng() * (-ZF + 20)); d.scale.setScalar(.6 + rng() * .8); d.rotation.set((rng() - .5) * .4, rng() * 6, (rng() - .5) * .4); d.updateMatrix(); gr.setMatrixAt(i, d.matrix); }
    scene.add(gr); }
  // the edge of the field: low rocks and a few boulders in broken runs, with a faint worn strip beside them. Present enough to read as a boundary, quiet enough to feel like open ground
  { const L0 = 1.6, L1 = ZF + .5, ex = FWW / 2 + .5, d = new THREE.Object3D(), er = mulberry(11), N = 170;
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 0), new THREE.MeshLambertMaterial({ flatShading: true }), N), c = new THREE.Color(); let n = 0;
    const put = (x, z, sc) => { if (n >= N) return; d.position.set(x, sc * .16, z); d.scale.set(sc * (.9 + er() * .6), sc * (.5 + er() * .35), sc * (.9 + er() * .6)); d.rotation.set(er() * .5, er() * 6.3, er() * .5); d.updateMatrix(); rocks.setMatrixAt(n, d.matrix); const g = .19 + er() * .1; rocks.setColorAt(n, c.setRGB(g * 1.04, g, g * .88)); n++; };
    for (const sd of [-1, 1]) for (let z = L0; z > L1; z -= .5 + er() * .7) { const t = (L0 - z) / (L0 - L1); if (er() < .28 + .6 * t) { z -= 1.2 + er() * 2; continue; } const f = 1 - .65 * t; put(sd * (ex + (er() - .5) * .8), z, (er() < .1 ? .55 + er() * .2 : .25 + er() * .25) * f); if (er() < .3 * (1 - t)) put(sd * (ex + .3 + er() * .6), z + er(), (.18 + er() * .2) * f); }
    rocks.count = n; rocks.instanceMatrix.needsUpdate = true; rocks.instanceColor.needsUpdate = true; scene.add(rocks); }
  // mist where the enemies come from: two drifting banks lying over the far end, thick at the edge and gone by the middle of the field
  { const mk = seed => { const er = mulberry(seed), cn = document.createElement('canvas'); cn.width = cn.height = 256; const g = cn.getContext('2d');
      for (let k = 0; k < 90; k++) { const x = er() * 256, y = er() * 256 * .8, r = 30 + er() * 50, a = .12 + er() * .16; for (const dx of [-256, 0, 256]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, `rgba(150,165,190,${a})`); gr.addColorStop(1, 'rgba(150,165,190,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2); } }
      g.globalCompositeOperation = 'destination-in'; const fade = g.createLinearGradient(0, 0, 0, 256); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.35, 'rgba(0,0,0,.85)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(cn); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
    [[5, .5, .85], [9, 1.7, .6]].forEach(([sd, y, op], i) => { const t = mk(sd), m = new THREE.Mesh(new THREE.PlaneGeometry(FWW + 16, 22), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, y, ZF + 3); m.renderOrder = 2; scene.add(m); mists.push(t); }); }
  // buildings
  buildGeos();
  matS = new THREE.MeshLambertMaterial({ vertexColors: true }); matSF = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x8a4a22 });
  matGhostOK = new THREE.MeshBasicMaterial({ color: 0x78e696, transparent: true, opacity: .55, depthWrite: false }); matGhostBad = new THREE.MeshBasicMaterial({ color: 0xf05a46, transparent: true, opacity: .55, depthWrite: false });
  // the placing hints
  { const y0 = Math.max(90, H * .22), h0 = GL - 22 - y0, zw = W * K, zd = h0 * K, zc = wz(y0 + h0 / 2);
    zone = new THREE.Mesh(new THREE.PlaneGeometry(zw, zd), new THREE.MeshBasicMaterial({ color: 0xe0b04a, transparent: true, opacity: .09, depthWrite: false })); zone.rotation.x = -Math.PI / 2; zone.position.set(0, .03, zc); zone.visible = false; scene.add(zone);
    const pts = [[-zw / 2, -zd / 2], [zw / 2, -zd / 2], [zw / 2, zd / 2], [-zw / 2, zd / 2]].map(p => new THREE.Vector3(p[0], .05, zc + p[1]));
    zoneLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xe0b04a, dashSize: .5, gapSize: .4, transparent: true, opacity: .55 })); zoneLine.computeLineDistances(); zoneLine.visible = false; scene.add(zoneLine); }
  auraLight = new THREE.PointLight(0xffc060, 0, 18, 2); scene.add(auraLight); vig = $('#vig');
  stainCv = document.createElement('canvas'); stainCv.width = 256; stainCv.height = Math.round(256 * H / W); stainCx = stainCv.getContext('2d'); stainTex = new THREE.CanvasTexture(stainCv); stainTex.colorSpace = THREE.SRGBColorSpace;
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(W * K, H * K), new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, .02, (ZF + wz(H)) / 2); scene.add(m); }
  markRing = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xe0b04a, transparent: true, depthWrite: false, side: THREE.DoubleSide })); markRing.rotation.x = -Math.PI / 2; markRing.visible = false; scene.add(markRing);
  ghostG = new THREE.Group(); ghostMesh = new THREE.Mesh(GEO.palisade, matGhostOK); ghostFoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x78e696, transparent: true, opacity: .3, depthWrite: false })); ghostFoot.rotation.x = -Math.PI / 2; ghostFoot.position.y = .04;
  ghostRing = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .2, depthWrite: false })); ghostRing.rotation.x = -Math.PI / 2; ghostRing.position.y = .05;
  ghostG.add(ghostMesh, ghostFoot, ghostRing); ghostG.visible = false; scene.add(ghostG);
  // the banner
  { const pole = new THREE.Mesh(CYL, new THREE.MeshLambertMaterial({ color: 0x5a3d22 })); pole.scale.set(.09, 3.8, .09); pole.position.y = 1.9; const knob = new THREE.Mesh(new THREE.SphereGeometry(.14, 6, 6), new THREE.MeshLambertMaterial({ color: 0xc9a24a })); knob.position.y = 3.85;
    flag = new THREE.Mesh(new THREE.BoxGeometry(1.3, .85, .04).translate(.65, 0, 0), new THREE.MeshLambertMaterial({ color: 0x3d6ab0, emissive: 0x0a1a3a })); flag.position.set(.05, 3.3, 0);
    const em = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .05), new THREE.MeshLambertMaterial({ color: 0xe0b04a })); em.position.set(.6, 3.3, 0);
    banner = new THREE.Group(); banner.add(pole, knob, flag, em); banner.visible = false; scene.add(banner); flag.userData.em = em; }
  // everyone who fights: instanced parts, one draw call each
  const mu = new THREE.MeshLambertMaterial();
  mBody = inst(new THREE.BoxGeometry(.56, .78, .38).translate(0, .79, 0), mu, NU); mHead = inst(new THREE.BoxGeometry(.38, .38, .38), mu, NU); mHat = inst(BOX, mu, NU);
  mLegL = inst(new THREE.BoxGeometry(.2, .42, .22).translate(0, -.21, 0), mu, NU); mLegR = inst(new THREE.BoxGeometry(.2, .42, .22).translate(0, -.21, 0), mu, NU);
  mWpn = inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -.5), mu, NU); mAcc = inst(BOX, mu, NU);
  mBlob = inst(new THREE.CircleGeometry(.6, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .38, depthWrite: false }), NU + 20);
  mCatB = inst(new THREE.BoxGeometry(1.1, .5, 1.2).translate(0, .5, 0), mu, 20); mCatA = inst(new THREE.BoxGeometry(.12, .12, 1.4).translate(0, 0, .7), mu, 20);
  mArrow = inst(new THREE.BoxGeometry(.04, .04, .9), new THREE.MeshBasicMaterial(), NPR); mPart = inst(BOX, new THREE.MeshBasicMaterial(), NPT);
}

/* ---- drawing the field ---- */
const C_ARROW = new THREE.Color(0xe9dcb4), C_FIRE = new THREE.Color(0xffb04a), C_SLING = new THREE.Color(0x5ae0ff), C_BOLT = new THREE.Color(0xd9dde4), C_STONE = new THREE.Color(0x8a867c);
function tint(col, flash, burn, dark) { if (flash) col.lerp(WHITE, .6); else if (burn) col.lerp(FIRE, .35); if (dark) col.multiplyScalar(dark); return col; }
function figure(i, L, v, X, Z, yaw, tilt, yoff, sc, ph, mv, lunge, flash, burn, dark, tier) {
  const sx = L.sh[0] * sc, sy = L.sh[1] * sc, sz = L.sh[2] * sc, f = lunge * .32 * sc;
  tE.set(tilt, yaw, 0, 'YXZ'); tQ.setFromEuler(tE); tV.set(X - Math.sin(yaw) * f, yoff + (mv ? Math.abs(Math.sin(ph)) * .07 * sy : 0), Z - Math.cos(yaw) * f);
  const M = tM.compose(tV, tQ, tS.set(sx, sy, sz)); mBody.setMatrixAt(i, M); mBody.setColorAt(i, tint(tC.copy(L.bodyC[v]), flash, burn, dark));
  const hp = L.hp, hs = L.hs; tL.compose(tP.set(hp[0], hp[1], hp[2]), QI, tD.set(hs[0], hs[1], hs[2])).premultiply(M); mHead.setMatrixAt(i, tL); mHead.setColorAt(i, tint(tC.copy(L.skinC[v]), flash, burn, dark));
  if (L.hat) { const h = L.hat; tL.compose(tP.set(h.p[0], h.p[1], h.p[2]), QI, tD.set(h.s[0], h.s[1] * (1 + .5 * tier), h.s[2])).premultiply(M); mHat.setMatrixAt(i, tL); mHat.setColorAt(i, tint(tC.copy(tier ? TIERC[tier] : h.cc), flash, burn, dark)); } else mHat.setMatrixAt(i, ZERO);
  const sw = mv ? Math.sin(ph) * .75 : 0;
  if (L.nolegs) { mLegL.setMatrixAt(i, ZERO); mLegR.setMatrixAt(i, ZERO); } else {
  tE.set(sw, 0, 0); tQ.setFromEuler(tE); tL.compose(tP.set(-.14, .42, 0), tQ, tD.set(1, 1, 1)).premultiply(M); mLegL.setMatrixAt(i, tL); mLegL.setColorAt(i, tint(tC.copy(L.legC), flash, burn, dark));
  tE.set(-sw, 0, 0); tQ.setFromEuler(tE); tL.compose(tP.set(.14, .42, 0), tQ, tD.set(1, 1, 1)).premultiply(M); mLegR.setMatrixAt(i, tL); mLegR.setColorAt(i, tint(tC.copy(L.legC), flash, burn, dark)); }
  if (L.wp) { const w = L.wp; tE.set(w.rx - lunge * w.sw, 0, 0); tQ.setFromEuler(tE); tL.compose(tP.set(w.p[0], w.p[1], w.p[2]), tQ, tD.set(w.th, w.th, w.len)).premultiply(M); mWpn.setMatrixAt(i, tL); mWpn.setColorAt(i, tint(tC.copy(w.cc), flash, 0, dark)); } else mWpn.setMatrixAt(i, ZERO);
  const a = L.acc || (tier ? CAPE : null); if (a) { tL.compose(tP.set(a.p[0], a.p[1], a.p[2]), QI, tD.set(a.s[0], a.s[1], a.s[2])).premultiply(M); mAcc.setMatrixAt(i, tL); mAcc.setColorAt(i, tint(tC.copy(!L.acc && tier === 2 ? TIERC[2] : a.cc), flash, burn, dark)); } else mAcc.setMatrixAt(i, ZERO);
}
function stamp(x, y, side, big) {   // a stain on the ground where someone fell
  if (!stainCx) return; const pw = G ? G.pw || 0 : 0, px = x / W * stainCv.width, py = y / H * stainCv.height, r = (5 + rnd() * 7 + big * 9) * (1 + pw * .12), g = stainCx.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, side ? EPAL[PI].stain : 'rgba(150,20,20,.5)'); g.addColorStop(1, EPAL[PI].fade); stainCx.fillStyle = g; stainCx.fillRect(px - r, py - r, r * 2, r * 2); stainDirty = true;
}
let nB = 0;
function blobAt(X, Z, r) { tM.makeScale(r, 1, r).setPosition(X, .03, Z); mBlob.setMatrixAt(nB++, tM); }
function catPiece(i, u) {
  const t = u.tgt, yaw = t && !t.dead ? Math.atan2(-(t.x - u.x), -(t.y - u.y)) : 0, X = wx(u.x), Z = wz(u.y), r = 1 - clamp(u.cd / u.d.rate, 0, 1);
  tE.set(0, yaw, 0); tQ.setFromEuler(tE); const ks = 1.5 * u.scale / 1.4, M = tM.compose(tV.set(X, 0, Z), tQ, tS.set(ks, ks, ks));
  mCatB.setMatrixAt(i, M); mCatB.setColorAt(i, tint(tC.set(0x6b4a2a), u.flash > 0, 0, 0));
  tE.set(-2.3 + 2.8 * r, 0, 0); tQ.setFromEuler(tE); tL.compose(tP.set(0, .85, .25), tQ, tD.set(1, 1, 1)).premultiply(M); mCatA.setMatrixAt(i, tL); mCatA.setColorAt(i, tC.set(0x8a6238)); blobAt(X, Z, 1.2 * ks / 1.5);
}
function drawUnits() {
  let nU = 0, nC = 0; nB = 0; const now = performance.now(), introHide = !!(G && G.phase === 'intro');   // troops step aside for the new-enemy reveal
  for (let k = 0; k < U.length; k++) {
    const u = U[k], L = LOOK[u.key]; if (introHide && !u.side) continue;
    if (u.key === 'cat') { if (nC < 16) catPiece(nC++, u); continue; }
    if (nU >= NU - CORPSE_MAX) break;
    const tg = u.tgt, spd2 = u.vx * u.vx + u.vy * u.vy; let dx, dz;
    if (tg && !tg.dead && tg.hp > 0) { dx = tg.x - u.x; dz = tg.y - u.y; } else if (spd2 > 36) { dx = u.vx; dz = u.vy; } else { dx = 0; dz = u.side ? 1 : -1; }
    const ty = Math.atan2(-dx, -dz); if (u.yawSet !== undefined) u.yaw = u.yawSet; else if (u.yaw === undefined) u.yaw = ty; else { let d = ty - u.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); u.yaw += d * .18; }
    const a = u.atk > 0 ? u.atk / .16 : 0, lunge = a > 0 ? Math.sin(Math.PI * (1 - a)) : 0, sc = figScale(u.key, u.scale, u.tier), X = wx(u.x), Z = wz(u.y);
    figure(nU++, L, u.v % 3, X, Z, u.yaw, 0, (L.fl ? L.fl * sc + Math.sin(now / 420 + u.uid * 1.7) * .09 * sc : 0) + (u.lift || 0), sc, u.anim * 4.4, spd2 > 36 || u.moving, lunge, u.flash > 0, u.burn > 0, 0, u.tier || 0);
    blobAt(X, Z, .62 * sc * Math.max(L.sh[0], L.sh[2]) * (u.key === 'horse' ? .8 : .9));
  }
  for (let k = CORPSES.length - 1; k >= 0 && nU < NU; k--) {
    const c = CORPSES[k]; c.age += 1 / 60; if (c.age > 13) { CORPSES.splice(k, 1); continue; }
    const L = LOOK[c.key], f = Math.min(1, c.age / .28), sink = c.age > 9 ? (c.age - 9) * .5 : 0, sc = figScale(c.key, c.scale, c.tier);
    figure(nU++, L, c.v % 3, wx(c.x), wz(c.y), c.yaw, f * c.dir * 1.5, .13 * f * sc - sink, sc, 0, false, 0, false, false, .6, c.tier || 0);
    if (!sink) blobAt(wx(c.x), wz(c.y), .6 * sc);
  }
  for (const m of [mBody, mHead, mHat, mLegL, mLegR, mWpn, mAcc]) { m.count = nU; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  mBlob.count = nB; mBlob.instanceMatrix.needsUpdate = true;
  mCatB.count = mCatA.count = nC; for (const m of [mCatB, mCatA]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
}
function drawProj() {
  let n = 0; const pwm = 1 + (G ? G.pw || 0 : 0) * .1;
  for (let k = 0; k < PR.length && n < NPR; k++) {
    const p = PR[k]; let x = wx(p.x), z = wz(p.y), y = 1, dx = 0, dy = 0, dz = -1, sl = 1, th = 1, c = C_ARROW;
    if (p.k === 'arrow' || p.k === 'sling') {
      const dist = hyp(p.lx - p.x, p.ly - p.y), f = clamp(1 - dist / p.d0, 0, 1), ap = Math.min(3.2, p.d0 * K * .22);
      y = .9 + 4 * ap * f * (1 - f); dx = p.dx || 0; dz = p.dy || -1; dy = 4 * ap * (1 - 2 * f) / Math.max(.5, p.d0 * K);
      if (p.k === 'sling') { sl = .3; th = 1.7; c = C_SLING; } else if (p.fire) c = C_FIRE;
    } else if (p.k === 'bolt') { const l = hyp(p.vx, p.vy) || 1; y = 1.1; dx = p.vx / l; dz = p.vy / l; dy = 0; th = 1.9; sl = 1.25; c = C_BOLT; }
    else if (p.k === 'stone') { y = .5 + p.z * KY; dx = 1; dz = 0; sl = .35; th = 5; c = C_STONE; }
    else { const f = p.t / p.T; y = 150 * (1 - f) * KY + .3; dx = 0; dy = -1; dz = .02; if (p.fire) c = C_FIRE; }
    tD.set(dx, dy, dz).normalize(); tQ.setFromUnitVectors(UZ, tD); tM.compose(tV.set(x, y, z), tQ, tS.set(th * pwm, th * pwm, sl * pwm)); mArrow.setMatrixAt(n, tM); mArrow.setColorAt(n, c); n++;
  }
  mArrow.count = n; mArrow.instanceMatrix.needsUpdate = true; mArrow.instanceColor.needsUpdate = true;
  let m = 0;
  for (let k = 0; k < PT.length && m < NPT; k++) { const p = PT[k], s = .11 * (p.s || 1) * Math.min(1, p.life * 4) * 1.3; tM.compose(tV.set(wx(p.x), p.h * KY + .03, wz(p.y)), QI, tS.set(s, s, s)); mPart.setMatrixAt(m, tM); mPart.setColorAt(m, cc(p.c)); m++; }
  mPart.count = m; mPart.instanceMatrix.needsUpdate = true; mPart.instanceColor.needsUpdate = true;
}
function structMesh(s) {
  let o = structObjs.get(s.uid);
  if (!o) {
    const mesh = new THREE.Mesh(GEO[s.t], matS), foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf05a46, transparent: true, opacity: .35, depthWrite: false }));
    foot.rotation.x = -Math.PI / 2; foot.position.y = .06; foot.scale.set((s.w + 6) * K, (s.h + 6) * K, 1); foot.visible = false; mesh.add(foot); mesh.userData.foot = foot; scene.add(mesh); o = { mesh }; structObjs.set(s.uid, o);
  }
  return o;
}
function render(t) {
  if (!renderer) return;
  const w = cam.w, h = cam.h, now = performance.now();
  // the camera: low and close for battle, high and wide for the shop, with a slow swing between the two
  const pr = clamp((now - cam.t0) / cam.dur, 0, 1), e = easeIO(pr); cam.v = cam.from + (cam.to - cam.from) * e;
  const lo = cam.lo, hi = cam.hi, v = cam.v, ang = pr < 1 ? Math.sin(pr * Math.PI) * .22 * (cam.to > cam.from ? 1 : -1) : 0;
  const pe = lo.e + (hi.e - lo.e) * v, pD = Math.exp(Math.log(lo.D) + (Math.log(hi.D) - Math.log(lo.D)) * v), ptz = lo.tz + (hi.tz - lo.tz) * v, pys = lo.ys + (hi.ys - lo.ys) * v, pf = lo.fov + (hi.fov - lo.fov) * v;
  let jx = 0, jy = 0; if (cam.shake > .05) { jx = (rnd() - .5) * cam.shake * .1; jy = (rnd() - .5) * cam.shake * .1; cam.shake *= .88; }
  const ce = Math.cos(pe), se = Math.sin(pe), sway = G ? 0 : Math.sin(now / 5200) * .06;
  scene.fog.density = .6 / pD; camera.fov = pf; camera.aspect = w / h; camera.setViewOffset(w, h, 0, pys, w, h);
  camera.position.set(Math.sin(ang + sway) * pD * ce + jx, pD * se + jy, ptz + Math.cos(ang + sway) * pD * ce); camera.lookAt(0, 0, ptz);
  if (roam.on) { if (roam.dir) roam.dir(now); else if (!roam.touched) roam.yaw += (now - roam.t) * .00009; roam.t = now; const cp = Math.cos(roam.pitch); camera.fov = roam.fov; if (roam.shift) camera.setViewOffset(w, h, 0, roam.shift, w, h); else camera.clearViewOffset(); camera.position.set(roam.tx + Math.sin(roam.yaw) * roam.dist * cp + jx, roam.dist * Math.sin(roam.pitch) + jy, roam.tz + Math.cos(roam.yaw) * roam.dist * cp); camera.lookAt(roam.tx, roam.ty, roam.tz); camera.updateProjectionMatrix(); scene.fog.density = .55 / roam.dist; }
  // how bad it has got: the more you have killed, the redder the sky, the brighter the fires, the fiercer the sparks
  let pw = 0; if (G) { G.pw = (G.pw || 0) + (clamp(Math.log2(1 + G.kills / 40), 0, 6) - (G.pw || 0)) * .02; pw = G.pw; }
  const pk = pw / 6, tp = 1 + pw * .15; tC.setHex(FOGC).lerp(CRIM, pk * .8); scene.background.copy(tC); scene.fog.color.copy(tC);
  auraLight.intensity = pw * 10; if (G) auraLight.position.set(wx(G.bx), 3.2, wz(G.by + 8));
  if (vigKey !== ((pk * 50) | 0)) { vigKey = (pk * 50) | 0; vig.style.opacity = (pk * .6).toFixed(2); }
  const kt = Math.min(5, pw | 0); if (kt !== killTier) { killTier = kt; el.killsB.style.color = KCOL[kt]; }
  if (G && G.phase === 'battle' && qLevel === 0 && pw > .8 && PT.length < MAXP - 20 && rnd() < pk * .55) PT.push({ x: rnd() * W, y: GL - rnd() * H * .7, h: rnd() * 10, vx: (rnd() - .5) * 14, vy: -rnd() * 10, vh: 14 + rnd() * 16, g: -2, life: 2.2 + rnd() * 1.6, c: rnd() < .5 ? '#ff9a3c' : '#ffd27a', s: .8 });
  if (stainDirty && ++stainTick % 3 === 0) { stainTex.needsUpdate = true; stainDirty = false; }
  // light and scenery
  const fl = 1 + Math.sin(t / 90) * .12 + Math.sin(t / 37 + 1) * .08; torchA.intensity = 90 * fl * tp; torchB.intensity = 90 * (2 - fl) * tp; for (let i = 0; i < flames.length; i++) { const s = .9 + (i ? 2 - fl : fl) * .12; flames[i].scale.setScalar(s); }
  const hurtG = G && G.gflash > 0 ? G.gflash * 4 : 0; for (const m of wallMats) m.emissive.setRGB(hurtG, hurtG * .15, hurtG * .1);
  if (G) matGate.color.setHex(G.gate < G.gateMax * .5 ? 0x4a2024 : 0x2c3a46);
  for (const b of dcBeams) b.rotation.y = Math.sin(t / 2200 + b.userData.ph) * .5;
  for (let i = 0; i < dcBlink.length; i++) dcBlink[i].material.color.setHex((((t / 700) | 0) + i) % 2 ? 0xff3030 : 0x401010);
  if (mists.length) { mists[0].offset.x = t * 6e-6; mists[1].offset.x = -t * 9e-6; }
  if (leds && t - ledT > 160) { ledT = t; const lc = [0x39e07a, 0x39e07a, 0x4ac8ff, 0xffb02e, 0x1a2630]; for (let k = 0; k < 14; k++) leds.setColorAt((Math.random() * leds.count) | 0, tC.setHex(lc[(Math.random() * 5) | 0])); leds.instanceColor.needsUpdate = true; }
  // field
  if (G) {
    drawUnits(); drawProj();
    const seen = ++frameSeen;
    for (const s of S) { const o = structMesh(s); o.seen = seen; o.mesh.visible = G.phase !== 'intro'; o.mesh.position.set(wx(s.x), 0, wz(s.y)); o.mesh.material = s.flash > 0 ? matSF : matS; o.mesh.userData.foot.visible = tool === 'sell' && G.phase === 'build'; }
    for (const [id, o] of structObjs) if (o.seen !== seen) { scene.remove(o.mesh); structObjs.delete(id); }
    banner.visible = G.phase !== 'over' && G.phase !== 'intro'; banner.position.set(wx(G.bx) + .5, 0, wz(G.by + 12)); flag.material.color.setHex(store.prestige ? 0xe0b04a : 0x3d6ab0); flag.rotation.y = Math.sin(t / 380) * .22; flag.scale.x = .9 + Math.sin(t / 190) * .08;
    const building = !!(G.phase === 'build' && tool && tool !== 'sell'); zone.visible = zoneLine.visible = building;
    if (G.mark) { const m = G.mark; m.t -= 1 / 60; markRing.visible = m.t > 0; markRing.position.set(wx(m.x), .06, wz(m.y)); markRing.scale.set(m.r * K, m.r * K, 1); markRing.material.opacity = Math.max(0, m.t / .9) * .7; if (m.t <= 0) G.mark = null; } else markRing.visible = false;
    if (building && ghost) {
      const d = SD[tool], gx = Math.round(ghost.x / 10) * 10, gy = Math.round(ghost.y / 10) * 10, ok = placeOK(tool, gx, gy) && G.gold >= cost(d.cost);
      if (ghostKey !== tool) { ghostKey = tool; ghostMesh.geometry = GEO[tool]; ghostFoot.scale.set(d.w * K, d.h * K, 1); ghostRing.visible = !!d.range; if (d.range) ghostRing.scale.set(d.range * K, d.range * K, 1); }
      ghostMesh.material = ok ? matGhostOK : matGhostBad; ghostFoot.material.color.setHex(ok ? 0x78e696 : 0xf05a46); if (d.range) ghostRing.scale.setScalar(d.range * (tool === 'tower' ? B.range : 1) * K);
      ghostG.position.set(wx(gx), 0, wz(gy)); ghostG.visible = true;
    } else ghostG.visible = false;
  } else { banner.visible = false; ghostG.visible = false; zone.visible = zoneLine.visible = false; markRing.visible = false; }
  renderer.render(scene, camera);
  overlay();
}

/* ---- the flat layer on top: health bars, floating costs, the price tag on the ghost ---- */
const sp = [0, 0, 0], sp2 = [0, 0, 0]; let ovDirty = false;
function bar(x, y, wd, f, col) { ox.fillStyle = '#000'; ox.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 4); ox.fillStyle = col; ox.fillRect(x - wd / 2, y, wd * clamp(f, 0, 1), 2); }
const OVERLAYS = [];          // modes add flat-layer drawing here (the defend intro's speech bubble, say)
function overlay() {
  if (ovDirty) { ox.clearRect(0, 0, cam.w, cam.h); ovDirty = false; }
  if (!G) return;
  for (const u of U) {
    if (!((!u.side && u.hp < u.mhp * .98) || (u.side && u.scale >= 1.5 && u.hp < u.mhp))) continue;
    const sc = figScale(u.key, u.scale, u.tier); toScreen(wx(u.x), (1.95 + (LOOK[u.key].fl || 0)) * sc, wz(u.y), sp); toScreen(wx(u.x) + .5, 1.95 * sc, wz(u.y), sp2);
    bar(sp[0], sp[1] - 4, Math.max(12, Math.abs(sp2[0] - sp[0]) * 2.2 * sc), u.hp / u.mhp, u.side ? '#e0533f' : '#5fcf7a'); ovDirty = true;
  }
  for (const s of S) if (s.hp < s.mhp) { toScreen(wx(s.x), HT[s.t] + .25, wz(s.y), sp); bar(sp[0], sp[1], 26, s.hp / s.mhp, '#d6a63a'); ovDirty = true; }
  if (FT.length) {
    ox.font = '600 12px "JetBrains Mono", monospace'; ox.textAlign = 'center'; ovDirty = true;
    for (let i = FT.length - 1; i >= 0; i--) {
      const f = FT[i]; f.life -= 1 / 60 / 1.1; f.h = (f.h || 0) + .55; if (f.life <= 0) { FT.splice(i, 1); continue; }
      toScreen(wx(f.x), 1 + f.h * KY, wz(f.y), sp); ox.globalAlpha = Math.min(1, f.life * 2.2); ox.fillStyle = '#000'; ox.fillText(f.text, sp[0] + 1, sp[1] + 1); ox.fillStyle = f.col; ox.fillText(f.text, sp[0], sp[1]);
    }
    ox.globalAlpha = 1;
  }
  if (G.phase === 'build' && tool && tool !== 'sell' && ghost) {   // what it costs, right under the thing you are placing
    const d = SD[tool], gx = Math.round(ghost.x / 10) * 10, gy = Math.round(ghost.y / 10) * 10, c = cost(d.cost), afford = G.gold >= c, label = afford ? c + 'g' : 'need ' + c + 'g';
    toScreen(wx(gx), 0, wz(gy + d.h / 2 + 8), sp); ox.font = '600 13px "JetBrains Mono", monospace'; ox.textAlign = 'center'; ox.fillStyle = '#000'; ox.fillText(label, sp[0] + 1, sp[1] + 15); ox.fillStyle = afford ? '#e0b04a' : '#e0533f'; ox.fillText(label, sp[0], sp[1] + 14); ovDirty = true;
  }
  if (G.phase === 'build' && tool === 'sell') {   // what a tap would sell: everything sellable gets a faint ring, the one under the pointer (or picked) gets an orange box and its price
    const hover = ghost ? targetAt(ghost.x, ghost.y) : null, tg = hover || sellSel;
    ox.lineWidth = 1; ox.strokeStyle = 'rgba(255,138,60,.35)';
    for (const u of U) if (!u.side && !u.dead && u !== tg) { toScreen(wx(u.x), 0, wz(u.y), sp); toScreen(wx(u.x) + .7, 0, wz(u.y), sp2); const rx = Math.abs(sp2[0] - sp[0]); ox.beginPath(); ox.ellipse(sp[0], sp[1], rx, rx * .5, 0, 0, 6.3); ox.stroke(); }
    if (tg) {
      const hw = tg.isS ? tg.w / 2 + 3 : tg.r * 1.3 + 3, hh = tg.isS ? tg.h / 2 + 3 : tg.r * 1.3 + 3, pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(c => toScreen(wx(tg.x + c[0]), 0, wz(tg.y + c[1]), [0, 0, 0]));
      ox.beginPath(); pts.forEach((p, i) => i ? ox.lineTo(p[0], p[1]) : ox.moveTo(p[0], p[1])); ox.closePath(); ox.fillStyle = 'rgba(255,122,60,.22)'; ox.fill(); ox.lineWidth = 2; ox.strokeStyle = '#ff7a3c'; ox.stroke();
      const label = 'Sell ' + sellName(tg) + '  +' + sellValueOf(tg) + 'g', lx = (pts[0][0] + pts[1][0]) / 2, ly = Math.min(pts[0][1], pts[1][1]) - 10;
      ox.font = '600 12px "JetBrains Mono", monospace'; ox.textAlign = 'center'; const tw = ox.measureText(label).width + 14, bx = clamp(lx - tw / 2, 4, cam.w - tw - 4);
      ox.fillStyle = 'rgba(20,10,6,.88)'; ox.fillRect(bx, ly - 14, tw, 20); ox.strokeStyle = '#ff7a3c'; ox.lineWidth = 1; ox.strokeRect(bx + .5, ly - 13.5, tw - 1, 19); ox.fillStyle = '#ffb27a'; ox.fillText(label, bx + tw / 2, ly);
    }
    ovDirty = true;
  }
  for (const f of OVERLAYS) f();
  if (FLAG.fps) { ox.font = '12px monospace'; ox.textAlign = 'left'; ox.fillStyle = '#fff'; ox.fillText(Math.round(1000 / fpsAvg) + ' fps · ' + cpuAvg.toFixed(1) + ' ms cpu · ' + U.length + ' units · q' + qLevel + ' · ' + renderer.info.render.calls + ' draws', 12, 96); ovDirty = true; }
}
