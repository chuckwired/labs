/* Defend mode: the heads-up for an enemy the player has not met yet. A name card, the enemy drops into the field, a shocked "!?",
   it realises it is alone, sprints north into the mist to fetch its friends, and then the wave starts. Skippable; seen types are remembered. */
'use strict';
const INTRO = {
  hound:   ['Crawlers', 'Fast and low. They run the flanks and slip past the line.'],
  slinger: ['Chatbots', 'They shoot from behind their friends. Archers and cavalry reach them.'],
  brute:   ['Agents', 'Heavy hitters that chew through a shield wall.'],
  giant:   ['Foundation models', 'Huge. Foot troops barely scratch them. Towers and ballistas do.'],
  warlord: ['AGI', 'Nearly immune to the line. Bring heavy defences.'],
  hype:    ['The Early Adopter', 'Boss. First in line, and he brings the whole waitlist of vibe coders with him.'],
  claw:    ['The Claw Inventor', 'Boss. Gave the agents root access. They keep sprinting out of him.'],
  layoff:  ['Head of Efficiency', 'Boss. Every few seconds he makes cuts, and a chunk of your troops goes with them.'],
  ipo:     ['IPO Day', 'Boss. His valuation, and his health, only go up. End it quickly.'],
  mythos:  ['Mythos', 'Boss. Too powerful to release. Blinks toward your gate, and when it falls its experts scatter.'],
  sam:     ['Sam Altmann', 'Final boss. He never advances and keeps calling in agents. Only your towers can reach him.'],
};
const introEl = $('#intro');
function introNew(plan) { return Object.keys(INTRO).filter(k => plan.counts[k] && !store.seen[k]).sort((a, b) => ED[a].cost - ED[b].cost); }
/* the speech bubble boss enemies put up while a wave is running */
OVERLAYS.push(() => {
  if (!G || G.phase !== 'battle') return; const now = performance.now();
  for (const u of U) { if (!u.side || u.dead || !u.say || u.sayUntil < now) continue; const sc = figScale(u.key, u.scale, u.tier); toScreen(wx(u.x), (2.2 + (LOOK[u.key].fl || 0)) * sc, wz(u.y), sp);
    ox.save(); ox.font = '600 13px "JetBrains Mono", monospace'; const w = ox.measureText(u.say).width + 20, x = clamp(sp[0], w / 2 + 6, cam.w - w / 2 - 6), y = sp[1] - 18;
    ox.fillStyle = '#f4f6fa'; ox.strokeStyle = '#e0533f'; ox.lineWidth = 2; ox.beginPath(); ox.roundRect(x - w / 2, y - 26, w, 26, 9); ox.moveTo(sp[0] - 5, y); ox.lineTo(sp[0], y + 9); ox.lineTo(sp[0] + 5, y); ox.closePath(); ox.fill(); ox.stroke();
    ox.fillStyle = '#10141a'; ox.textAlign = 'center'; ox.textBaseline = 'middle'; ox.fillText(u.say, x, y - 12); ox.restore(); ovDirty = true; }
});
function startIntro(keys) {
  G.phase = 'intro'; tool = null; ghost = null; sellSel = null; fieldView = false;
  for (const s of S) s.fresh = false; for (const u of U) u.fresh = false;
  sheet.hidden = true; placing.hidden = true; document.body.className = 'battle intro'; setCamTarget(false);
  G.intro = { keys, i: 0, t: 0, u: null, k: '', bubble: '', landed: false }; for (const k of keys) store.seen[k] = true; persist();
  introCinema(); nextIntro();
}
function nextIntro() {
  const I = G.intro; if (I.u) { const n = U.indexOf(I.u); if (n >= 0) U.splice(n, 1); I.u = null; }
  if (I.i >= I.keys.length) return endIntro();
  const k = I.keys[I.i++], x = W * .5 + (rnd() - .5) * 120, y = 400, u = spawnEnemy(k, x, y, G.wave);
  u.scale = Math.max(u.scale, 2.6); u.x = x; u.y = y; u.vx = u.vy = 0;   // small enemies are shown bigger so they can be seen
  u.yawSet = Math.PI; u.lift = 14; I.u = u; I.k = k; I.t = 0; I.bubble = ''; I.landed = false; I.dust = 0;
  introEl.innerHTML = `<i>${ED[k].boss ? 'Boss' : 'New enemy'}</i><h3>${esc(INTRO[k][0])}</h3><p>${esc(INTRO[k][1])}</p><small>tap to skip</small>`; introEl.hidden = false; introEl.classList.remove('in'); void introEl.offsetWidth; introEl.classList.add('in');
}
const RUN = 3.6;   // when the new enemy gives up looking around and bolts (the drop and the "!?" are done by 1.95)
function introTick(dt) {
  const I = G.intro; if (!I || !I.u) return; const u = I.u; I.t += dt; const t = I.t; u.anim += dt * 9; I.bubble = '';
  if (t < .6) { u.lift = Math.max(0, 14 - 40 * t * t); u.yawSet = Math.PI; }
  else {
    if (!I.landed) { I.landed = true; u.lift = 0; shake(2); puff(u.x, u.y, 10, '#8a8f98'); sfx.play('knock'); }
    if (t < .85) { u.lift = .35 * Math.sin((t - .6) / .25 * Math.PI); u.yawSet = Math.PI; }
    else if (t < 1.95) { I.bubble = '!?'; u.lift = Math.abs(Math.sin((t - .85) * 6.5)) * .45 * (t < 1.5 ? 1 : .4); u.yawSet = Math.PI + Math.sin(t * 8) * .5; if (!I.hit && t > .88) { I.hit = true; sfx.play('hitA', u.x); } }
    else if (t < RUN - .25) {                       // it realises it is alone and looks around, suspiciously
      const s = t - 1.95, k = clamp((RUN - .25 - t) * 5, 0, 1); u.lift = 0; u.yawSet = Math.PI + Math.sin(s * 4.6) * 1.25 * k; I.bubble = Math.floor(s * 2.2) % 2 ? '?' : '…';
    }
    else if (t < RUN) { u.lift = 0; u.yawSet = Math.PI * (1 - (t - (RUN - .25)) / .25); I.bubble = '…'; }
    else {
      u.lift = 0; u.yawSet = 0; const sp = 60 + (t - RUN) * 900; u.vy = -sp; u.vx = 0; u.y += u.vy * dt; I.dust -= dt; if (I.dust <= 0) { I.dust = .05; puff(u.x, u.y + 10, 1, '#786850'); }
      if (introEl.classList.contains('in')) introEl.classList.remove('in');
      if (u.y < -70) return nextIntro();
    }
  }
  if (t > RUN + 2.4) nextIntro();
}
function endIntro() { const I = G.intro; if (I && I.u) { const n = U.indexOf(I.u); if (n >= 0) U.splice(n, 1); } G.intro = null; introEl.hidden = true; introEl.classList.remove('in'); roamOn(false); beginWave(); }
function skipIntro() { if (G && G.phase === 'intro') { G.intro.i = G.intro.keys.length; nextIntro(); } }
introEl.addEventListener('click', skipIntro);
OVERLAYS.push(() => {                       // the shocked bubble over the new enemy's head
  const I = G && G.phase === 'intro' && G.intro; if (!I || !I.u || !I.bubble) return; const u = I.u, sc = figScale(u.key, u.scale, u.tier);
  toScreen(wx(u.x), (2.15 + (LOOK[u.key].fl || 0)) * sc + (u.lift || 0), wz(u.y), sp);
  const bw = 54, bh = 38, x = sp[0], y = sp[1] - 14, pop = Math.min(1, I.t % 1 < .1 ? (I.t % 1) / .1 : 1);
  ox.save(); ox.translate(x, y); ox.scale(.6 + .4 * pop, .6 + .4 * pop); ox.fillStyle = '#f4f6fa'; ox.strokeStyle = '#' + EPAL[PI].a.toString(16).padStart(6, '0'); ox.lineWidth = 2;
  ox.beginPath(); ox.roundRect(-bw / 2, -bh, bw, bh, 12); ox.moveTo(-6, 0); ox.lineTo(0, 11); ox.lineTo(6, 0); ox.closePath(); ox.fill(); ox.stroke();
  ox.fillStyle = '#10141a'; ox.font = '700 22px "JetBrains Mono", monospace'; ox.textAlign = 'center'; ox.textBaseline = 'middle'; ox.fillText(I.bubble, 0, -bh / 2 + 1); ox.restore(); ovDirty = true;
});
