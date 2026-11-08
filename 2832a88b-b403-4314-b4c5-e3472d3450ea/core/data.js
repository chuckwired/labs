/* Shieldwall core: helpers, tunables and the definitions of troops, enemies and defences. Loaded first; shared by every mode. */
'use strict';
const $ = s => document.querySelector(s);
const cv = $('#c'), ov = $('#ov'), ox = ov.getContext('2d');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = Math.random, hyp = Math.hypot, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const q = new URLSearchParams(location.search);

/* ================= tunables ================= */
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const CFG = {
  step: 1 / 60,
  maxAlive: 260,        // enemies on the field at once; the rest wait in the queue (keeps the frame rate honest)
  armyCap: 70,
  wallH: 46,
  gateStart: 400,
  startGold: 210,
  start: { spear: 4, archer: 2 },   // a small band to begin with: the first waves are thinned to match, and are back to full strength by wave 4
  early: [.45, .6, .8],              // share of a wave's enemies in waves 1, 2 and 3
  boonMul: 1.8,                      // boons come at prime waves only, so each is worth about this much more than it would be on every wave
  boonWave: n => isPrime(n),
  winWave: 30,                       // clear this wave to prestige
  mergeN: 10,            // this many of one kind (and tier) trade up for one of the next tier...
  tierMul: [1, 7, 49],   // ...which is this many times as strong (less than mergeN: you pay a little for the freed places)
  countMul: 1.7,         // more bodies per wave, and the wave lasts longer, so the pressure at any moment stays the same
  goldMul: 0.62,         // ...so each kill pays a little less
  budget: n => 1.7 * (7 + 3.6 * n + 0.55 * n * n),       // points of enemy per wave
  hpMul: n => (1 + 0.11 * (n - 1)) * (n > 10 ? Math.pow(1.13, n - 10) : 1),  // the wall: after wave 10 health compounds
  dmgMul: n => 1 + 0.03 * (n - 1),
  clearGold: n => 25 + 7 * n,
};

