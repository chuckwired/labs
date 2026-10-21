// Fills template.html with the traced points and writes ../../404.html, then syncs the hackers-delight copy.
import fs from 'fs';
const j = JSON.parse(fs.readFileSync(new URL('points.json', import.meta.url)));
const t = fs.readFileSync(new URL('template.html', import.meta.url), 'utf8')
  .replace('__ASPECT__', j.aspect.toFixed(4)).replace('__DATA__', j.enc).replace('__N__', j.n.toLocaleString('en-US'));
fs.writeFileSync(new URL('../../404.html', import.meta.url), t);
console.log('404.html written,', j.n, 'dots');
