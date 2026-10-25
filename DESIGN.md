# DESIGN.md: visual system for labs.chuckwired.com

The shared look of the index, `404.html` and every lab's own notes pages. Individual labs may have their own world (the capes lab has its own void palette; see CLAUDE.md for lab-specific decisions), but anything that sits on the index, or links back to it, follows this.

No build step. Tokens and fonts live in `shared/base.css` (every page links it); the "Behind the design" layout lives in `shared/notes.css`. **Change a token in `shared/base.css` first**, then here. Pages that override a token (the 404, the index's own rules, labs with their own world) do it inline after the link. Relative paths: `../shared/` from a lab, `../../shared/` from its notes page; the 404 uses `/shared/` because it is served from any depth.

## Principles
- **Quiet dark void.** Content floats in near-black; colour comes from the work, not the chrome.
- **Serif speaks, mono explains.** Instrument Serif italic carries voice (headlines, titles). JetBrains Mono carries everything functional (body, labels, nav).
- **Clear hierarchy through size and tone, not decoration.** Three levels of text emphasis: ink (primary), dim (secondary), and dim at small size (tertiary). No bold, no underline except the link style below.
- **Motion is felt, not noticed.** Short, eased, reduced-motion safe.

## Colour
| Token | Value | Use |
|---|---|---|
| `--bg` | `#07070a` | page background (always set explicitly) |
| `--ink` | `#e8e6df` | primary text, hover/active |
| `--dim` | `#8b8a93` | secondary text, nav, captions |
| `--line` | `rgba(255,255,255,.10)` | borders, dividers |

Single dark look by choice (`color-scheme: dark`). Background dots: sparse, `#e8e6df` at 5 to 35% alpha, 1 to 1.6px.

## Type
Fonts: `Instrument Serif` (italic only), `JetBrains Mono` 400/500. Self-hosted woff2 in `shared/fonts/` (declared in `shared/base.css`, `font-display: swap`), with Georgia and system-mono fallbacks.

| Role | Face | Size | Notes |
|---|---|---|---|
| Display (page H1) | Serif italic | `clamp(44-48px, 9vw, 84-104px)` / 0.95 | letter-spacing -0.01em, `text-wrap: balance`. Index is the largest; secondary pages and 404 step down |
| Section heading (H2) | Serif italic | `clamp(26px, 5vw, 34px)` / 1.1 | on text pages |
| Card title | Serif italic | 28px / 1.1 | |
| **Lede** (intro under a headline) | Mono | **17px desktop, 15px at ≤560px** / 1.55 | `--dim`, max ~54ch. Every page-level intro uses this |
| Body | Mono | 14px / 1.6 | `--ink` on text pages |
| Secondary / caption | Mono | 12px | `--dim`: card blurbs, rule lines |
| Label | Mono, UPPERCASE | 11px, tracking `.16em` | nav, links, back links, footer-ish UI. Phones: 10 to 11px, `.12em` |
| Tag pill | Mono, UPPERCASE | 10px, tracking `.14em` | |

Rule of thumb: if you add a text style, it must fit one row above. If it doesn't, the hierarchy is wrong rather than the table.

## Links and buttons
- **Nav / quiet link:** label style, `--dim`, no underline; hover goes to `--ink`.
- **Call-to-action link** ("View source", "Behind the design", "Open the capes", "Labs" on 404): label style, `--ink`, 1px bottom border at 25% white, `padding-bottom: 3px`; hover border becomes `--ink`. At least ~26px of air above it.
- **Pill** (tags, back link on a lab): 999px radius, 1px `--line` border, label/tag type.
- Focus: `1px solid --ink`, 3px offset, via `:focus-visible`.

## Layout
- Content column max 1120px (index) or 720px (text pages); side gutters at least 20px plus safe-area insets.
- Index labs: one row each. Text on the left (date, title, blurb, tags, then "Dive in" and "Behind the design" inline as call-to-action links with no indent), a single credit-card-shaped plate on the right (credit-card corner, `border-radius: 3.7% / 5.9%`, 1px `--line`, turns (max 24deg across, 13deg up/down, eased on scroll) to face the middle of the viewport, the cover over the lab's glow colours; hover lifts it). Card goes above the text under 760px.
- Sections on text pages: 44px apart, separated by a `--line` rule with a small numbered label.
- Mobile: no horizontal scroll, one-row nav (drop the current-page link), type steps down per the table.

## Motion
- Page changes: cross-document View Transitions, root crossfade 0.32s; the card art and a lab's stage morph via the shared name `lab-art` (0.5s, `cubic-bezier(.2,.7,.2,1)`). Guarded by `prefers-reduced-motion: no-preference`.
- Hovers: 0.2 to 0.6s, same easing family. Nothing loops except what a lab itself needs.

## Voice
First person, plain, a bit wry. No "leverage", no "passionate". Claims should be things the page can show. (Chuck's own voice skill is the reference; AI-drafted copy gets passed through it.)

## Cover art
Each lab supplies a cover at 400x190 ratio: `cover.svg` (flat, no CSS variables) or a PNG with alpha (Pipes: rendered from the lab's own WebGL scene with a hand-placed set of pipes, 1000x475). A `LABS` entry can set `shatter: true`: clicking the card or "Dive in" breaks the plate into an 8x5 grid of squares that drift apart (NT-logo nod, ~0.75s) before navigating; skipped under reduced motion, and the lab-art view transition is skipped for it. The capes cover is generated: `node tools/make-cover.mjs`.
