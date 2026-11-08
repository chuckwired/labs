/* Defend mode: recruiting, merging, selling, placing, repairing, boons taken. */
'use strict';
/* ================= economy / shop ================= */
function recruit(key) {
  const d = UD[key], c = cost(d.cost); if (G.gold < c || allies() >= CFG.armyCap) return false;
  if (d.max && countOf(key) >= d.max) return false;
  sfx.play('coin'); G.gold -= c; floatText(G.bx, G.by - 14, '-' + c + 'g', '#e0b04a'); const u = spawnAlly(key, G.bx + (rnd() - .5) * 40, GL + 2); u.v = (rnd() * 3) | 0; u.fresh = true; u.paid = c; layoutSlots(); save(); return true;
}
function countOf(key) { let n = 0; for (const u of U) if (!u.side && !u.dead && u.key === key) n++; return n; }
const tierName = ['', 'II', 'III'];
function tcount(key, tier) { let n = 0; for (const u of U) if (!u.side && !u.dead && u.key === key && (u.tier || 0) === tier) n++; return n; }
function canMerge(key, tier) { return tier < CFG.tierMul.length - 1 && tcount(key, tier) >= CFG.mergeN; }
function merge(key, tier) {             // trade a handful for one stronger figure: fewer bodies on the field, more feeling of progress
  if (!canMerge(key, tier)) return false;
  let sx = 0, sy = 0, n = 0;
  for (let i = U.length - 1; i >= 0 && n < CFG.mergeN; i--) { const u = U[i]; if (!u.side && !u.dead && u.key === key && (u.tier || 0) === tier) { sx += u.x; sy += u.y; n++; U.splice(i, 1); } }
  const u = spawnAlly(key, sx / n, sy / n, tier + 1); sfx.play('boon'); floatText(u.x, u.y - 24, UD[key].one + ' ' + tierName[tier + 1], '#e0b04a'); puff(u.x, u.y, 8, '#e0b04a');
  layoutSlots(); save(); return true;
}
function placeOK(type, x, y) {
  const d = SD[type]; if (x < d.w / 2 + 4 || x > W - d.w / 2 - 4 || y < Math.max(90, H * .22) || y > GL - d.h / 2 - 22) return false;
  for (const s of S) if (!s.dead && Math.abs(s.x - x) < (s.w + d.w) / 2 + 1 && Math.abs(s.y - y) < (s.h + d.h) / 2 + 1) return false;
  return true;
}
function place(type, x, y) {
  const d = SD[type], c = cost(d.cost); x = Math.round(x / 10) * 10; y = Math.round(y / 10) * 10;
  if (G.gold < c || !placeOK(type, x, y)) return false;
  sfx.play('knock'); G.gold -= c; floatText(x, y - d.h / 2 - 8, '-' + c + 'g', '#e0b04a'); const hp = d.hp * B.struct; S.push({ isS: true, uid: uidc++, t: type, x, y, w: d.w, h: d.h, hp, mhp: hp, cd: .5, flash: 0, dead: false, fresh: true, r: d.w / 2, paid: c, fire: 0 }); save(); return true;
}
/* selling: anything you own. New purchases refund in full, the rest 60% */
let sellSel = null;
const unitBase = u => cost(UD[u.key].cost) * Math.pow(CFG.mergeN, u.tier || 0);
const unitValue = u => u.fresh && u.paid && !u.tier ? u.paid : Math.round(unitBase(u) * .6);
const structValue = s => Math.round(s.paid * (s.fresh ? 1 : .6));
const sellValueOf = t => t.isS ? structValue(t) : unitValue(t);
const sellName = t => t.isS ? SD[t.t].name : UD[t.key].one + (t.tier ? ' ' + tierName[t.tier] : '');
function sellTarget(t) {
  const back = sellValueOf(t), x = t.x, y = t.y, top = t.isS ? t.h / 2 + 8 : 22;
  sfx.play('coin'); G.gold += back; floatText(x, y - top, '+' + back + 'g', '#7fd68f'); puff(x, y, 4, '#7fd68f');
  if (t.isS) S.splice(S.indexOf(t), 1); else { U.splice(U.indexOf(t), 1); layoutSlots(); }
  if (sellSel === t) sellSel = null; save();
}
function sellPickUnit(key) { let best = null; for (const u of U) if (!u.side && !u.dead && u.key === key && (!best || (u.tier || 0) < (best.tier || 0) || ((u.tier || 0) === (best.tier || 0) && u.fresh && !best.fresh))) best = u; return best; }
function targetAt(x, y) {          // what is under a tap or the pointer while selling: defences first (bigger), then the nearest trooper
  for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; if (!s.dead && Math.abs(s.x - x) < s.w / 2 + 6 && Math.abs(s.y - y) < s.h / 2 + 6) return s; }
  let best = null, bd = 1e9; for (const u of U) { if (u.side || u.dead) continue; const d = hyp(u.x - x, u.y - y) - u.r; if (d < 13 && d < bd) { bd = d; best = u; } }
  return best;
}
function repairCost() { let c = (G.gateMax - G.gate) * .5; for (const s of S) c += (s.mhp - s.hp) * .15; return Math.ceil(c); }
function repairAll() { const c = repairCost(); if (!c || G.gold < c) return; sfx.play('knock'); G.gold -= c; floatText(W / 2, GL - 30, '-' + c + 'g', '#e0b04a'); G.gate = G.gateMax; for (const s of S) s.hp = s.mhp; save(); }
function setBoonState() { if (CFG.boonWave(G.wave)) { G.taken = null; G.offer = offerBoons(); } else { G.taken = '-'; G.offer = null; } }
function nextBoonWave(n) { while (n < 999 && !CFG.boonWave(++n)); return n; }
function offerBoons() {
  const pool = BOONS.filter(b => L(b.id) < b.max).map(b => b.id), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
  return out;
}
function takeBoon(id) {
  if (G.taken) return; sfx.play('boon'); const old = B.hp; G.boons[id] = L(id) + 1; G.taken = id; calcB();
  if (id === 'plate') for (const u of U) if (!u.side) { u.hp *= B.hp / old; u.mhp *= B.hp / old; }
  if (id === 'spikes') { const r = (1 + .4 * CFG.boonMul * L('spikes')) / (1 + .4 * CFG.boonMul * (L('spikes') - 1)); for (const s of S) { s.hp *= r; s.mhp *= r; } }
  if (id === 'ups') { const a = Math.round(G.gateMax * .2 * CFG.boonMul); G.gateMax += a; G.gate += a; }
  if (id === 'stone') { const a = Math.round(150 * CFG.boonMul); G.gateMax += a; G.gate += a; }
  if (id === 'muster') { for (let i = 0; i < Math.round(4 * CFG.boonMul); i++) spawnAlly('spear', G.bx + (rnd() - .5) * 60, GL + 2); for (let i = 0; i < Math.round(2 * CFG.boonMul); i++) spawnAlly('archer', G.bx + (rnd() - .5) * 60, GL + 2); layoutSlots(); }
  if (id === 'chest') G.gold += Math.round((70 + 14 * G.wave) * CFG.boonMul);
  save();
}
