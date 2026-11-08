/* Defend mode: HUD, the shop sheet, boon dialog, selling, input and the title / pause / game-over screens. */
'use strict';
/* ================= rendering (see the 3D scene section above) ================= */
let qLevel = 0, fpsAvg = 16, slowFrames = 0, cpuAvg = 4, frameSeen = 0;
const FT = [];
function floatText(x, y, text, col) { if (headless) return; FT.push({ x, y, text, col: col || '#e0b04a', life: 1, h: 0 }); }

/* ================= UI ================= */
const el = { send: $('#send'), wave: $('#hWave'), gold: $('#hGold'), left: $('#hLeft'), leftL: $('#hLeftL'), gate: $('#gate'), gateI: $('#gate i'), bV: $('#bVolley'), bC: $('#bCharge'), toast: $('#toast'), kills: $('#kills'), killsB: $('#kills b') };
let hc = {}; const warnEl = $('#warn'), bossEl = $('#boss');
const bnEl = $('#bn'); let bnIds = [];
function renderBoons() {
  const ids = Object.keys(G.boons).filter(k => G.boons[k] && BOONS.some(b => b.id === k)), sig = ids.map(k => k + G.boons[k]).join(); if (hc.bn === sig) return; hc.bn = sig;
  bnEl.innerHTML = ids.map(k => { const b = BOONS.find(x => x.id === k), lv = G.boons[k]; return `<button type="button" class="bc${bnIds.includes(k) ? '' : ' new'}" data-bc aria-label="${esc(b.name)} ${ROMAN[lv]}: ${esc(b.d)}">${bIcon(k)}${lv > 1 ? `<i class="lv">${ROMAN[lv]}</i>` : ''}<span class="tip"><b>${esc(b.name)} ${ROMAN[lv]}</b>${esc(b.d)}${lv > 1 ? '<br>Each level adds this again.' : ''}</span></button>`; }).join(''); bnIds = ids;
}
bnEl.addEventListener('click', e => { const c = e.target.closest('.bc'); const was = c && c.classList.contains('open'); bnEl.querySelectorAll('.open').forEach(x => x.classList.remove('open')); if (c && !was) c.classList.add('open'); });
addEventListener('pointerdown', e => { if (!e.target.closest('#bn')) bnEl.querySelectorAll('.open').forEach(x => x.classList.remove('open')); });
function hud() {
  if (!G) return; renderBoons();
  const set = (k, v, e, f) => { if (hc[k] !== v) { hc[k] = v; f ? f(v) : (e.textContent = v); } };
  set('snd', G.wave, null, v => { $('#sendT').textContent = 'Send wave ' + waveLabel(v); });
  set('k', G.kills, null, v => { el.killsB.textContent = v.toLocaleString('en-GB'); el.kills.classList.remove('pop'); void el.kills.offsetWidth; el.kills.classList.add('pop'); });
  set('w', waveLabel(G.wave), el.wave); set('g', Math.floor(G.gold), el.gold, v => { el.gold.textContent = v; const sg = $('#sGold'); if (sg) sg.textContent = v; });
  const left = G.phase === 'battle' ? G.enemies + G.plan.queue.length : (G.plan ? G.plan.total : 0);
  const bw = G.phase === 'build' && G.plan ? (G.plan.boss ? 'Boss incoming · ' + ED[G.plan.boss].name : bossWaveAtOrAfter(G.wave) === G.wave + 1 ? 'Boss next wave · ' + ED[BOSSES[G.wave + 1]].name : '') : '';
  set('bw', bw, null, v => { warnEl.textContent = v; warnEl.hidden = !v; warnEl.classList.toggle('now', !!G.plan && !!G.plan.boss); });
  let bu = null; if (G.phase === 'battle') for (const u of U) if (u.side && u.d.boss && !u.dead) { bu = u; break; }
  set('bb', bu ? bu.d.name : '', null, v => { bossEl.hidden = !v; bossEl.firstElementChild.textContent = v; }); if (bu) bossEl.lastElementChild.firstElementChild.style.transform = `scaleX(${clamp(bu.hp / bu.mhp, 0, 1).toFixed(3)})`;
  set('l', left, el.left); set('ll', G.phase === 'battle' ? 'Left' : 'Next', el.leftL);
  const gf = Math.round(G.gate / G.gateMax * 100) / 100; set('gf', gf, null, v => { el.gateI.style.transform = `scaleX(${v})`; el.gate.classList.toggle('low', v < .35); el.gate.setAttribute('aria-valuenow', Math.round(v * 100)); });
  const v = G.cdVolley > 0 ? G.cdVolley / (G.cdVolleyMax || 1) : 0, c = G.cdCharge > 0 ? G.cdCharge / (G.cdChargeMax || 1) : 0;
  set('v', Math.round(v * 50), null, () => { el.bV.style.setProperty('--cd', v.toFixed(3)); el.bV.classList.toggle('ready', v === 0); });
  set('c', Math.round(c * 50), null, () => { el.bC.style.setProperty('--cd', c.toFixed(3)); el.bC.classList.toggle('ready', c === 0); });
  el.bC.classList.toggle('on', G.charge > 0);
  if (G.phase === 'build') refreshSheet();
}
function toast(a, b) { if (headless || (G && G.demo)) return; el.toast.firstElementChild.textContent = a; el.toast.lastElementChild.textContent = b || ''; el.toast.classList.remove('show'); void el.toast.offsetWidth; el.toast.classList.add('show'); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function statLine(k) {
  const d = UD[k], hp = Math.round(d.hp * B.hp);
  if (d.role === 'ranged') return `${hp} hp · ${(d.dmg * B.ranged).toFixed(1)} dmg · range ${Math.round(d.range * B.range)}`;
  if (d.role === 'siege') return `${hp} hp · ${Math.round(d.dmg * B.ranged)} splash · range ${Math.round(d.range * B.range)}`;
  return `${hp} hp · ${(d.dmg * B.melee).toFixed(1)} dmg`;
}
const ICON = {
  boon: '<path d="M12 3l2.4 5.6 6.1.6-4.6 4 1.4 6-5.3-3.2L6.7 19.2l1.4-6-4.6-4 6.1-.6z"/>',
  recruit: '<circle cx="10" cy="7.5" r="3.5"/><path d="M3.5 20c.4-4 3-6.2 6.5-6.2s6.1 2.2 6.5 6.2M19 5v6M16 8h6"/>',
  defend: '<path d="M12 3l7.5 2.6v6.2c0 4.4-3.1 7.7-7.5 9.2-4.4-1.5-7.5-4.8-7.5-9.2V5.6z"/><path d="M12 8v8M8.5 11.5h7"/>',
  sell: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.6c-.4-1-1.3-1.5-2.6-1.5-1.5 0-2.5.7-2.5 1.8s1 1.5 2.5 1.8 2.5.7 2.5 1.8-1 1.8-2.5 1.8c-1.3 0-2.3-.5-2.7-1.5M12 6.8v1.3M12 15.8v1.4"/>' };
function buildSheet() {
  const f = G.plan; G.tab = G.taken ? 'recruit' : 'boon';
  const tab = (k, name, extra) => `<button type="button" role="tab" data-tab="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${name}${extra || ''}</button>`;
  const recruit = Object.keys(UD).map(k => `<button type="button" class="card" data-buy="${k}"><b>${UD[k].name}</b><span class="st" data-st></span><span class="ct" data-ct></span><span class="tr" data-tiers></span><span class="cost" data-cost></span></button>`
    + [0, 1].map(t => `<button type="button" class="card merge" data-merge="${k}:${t}" hidden><b>Merge ${CFG.mergeN} into ${UD[k].one} ${tierName[t + 1]}</b><span class="st">${CFG.mergeN} ${t ? UD[k].name + ' ' + tierName[t] : UD[k].name} become one that is ${CFG.tierMul[t + 1] / CFG.tierMul[t]}x as strong. Frees ${CFG.mergeN - 1} places.</span><span class="cost na">Free</span></button>`).join('')).join('');
  const defend = Object.keys(SD).map(k => `<button type="button" class="card" data-tool="${k}"><b>${SD[k].name}</b><span class="st">${SD[k].note}</span><span class="ct" data-ct></span><span class="cost" data-cost></span></button>`).join('') + `<button type="button" class="card" id="repair"><b>Repair</b><span class="st">Doors and defences back to full</span><span class="cost" data-cost></span></button>`;
  const sell = `<div class="taken">Hover or tap anything on the field to sell it. New purchases refund in full, the rest 60%. Or sell one from here.</div>` + Object.keys(UD).map(k => `<button type="button" class="card" data-sellu="${k}"><b>${UD[k].name}</b><span class="st">Sells the weakest one</span><span class="ct" data-ct></span><span class="cost" data-cost></span></button>`).join('') + Object.keys(SD).map(k => `<button type="button" class="card" data-sell1="${k}"><b>${SD[k].name}</b><span class="st">Sells the newest one</span><span class="ct" data-ct></span><span class="cost" data-cost></span></button>`).join('');
  sheet.innerHTML = `<div class="sh-fc"><button type="button" class="link" id="saveExit">Save &amp; exit</button>Threat feed ${forecastHTML(f)} · Army <b data-armyct></b></div>
  <div class="sh-top">
    <div class="sh-gold" id="shGold"><i>Gold</i><b id="sGold">0</b></div>
    <div class="sh-tabs" role="tablist">${tab('boon', 'Boon', '<i class="dot"></i>')}${tab('recruit', 'Recruit')}${tab('defend', 'Defend')}${tab('sell', 'Sell')}</div>
  </div>
  <div class="sh-body">
    <div class="cards" data-pane="boon" id="boons"></div>
    <div class="cards" data-pane="recruit">${recruit}</div>
    <div class="cards" data-pane="defend">${defend}</div>
    <div class="cards" data-pane="sell">${sell}</div>
  </div>`;
  boonsDirty = true; hc.sheet = '';
}
let boonsDirty = true;
/* the boon dialog: a full-screen pick before each build phase, so choosing one is a moment, not a tab. "Any" takes a random one for people who do not care */
const pickEl = $('#pick'); let picking = false;
function openPick() {
  if (headless || !G || G.taken || G.phase !== 'build') return; picking = true; pickEl.className = ''; pickEl.hidden = false;
  const rc = 25 + 20 * G.rerolls, cards = G.offer.map((id, i) => { const b = BOONS.find(x => x.id === id), lv = L(id); return `<button type="button" class="pcard" data-p="${id}"><span class="ic">${bIcon(id)}</span><span class="lv">${lv ? 'Level ' + ROMAN[lv] + ' to ' + ROMAN[lv + 1] : 'New'} · key ${i + 1}</span><b>${esc(b.name)}</b><span class="d">${esc(b.d)}</span></button>`; }).join('');
  pickEl.innerHTML = `<h2>Choose a boon</h2><p class="sub">Wave ${waveLabel(G.wave)} · it lasts the whole run</p><div class="pcards">${cards}</div><div class="alt"><button type="button" id="pReroll"${G.gold < rc ? ' disabled' : ''}>Reroll · ${rc}g</button><button type="button" id="pAny">Any</button></div>`;
  const f = pickEl.querySelector('.pcard'); if (f && !('ontouchstart' in window)) f.focus({ preventScroll: true });
}
function choosePick(id) {
  if (!picking || G.taken) return; picking = false; takeBoon(id); G.tab = 'recruit'; boonsDirty = true; hc.sheet = '';
  pickEl.querySelectorAll('.pcard').forEach(c => c.classList.add(c.dataset.p === id ? 'chosen' : 'gone')); pickEl.querySelector('.alt').style.visibility = 'hidden';
  puff(G.bx, G.by, 14, '#e0b04a'); shake(1.2); const b = BOONS.find(x => x.id === id); floatText(G.bx, G.by - 20, b.name + ' ' + ROMAN[L(id)], '#e0b04a');
  setTimeout(() => { pickEl.classList.add('out'); setTimeout(() => { pickEl.hidden = true; pickEl.className = ''; refreshSheet(); }, 330); }, 700);
}
pickEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !G) return;
  if (b.dataset.p) choosePick(b.dataset.p);
  else if (b.id === 'pAny') choosePick(G.offer[(rnd() * G.offer.length) | 0]);
  else if (b.id === 'pReroll') { const rc = 25 + 20 * G.rerolls; if (G.gold >= rc) { sfx.play('click'); G.gold -= rc; G.rerolls++; G.offer = offerBoons(); save(); openPick(); } }
});
const placing = $('#placing');
function setTool(k) { tool = tool === k ? null : k; ghost = null; if (tool) G.tab = 'defend'; hc.sheet = ''; refreshSheet(); }
function armySig() { let n = 0, w = 0; for (const u of U) if (!u.side && !u.dead) { n++; w += u.key.charCodeAt(0) * (1 + 7 * (u.tier || 0)) + u.key.length; } return n + ':' + w; }
function refreshSheet() {
  if (!G) return;
  const sig = [Math.floor(G.gold), armySig(), S.length, tool, sellSel ? sellSel.uid : 0, G.taken, G.gate | 0, G.rerolls, G.tab, G.phase].join('|');
  if (hc.sheet === sig && !boonsDirty) return; hc.sheet = sig;
  // the bar that says what a tap on the field will do, and what it costs
  if (G.phase === 'build' && tool) {
    if (tool === 'sell') placing.innerHTML = sellSel ? `<span>Sell <b>${esc(sellName(sellSel))}</b> <span class="g" style="color:var(--green,#7fd68f)">+${sellValueOf(sellSel)} gold</span></span><button type="button" id="sellGo" class="primary">Sell</button><button type="button" id="cancelTool">Done</button>` : `<span>Selling: hover or tap anything on the field</span><button type="button" id="cancelTool">Done</button>`;
    else { const c = cost(SD[tool].cost), ok = G.gold >= c; placing.innerHTML = `<span>Placing <b>${SD[tool].name}</b> <span class="g" style="${ok ? '' : 'color:var(--red)'}">${c} gold</span> <span class="d">${ok ? 'tap the field' : 'not enough gold'}</span></span><button type="button" id="cancelTool">Cancel</button>`; }
    placing.hidden = false;
  } else placing.hidden = true;
  const body = sheet.querySelector('#boons'); if (!body) return;
  if (boonsDirty) {
    boonsDirty = false;
    if (G.taken === '-') body.innerHTML = `<div class="taken">No boon this wave.<br>The next comes at wave ${nextBoonWave(G.wave)}.</div>`;
    else if (G.taken) { const b = BOONS.find(x => x.id === G.taken); body.innerHTML = `<div class="taken">Taken: <b>${esc(b.name)} ${ROMAN[L(b.id)]}</b><br>${esc(b.d)}</div>`; }
    else { const rc = 25 + 20 * G.rerolls; body.innerHTML = G.offer.map(id => { const b = BOONS.find(x => x.id === id); return `<button type="button" class="card boon" data-boon="${id}"><b>${esc(b.name)}<em>${ROMAN[L(id) + 1] || ''}</em></b><span class="st">${esc(b.d)}</span></button>`; }).join('') + `<button type="button" class="card" id="reroll"><b>Reroll</b><span class="st">Three new boons</span><span class="cost">${rc}</span></button>`; }
  }
  const rr = sheet.querySelector('#reroll'); if (rr) rr.disabled = G.gold < 25 + 20 * G.rerolls;
  sheet.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === G.tab)));
  sheet.querySelectorAll('[data-pane]').forEach(pn => pn.hidden = pn.dataset.pane !== G.tab);
  sheet.querySelector('.dot').hidden = !!G.taken;
  sheet.querySelector('[data-armyct]').textContent = `${allies()}/${CFG.armyCap}`; const sg = sheet.querySelector('#sGold'); if (sg) sg.textContent = Math.floor(G.gold);
  const own = (ct, n) => { ct.textContent = n + ' owned'; ct.classList.toggle('zero', !n); };
  sheet.querySelectorAll('[data-buy]').forEach(b => {
    const k = b.dataset.buy, d = UD[k], c = cost(d.cost), n = countOf(k), tiers = [];
    for (let t = 1; t < CFG.tierMul.length; t++) { const m = tcount(k, t); if (m) tiers.push(tierName[t] + ' x' + m); }
    b.querySelector('[data-st]').textContent = statLine(k); own(b.querySelector('[data-ct]'), n); b.querySelector('[data-tiers]').textContent = tiers.join(' · '); b.querySelector('[data-cost]').textContent = c;
    b.disabled = G.gold < c || allies() >= CFG.armyCap || (d.max && n >= d.max);
  });
  sheet.querySelectorAll('[data-merge]').forEach(b => { const a = b.dataset.merge.split(':'); b.hidden = !canMerge(a[0], +a[1]); });
  sheet.querySelectorAll('[data-tool]').forEach(b => { const k = b.dataset.tool; b.classList.toggle('active', tool === k); const c = cost(SD[k].cost); b.querySelector('[data-cost]').textContent = c; own(b.querySelector('[data-ct]'), S.filter(s => s.t === k && !s.dead).length); b.disabled = G.gold < c && tool !== k; });
  sheet.querySelectorAll('[data-sell1]').forEach(b => { const k = b.dataset.sell1, t = [...S].reverse().find(x => !x.dead && x.t === k && x.fresh) || [...S].reverse().find(x => !x.dead && x.t === k), v = t ? structValue(t) : 0; own(b.querySelector('[data-ct]'), S.filter(s => s.t === k && !s.dead).length); b.querySelector('[data-cost]').textContent = v ? '+' + v : 'None to sell'; b.querySelector('[data-cost]').classList.toggle('na', !v); b.disabled = !v; });
  sheet.querySelectorAll('[data-sellu]').forEach(b => { const k = b.dataset.sellu, t = sellPickUnit(k), v = t ? unitValue(t) : 0; own(b.querySelector('[data-ct]'), countOf(k)); b.querySelector('[data-cost]').textContent = v ? '+' + v : 'None to sell'; b.querySelector('[data-cost]').classList.toggle('na', !v); b.disabled = !v; });
  const rp = sheet.querySelector('#repair'), rcst = repairCost(); rp.disabled = !rcst || G.gold < rcst; const rcEl = rp.querySelector('[data-cost]'); rcEl.textContent = rcst ? rcst : 'Nothing to fix'; rcEl.classList.toggle('na', !rcst);
}
sheet.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !G) return;
  if (b.dataset.tab) { sfx.play('click'); G.tab = b.dataset.tab; sellSel = null; if (G.tab === 'sell') { tool = 'sell'; ghost = null; } else if (tool === 'sell') tool = null; hc.sheet = ''; refreshSheet(); }
  else if (b.dataset.buy) { recruit(b.dataset.buy); hc.sheet = ''; refreshSheet(); }
  else if (b.dataset.merge) { const a = b.dataset.merge.split(':'); merge(a[0], +a[1]); hc.sheet = ''; refreshSheet(); }
  else if (b.dataset.sell1) { const t = [...S].reverse().find(x => !x.dead && x.t === b.dataset.sell1 && x.fresh) || [...S].reverse().find(x => !x.dead && x.t === b.dataset.sell1); if (t) sellTarget(t); hc.sheet = ''; refreshSheet(); }
  else if (b.dataset.sellu) { const t = sellPickUnit(b.dataset.sellu); if (t) sellTarget(t); hc.sheet = ''; refreshSheet(); }
  else if (b.dataset.tool) { sfx.play('click'); setTool(b.dataset.tool); }
  else if (b.dataset.boon) { takeBoon(b.dataset.boon); G.tab = 'recruit'; boonsDirty = true; hc.sheet = ''; refreshSheet(); }
  else if (b.id === 'reroll') { const rc = 25 + 20 * G.rerolls; if (G.gold >= rc && !G.taken) { sfx.play('click'); G.gold -= rc; G.rerolls++; G.offer = offerBoons(); boonsDirty = true; hc.sheet = ''; save(); refreshSheet(); } }
  else if (b.id === 'repair') { repairAll(); hc.sheet = ''; refreshSheet(); }
});
placing.addEventListener('click', e => { if (e.target.closest('#sellGo') && sellSel) { sellTarget(sellSel); hc.sheet = ''; refreshSheet(); return; } if (e.target.closest('#cancelTool')) { sfx.play('click'); tool = null; ghost = null; sellSel = null; if (G.tab === 'sell') G.tab = 'defend'; hc.sheet = ''; refreshSheet(); } });
$('#send').addEventListener('click', () => { if (G && G.phase === 'build' && !picking) sendWave(); });

