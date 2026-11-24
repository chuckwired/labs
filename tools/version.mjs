// Site version: one number in .version (MAJOR.MINOR.PATCH), one annotated git tag per release (vMAJOR.MINOR.PATCH).
//   minor = a new public lab, a new page under p/, or a notable update to a lab
//   patch = maintenance and refactors (tooling, paths, checks, copy fixes)
//   major = a rework of the whole site
//
// node tools/version.mjs show                       current version, latest tag, commits since
// node tools/version.mjs list                       all version tags, newest first
// node tools/version.mjs minor "Ocean lab" [--push] bump, commit .version, tag, optionally push main and the tag
// node tools/version.mjs patch "Message" [--push]
// node tools/version.mjs major "Message" [--push]
//
// The message becomes the annotated tag's message and is public once pushed, so keep it neutral for anything under p/.
// Run it on main with a clean tree. The pre-commit hook still runs on the version commit.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VFILE = ROOT + '.version';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const die = m => { console.error(m); process.exit(1); };
const [cmd, ...rest] = process.argv.slice(2);
const push = rest.includes('--push');
const message = rest.filter(a => a !== '--push').join(' ').trim();
const current = () => (existsSync(VFILE) ? readFileSync(VFILE, 'utf8').trim() : '0.0.0');
const tags = () => git('tag', '-l', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname', '--format=%(refname:short)|%(creatordate:short)|%(contents:subject)').split('\n').filter(Boolean);

if (cmd === 'show' || !cmd) {
  const latest = tags()[0]?.split('|')[0];
  console.log(`.version   ${current()}\nlatest tag ${latest ?? '(none)'}`);
  if (latest) { const n = git('rev-list', '--count', `${latest}..HEAD`); console.log(`since tag  ${n} commit(s)`); }
} else if (cmd === 'list') {
  for (const t of tags()) { const [n, d, s] = t.split('|'); console.log(`${n.padEnd(9)} ${d}  ${s}`); }
} else if (['major', 'minor', 'patch'].includes(cmd)) {
  if (!message) die(`Give the release a message: node tools/version.mjs ${cmd} "What changed" [--push]`);
  if (git('branch', '--show-current') !== 'main') die('Run releases from main.');
  if (git('status', '--porcelain', '--untracked-files=no')) die('Working tree has uncommitted changes. Commit or stash them first.');
  const [M, m, p] = current().split('.').map(Number);
  const next = cmd === 'major' ? [M + 1, 0, 0] : cmd === 'minor' ? [M, m + 1, 0] : [M, m, p + 1];
  const v = next.join('.');
  if (git('tag', '-l', `v${v}`)) die(`Tag v${v} already exists.`);
  writeFileSync(VFILE, v + '\n');
  git('add', '.version');
  git('commit', '-m', `Version ${v}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`);
  git('tag', '-a', `v${v}`, '-m', message);
  console.log(`v${v} created (${message})`);
  if (push) { git('push', 'origin', 'main'); git('push', 'origin', `v${v}`); console.log('pushed main and the tag'); }
  else console.log(`Not pushed. Run: git push origin main v${v}`);
} else die('Usage: node tools/version.mjs show | list | major|minor|patch "message" [--push]');
