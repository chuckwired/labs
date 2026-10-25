# Fonts

Self-hosted so no page calls Google at load time. Latin subset only (what the site uses).

| File | Family | Licence |
| --- | --- | --- |
| `instrument-serif-italic-latin.woff2` | Instrument Serif, italic 400 | SIL Open Font License 1.1 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono, variable (400 and 500 share one file) | SIL Open Font License 1.1 |
| `jersey-10-latin.woff2` | Jersey 10 (only the capes lab uses it; declared in that page) | SIL Open Font License 1.1 |

Source: the woff2 files Google Fonts serves (fonts.gstatic.com, Instrument Serif v5, JetBrains Mono v24). Declared in `../base.css`.
If a page ever needs another glyph range or the upright serif, add the matching file and `@font-face` there.
