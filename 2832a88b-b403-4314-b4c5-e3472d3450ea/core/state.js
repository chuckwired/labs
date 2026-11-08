/* Defend Humanity core: shared mutable state and local storage. */
'use strict';
/* ================= state ================= */
const W = 420, H = 900, GL = H - 40, K = .055;   // the sim field is a fixed 420 x 900; K turns its pixels into world units for the 3D scene
let dpr = 1, qDpr = 2;
let G = null, B = {}, U = [], S = [], PR = [], PT = [], CD = [];
let tool = null, ghost = null, fieldView = false, headless = false, paused = false, uidc = 1, lastW = 0, lastH = 0;
const FLAG = { fps: q.has('fps') };

/* ================= storage ================= */
const KEY = 'defendhumanity:v1', OLD_KEY = 'shieldwall:v1';   // saves live in the browser per site, so never rename again without importing the old key (OLD_KEY below was the working title's)
/* Save format version. Saves written before versioning have no `v` and are the v1 shape.
   To change the shape: bump VERSION and add MIGRATE[oldVersion] = s => { ...edit s...; return s; }.
   Each step upgrades one version, so an old save walks through every step in order. */
const VERSION = 1;
const MIGRATE = {
  // 1: s => { s.something = default; return s; },   // v1 -> v2
};
let readOnly = false;
let store = { v: VERSION, best: { wave: 0, score: 0 }, scores: [], run: null, prestige: 0, name: '', seen: {} };
function migrate(s) {
  let v = s.v || 1;
  if (v > VERSION) return null;                      // saved by a newer build: don't guess at it
  while (v < VERSION) { if (!MIGRATE[v]) return null; s = MIGRATE[v](s); v++; }
  s.v = VERSION; return s;
}
try {
  let raw = localStorage.getItem(KEY);
  if (raw == null) { raw = localStorage.getItem(OLD_KEY); if (raw != null) localStorage.setItem(KEY, raw); }   // first load after the rename: bring the old save across (the old key is left in place)
  const s = JSON.parse(raw);
  if (s && typeof s === 'object') {
    if ((s.v || 1) < VERSION) { try { localStorage.setItem(KEY + ':backup-v' + (s.v || 1), raw); } catch (e) {} }   // keep the old copy in case a migration is wrong
    const m = migrate(s);
    if (m) store = Object.assign(store, m);
    else if ((s.v || 1) > VERSION) readOnly = true;  // saved by a newer build: play, but never overwrite it
  }
} catch (e) {}
function persist() { if (headless || readOnly) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
