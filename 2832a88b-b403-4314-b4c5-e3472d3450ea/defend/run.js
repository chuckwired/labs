/* Defend mode: the flow of a run (new, save, load, build, battle, clear, game over). */
'use strict';
/* ================= run flow ================= */
function newRun(go) {
  roamOn(false); scr.classList.remove('roaming');
  U = []; S = []; PR = []; PT = []; FT.length = 0; fadeDecals(1);
  G = { phase: 'build', wave: 1, gold: CFG.startGold, goldF: 0, score: 0, kills: 0, gate: CFG.gateStart, gateMax: CFG.gateStart, boons: {}, bx: W / 2, by: GL - 100, taken: null, offer: null, rerolls: 0, time: 0, charge: 0, cdVolley: 0, cdCharge: 0, cdVolleyMax: 1, cdChargeMax: 1, enemies: 0, plan: null, gflash: 0, depth: 0, half: 100, mark: null, volleyQ: null, fx: 0, pw: 0, won: false, st: { slain: {}, lost: 0, lostBy: {}, gateBy: {}, peak: 0, time: 0 } };
  calcB(); initGrid();
  for (const k in CFG.start) for (let i = 0; i < CFG.start[k]; i++) spawnAlly(k, G.bx + (rnd() - .5) * 80, GL - 60 + rnd() * 20);
  layoutSlots(); for (const u of U) { u.x = G.bx + u.dx; u.y = G.by + u.dy; }
  setBoonState(); G.plan = planWave(1); store.run = snapshot(); persist();
  if (go) { scr.hidden = true; sendWave(); } else enterBuild(true);
}
function snapshot() {
  const army = {}; for (const u of U) if (!u.side && !u.dead) { const k = u.key + (u.tier ? '#' + u.tier : ''); army[k] = (army[k] || 0) + 1; }
  return { v: 1, wave: G.wave, gold: Math.floor(G.gold), score: G.score, kills: G.kills, gate: Math.round(G.gate), gateMax: G.gateMax, boons: G.boons, army, taken: G.taken, offer: G.offer, rerolls: G.rerolls, won: G.won, st: G.st,
    structs: S.filter(s => !s.dead).map(s => ({ t: s.t, x: +(s.x / W).toFixed(4), y: +(s.y / H).toFixed(4), hp: Math.round(s.hp), m: Math.round(s.mhp), paid: s.paid })), bx: +(G.bx / W).toFixed(4), by: +(G.by / H).toFixed(4) };
}
function save() { if (headless || !G || G.phase !== 'build') return; store.run = snapshot(); persist(); }
function loadRun(r) {
  U = []; S = []; PR = []; PT = []; fadeDecals(1);
  G = { phase: 'build', wave: r.wave, gold: r.gold, goldF: 0, score: r.score, kills: r.kills, gate: r.gate, gateMax: r.gateMax, boons: r.boons || {}, bx: r.bx * W, by: r.by * H, taken: r.taken || null, offer: r.offer || null, rerolls: r.rerolls || 0, time: 0, charge: 0, cdVolley: 0, cdCharge: 0, cdVolleyMax: 1, cdChargeMax: 1, enemies: 0, plan: null, gflash: 0, depth: 0, half: 100, mark: null, volleyQ: null, fx: 0, pw: 0, won: !!r.won, st: Object.assign({ slain: {}, lost: 0, lostBy: {}, gateBy: {}, peak: 0, time: 0 }, r.st || {}) };
  calcB(); initGrid();
  for (const k in r.army) { const kk = k.split('#')[0], tt = +k.split('#')[1] || 0; if (UD[kk] && tt < CFG.tierMul.length) for (let i = 0; i < r.army[k]; i++) spawnAlly(kk, G.bx, G.by, tt); }
  for (const s of r.structs || []) if (SD[s.t]) S.push({ isS: true, uid: uidc++, t: s.t, x: s.x * W, y: s.y * H, w: SD[s.t].w, h: SD[s.t].h, hp: s.hp, mhp: s.m, cd: .5, flash: 0, dead: false, fresh: false, r: SD[s.t].w / 2, paid: s.paid || SD[s.t].cost, fire: 0 });
  layoutSlots(); for (const u of U) { u.x = G.bx + u.dx; u.y = G.by + u.dy; }
  if (!G.taken && !CFG.boonWave(G.wave)) { G.taken = '-'; G.offer = null; } else if (!G.offer && !G.taken) G.offer = offerBoons();
  G.plan = planWave(G.wave); enterBuild(true);
}
function enterBuild(first) {
  G.phase = 'build'; tool = null; ghost = null; fieldView = false; document.body.className = 'build';
  for (const u of U) if (!u.side) { u.tgt = null; u.vx = u.vy = 0; }
  layoutSlots(); buildSheet(); refreshSheet(); sheet.hidden = false; sheet.classList.remove('fold'); scr.hidden = true; setCamTarget(false); openPick(); if (G.plan && G.plan.boss) { toast('Boss incoming', ED[G.plan.boss].name + ' · prepare your defences'); sfx.play('over'); }
  if (first) setTimeout(() => setCamTarget(false), 380);
}
function sendWave() {
  if (G.phase !== 'build') return;
  const fresh = headless ? [] : introNew(G.plan); if (fresh.length) { startIntro(fresh); return; }   // an enemy the player has not met gets an introduction first
  beginWave();
}
function beginWave() {
  G.phase = 'battle'; G.time = 0; G.charge = 0; G.cdVolley = Math.min(G.cdVolley, 3); G.cdCharge = Math.min(G.cdCharge, 5); tool = null; ghost = null; fieldView = false;
  for (const s of S) s.fresh = false; for (const u of U) u.fresh = false; sellSel = null;
  sheet.hidden = true; placing.hidden = true; document.body.className = 'battle'; setCamTarget(false);
  sfx.play('horn'); toast('Wave ' + waveLabel(G.wave), forecastText(G.plan));
}
function forecastText(plan) { return plan.n === 1 ? 'Tap the field to move your banner' : plan.total + ' coming'; }
function waveCleared() {
  const bonus = Math.round(CFG.clearGold(G.wave) * B.gold); G.gold += bonus; G.score += 100 * G.wave;
  for (const u of U) if (!u.side) { u.hp = u.mhp; }
  G.gate = Math.min(G.gateMax, G.gate + G.gateMax * .2); for (const s of S) s.hp = Math.min(s.mhp, s.hp + s.mhp * .3);
  PR.length = 0; G.volleyQ = null; G.mark = null; fadeDecals(.55);
  const cleared = G.wave; G.wave++; G.rerolls = 0; setBoonState(); G.plan = planWave(G.wave); if (allies() > G.st.peak) G.st.peak = allies();
  if (!headless) { if (cleared > store.best.wave) store.best.wave = cleared; store.best.score = Math.max(store.best.score, G.score); }
  if (cleared >= CFG.winWave && !G.won && !headless) { G.phase = 'clearing'; document.body.className = 'clearing'; sfx.play('fanfare'); shake(3); save2(); setTimeout(showVictory, 1400); return; }
  enterBuildAfterDelay(cleared, bonus);
}
function save2() { store.run = snapshot(); persist(); }
function enterBuildAfterDelay(cleared, bonus) {
  if (headless) { G.phase = 'build'; return; }
  G.phase = 'clearing'; document.body.className = 'clearing'; sfx.play('fanfare'); toast('Wave ' + waveLabel(cleared) + ' cleared', '+' + bonus + ' gold');
  setTimeout(() => { if (G && G.phase === 'clearing') { enterBuild(false); save(); } }, 1500);
}
function gameOver() {
  if (G.phase === 'over') return; G.phase = 'over'; shake(4); sfx.play('over');
  if (headless) return;
  const sc = { name: store.name || 'Anon', wave: G.wave, score: G.score, kills: G.kills, date: Date.now() }, newBest = G.score > store.best.score || G.wave > store.best.wave;
  store.best.wave = Math.max(store.best.wave, G.wave); store.best.score = Math.max(store.best.score, G.score);
  store.scores.push(sc); store.scores.sort((a, b) => b.score - a.score); store.scores = store.scores.slice(0, 5); store.run = null; persist();
  if (headless) return;
  setTimeout(() => showOver(sc, newBest), 900);
}
