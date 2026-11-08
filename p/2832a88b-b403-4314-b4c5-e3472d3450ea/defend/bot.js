/* Defend mode: a dumb headless player for balance testing (__game.bot). */
'use strict';
/* ================= bot (for balance testing; ?bot in console: __game.bot()) ================= */
let botMode = 'mix';     // 'mix' (the default), 'army' (no defences) or 'towers' (no recruits beyond the starting band)
function botBuild() {
  if (!G.taken) { const o = G.offer; const pri = ['plate', 'sharp', 'fletch', 'drill', 'stone', 'tax', 'quart', 'rain', 'muster', 'chest', 'medic', 'longbow', 'fire', 'spikes', 'warcry']; o.sort((a, b) => pri.indexOf(a) - pri.indexOf(b)); takeBoon(o[0]); }
  let guard = 0;
  if (botMode === 'mix' && G.plan.boss) {   // a boss is coming: put most of the gold into towers and ballistas
    let spent = 0, g0 = G.gold;
    while (guard++ < 60 && spent < g0 * .75) { const t = guard % 2 ? 'ballista' : 'tower', c = cost(SD[t].cost); if (G.gold < c) break; let ok = false; for (let k = 0; k < 20 && !ok; k++) ok = place(t, 30 + rnd() * (W - 60), H * .35 + rnd() * (GL - H * .35 - 50)); if (!ok) break; spent += c; }
    guard = 0;
  }
  if (botMode === 'towers') {
    while (guard++ < 80) { const t = guard % 3 ? 'tower' : 'ballista', c = cost(SD[t].cost); if (G.gold < c) break; let ok = false; for (let k = 0; k < 20 && !ok; k++) ok = place(t, 30 + rnd() * (W - 60), H * .3 + rnd() * (GL - H * .3 - 50)); if (!ok) break; }
    if (G.gold > repairCost() + 20 && G.gate < G.gateMax * .7) repairAll(); return;
  }
  while (guard++ < 60) {
    const n = allies(), want = { shield: .14, spear: .34, archer: .30, horse: .12, cat: .10 }; let pick = null, bd = -1;
    for (const k in want) { if (UD[k].max && countOf(k) >= UD[k].max) continue; const def = want[k] - countOf(k) / Math.max(1, n); if (def > bd && G.gold >= cost(UD[k].cost)) { bd = def; pick = k; } }
    if (botMode === 'mix' && G.wave >= 3 && G.wave % 2 === 1 && S.filter(s => s.t === 'tower').length < 6 && G.gold >= cost(SD.tower.cost) + 40) { for (let t = 0; t < 12; t++) if (place('tower', 40 + rnd() * (W - 80), H * .45 + rnd() * (GL - H * .5 - 40))) break; }
    if (botMode === 'mix' && G.wave >= 6 && S.filter(s => s.t === 'ballista').length < 4 && G.gold >= cost(SD.ballista.cost) + 40) { for (let t = 0; t < 12; t++) if (place('ballista', 40 + rnd() * (W - 80), H * .55 + rnd() * (GL - H * .6 - 40))) break; }
    if (!pick || !recruit(pick)) break;
  }
  if (G.gold > repairCost() + 20 && G.gate < G.gateMax * .7) repairAll();
}
function botRun(maxWave, quiet, mode) {
  botMode = mode || 'mix'; const was = headless; headless = true; newRun(); let guard = 0;
  while (G.phase !== 'over' && G.wave <= maxWave) {
    botBuild(); sendWave(); let g2 = 0; const w0 = G.wave;
    while (G.phase === 'battle' && g2++ < 60 * 900) { step(CFG.step); if (g2 % 20 === 0 && G.cdVolley <= 0) fireVolley(); if (g2 % 20 === 0 && G.cdCharge <= 0 && G.enemies > 25) fireCharge(); }
    if (G.phase === 'battle') break; guard++;
    if (!quiet) console.log('wave', w0, 'cleared; army', allies(), 'gold', Math.floor(G.gold), 'gate', Math.round(G.gate));
  }
  const res = { wave: G.wave, score: G.score, army: allies(), over: G.phase === 'over' }; headless = was; return res;
}
