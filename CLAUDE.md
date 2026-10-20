# labs (labs.chuckwired.com)

Chuck's monorepo of small interactive experiments. Owner: Chuck (product designer, portfolio on Ghost at chuckwired.com).

## Shape
- `index.html`: landing page and nav. Labs are listed in the `LABS` array in its script; add an entry per lab.
- `<lab-name>/index.html`: one folder per lab, each a self-contained static page. Link back to the index with `<a href="../">`.
- No build step, no dependencies. Vanilla HTML/CSS/JS. Use relative paths only (labs are served from subpaths).
- Visual system (colour, type scale, links, motion, voice) lives in `DESIGN.md`: read it before adding or restyling anything on the index or a text page, and update it when a token changes.
- Style: dark void `#07070a`, ink `#e8e6df`, dim `#8b8a93`; Instrument Serif (italic for titles), JetBrains Mono for UI. Sparse background dots. Keep the Google Fonts `<link>` pattern, or self-host.
- `404.html` at the root is served by DO for unknown paths from any URL depth, so it is the one file that must use absolute paths (`/`) and inline styles.
- Cover art: each `LABS` entry can set `cover: '<lab>/cover.svg'` (400x190 viewBox, flat art) or a PNG of the same ratio (`windows-pipes/cover.png` was rendered from the lab itself). `shatter: true` on an entry makes the card break into squares on click. The capes cover is generated from the lab's own cape code: run `node tools/make-cover.mjs` after changing cape art.
- Page transitions: cross-document View Transitions (`@view-transition { navigation: auto }`, off under reduced motion) on the index and every lab. The card's `.art` and the lab's main surface share the name `lab-art` (card named by script during the transition; lab names its stage in CSS). Browsers without support just navigate normally. Speculation rules prefetch (never prerender: the labs run render loops) the next page.
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
- Perf update (v1 tag `v1-20261020` is the checkpoint before this): artwork is built on demand (flat SVG only while a cape is shown, the 16-layer stack only while focused, dropped after); colour-independent geometry, clip paths and the six-section shading live once in `sharedDefs()` and are `<use>`d per cape (pixel-identical to before). Above `CONFIG.crowdAt` (10) shown capes: no per-cape blur, no glow pulse, no idle tilt, light taken from resting position. At 29 capes: 4,682 -> 1,346 DOM nodes, 898KB -> 144KB markup, load 4.6s -> 2.3s (headless Chrome, 60fps held at 1x). On a throttled CPU (2x/4x, software raster) 29 capes is still not smooth; the first focus click shows a ~1s long frame in headless. Needs a real-phone check.
- Capes (12): herblore, mining, cooking, magic (original four, approved, never touch) plus agility, thieving, fletching, smithing, fishing, firemaking, woodcutting, farming (branch `rs2-all-capes`, the 99+ skills from Chuck's RS3 skills-tab screenshot). The new eight were traced from the OSRS Wiki's 3D cape renders (reference only, not shipped): emblems are the render's flat colours outlined and simplified to low-poly paths (`emAgility()` etc., 0.5-2.2KB each), palettes sampled from the render and tuned by eye against it. Method: pick the emblem's exact flat colours, label pixels, trace loops, Douglas-Peucker simplify, centre on (60,135). `tools/make-cover.mjs` was updated for the shared `<defs>` (it bakes a per-cape copy) and still reproduces the cover.
- Stress testing: `?stress=N` (N up to 60) pads the list with recoloured copies of the real capes and shows them all; the picker's temporary **Max** button does the same up to 29 at runtime and restores your selection when toggled off. Test capes are never saved. Remove the Max button when new capes exist.
- Decisions Chuck made: shoulder pads and the large focused view are approved, do not change. Shading approved. Disappear transition mirrors the intro but shorter. Title bottom-left uses Jersey 10 (closest free match to the in-game font), orange `#ff981f`, 2px hard black shadow.
- Open: mobile used to force-restart (suspected memory pressure); perf work done but untested on a real phone. Test from the deployed URL.

## windows-pipes lab
Windows XP 3D Pipes screensaver in raw WebGL2, no dependencies. Instanced cylinders and spheres (two draw calls), pipes grow on a 16^3 grid, camera drifts toward the growing tips. Same dot-field background as capes, no shooting stars. Bottom-right controls: palette swatches (restart on change, stored in localStorage `pipes:palette`), Next, FPS readout (also `P`), Full screen (also `F`; hidden where unsupported). Tunables in `CONFIG`. Chuck's framing: an experiment in performance and nostalgia, "not much to write yet"; notes page at `windows-pipes/direction/`. Untested on real phones: use the FPS readout.

## hackers-delight lab (hidden)
Easter egg. The `LABS` entry has `secret: true`: its row is `hidden` until the visitor, at the bottom of the index, makes 3 separate downward pushes (wheel gestures begun at the bottom, touch drags, or PageDown/End/Space/ArrowDown). Reveal flickers in, scrolls to it, and is remembered in localStorage `labs:found`; a quiet "Hide again" button on its row hides it and clears that flag. The footer nudges on each push. Not listed in the README on purpose. The lab itself is the 404 page for now (placeholder); notes page is about doing PortSwigger Web Security Academy labs (Chuck has finished server-side vulnerabilities and all three kinds of XSS: reflected, stored, DOM-based) and why hidden things delight practitioners, like game easter eggs. Both pages are `noindex`.

## Design decisions (Chuck's directions: do not regress)
Public write-up lives at `rs2-capes/direction/index.html`, linked from the index card via the `notes` field (link text "Behind the design"). Keep it in step with this list when decisions change.

**Concept and engine**
- Capes float in a dark void, each with a faint glow in its main colour. Click one to bring it to full height with mouse-driven 3D tilt. No back view. Others blur but stay faintly visible; click away or Esc returns it.
- Occasional shooting stars. A picker chooses which capes show; default three: herblore, mining, magic.
- Plain HTML/JS/CSS, no assets: capes are layered SVG shape and colour, with real 3D depth.

**Motion**
- Floating is subtle, slower still in the overview. Appearing runs small to large with natural motion (liked).
- Disappearing mirrors the appearance in reverse, shorter (it lingered before). Re-flowing the remaining capes when one is unticked was already excellent: leave it.
- Sparse background dots at varied, subtle opacities.

**Cape construction**
- Trim runs along left and right edges only, not across the bottom. The body's side edges end at the bottom rather than meeting inward.
- Layering (from OSRS): trim colour is a back layer, body on top, hood and shoulder pads in front; the trim back layer pokes out slightly at the bottom.
- Shoulder pads: redone once, then approved exactly as they are. Large focused view: "perfect", do not touch.

**Shading and light**
- Single light from screen centre shining outward, gradual section by section (the earlier version looked like folded paper). Six sections, organic slightly curved section lines, lighter vertical lines, softer light in both overview and focus. Approved.

**Per cape**
- Mining: graphic nudged slightly right to counterbalance; side trim is the cyan of the shoulder pads.
- Cooking: purple body, red side trim matching the shoulder pads (no bottom band). Emblem is a pot (not a chicken) with a neck flaring at the top, shaded round, slightly smaller, slimmed black outline that runs unbroken all the way round. Smoke wisps rectangular (not diamond), close together, with finger-joint bends: left bends left; middle is lower, tilted slightly right with its tip bent left; right matches the middle but tip tilted right.
- Magic: white body, blue trim.
- Herblore: `rs3` (default) and `osrs` variants both live in config, no UI yet; the osrs one is rebuilt from Chuck's OSRS reference. Keep both.

**Typography**
- Title bottom-left, "Chuck's Capes of Accomplishment". Jersey 10 (closest free match to the proprietary in-game font), OSRS orange `#ff981f`, 2px hard black shadow.

**Performance**
- Chuck saw forced restarts on mobile (more in the Claude app than in the browser) and asked for optimisation for mobile and weaker machines. See the perf architecture above.

**Project**
- One monorepo (`labs`) with labs.chuckwired.com as the entry point, one DO app; curate experiments out later if it gets big.

## Working with Chuck
Treat as a highly experienced peer. Terse, direct, no padding. Challenge him where useful.

## Git
Default branch `main`. Commit messages end with the Co-Authored-By trailer if Claude wrote the change.