/* ================= definitions ================= */
const UD = {
  spear:  { name: 'Spearmen',     one: 'Spearman',     cost: 12, hp: 42,  dmg: 6,  rate: .8,  reach: 16, speed: 46,  r: 5, role: 'melee',  note: 'Hold the line' },
  shield: { name: 'Shieldbearers', one: 'Shieldbearer', cost: 30, hp: 120, dmg: 4,  rate: .9,  reach: 15, speed: 40,  r: 6, role: 'melee',  note: 'Slow and very tough' },
  archer: { name: 'Archers',      one: 'Archer',       cost: 20, hp: 22,  dmg: 7,  rate: 1.05, range: 170, speed: 44, r: 5, role: 'ranged', note: 'Shoot over the line' },
  horse:  { name: 'Cavalry',      one: 'Horseman',     cost: 48, hp: 80,  dmg: 15, rate: .9,  reach: 18, speed: 100, r: 8, role: 'cav',    note: 'Fast flankers', scale: 1.25 },
  cat:    { name: 'Catapults',    one: 'Catapult',     cost: 90, hp: 70,  dmg: 40, rate: 3.4, range: 250, speed: 22, r: 9, role: 'siege',  note: 'Splash, long range', scale: 1.4, splash: 36, max: 6 },
};
const ED = {
  raider:  { cost: 1,   hp: 24,   dmg: 4,  rate: 1,   reach: 13, speed: 36, r: 5,  gold: 2,   name: 'vibe coders' },
  hound:   { cost: 1.6, hp: 14,   dmg: 3,  rate: .6,  reach: 11, speed: 82, r: 4,  gold: 3,   name: 'crawlers' },
  slinger: { cost: 3,   hp: 18,   dmg: 5,  rate: 1.4, range: 105, speed: 34, r: 5, gold: 6,  name: 'chatbots' },
  brute:   { cost: 8,   hp: 170,  dmg: 15, rate: 1.4, reach: 18, speed: 27, r: 9,  gold: 16,  name: 'AI-native workers', scale: 1.6 },
  giant:   { cost: 34,  hp: 950,  dmg: 50, rate: 2,   reach: 28, speed: 19, r: 16, gold: 70,  tough: .5, name: 'foundation models', scale: 2.6, splash: 30 },
  warlord: { cost: 90,  hp: 1000, dmg: 70, rate: 1.8, reach: 32, speed: 22, r: 20, gold: 200, tough: .85, name: 'AGIs', scale: 3.1, splash: 34 },
  /* bosses: one every fifth wave (BOSSES). hp is scaled by bossHp(n), not the normal wall. */
  hype:    { boss: 1, cost: 60,  hp: 800, dmg: 30, rate: 1.6, reach: 24, speed: 24, r: 18, gold: 250, tough: .5, name: 'The Early Adopter', scale: 2.8, splash: 26,
             summon: { every: 6, n: 2, keys: ['raider'] }, quotes: ['I was on the waitlist', 'you probably have not heard of it', "it's basically beta", 'I got in before it was cool'] },
  claw:    { boss: 1, cost: 90,  hp: 1000, dmg: 40, rate: 1.7, reach: 28, speed: 26, r: 19, gold: 350, tough: .5, name: 'The Claw Inventor', scale: 2.9, splash: 30,
             summon: { every: 5, n: 3, keys: ['hound'] }, quotes: ['it runs on my laptop', 'give it root access', 'what could go wrong', 'ship it, fix it later'] },
  layoff:  { boss: 1, cost: 120, hp: 1600, dmg: 35, rate: 1.8, reach: 26, speed: 22, r: 19, gold: 500, tough: .6, name: 'Head of Efficiency', scale: 2.8,
             pulse: { every: 7, R: 130, frac: .14 }, quotes: ["we're right-sizing", 'do more with less', 'this is not about performance', 'AI made your role redundant'] },
  ipo:     { boss: 1, cost: 150, hp: 1500, dmg: 55, rate: 2, reach: 30, speed: 16, r: 22, gold: 800, tough: .6, name: 'IPO Day', scale: 3.0, splash: 34,
             grow: 5, quotes: ['ringing the bell', 'valuation up 40%', 'the lock-up expires soon', 'market cap: yes'] },
  mythos:  { boss: 1, cost: 200, hp: 2600, dmg: 65, rate: 1.9, reach: 30, speed: 20, r: 22, gold: 1100, tough: .5, name: 'Mythos', scale: 3.1, splash: 36,
             blink: 7, split: [['giant', 1], ['brute', 3], ['slinger', 4]], quotes: ['too dangerous to release', 'preview access only', 'trust us, it is magic', 'you are not ready'] },
  sam:     { boss: 1, cost: 300, hp: 600, dmg: 45, rate: 2, reach: 30, speed: 14, r: 20, gold: 1500, tough: .93, name: 'Sam Altmann', scale: 2.6, hold: 340,
             summon: { every: 4, n: 4, lv: 14, cap: 40, keys: ['raider', 'raider', 'hound', 'slinger', 'brute'] }, quotes: ['AGI is a few thousand days away', 'scale is all you need', 'this is the worst it will ever be', 'safety is our top priority*', "we're so back", 'raising at $5 trillion'] },
};
const SD = {
  palisade: { name: 'Palisade',   cost: 15,  w: 42, h: 12, hp: 170, solid: true,  note: 'Blocks and delays' },
  spikes:   { name: 'Spike pit',  cost: 22,  w: 30, h: 26, hp: 260, solid: false, note: 'Hurts and slows who cross' },
  tower:    { name: 'Watchtower', cost: 65,  w: 20, h: 24, hp: 240, solid: true,  note: 'Archers, range 170', range: 170, dmg: 9,  rate: .9 },
  ballista: { name: 'Ballista',   cost: 110, w: 26, h: 20, hp: 170, solid: true,  note: 'Bolts pierce the horde', range: 290, dmg: 50, rate: 2.1 },
};
const BOSSES = { 5: 'hype', 10: 'claw', 15: 'layoff', 20: 'ipo', 25: 'mythos', 30: 'sam' };
const bossWaveAtOrAfter = n => { for (const w of Object.keys(BOSSES).map(Number).sort((a, b) => a - b)) if (w >= n) return w; return 0; };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
