// Builds rs2-capes/cover.svg: flat cape art for the landing-page card.
// Reuses the lab's own cape code (CONFIG..buildLayers) so the cover never drifts from the real art.
// Usage: node tools/make-cover.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../rs2-capes/index.html', import.meta.url), 'utf8');
const a = html.indexOf('/* ---------- tunables');
const b = html.indexOf('/* ---------- build DOM');
if (a < 0 || b < 0) throw new Error('markers not found in rs2-capes/index.html');
globalThis.matchMedia = () => ({ matches: false });
globalThis.navigator ??= {};
globalThis.location = { search: '' };
const { CAPES, buildLayers, sharedDefs } = new Function(html.slice(a, b) + '; return { CAPES, buildLayers, sharedDefs };')();

// the lab drives shading with the CSS var --lx; bake it into plain numbers so the SVG needs no CSS variable support
const bake = (svg, lx) => svg.replace(/opacity:max\(0,calc\((.*?)\)\)"/g, (_, e) => {
  const v = new Function(`return ${e.replace(/var\(--lx\)/g, `(${lx})`)}`)();
  return `opacity:${Math.max(0, v).toFixed(3)}"`;
});

// x, y = top-left of the cape; h = height; r = tilt in degrees; lx = position relative to screen centre
const PLACE = { mining: { x: 52, y: 40, h: 140, r: -6, lx: -0.55 }, herblore: { x: 165, y: 14, h: 164, r: 0, lx: 0 }, magic: { x: 283, y: 44, h: 140, r: 6, lx: 0.55 } };
let out = '';
for (const id of ['mining', 'herblore', 'magic']) {
  const d = CAPES.find(c => c.id === id), p = PLACE[id], s = p.h / 260;
  // the lab shares its clip paths and shading through <defs>/<use>; here each cape gets its own copy (ids suffixed, --lx baked in)
  const SHARED = ['cp-inn', 'cp-outb', 'gr-body', 'shade-body', 'shade-collar'];
  const suffix = t => SHARED.reduce((acc, k) => acc.split(`id="${k}"`).join(`id="${k}-${id}"`).split(`#${k}`).join(`#${k}-${id}`), t);
  const defs = suffix(sharedDefs()).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const inner = suffix(buildLayers(d, `c-${id}`).filter(l => l.flat).map(l => l.inner).join(''));
  out += `<g transform="translate(${p.x} ${p.y}) rotate(${p.r} ${60 * s} ${130 * s}) scale(${s.toFixed(4)})">${bake(defs + inner, p.lx)}</g>`;
}
writeFileSync(new URL('../rs2-capes/cover.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 190">${out}</svg>\n`);
console.log('wrote rs2-capes/cover.svg', out.length, 'bytes');
