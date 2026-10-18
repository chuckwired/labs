# labs (labs.chuckwired.com)

Chuck's monorepo of small interactive experiments. Owner: Chuck (product designer, portfolio on Ghost at chuckwired.com).

## Shape
- `index.html`: landing page and nav. Labs are listed in the `LABS` array in its script; add an entry per lab.
- `<lab-name>/index.html`: one folder per lab, each a self-contained static page. Link back to the index with `<a href="../">`.
- No build step, no dependencies. Vanilla HTML/CSS/JS. Use relative paths only (labs are served from subpaths).
- Style: dark void `#07070a`, ink `#e8e6df`, dim `#8b8a93`; Instrument Serif (italic for titles), JetBrains Mono for UI. Sparse background dots. Keep the Google Fonts `<link>` pattern, or self-host.
- Adding a lab: create folder + `index.html`, include the doctype/viewport/theme-color head and a "← Labs" back link, then add it to `LABS`.

## Hosting
- DigitalOcean App Platform, static site, source dir `/`, no build command. Free tier = 3 static-only apps (counts apps, not components; one app can hold several static components). Extra apps $3/mo. Each app: 1 GiB outbound/month, then $0.02/GiB.
- Goal: this one app serves `labs.chuckwired.com` (add the domain in app Settings > Domains, CNAME at DNS). Main site is Ghost on a DO droplet; leave it alone (ghost-cli regenerates its nginx config).
- Old standalone app `lab-rs2-capes-6z7et.ondigitalocean.app` (repo `lab-rs2-capes`) can be deleted once the monorepo is live.
- Fallbacks if limits bite: GitHub Pages or Cloudflare Pages (unlimited static).
- To verify: `/rs2-capes` and `/rs2-capes/` both resolve on DO; whether Google Fonts should be self-hosted (zero third-party calls).

## rs2-capes lab
Interactive RuneScape skill capes (herblore, mining, cooking, magic) drawn as layered SVG, no image assets. Click a cape to bring it forward, mouse-driven 3D tilt (max ±25° Y, ±15° X, no back view), others blur and dim, Esc or click away returns. Picker top right chooses which show; choice stored in localStorage (`cape-void:shown:v2`). Occasional shooting stars.
- Everything tunable is in `CONFIG` at the top of the script. `CONFIG.capeStyle = { herblore: 'rs3' }` (`osrs` variant is kept, do not delete). `defaultShown = herblore, mining, magic`.
- Model: back plate in trim colour (hangs slightly below hem), extrusion slices, body panel with six curved sections, emblem, shoulder pads, V collar. Light comes from screen centre via `--lx`.
- Perf architecture (keep): idle capes are one flat SVG; the 3D stack is `display:none` until focused; style writes cached; loop stops when page hidden; frame governor `goLite()` drops blur/stars/glow pulse if frames average >26ms; `LOWPOWER` builds fewer layers on weak devices.
- Decisions Chuck made: shoulder pads and the large focused view are approved, do not change. Shading approved. Disappear transition mirrors the intro but shorter. Title bottom-left uses Jersey 10 (closest free match to the in-game font), orange `#ff981f`, 2px hard black shadow.
- Open: mobile used to force-restart (suspected memory pressure); perf work done but untested on a real phone. Test from the deployed URL.

## Working with Chuck
Treat as a highly experienced peer. Terse, direct, no padding. Challenge him where useful.

## Git
Default branch `main`. Commit messages end with the Co-Authored-By trailer if Claude wrote the change.
