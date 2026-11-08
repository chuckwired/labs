/* Defend mode: scripted camera cuts. Two directors drive `roam.dir` (core/scene.js): one for the game-over screen (a loop of cuts over the
   battlefield behind the stats panel; a touch hands the camera to the player) and one for the new-enemy intro (a close-up of the drop, then a
   chase shot from behind as it sprints north). */
'use strict';
function playShots(shots, auto) {
  roamOn(true); roam.auto = !!auto; let i = 0, t0 = performance.now(), s = shots[0];
  roam.dir = now => {
    if (now - t0 > s.dur) { i = (i + 1) % shots.length; s = shots[i]; t0 = now; }
    const el = now - t0; roam.tx = s.tx; roam.ty = s.ty || 0; roam.tz = s.tz; roam.yaw = s.yaw + (s.dy || 0) * el; roam.pitch = s.pitch; roam.dist = s.dist + (s.dd || 0) * el; roam.fov = s.fov || 42;
    const pn = auto && !scr.classList.contains('roaming') && scr.querySelector('.panel'); roam.shift = pn ? Math.round(pn.offsetHeight / 2 + 10) : 0;
  };
}
function overCinema() {
  let n = 0, ex = 0, ey = 0; for (const u of U) if (u.side && !u.dead) { n++; ex += u.x; ey += u.y; } if (n) { ex /= n; ey /= n; } else { ex = G.bx; ey = GL - 160; }
  const gx = wx(clamp(ex, 60, W - 60)), gz = wz(ey);
  playShots([
    { dur: 5000, tx: 0, tz: -9, yaw: .55, pitch: .5, dist: 50, dy: .00011, dd: -.0012 },            // wide, drifting in
    { dur: 4200, tx: wx(G.bx) * .6, ty: .6, tz: -1.5, yaw: -.85, pitch: .2, dist: 13, dy: .00016 },   // low at the gate
    { dur: 5000, tx: gx, tz: gz, yaw: Math.PI + .3, pitch: .3, dist: 26, dy: -.00013 },             // from behind the horde, looking at the data centre
    { dur: 4500, tx: 0, tz: -4, yaw: .1, pitch: 1.0, dist: 30, dy: .0001 },                         // high above the wall
  ], true);
}
/* the new-enemy intro: two cuts. `I.u` is the enemy; the first shot sits low in front of it for the drop and the "!?", the second follows it from behind as it sprints off. */
function introCinema() {
  roamOn(true); const sv = { y: 0 };
  roam.dir = () => {
    const I = G && G.intro, u = I && I.u; if (!u) return; const sc = figScale(u.key, u.scale, u.tier), h = (1.2 + (LOOK[u.key].fl || 0)) * sc;
    if (I.t < RUN) { roam.tx = wx(u.x); roam.ty = h * .7; roam.tz = wz(u.y); roam.yaw = .55 + I.t * .05; roam.pitch = .16; roam.dist = Math.max(6, 6 + sc * 3.5 - Math.min(I.t, 2.2) * .9); roam.fov = 42; }
    else { roam.tx = wx(u.x); roam.ty = h * .5; roam.tz = wz(u.y) - 3; roam.yaw = .25; roam.pitch = .3; roam.dist = 9 + sc * 2; roam.fov = 46; }
    roam.shift = 0;
  };
}
