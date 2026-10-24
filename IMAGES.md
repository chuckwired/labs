# Image optimisation: findings and proposal

Status: attempted on branch `image-optimisation` (not merged). Originals untouched.

## What's in the repo
26 raster images, about 5.0 MB: 15 PNG (3.6 MB, covers and birthday-dog screenshots) and 11 JPEG (1.4 MB, the ocean notes screenshots). The two SVG covers are already tiny. The repo itself is small (`.git` 8 MB), so this is about page weight and bandwidth, not repo size.

The heaviest thing a visitor meets is the index: three raster covers load on arrival (`ocean`, `windows-pipes`, `birthday-dog`), about 493 KB. The rest only load on the "Behind the design" pages.

## What I measured
Encoded every image with Chrome's WebP encoder and compared against the original (PSNR is a rough quality score: above about 35 dB is hard to tell apart on screenshots, 40+ is very close).

| Format | Total | vs original | Quality |
|---|---|---|---|
| Originals (PNG + JPEG) | 5.0 MB | | |
| WebP lossless | 9.0 MB | worse | identical (JPEG-sourced files balloon) |
| WebP lossless, PNGs only | 3.3 MB | -9% | identical |
| WebP q92 | 2.0 MB | -59% | 37 to 44 dB |
| **WebP q85** | **1.5 MB** | **-70%** | **35 to 42 dB** |
| WebP q75 | 1.1 MB | -78% | 34 to 40 dB |

- Lossless WebP isn't worth it: PNG to lossless WebP saves under 10%.
- Lossy q85 is the sweet spot. Index covers go from 493 KB to about 131 KB. Alpha on the pipes cover is preserved.
- AVIF (macOS can write it) is a further 10 to 30% smaller on the three I tried (e.g. dog cover 252 KB PNG, 73 KB WebP, 56 KB AVIF). Worth it only if you want to chase the last bytes; WebP is simpler and universally supported.

## What I did on the branch
- Added a `.webp` (q85) next to each original, same name. Originals stay exactly where they are, so nothing is lost and everything is packaged together.
- Pointed the index covers and the three notes pages at the `.webp` files. All images load (checked all four pages in a browser), and the pipes alpha cover looks right.
- Not done: nothing is pushed. The originals are still deployed (static host serves the whole repo), but they cost nothing unless requested.

## Caveats and decisions for you
1. **Ocean screenshots are double-compressed.** The repo copies are already JPEGs I exported at 1200px wide from 1440px PNGs, and the WebPs were made from those. The real originals (11 PNGs, 9.5 MB) were only in my temporary scratch folder, not the repo. If you want them kept, they should be added (e.g. `ocean/direction/shots/originals/`) and the WebPs re-made from them. Your call: 9.5 MB extra in git history for a better source.
2. **Quality**: q85 is visible only if you look for it (soft edges on UI text in the birthday-dog screenshots). If any image matters more (the covers?), use q90 for those.
3. **Repeatability**: I encoded with Chrome through a throwaway script, which isn't worth keeping. The durable option is a small `tools/optimise-images.mjs` that shells out to `cwebp` (`brew install webp`, a dev-only tool, nothing ships): `cwebp -q 85 -alpha_q 100 -m 6 in.png -o in.webp`. Then new screenshots just need one command. I haven't installed it.
4. **Naming convention** if you adopt it: keep originals as the source of truth, serve the `.webp` sibling, and add a line to `CLAUDE.md` so new labs do the same.
5. **Fallbacks**: I used plain `.webp` references. Every browser that supports the site's View Transitions also supports WebP, so no `<picture>` fallback. Say if you'd rather have one.
6. **Open Graph**: no pages set `og:image` today. If you add one, use the original PNG/JPEG, since some social crawlers still skip WebP.