/* input */
{ const pts = new Map(); let pinch = 0;
  cv.addEventListener('pointerdown', e => { if (!roam.on || (roam.dir && !roam.auto)) return; if (roam.auto) { roam.auto = false; roam.dir = null; } cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); roam.touched = true; pinch = 0; });
  cv.addEventListener('pointermove', e => { if (!roam.on || roam.dir || !pts.has(e.pointerId)) return; const o = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { roam.yaw -= (e.clientX - o[0]) * .006; roam.pitch = clamp(roam.pitch + (e.clientY - o[1]) * .005, .12, 1.5); }
    else if (pts.size === 2) { const a = [...pts.values()], dd = hyp(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) roam.dist = clamp(roam.dist * pinch / dd, 8, 90); pinch = dd; } });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => { pts.delete(e.pointerId); pinch = 0; });
  cv.addEventListener('wheel', e => { if (!roam.on || (roam.dir && !roam.auto)) return; if (roam.auto) { roam.auto = false; roam.dir = null; } e.preventDefault(); roam.touched = true; roam.dist = clamp(roam.dist * Math.exp(e.deltaY * .001), 8, 90); }, { passive: false }); }
cv.addEventListener('pointermove', e => { if (!G) return; const [x, y] = toWorld(e.clientX, e.clientY); ghost = { x, y }; });
cv.addEventListener('pointerleave', () => { ghost = null; });
cv.addEventListener('pointerdown', e => {
  if (!G || G.phase === 'over' || !scr.hidden) return;
  const [x, y] = toWorld(e.clientX, e.clientY); ghost = e.pointerType === 'mouse' ? { x, y } : null;
  if (G.phase === 'build' && tool) {
    if (tool === 'sell') {            // a mouse already showed what is under it, so a click sells; a finger taps once to pick, then Sell (or a second tap) confirms
      const t = targetAt(x, y);
      if (!t) { sellSel = null; floatText(x, y - 10, 'nothing to sell here', '#8b8a93'); }
      else if (e.pointerType === 'mouse' || sellSel === t) sellTarget(t); else sellSel = t;
      hc.sheet = ''; refreshSheet(); return;
    }
    if (!place(tool, x, y)) { const c = cost(SD[tool].cost); if (G.gold < c) { flashGold(); floatText(x, y - 10, 'need ' + c + 'g', '#e0533f'); } else floatText(x, y - 10, 'can\'t build here', '#e0533f'); } else { hc.sheet = ''; refreshSheet(); }
    return;
  }
  if (G.phase === 'build' || G.phase === 'battle') { G.bx = x; G.by = y; layoutSlots(); if (G.phase === 'build') save(); }
});
function flashGold() { const c = [el.gold.parentElement, $('#shGold')].filter(Boolean); c.forEach(e => e.style.borderColor = 'var(--red)'); setTimeout(() => c.forEach(e => e.style.borderColor = ''), 250); }
el.bV.addEventListener('click', fireVolley); el.bC.addEventListener('click', fireCharge);
addEventListener('keydown', e => {
  if (!G) return; if (G.phase === 'intro' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); skipIntro(); return; } if (picking && /^[123]$/.test(e.key)) { if (G.offer[+e.key - 1]) choosePick(G.offer[+e.key - 1]); } else if (e.key === '1') fireVolley(); else if (e.key === '2') fireCharge(); else if (e.key === 'Escape' || e.key === 'p') { if (tool) { tool = null; hc.sheet = ''; refreshSheet(); } else togglePause(); }
  else if ((e.key === 'Enter' || e.key === ' ') && !picking && G.phase === 'build' && document.activeElement === document.body) { e.preventDefault(); sendWave(); }
});
$('#pause').addEventListener('click', () => togglePause());
/* between waves: keep the run and go back to the title, where Continue picks it up */
function saveAndExit() { if (!G || G.phase !== 'build') return; sfx.play('click'); store.run = snapshot(); persist(); showTitle(); }
$('#exitb').addEventListener('click', saveAndExit); sheet.addEventListener('click', e => { if (e.target.closest('#saveExit')) saveAndExit(); });
const muteBtn = $('#mute'); muteBtn.setAttribute('aria-pressed', String(sfx.muted)); muteBtn.addEventListener('click', () => muteBtn.setAttribute('aria-pressed', String(sfx.toggle())));
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => sfx.unlock(), { passive: true });
document.addEventListener('visibilitychange', () => { sfx.hold(document.hidden); if (document.hidden && G && G.phase === 'battle' && !G.demo && !paused) togglePause(true); });

