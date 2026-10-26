// Fast, dependency-free sanity check for the whole site. Runs from the pre-commit hook; run it by hand any time.
//   - every local src/href resolves to a real file, and nothing links into originals/
//   - every web image is current (tools/optimise-images.mjs --check)
//   - every indexable page has title, description, canonical, og:title, a favicon and image alt text
//   - no Google Fonts: fonts are self-hosted (the one deliberate third-party dependency is three.js on the birthday card, pinned on jsDelivr)
// Usage: node tools/check.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lintPages } from './lint-pages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', '.git', 'originals', 'tools']);
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (SKIP.has(e.name) ? [] : walk(join(d, e.name))) : e.name.endsWith('.html') ? [join(d, e.name)] : []);

const errors = [];
const titles = new Map();
const err = (f, m) => errors.push(`${relative(ROOT, f)}: ${m}`);

for (const f of walk(ROOT)) {
  const html = readFileSync(f, 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const noindex = /name="robots" content="noindex/.test(head);

  for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|data:|#|javascript:|\/\/)/.test(u) || u.includes('${') || u.includes("' +")) continue;
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    if (/originals\//.test(u)) err(f, `links into originals/: ${u}`);
    let t = u.startsWith('/') ? join(ROOT, u) : resolve(dirname(f), u);
    if (existsSync(t) && statSync(t).isDirectory()) t = join(t, 'index.html');
    if (!existsSync(t)) err(f, `broken link: ${m[1]}`);
  }

  if (/fonts\.(googleapis|gstatic)\.com/.test(head)) err(f, 'loads Google Fonts; use shared/base.css');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt=/.test(m[0])) err(f, `image without alt: ${m[0].slice(0, 60)}`);
  if (!/<html lang=/.test(html)) err(f, 'no lang on <html>');
  if (!/name="viewport"/.test(head)) err(f, 'no viewport meta');
  if (!/<title>[^<]+<\/title>/.test(head)) err(f, 'no <title>');
  if (!/rel="icon"/.test(head) && !f.includes('/archive/')) err(f, 'no favicon');
  if (!noindex) {
    const t = head.match(/<title>([^<]+)<\/title>/)?.[1], d = head.match(/name="description" content="([^"]+)/)?.[1];
    if (t && titles.has(t)) err(f, `same title as ${titles.get(t)}: "${t}"`); else if (t) titles.set(t, relative(ROOT, f));
    if (t && t.length > 70) err(f, `title is ${t.length} characters (keep it under 70)`);
    if (d && d.length > 170) err(f, `description is ${d.length} characters (keep it under 170)`);
    if (!/name="author"/.test(head)) err(f, 'no author meta');
    if (!/name="description" content="[^"]+/.test(head)) err(f, 'no meta description');
    if (!/rel="canonical"/.test(head)) err(f, 'no canonical link');
    if (!/property="og:title"/.test(head)) err(f, 'no og:title');
  }
}

for (const m of readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/labs\.chuckwired\.com\/([^<]*)<\/loc>/g)) {
  const t = join(ROOT, m[1], m[1] === '' || m[1].endsWith('/') ? 'index.html' : '');
  if (!existsSync(t)) err(join(ROOT, 'sitemap.xml'), `lists a page that doesn't exist: /${m[1]}`);
}

lintPages((f, m) => errors.push(`${f}: ${m}`), (f, m) => console.warn(`warn  ${f}: ${m}`));

const img = spawnSync('node', [join(ROOT, 'tools/optimise-images.mjs'), '--check'], { encoding: 'utf8' });
if (img.status !== 0) errors.push(img.stderr.trim() || 'image check failed');

if (errors.length) { console.error(`${errors.length} problem(s):\n  ` + errors.join('\n  ')); process.exit(1); }
console.log('check ok');
