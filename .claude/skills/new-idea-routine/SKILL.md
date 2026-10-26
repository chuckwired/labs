---
name: new-idea-routine
description: Chuck's routine for coming up with and building a new lab in this repo. Use when asked to "use the new idea routine", come up with new lab ideas, or start a new lab. Covers ideation, parallel style directions, building, testing honestly, the "Behind the design" write-up, and a publish-safety check.
---

# New idea routine

This is how I (Chuck) work on labs, written down so it can be repeated and improved. It is public on purpose: the method is part of the work. Read `CLAUDE.md` and `DESIGN.md` first. They hold the repo conventions; this file holds the method.

## Principles
- **Make me smile first.** The emotional reaction decides, not the spec. For a gift or a toy, a smile is the test. For anything higher-stakes (a customer, a product page) say so and propose real measurement instead (Self-Assessment Manikin, five-second tests).
- **Light-hearted over realistic.** Stylised and fun beats polished and serious unless I say otherwise.
- **Know who it is for.** Ask who the audience is. A direction that is cool but wrong for them is the wrong direction.
- **Build, don't describe.** I can't judge a style from a paragraph. Show three real ones.
- **Small and finishable.** Cut scope to what can be done well in a day. Say what you cut.
- **Be honest about testing.** Say what was only checked in a headless browser, and what I need to confirm on a real phone or real hardware.
- **Specific, slightly wrong details are the likeness.** Character comes from the quirk, not the average.

## 1. Ideate (no building yet)
1. Skim the existing labs and say what they share: what makes them feel like mine.
2. Give 8 ideas. For each: a one-line pitch, the interaction hook (what you can poke), the tech (SVG, CSS 3D, canvas, WebGL, three.js), and a rough effort in hours. Mix small and ambitious. No generic dashboards or portfolios, no near-duplicates of existing labs.
3. Recommend a top 3, say why, and what to cut to keep each small.
4. Stop. Wait for me to pick.

## 2. Pick a direction by building three
- Create a branch first. Never commit to `main`.
- Propose three genuinely different style directions: one ground, one ink, one accent; one type family; a clear idea sentence ("On this page, X becomes Y").
- If a style or design skill is installed and I haven't ruled it out, use it. If not, apply the rules in the next section yourself. Either way, don't make three variations of the same thing.
- Build all three in parallel with subagents, each in its own folder, each told its own port for testing. They must not touch each other's files or commit.
- Check each one yourself in a browser at desktop and phone width. Subagent reports are claims, not proof.
- Wait for me to choose. I may pick on feeling alone; that's valid.

## 3. House rules for a direction (when no style skill is used)
- One ground, one ink, one accent. One type family (two at most). Headline on at most two lines at every width.
- Tight display tracking, large scale contrast, left-aligned by default.
- No emoji, no glassmorphism, no gradient blobs, no icon-topped card rows, no decorative shadows or glows, no eyebrow labels, no index numbering in the product itself.
- Every control gives feedback. Motion is transform and opacity. Honour `prefers-reduced-motion`.
- If the lab should feel at home on the index, follow `DESIGN.md`. If it is its own world, say so and keep its tokens in its own file.

## 4. Build the chosen one
- It lives at `<lab>/index.html`, relative paths only, link `../shared/base.css` (self-hosted fonts and tokens; never Google Fonts), a unique title, description, canonical, `og:*` tags and JSON-LD copied from a neighbour, a "← Labs" back link, doctype, viewport and theme-color.
- Tunables go in a `CONFIG` object at the top of the script. Expose a small debug handle if it helps headless testing.
- Pause render loops when the tab is hidden. Cap pixel ratio. Provide a plain fallback if WebGL or a permission fails.
- Ask for permissions (microphone, camera, motion) only when the experience needs them, and handle refusal gracefully.
- Make the primary interaction forgiving: generous hit areas, nothing that needs precision.
- When I can't describe a number in words (a height, an angle), add a temporary slider behind a query string, let me set it by eye, then remove it.
- Keep the original directions: archive them under `<lab>/archive/` so the thinking stays visible, and tag the checkpoint.

## 5. Test honestly
- Check at desktop and phone width. Read the console. Step animations in a headless browser if the pane is throttled.
- Real hardware (phone, microphone, GPU) is mine to confirm. Say that plainly, then fix what I report.

## 6. Document
- Save full-quality screenshots (PNG) to `originals/<lab>/direction/shots/`: the three directions, the chosen one, and any tuning tools while they exist. Same for `cover.png` (`originals/<lab>/cover.png`). Then run `node tools/optimise-images.mjs` and reference the `.webp` copies in pages and `LABS`. Never link `originals/`. See `IMAGES.md`.
- Write `<lab>/direction/index.html`, a "Behind the design" page in my voice: first person, plain, a bit wry. Numbered sections, each ending with a one-line "Rule:". Include my actual reasons, in my words, including the unscientific ones. Start from `tools/templates/direction.html` (head tags, JSON-LD, byline, "Also read" nav and the section shape are all in it); `node tools/check.mjs` lints the result, so a write-up or a lab that isn't up to scratch fails the commit.
- Register the lab in `LABS` in the root `index.html` (with a cover and `notes`), add it to `README.md`, and add a section to `CLAUDE.md` with the decisions I made.

## 7. Publish-safety check (before every push)
This repo is public. Before asking to merge:
- Search the diff for local paths (`/Users/`, home directories, scratch folders), emails, tokens, API keys, internal URLs, and `localhost` ports in anything that ships.
- Screenshots must be page-only (rendered by a headless browser or cropped to the page). No desktop, no other tabs, no OS chrome, no file paths, no notifications.
- No real people's details beyond what I've said is fine to show. Personal pages (a gift, a private joke) get `noindex`.
- External scripts and fonts: pinned versions, from known CDNs. Found images or assets: licence and credit recorded.
- Don't commit the contents of any `.env`, credentials file, or machine config. Don't add tool or agent config that reveals more than the method.
- Run `node tools/check.mjs` (links, alt text, head tags, image copies, and the lab and write-up lint in `tools/lint-pages.mjs`: cover, notes page, back link, reduced motion, Article JSON-LD, Rule lines, voice) and `node tools/sync-seo.mjs` (sitemap and the crawlable list). Run `node tools/optimise-images.mjs --check` so every image has a current `.webp`, and confirm no page links into `originals/`.
- Show me `git status` and a short summary of what will go public.

## 8. Wrap up
- Commit on the branch with a clear message. Ask before merging to `main` and pushing; do the merge and push only when I say so.
- Tell me what's untested, what you'd fix next, and anything that looked wrong that I didn't ask about.

## To grow
This is a first draft. Add to it as I learn what works: new directions I like, rules I keep repeating, tests I trust.