/* screens */
const fmt = n => n.toLocaleString('en-GB');
const RANKS = ['', 'Squire', 'Knight', 'Banneret', 'Baron', 'Count', 'Duke', 'Prince', 'King', 'Emperor'];
const CROWN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3 18l-1-10 5 4 5-7 5 7 5-4-1 10z"/></svg>';
const waveLabel = n => store.prestige ? `${n} (${n + CFG.winWave * store.prestige})` : String(n);
function prestigeHTML() { const n = store.prestige || 0; if (!n) return ''; return `<div class="pres" title="Prestige ${n}">${CROWN.repeat(Math.min(n, 5))}${n > 5 ? '<em>x' + n + '</em>' : ''}<b>${RANKS[n] || 'Eternal'}</b><span>Prestige ${n}</span></div>`; }
function startOver() { paused = false; sfx.hold(false); scr.hidden = true; newRun(false); }
function confirmStartOver() {
  scr.hidden = false; scr.className = 'clear';
  scr.innerHTML = `<div class="panel"><h2>New game?</h2><p>This abandons your run at <b>wave ${G.wave}</b> and begins again from wave 1 with a small band. Your best scores${store.prestige ? ' and prestige' : ''} are kept.</p>
    <div class="row"><button type="button" class="danger" id="yes">New game</button><button type="button" class="primary" id="no">Keep playing</button></div></div>`;
  $('#yes').onclick = () => { sfx.play('click'); startOver(); }; $('#no').onclick = () => { paused = false; togglePause(true); };
}
function showVictory() {
  if (!G) return; document.body.className = 'menu'; sheet.hidden = true; scr.hidden = false; scr.className = ''; const next = (store.prestige || 0) + 1;
  scr.innerHTML = `<div class="panel"><div class="new">Wave ${CFG.winWave} held</div><h2>The wall stands.</h2><p>Thirty waves broken against your gate. Take the crown and begin again, stronger in name, or keep fighting where you are.</p>
    <div class="stat"><div><i>Score</i><b>${fmt(G.score)}</b></div><div><i>Kills</i><b>${fmt(G.kills)}</b></div></div>
    <div class="pres big">${CROWN.repeat(Math.min(next, 5))}<b>${RANKS[next] || 'Eternal'}</b><span>Prestige ${next}</span></div>
    <div class="row"><button type="button" class="primary" id="pres">Prestige and begin again</button><button type="button" id="keep">Keep fighting</button></div></div>`;
  $('#pres').onclick = () => { store.prestige = next; persist(); applyPrestigeLook(); sfx.play('boon'); scr.hidden = true; newRun(false); };
  $('#keep').onclick = () => { G.won = true; scr.hidden = true; enterBuild(false); save(); };
}
function showTitle() {
  roamOn(false); picking = false; pickEl.hidden = true; document.body.className = 'menu'; sheet.hidden = true; G = null; U = []; S = []; PR = []; PT = []; tool = null; fadeDecals(1); setCamTarget(true);
  const fresh = x => x.wave === 1 && x.gold === CFG.startGold && (!x.taken || x.taken === '-') && !Object.keys(x.boons || {}).length && !(x.structs || []).length && Object.keys(CFG.start).every(k => (x.army || {})[k] === CFG.start[k]);
  const r = store.run && !fresh(store.run) ? store.run : null;     // an untouched wave-1 save is not worth continuing
  scr.hidden = false; scr.className = '';
  const top = store.scores[0], you = store.name ? `<p class="you">Playing as <b>${esc(store.name)}</b> <button type="button" class="link" id="chg">change</button></p>` : '';
  scr.innerHTML = `<div class="panel"><h1>Defend Humanity</h1>${prestigeHTML()}${top ? `<p class="hi">High score <b>${fmt(top.score)}</b> · ${esc(top.name || 'Anon')} · wave ${top.wave}</p>` : ''}${you}
    <div class="row">${r ? `<button type="button" class="primary" id="cont">Continue game</button><button type="button" id="new">New game</button>` : `<button type="button" class="primary" id="new">New game</button>`}</div></div>`;
  const c = $('#cont'); if (c) c.onclick = () => { sfx.play('click'); ensureName(() => { scr.hidden = true; loadRun(r); }); };
  $('#new').onclick = () => { if (r && !confirm('Abandon the saved game and start again?')) return; sfx.play('click'); ensureName(() => { scr.hidden = true; newRun(false); }); };
  const ch = $('#chg'); if (ch) ch.onclick = () => askName(showTitle);
}
/* the name for the high-score table: asked once, kept on this device */
function askName(next) {
  scr.hidden = false; scr.className = '';
  scr.innerHTML = `<div class="panel"><h2>Your name</h2><p>It goes on the high-score table. Kept on this device, change it any time from the title.</p><input id="nm" maxlength="14" autocomplete="off" spellcheck="false" placeholder="Name" value="${esc(store.name || '')}" aria-label="Your name"><div class="row"><button type="button" class="primary" id="nmGo">Go</button></div></div>`;
  const inp = $('#nm'), go = () => { store.name = (inp.value.trim() || 'Anon').slice(0, 14); persist(); sfx.play('click'); next(); };
  $('#nmGo').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); }; setTimeout(() => { inp.focus(); inp.select(); }, 50);
}
function ensureName(next) { if (store.name) next(); else askName(next); }
function togglePause(force) {
  if (!G || G.phase === 'over') return;
  if (paused && !force) { paused = false; scr.hidden = true; sfx.hold(false); return; }
  if (paused) return;
  paused = true; sfx.hold(true); scr.hidden = false; scr.className = 'clear';
  scr.innerHTML = `<div class="panel"><h2>Paused</h2><div class="stat"><div><i>Wave</i><b>${G.wave}</b></div><div><i>Score</i><b>${fmt(G.score)}</b></div><div><i>Kills</i><b>${fmt(G.kills)}</b></div></div>
    ${prestigeHTML()}<div class="row"><button type="button" class="primary" id="res">Resume</button><button type="button" class="cta" id="restart">New game</button><button type="button" id="quit">Leave run</button></div>
    <small>Leaving keeps your progress from the start of this wave.</small></div>`;
  $('#restart').onclick = confirmStartOver;
  $('#res').onclick = () => togglePause(); $('#quit').onclick = () => { paused = false; sfx.hold(false); if (G.phase !== 'build') { /* store.run already holds the start of this wave */ } showTitle(); };
}
function showOver(sc, nb) {
  document.body.className = 'menu'; sheet.hidden = true; scr.hidden = false; scr.className = 'over';
  const st = G.st, names = {}; for (const k in ED) names[k] = ED[k].name;
  let hard = 0, hl = -1; for (const w in st.lostBy) { const v = st.lostBy[w] + (st.gateBy[w] || 0) / 40; if (v > hl) { hl = v; hard = +w; } } if (!hard) hard = G.wave;
  const slain = Object.keys(names).filter(k => st.slain[k]).map(k => `<b>${fmt(st.slain[k])}</b> ${names[k]}`).join(' · ');
  const mins = Math.floor(st.time / 60), secs = Math.round(st.time % 60);
  const list = store.scores.map((s_, i) => `<li class="${s_.date === sc.date ? 'me' : ''}"><span>${i + 1}. ${esc(s_.name || 'Anon')} · wave ${s_.wave}</span><span>${fmt(s_.score)}</span></li>`).join('');
  scr.innerHTML = `<div class="panel wide"><h2>The data centre went dark on wave ${waveLabel(sc.wave)}.</h2>${nb ? '<div class="new">New personal best</div>' : ''}
    <div class="stat"><div><i>Score</i><b>${fmt(sc.score)}</b></div><div><i>Terminated</i><b>${fmt(sc.kills)}</b></div><div><i>Troops lost</i><b>${fmt(st.lost)}</b></div><div><i>Peak army</i><b>${st.peak || allies()}</b></div><div><i>Hardest wave</i><b>${waveLabel(hard)}</b></div><div><i>Time</i><b>${mins}m ${String(secs).padStart(2, '0')}s</b></div></div>
    ${slain ? `<p class="brk">${slain}</p>` : ''}
    <ol>${list}</ol>
    <div class="row"><button type="button" class="primary" id="again">New game</button><button type="button" id="roamGo">Roam the field</button><button type="button" id="menu">Menu</button></div></div><div id="roamBar"><span>Drag to look around · scroll or pinch to zoom</span><button type="button" id="roamBack">Results</button></div>`;
  overCinema();
  $('#roamGo').onclick = () => { roamOn(true); scr.classList.add('roaming'); }; $('#roamBack').onclick = () => { scr.classList.remove('roaming'); overCinema(); };
  $('#again').onclick = () => { ensureName(() => { scr.hidden = true; scr.className = ''; newRun(false); }); }; $('#menu').onclick = showTitle;
}
