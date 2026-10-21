// hackers-delight/index.html is a byte-for-byte copy of 404.html (the lab is the 404 page).
// Edit 404.html only; this runs from the pre-commit hook (see tools/hooks/pre-commit).
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
copyFileSync(fileURLToPath(new URL('404.html', root)), fileURLToPath(new URL('hackers-delight/index.html', root)));
console.log('synced 404.html -> hackers-delight/index.html');
