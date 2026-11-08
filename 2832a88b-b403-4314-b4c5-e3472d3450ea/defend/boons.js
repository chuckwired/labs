/* Defend mode: boon data, icons and how boons change your stats. */
'use strict';
const pc = x => Math.round(x * CFG.boonMul * 100) + '%', pcInv = x => Math.round((1 - Math.pow(x, CFG.boonMul)) * 100) + '%';
const BOONS = [
  { id: 'sharp',   name: 'Whetstones',     max: 5, d: 'Melee damage +' + pc(.12) },
  { id: 'fletch',  name: 'Fletching',      max: 5, d: 'Arrows, bolts and stones +' + pc(.12) + ' damage' },
  { id: 'plate',   name: 'Plate armour',   max: 5, d: 'Troop health +' + pc(.15) },
  { id: 'drill',   name: 'Drill sergeant', max: 4, d: 'Everyone attacks ' + pc(.10) + ' faster' },
  { id: 'longbow', name: 'Longbows',       max: 3, d: 'Ranged reach +' + pc(.14) },
  { id: 'tax',     name: 'Tax collector',  max: 4, d: 'Gold from kills +' + pc(.15) },
  { id: 'quart',   name: 'Quartermaster',  max: 3, d: 'Recruits and defences cost ' + pcInv(.92) + ' less' },
  { id: 'medic',   name: 'Field surgeon',  max: 3, d: 'Troops mend ' + (1.2 * CFG.boonMul).toFixed(1) + '% of their health a second' },
  { id: 'stone',   name: 'Blast doors',    max: 4, d: 'Doors +' + Math.round(150 * CFG.boonMul) + ' health, repaired now' },
  { id: 'ups',     name: 'Backup power',   max: 3, d: 'Data centre +' + pc(.2) + ' health, and it self-repairs ' + (.5 * CFG.boonMul).toFixed(1) + '% of it a second in battle' },
  { id: 'warcry',  name: 'War drums',      max: 3, d: 'Warcry lasts longer and recharges ' + pcInv(.8) + ' faster' },
  { id: 'rain',    name: 'Rain of arrows', max: 4, d: 'Volley +' + Math.round(4 * CFG.boonMul) + ' arrows, +' + pc(.3) + ' damage, recharges ' + pcInv(.88) + ' faster' },
  { id: 'fire',    name: 'Fire arrows',    max: 3, d: 'Hits set enemies alight' },
  { id: 'spikes',  name: 'Iron caltrops',  max: 3, d: 'Defences ' + pc(.4) + ' sturdier, spike pits bite harder' },
  { id: 'muster',  name: 'Conscription',   max: 99, d: 'Gain ' + Math.round(4 * CFG.boonMul) + ' spearmen and ' + Math.round(2 * CFG.boonMul) + ' archers now' },
  { id: 'chest',   name: 'War chest',      max: 99, d: 'Gain gold now (more the later it is)' },
];
const BICON = {
  sharp: '<path d="M20 4L9 15M7 13l4 4M7 17l-3 3"/>', fletch: '<path d="M4 20L19 5M19 5h-5M19 5v5M4 20l1-4M4 20l4-1M7 17l1-4"/>', plate: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
  drill: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', longbow: '<path d="M7 4c9 3 9 13 0 16M7 4v16M7 12h12M16 9l3 3-3 3"/>',
  tax: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.6c-.4-1-1.3-1.5-2.6-1.5-1.5 0-2.5.7-2.5 1.8s1 1.5 2.5 1.8 2.5.7 2.5 1.8-1 1.8-2.5 1.8c-1.3 0-2.3-.5-2.7-1.5M12 6.8v1.3M12 15.8v1.4"/>',
  quart: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1"/>', medic: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M7.5 12h9"/>',
  stone: '<path d="M4 20V9l3-2 3 2v2h4V9l3-2 3 2v11M10 20v-5h4v5"/>', warcry: '<path d="M4 10h16v3a8 4 0 0 1-16 0zM4 10a8 4 0 0 1 16 0M7 16l-2 4M17 16l2 4"/>',
  rain: '<path d="M6 3v8M4 9l2 2 2-2M12 2v9M10 9l2 2 2-2M18 3v8M16 9l2 2 2-2M5 15v6M12 14v7M19 15v6"/>', fire: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  spikes: '<path d="M3 20l3-12 3 12M9 20l3-14 3 14M15 20l3-12 3 12"/>', muster: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.4-4 3-6.2 6.5-6.2s6.1 2.2 6.5 6.2M18 5v6M15 8h6"/>',
  ups: '<rect x="4" y="7" width="15" height="10" rx="2"/><path d="M19 10h2v4h-2M11 8.5l-2.5 4h4l-2.5 4"/>', chest: '<path d="M4 10h16v9H4zM4 10a8 5 0 0 1 16 0M12 13v3"/>' };
const bIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${BICON[id] || ''}</svg>`;

/* ================= boons / stats ================= */
function L(id) { return (G && G.boons[id]) || 0; }
function calcB() {
  const m = CFG.boonMul;
  B = { melee: 1 + .12 * m * L('sharp'), ranged: 1 + .12 * m * L('fletch'), hp: 1 + .15 * m * L('plate'), rate: 1 + .1 * m * L('drill'), range: 1 + .14 * m * L('longbow'), gold: 1 + .15 * m * L('tax'),
    cost: Math.pow(.92, m * L('quart')), regen: .006 + .012 * m * L('medic'), fire: L('fire'), rain: m * L('rain'), warcry: m * L('warcry'), struct: 1 + .4 * m * L('spikes'), gregen: .005 * m * L('ups') };
}
const cost = (base) => Math.max(1, Math.round(base * B.cost));
