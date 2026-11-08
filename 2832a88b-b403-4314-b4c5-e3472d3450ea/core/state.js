/* Shieldwall core: shared mutable state and local storage. */
'use strict';
/* ================= state ================= */
const W = 420, H = 900, GL = H - 40, K = .055;   // the sim field is a fixed 420 x 900; K turns its pixels into world units for the 3D scene
let dpr = 1, qDpr = 2;
let G = null, B = {}, U = [], S = [], PR = [], PT = [], CD = [];
let tool = null, ghost = null, fieldView = false, headless = false, paused = false, uidc = 1, lastW = 0, lastH = 0;
const FLAG = { fps: q.has('fps') };

/* ================= storage ================= */
const KEY = 'shieldwall:v1';   // keep this key: saves live in the browser per site, so renaming it would orphan everyone's progress
let store = { best: { wave: 0, score: 0 }, scores: [], run: null, prestige: 0, name: '', seen: {} };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') store = Object.assign(store, s); } catch (e) {}
function persist() { if (headless) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
