// Is this lab / write-up up to scratch? Called from tools/check.mjs (so it runs on commit). Run alone: node tools/lint-pages.mjs
//   - every LABS entry: folder, cover, notes page, head tags, back link, view transition, reduced motion
//   - every "Behind the design" page (*/direction/): the shape in tools/templates/direction.html
// Soft rules are warnings (printed, do not fail); hard rules are errors.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'https://labs.chuckwired.com';
const BANNED = ['leverage', 'passionate', 'delve', 'seamless', 'game-changer', 'unlock the', 'robust'];  // DESIGN.md voice: plain, first person, a bit wry
const read = f => readFileSync(join(ROOT, f), 'utf8');
// Pages that predate a rule are held to it as a warning, so new work meets the full standard without a rewrite of the old. Remove an entry when you fix the page.
const LEGACY = {
  'rs2-capes/index.html': ['og'], 'rs2-capes/direction/index.html': ['img-webp', 'og'], 'ocean/direction/index.html': ['img-size'],
  'birthday-dog/direction/index.html': ['byline'], 'hackers-delight/direction/index.html': ['byline', 'img-webp', 'placeholder'],
};

// Every live page carries the Cloudflare Web Analytics beacon and the Umami script (both cookie-free; see SEO.md). Archived experiments and generated copies are exempt.
const BEACON_SKIP = /(^|\/)(archive|originals|node_modules|\.git)(\/|$)|^hackers-delight\/index\.html$/;
function htmlFiles(dir = '') {
  return readdirSync(join(ROOT, dir)).flatMap(n => {
    const p = dir ? dir + '/' + n : n;
    if (BEACON_SKIP.test(p)) return [];
    return statSync(join(ROOT, p)).isDirectory() ? htmlFiles(p) : n.endsWith('.html') ? [p] : [];
  });
}

