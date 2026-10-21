# 404 dots

Generates the dot figure on `404.html`. Edit the page's markup, CSS and script in `template.html`, not in `404.html` (the build overwrites it).

```sh
SRC=/path/to/still.png node gen.mjs 1950   # trace the still into points.json (arg = target dot count)
node build.mjs                             # template.html + points.json -> ../../404.html
node ../sync-404.mjs                       # copy to hackers-delight/ (the pre-commit hook also does this)
```

The source still is not kept in the repo. `mask.mjs` holds the hand-traced silhouette; `gen.mjs` holds the density, fade and detail-zone (head, hand) settings.
