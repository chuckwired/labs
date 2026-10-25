// What does each page cost to load? Static estimate: the HTML plus every local file it references (stylesheets, scripts,
// fonts it uses, images). Text is counted gzipped (what the host sends); fonts and images are already compressed.
// Lazy images that the index draws from its LABS list are included. Third-party requests are listed, not counted.
// Usage: node tools/weigh.mjs
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGES = ['index.html', 'rs2-capes/', 'ocean/', 'windows-pipes/', 'birthday-dog/', 'rs2-capes/direction/', 'ocean/direction/', 'windows-pipes/direction/', '404.html'];
const kb = n => Math.round(n / 102.4) / 10;

const out = [];
for (const page of PAGES) {
  const file = join(ROOT, page.endsWith('/') ? page + 'index.html' : page);
  const html = readFileSync(file, 'utf8');
  const textGz = gzipSync(Buffer.from(html), { level: 9 }).length;
  let assets = 0, third = new Set(); const seen = new Set();
  const add = (u, base) => {
    if (/^data:|^#|^mailto:/.test(u)) return;
    if (/^https?:/.test(u)) { third.add(new URL(u).host); return; }
    const clean = u.split('#')[0].split('?')[0];
    const t = clean.startsWith('/') ? join(ROOT, clean) : resolve(dirname(base), clean);
    if (seen.has(t) || !existsSync(t) || statSync(t).isDirectory()) return;
    seen.add(t);
    const buf = readFileSync(t);
    assets += /\.(css|js|svg|txt)$/.test(t) ? gzipSync(buf, { level: 9 }).length : buf.length;
    if (t.endsWith('.css')) for (const m of buf.toString().matchAll(/url\(([^)]+)\)/g)) if (!/\.woff2/.test(m[1]) || usesFont(html, m[1])) add(m[1].replace(/['"]/g, ''), t);
  };
  const usesFont = (h, u) => /jetbrains/.test(u) || (/instrument/.test(u) && /--serif|Instrument Serif/.test(h)) || (/jersey/.test(u) && /Jersey/.test(h));
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) add(m[1], file);
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) add(m[1], file);
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) add(m[1], file);
  if (page === 'index.html') for (const m of html.matchAll(/cover: '([^']+)'/g)) add(m[1], file);
  for (const m of html.matchAll(/from "(https:[^"]+)"|"(https:\/\/cdn[^"]+)"/g)) third.add(new URL(m[1] || m[2]).host);
  out.push({ page, htmlKB: kb(Buffer.byteLength(html)), gzipKB: kb(textGz), assetsKB: kb(assets), totalKB: kb(textGz + assets), third: [...third].join(', ') || 'none' });
}
console.table(out);