export function lintPages(err0, warn) {
  const err = (f, m, rule) => (LEGACY[f]?.includes(rule) ? warn(f, m + ' (legacy page)') : err0(f, m));
  for (const f of htmlFiles()) if (!/cloud\.umami\.is\/script\.js[^>]*data-website-id/.test(read(f))) err0(f, 'no Umami script after the Cloudflare beacon (copy it from tools/templates/direction.html)');
  for (const f of htmlFiles()) if (!/src="\/shared\/engage\.js"/.test(read(f))) err0(f, 'no engagement-time script after the Umami script (copy it from tools/templates/direction.html)');
  for (const f of htmlFiles()) if (!/static\.cloudflareinsights\.com\/beacon\.min\.js[^>]*data-cf-beacon/.test(read(f))) err0(f, 'no Cloudflare Web Analytics beacon before </body> (copy it from tools/templates/direction.html)');
  const index = read('index.html');
  const a = index.indexOf('var LABS = ['), b = index.indexOf('];', a) + 1;
  const LABS = new Function(index.slice(a, b).replace('var LABS =', 'return') + ';')();

  // ---- labs
  for (const l of LABS) {
    const f = l.path + 'index.html', tag = `lab ${l.path}`;
    if (!existsSync(join(ROOT, f))) { err(f, `${tag}: no index.html`); continue; }
    const html = read(f), head = html.slice(0, html.indexOf('</head>')), noindex = /name="robots" content="noindex/.test(head);
    if (l.cover && !existsSync(join(ROOT, l.cover))) err(f, `${tag}: cover missing: ${l.cover}`);
    if (!l.cover) warn(f, `${tag}: no cover on its LABS entry`);
    if (!l.notes) warn(f, `${tag}: no "Behind the design" page (notes) on its LABS entry`);
    else if (!existsSync(join(ROOT, l.notes, 'index.html'))) err(f, `${tag}: notes page missing: ${l.notes}`);
    if (!l.blurb || !l.tags?.length || !l.date) err(f, `${tag}: LABS entry needs blurb, tags and date`);
    if (l.secret) continue;                                           // the hidden lab is a copy of the 404
    if (!/theme-color/.test(head)) err(f, `${tag}: no theme-color`);
    if (!/viewport-fit=cover/.test(head)) warn(f, `${tag}: viewport lacks viewport-fit=cover`);
    if (!/<a [^>]*href="\.\.\/"[^>]*>[^<]*Labs/.test(html)) warn(f, `${tag}: no "← Labs" back link`);
    if (!/lab-art/.test(html)) warn(f, `${tag}: stage lacks the shared view-transition name lab-art`);
    if (!/prefers-reduced-motion/.test(html)) err(f, `${tag}: no prefers-reduced-motion handling`);
    if (!noindex) {
      if (!/"@type":"CreativeWork"/.test(head)) err(f, `${tag}: no CreativeWork JSON-LD`);
      if (!head.includes(`rel="canonical" href="${ORIGIN}/${l.path}"`)) err(f, `${tag}: canonical should be ${ORIGIN}/${l.path}`);
      if (!/property="og:image"/.test(head)) err(f, `${tag}: no og:image`, 'og');
    }
  }

  // ---- write-ups
  const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return n === 'node_modules' || n === '.git' || n === 'originals' || n === 'tools' ? [] : statSync(p).isDirectory() ? walk(p) : []; });
  const notes = [];
  const find = d => { for (const n of readdirSync(d)) { const p = join(d, n); if (['node_modules', '.git', 'originals', 'tools'].includes(n)) continue; if (statSync(p).isDirectory()) { if (n === 'direction' && existsSync(join(p, 'index.html')) && !p.includes('/archive/')) notes.push(relative(ROOT, join(p, 'index.html'))); find(p); } } };
  find(ROOT);
  for (const f of notes) {
    const html = read(f), head = html.slice(0, html.indexOf('</head>')), noindex = /name="robots" content="noindex/.test(head), url = `${ORIGIN}/${f.replace(/index\.html$/, '')}`;
    const need = (ok, msg) => { if (!ok) err(f, `write-up: ${msg}`); };
    need(/<h1>Behind the design\.<\/h1>/.test(html), 'h1 should be "Behind the design."');
    need(/<p class="lede">/.test(html), 'no .lede');
    const time = html.match(/<p class="by">[\s\S]*?rel="author"[\s\S]*?<time datetime="(\d{4}-\d{2}-\d{2})">/);
    if (!time) err(f, 'write-up: no byline (.by with rel="author" and a <time datetime>)', 'byline');
    const secs = [...html.matchAll(/<section>([\s\S]*?)<\/section>/g)].map(m => m[1]);
    need(secs.length >= 3, `needs at least 3 numbered sections (has ${secs.length})`);
    secs.forEach((s, i) => { if (!/class="n">\d\d</.test(s) || !/<h2>/.test(s) || !/<p class="say"><b>Rule:<\/b> [^<]+/.test(s)) err(f, `write-up: section ${i + 1} needs a number, an h2 and a one-line "Rule:"`); });
    let noSize = 0;
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const t = m[0];
      if (!/src="[^"]+\.webp"/.test(t)) err(f, `write-up: image should be a .webp (see IMAGES.md): ${t.slice(0, 70)}`, 'img-webp');
      if (!/alt="[^"]{12,}"/.test(t)) err(f, `write-up: image needs real alt text (12+ characters): ${t.slice(0, 70)}`);
      if (!/\swidth="\d+"/.test(t) || !/\sheight="\d+"/.test(t)) noSize++;
    }
    if (noSize) err(f, `write-up: ${noSize} image(s) need width and height attributes (stops layout jumping)`, 'img-size');
    need(/<div class="actions">[\s\S]*?href="(\.\.\/){2}">[^<]*Back to labs/.test(html), 'no "Back to labs" action');
    if (!noindex) {
      need(head.includes(`rel="canonical" href="${url}"`), `canonical should be ${url}`);
      need(/property="og:type" content="article"/.test(head), 'og:type should be article');
      if (!(/property="og:image"/.test(head) && /twitter:card/.test(head))) err(f, 'write-up: needs og:image and twitter:card', 'og');
      const ld = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      let j = null; try { j = JSON.parse(ld?.[1] ?? 'null'); } catch {}
      need(j && j['@type'] === 'Article' && j.url === url && j.headline && j.datePublished, 'JSON-LD Article needs headline, url (= canonical) and datePublished');
      if (j && time && j.datePublished !== time[1]) err(f, `write-up: JSON-LD datePublished (${j.datePublished}) differs from the byline (${time[1]})`);
      if (!/<nav class="more"[^>]*>[\s\S]*?(<a [^>]*>[^<]+<\/a>\s*){2,}/.test(html)) warn(f, 'write-up: no "Also read" nav (needs 2+ links)');
    }
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').toLowerCase();
    for (const w of BANNED) if (text.includes(w)) err(f, `write-up: voice: "${w}" (DESIGN.md: plain, first person, a bit wry)`);
    if (/todo|lorem|placeholder|xxx/i.test(text)) err(f, 'write-up: leftover TODO / placeholder text', 'placeholder');
    if (!/\b(I|my|I'm|I've)\b/.test(html.replace(/<[^>]+>/g, ' '))) warn(f, 'write-up: no first person; it should read as Chuck talking');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = [], warns = [];
  lintPages((f, m) => errors.push(`${f}: ${m}`), (f, m) => warns.push(`${f}: ${m}`));
  warns.forEach(w => console.warn('warn  ' + w));
  if (errors.length) { console.error(errors.map(e => 'error ' + e).join('\n')); process.exit(1); }
  console.log('lint ok');
}
