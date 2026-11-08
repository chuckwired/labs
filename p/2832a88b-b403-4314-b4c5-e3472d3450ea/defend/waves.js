/* Defend mode: how a wave of enemies is planned and spawned. */
'use strict';
/* ================= waves ================= */
function planWave(n) {
  let b = CFG.budget(n) * (CFG.early[n - 1] || 1); const list = [];
  const W_ = { raider: 10, hound: n >= 3 ? Math.min(8, 2 + .4 * n) : 0, slinger: n >= 4 ? 1.5 + .25 * n : 0, brute: n >= 5 ? .6 + .17 * (n - 5) : 0, giant: n >= 9 ? .15 * (n - 8) + .1 : 0 };
  const keys = Object.keys(W_).filter(k => W_[k] > 0);
  const boss = BOSSES[n] || null; if (boss) { list.push(boss); b = Math.max(0, b * (n >= 30 ? .25 : 1) - ED[boss].cost * .5); }
  if (n >= 13 && n % 5 === 3 && !boss) { const k = 1 + Math.floor((n - 5) / 10); for (let i = 0; i < k; i++) list.push('warlord'); }
  let guard = 0;
  while (b > .9 && guard++ < 900) {
    const ok = keys.filter(k => ED[k].cost <= b); if (!ok.length) break;
    let tot = 0; for (const k of ok) tot += W_[k]; let r = rnd() * tot, pick = ok[0];
    for (const k of ok) { r -= W_[k]; if (r <= 0) { pick = k; break; } }
    list.push(pick); b -= ED[pick].cost;
  }
  const dur = Math.min(80, (18 + n * 1.2) * CFG.countMul), queue = [];
  const bykey = {}; list.forEach(k => (bykey[k] = bykey[k] || []).push(k));
  for (const k in bykey) {
    const arr = bykey[k], pack = k === 'raider' ? 5 : k === 'hound' ? 4 : k === 'slinger' ? 3 : k === 'brute' ? 2 : 1, heavy = ED[k].cost >= 8;
    for (let i = 0; i < arr.length; i += pack) {
      const t = (ED[k].boss ? .12 : k === 'warlord' ? .5 : heavy ? .3 + rnd() * .7 : rnd() * .75) * dur, n_ = Math.min(pack, arr.length - i);
      const flank = k === 'hound' && rnd() < .55, cx = flank ? (rnd() < .5 ? 12 : W - 12) : 34 + rnd() * (W - 68);
      for (let j = 0; j < n_; j++) queue.push({ k, t: t + j * .12, cx, flank, j });
    }
  }
  queue.sort((a, b) => a.t - b.t);
  const counts = {}; list.forEach(k => counts[k] = (counts[k] || 0) + 1);
  return { n, queue, counts, t: 0, dur, total: list.length, boss };
}
function forecastHTML(plan) {
  const order = ['hype', 'claw', 'layoff', 'ipo', 'mythos', 'sam', 'raider', 'hound', 'slinger', 'brute', 'giant', 'warlord'];
  return order.filter(k => plan.counts[k]).map(k => `<b>${plan.counts[k]}</b> ${plan.counts[k] === 1 ? ED[k].name.replace(/s$/, '') : ED[k].name}`).join(' · ');
}
function spawnFromQueue() {
  const Wv = G.plan; while (G.pend && G.pend.length) { const e = G.pend.pop(); spawnEnemy(e.k, e.x, e.y, e.lv ? Math.min(Wv.n, e.lv) : Wv.n); } let alive_ = 0; for (const u of U) if (u.side && !u.dead) alive_++;
  while (Wv.queue.length && Wv.queue[0].t <= Wv.t && alive_ < CFG.maxAlive) {
    const e = Wv.queue.shift(); let x = e.cx + (rnd() - .5) * 46, y = -14 - rnd() * 26;
    if (e.flank) { y = 30 + rnd() * H * .25; x = e.cx < W / 2 ? -8 - rnd() * 14 : W + 8 + rnd() * 14; }
    spawnEnemy(e.k, clamp(x, -30, W + 30), y, Wv.n); alive_++;
  }
}
