# Images

Originals are the source of truth. Pages only ever use the optimised `.webp` copy.

```
originals/<path>/name.png     full quality, in git, never linked, kept off the deploy
<path>/name.webp              what pages reference (made by the tool)
```

`originals/` mirrors the site tree, so `originals/ocean/direction/shots/3-final-golden.png` becomes `ocean/direction/shots/3-final-golden.webp`.

## Workflow (every time you add or change an image)
1. Put the full-quality PNG or JPEG in `originals/<same path as the page folder>/`.
2. Run `node tools/optimise-images.mjs`. It encodes anything new or out of date and prints the savings.
3. Reference the `.webp` in the page. Never reference `originals/`.
4. Commit both. `node tools/optimise-images.mjs --check` exits 1 if a web copy is missing or older than its original (use it before merging).

Needs `cwebp` once: `brew install webp`. Flags: `--force` re-encodes everything, `--q 80` changes the default quality.

Settings live in `CONFIG` at the top of the tool: q85 for everything, q90 for files named `cover.*`, lossless alpha, and nothing wider than 1600px is shipped (originals can be bigger).

## Results (all 26 rasters)
13.0 MB originals, 1.6 MB web (about -88%). The index covers go from about 490 KB to about 160 KB. Ocean shots drop from about 1 MB each to 60 to 100 KB: they are smooth gradients, which WebP loves.

How the format was chosen (measured, PSNR against originals): lossless WebP saves under 10% on PNGs, so it isn't worth it. Lossy q85 gives about 70% off at 35 to 42 dB, which is hard to tell apart on screenshots. AVIF is a further 10 to 30% smaller but adds complexity for little gain. WebP is supported by every browser the site's View Transitions need, so there is no `<picture>` fallback.

## Keeping `originals/` off the public site (DigitalOcean App Platform)
The repo is public and the deploy serves the source folder, so `originals/` would be reachable by URL unless it is removed. Nothing links to it and it only costs bandwidth if someone requests it, but the full-quality files shouldn't be handed out either.

What DigitalOcean's docs say: static sites have no ignore or exclude file. `.dockerignore` and `.gitignore` don't help. The controls are `source_dir`, `build_command` and `output_dir`.

Chosen approach: set the build command to remove the folder before it is served. In the app's static site component settings:

```
Build command:  rm -rf originals
Output dir:     (leave empty)
```

The same thing as an app spec fragment (`doctl apps update`; a `.do/app.yaml` in the repo does not apply itself, so it isn't committed):

```yaml
static_sites:
  - name: labs
    source_dir: /
    build_command: rm -rf originals
```

Not yet verified on a real deploy. After the first deploy, check that `https://labs.chuckwired.com/originals/ocean/cover.png` returns 404 and `https://labs.chuckwired.com/ocean/cover.webp` loads. If the folder is still served, the fallback is to copy only the served files into an output folder (`build_command: mkdir -p _static && rsync -a --exclude originals --exclude _static --exclude .git ./ _static/`, `output_dir: _static`). The structural alternative, moving the whole site into `public/`, works but changes every tool and path, so it isn't worth it.

Gotcha: `.webp` files themselves are committed (they are the shipped assets), so a fresh clone works without `cwebp`.

## Notes
- Open Graph: no pages set `og:image` today. If one is added, point it at a PNG/JPEG made from the original, since some social crawlers skip WebP.
- Originals add to git history permanently. Today it is about 13 MB, far under GitHub's limits (100 MB per file, about 1 GB per repo as a guideline). If assets ever reach 100 MB or more, move originals to DigitalOcean Spaces or Git LFS.
