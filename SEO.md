# Search and answer-engine (SEO / AEO) setup

Status as of 25 October 2026. What exists, what doesn't, and how to check it.

## In place
- `sitemap.xml`, `llms.txt` and the crawlable `<noscript>` lab list in `index.html` are generated from `LABS` by `tools/sync-seo.mjs` (the pre-commit hook runs it). `robots.txt` is hand-written.
- Every public page: unique `<title>`, meta description, canonical, `og:*`, `twitter:card`, JSON-LD (`WebSite`, `CreativeWork`, `Article`). `og:image` is a JPEG (`cover.og.jpg`, made by `tools/optimise-images.mjs`).
- Unlisted pages carry `noindex` and are left out of the sitemap: the birthday card and its notes, the hidden lab, `behind-the-404`, and every `archive/` page.
- Content is plain HTML text. The index's cards are drawn by script, so the generated `<noscript>` list gives non-JS crawlers (most AI crawlers) the same links and blurbs.
- Fonts self-hosted, images WebP, no third-party calls on most pages (fewer failure points, faster first paint). The exceptions are three.js on the birthday card and the Cloudflare Web Analytics beacon (cookie-free, no consent banner) on every live page; `tools/lint-pages.mjs` fails a commit where a page lacks the beacon. Archived experiments and generated copies are exempt. chuckwired.com (Ghost) carries its own beacon via Code injection; both sites share one Cloudflare dashboard.
- Write-ups and the Performance page show a byline and date (also in JSON-LD, with `rel="author"` and `meta author`) and link to each other in an "Also read" row, so crawlers and readers can move between them.
- `node tools/check.mjs` fails a commit that drops any of the above, repeats a title, or lets a title or description run too long for search results.

## Not in place
- Search Console and Bing Webmaster verification (needs your Google and Microsoft accounts; add the site, submit `/sitemap.xml`). Without them there is no data on indexing or queries.
- Evidence that any engine uses `llms.txt`. It is cheap and harmless; treat it as a bet.
- The labs are WebGL canvases with almost no text, so they will not rank on their own. The "Behind the design" pages and the "Performance" page carry the words; improving those is where search value lives.
- A backlink or distribution plan (the main driver of ranking for a new domain).

## How to check
- Local: `node tools/check.mjs`. Per-page weight: `node tools/weigh.mjs`.
- Live, after deploy: view `/robots.txt`, `/sitemap.xml`, `/llms.txt`; paste a URL into a social-card validator; run Lighthouse's SEO category on the live URL; check that `/originals/...` returns 404.
- Rich results: test the JSON-LD with Google's Rich Results Test or schema.org's validator.

## AEO notes
Answer engines favour pages that state plainly what they are, in text, near the top, and that other sites cite. The write-ups already answer questions a model might be asked ("how do you make a realistic ocean in WebGL without a library?", "what is the Pipes screensaver rebuilt in WebGL?"). Cheap next steps: a short visible "what this is" line in each lab page's HTML (never hidden text), FAQ-style headings in a few write-ups, and 
