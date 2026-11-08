/* Shieldwall: frame loop and boot. Loaded last. */
'use strict';
/* ================= loop ================= */
let last = 0;
let nextDraw = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t < nextDraw - 1.5) return;                      // 60 fps is the ceiling: 120/144 Hz screens skip frames
  nextDraw += 1000 / 60; if (t - nextDraw > 34) nextDraw = t + 1000 / 60;
  const c0 = performance.now();
  const dtms = last ? Math.min(100, t - last) : 16; last = t;
  fpsAvg += (dtms - fpsAvg) * .05;
  if (dtms > 24 && ++slowFrames > 40 && qLevel < 2 && !paused) { qLevel++; slowFrames = 0; qDpr = qLevel === 1 ? 1.5 : 1; resize(); } else if (dtms < 20 && slowFrames > 0) slowFrames--;
  if (G && G.phase === 'intro' && !paused) introTick(dtms / 1000);
  if (G && !paused) { acc += dtms / 1000; let n = 0; while (acc >= CFG.step && n < 4) { step(CFG.step); acc -= CFG.step; n++; } if (n === 4) acc = 0; }
  if (G && G.phase !== 'battle' && (++camTick & 7) === 0) setCamTarget(false);   // the sheet slides in, so re-read its size while building
  attractTick(t); sfx.tick(t); render(t); hud();
  cpuAvg += (performance.now() - c0 - cpuAvg) * .05;
}
let camTick = 0;

/* ================= boot ================= */
initScene(); resize(); initGrid();
showTitle();
if (!q.has('wave') && !q.has('menu') && !q.has('noattract')) attractStart();   // open on the film, a tap shows the menu, leaving it alone brings the film back
window.__game = { applyPrestigeLook, gameOver, showTitle, sfx, cam, CORPSES, render: t => { render(t || performance.now()); hud(); }, get G() { return G; }, get U() { return U; }, get S() { return S; }, CFG, store, step: n => { for (let i = 0; i < (n || 1); i++) step(CFG.step); }, newRun, bot: (w, q, m) => botRun(w || 30, q, m), sendWave, planWave, recruit, place, takeBoon, fireVolley, fireCharge,
  jump(n, gold) { if (!G) newRun(); G.wave = n; G.gold += gold || 0; G.plan = planWave(n); setBoonState(); buildSheet(); refreshSheet(); openPick(); }, qLevel: () => qLevel };
if (q.has('wave') && !q.has('menu')) { newRun(); scr.hidden = true; window.__game.jump(+q.get('wave') || 1, +q.get('gold') || 0); }
requestAnimationFrame(frame);
