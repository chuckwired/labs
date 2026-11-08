/* Defend mode: the player's powers in battle (volley, warcry). */
'use strict';
/* ================= abilities ================= */
const volleyCD = () => 15 * Math.pow(.88, B.rain), chargeCD = () => 28 * Math.pow(.8, B.warcry);
function fireVolley() {
  if (G.phase !== 'battle' || G.cdVolley > 0) return;
  const cs = 40, cols = Math.ceil(W / cs) + 1, rows = Math.ceil((H + 80) / cs) + 1, bins = new Int16Array(cols * rows);
  let any = false; for (const u of U) if (u.side && !u.dead) { const cx = clamp((u.x / cs) | 0, 0, cols - 1), cy = clamp(((u.y + 80) / cs) | 0, 0, rows - 1); bins[cy * cols + cx]++; any = true; }
  if (!any) return;
  let best = -1, bi = 0; for (let cy = 1; cy < rows - 1; cy++) for (let cx = 1; cx < cols - 1; cx++) { let s = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += bins[(cy + a) * cols + cx + b]; const cyW = cy * cs - 80; if (cyW < 0) s *= .3; if (s > best) { best = s; bi = cy * cols + cx; } }
  const bx = bi % cols, by = (bi / cols) | 0; let sx = 0, sy = 0, n = 0;
  for (const u of U) if (u.side && !u.dead) { const cx = (u.x / cs) | 0, cy = ((u.y + 80) / cs) | 0; if (Math.abs(cx - bx) <= 1 && Math.abs(cy - by) <= 1) { sx += u.x; sy += u.y; n++; } }
  const tx = sx / n, ty = clamp(sy / n, 10, GL - 20), cnt = 22 + 4 * B.rain, dmg = 15 * B.ranged * (1 + .3 * B.rain), list = [];
  for (let i = 0; i < cnt; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (44 + 4 * B.rain); list.push({ k: 'rain', x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r * .8, t: 0, T: .75, dmg, fire: B.fire }); }
  G.volleyQ = { list, t: 0 }; G.mark = { x: tx, y: ty, r: 54 + 4 * B.rain, t: .9 };
  G.cdVolley = volleyCD(); G.cdVolleyMax = G.cdVolley; sfx.play('volley');
}
function fireCharge() {
  if (G.phase !== 'battle' || G.cdCharge > 0) return;
  G.charge = 6 + 2 * B.warcry; G.cdCharge = chargeCD(); G.cdChargeMax = G.cdCharge; shake(1); sfx.play('warcry'); toast('Warcry!', '');
}
