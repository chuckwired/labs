// Makes the web copies of every source image.
//   originals/<path>/name.png|jpg  ->  <path>/name.webp
//   originals/<lab>/cover.png      ->  also <lab>/cover.og.jpg (JPEG for og:image: social crawlers are patchy with WebP)
// Originals are the source of truth (kept in git, never linked from a page, excluded from the deploy).
// Pages only ever reference the .webp. Needs cwebp: brew install webp
//
// Usage: node tools/optimise-images.mjs            encode anything new or out of date
//        node tools/optimise-images.mjs --check    report only, exit 1 if anything is missing or stale (no writes)
//        node tools/optimise-images.mjs --force    re-encode everything
//        node tools/optimise-images.mjs --q 80     change the default quality
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'originals');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const qArg = args.indexOf('--q');

const CONFIG = {
  quality: qArg >= 0 ? Number(args[qArg + 1]) : 85, // q85: about 70% smaller, hard to tell apart on screenshots
  coverQuality: 90,                                 // covers sit on the index and are the first thing seen
  alphaQuality: 100,                                // keep transparency edges clean
  maxWidth: 1600,                                   // never ship wider than this (originals can be bigger)
};

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(dir, e.name)) : /\.(png|jpe?g)$/i.test(e.name) ? [join(dir, e.name)] : []);

if (!existsSync(SRC)) { console.error('No originals/ folder.'); process.exit(1); }
if (!flag('--check')) {
  try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); }
  catch { console.error('cwebp not found. Install it with: brew install webp'); process.exit(1); }
}

const stale = [];
let before = 0, after = 0, done = 0;
for (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  const out = join(ROOT, dirname(rel), basename(rel, extname(rel)) + '.webp');
  const og = /(^|\/)cover\.[a-z]+$/i.test(rel) ? out.replace(/\.webp$/, '.og.jpg') : null;
  const fresh = [out, og].filter(Boolean).every(o => existsSync(o) && statSync(o).mtimeMs >= statSync(src).mtimeMs);
  if (fresh && !flag('--force')) { before += statSync(src).size; after += statSync(out).size; continue; }
  stale.push(rel);
  if (flag('--check')) continue;
  const q = /(^|\/)cover\.[a-z]+$/i.test(rel) ? CONFIG.coverQuality : CONFIG.quality;
  mkdirSync(dirname(out), { recursive: true });
  // -resize 0 keeps the height proportional; only used when the original is wider than maxWidth
  const wide = Number(execFileSync('sips', ['-g', 'pixelWidth', src]).toString().match(/pixelWidth: (\d+)/)?.[1] ?? 0) > CONFIG.maxWidth;
  execFileSync('cwebp', ['-q', String(q), '-alpha_q', String(CONFIG.alphaQuality), '-m', '6', '-quiet',
    ...(wide ? ['-resize', String(CONFIG.maxWidth), '0'] : []), src, '-o', out]);
  if (og) execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', '-Z', '1200', src, '--out', og], { stdio: 'ignore' });
  before += statSync(src).size; after += statSync(out).size; done++;
  console.log(`${rel}  ${(statSync(src).size / 1024) | 0} KB -> ${(statSync(out).size / 1024) | 0} KB  (q${q}${wide ? `, resized to ${CONFIG.maxWidth}px` : ''})`);
}

if (flag('--check')) {
  if (stale.length) { console.error(`${stale.length} image(s) missing or older than the original:\n  ` + stale.join('\n  ') + '\nRun: node tools/optimise-images.mjs'); process.exit(1); }
  console.log('All web copies are up to date.');
} else {
  console.log(`${done} encoded. Total ${(before / 1048576).toFixed(1)} MB originals -> ${(after / 1048576).toFixed(1)} MB web.`);
}
