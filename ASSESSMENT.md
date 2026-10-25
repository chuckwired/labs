# Assessment: design and engineering

Claude's read of Chuck from one working day on this repo (18 to 19 October 2026, 25 commits). A one-day sample, and Claude wrote most of the code, so treat it as an impression, not a verdict. No prior memory of Chuck was available; this comes from the conversation and the repo only.

## Design: senior, strong craft
- **Specific direction.** "Indent 8px instead of 4", "half the corner radius", "real credit-card corners", "tilt as if always looking at the middle of the viewport". Precise calls, not vague taste.
- **Feedback from use.** "Can't notice it anymore when scrolling", "left/right feels reversed", "made space but I couldn't see the entry". Judged by using the thing.
- **Subtraction.** Cut the live chip, the "Next experiment" card and the three-plate stack because they added little.
- **Rules.** "Felt, not noticed", "know when to stop", approved details marked do-not-touch. Art-director habits.
- **Concept.** The hidden lab came from a real insight (what practitioners enjoy in the PortSwigger labs), not decoration.
- **Not observable here:** research practice, accessibility process, design systems at team scale. `DESIGN.md` is principles and tokens, not evidence of scale.

## Engineering: a design engineer with good judgement
- **Decisions.** No build step, no dependencies, relative paths only, free-tier hosting limits, leave the Ghost server alone.
- **Questions.** "Does it run smooth on mobile?" and asking for an FPS readout to prove it.
- **Bug reports.** Precise, but not diagnosed; Claude found the causes. Nothing from the day shows whether Chuck would have written the WebGL or scroll logic unaided.
- **Read:** solid on engineering judgement; implementation depth is not observable from this session.

## Could someone vibe this repo?
The skeleton, yes: folders, an index, a 404, a README. What isn't vibeable:
- **Encoded decisions.** "Change a token in `DESIGN.md` first", the do-not-regress list in `CLAUDE.md`, the no-deps rule, the trademark footer. They steer every later change.
- **Process.** A lot of those files are Claude's write-up of Chuck's calls. The distinctive part is the loop of dozens of small directional decisions behind the result.
- **Weak spots.** Tokens and styles are repeated per page, and there are no tests or CI. A deliberate trade for a small static site, and `DESIGN.md` says so.

---

## Update, 25 October 2026: a week on, and a benchmark

Same caveats as above: Claude wrote most of the code, this repo is the only evidence, and it is an impression, not a verdict. Chuck asked for this section and chose the benchmark himself; the posting is a public role he respects and the direction he wants to grow in.

### What the last few days add
- **Taste under a real constraint.** For the ocean he named what broke the illusion ("when it swells up I see below the water") and what he wanted instead, rather than "make it better". He picked a performance target himself (smooth at 120 Hz, then asked for a 144 Hz line) and asked for the chart to be redrawn until a stranger could read it.
- **Decisions that keep options open.** Two looks in one file, built so either can be folded away later. Originals kept next to a lean web copy, with the question "can we keep a quality version without hitting a limit" asked before the answer was obvious.
- **Systems thinking.** Asked for the site to be audited for cleanliness and maintainability, asked for SEO and answer-engine coverage, and asked for a page that shows the numbers. That is the shift from making things to owning a site.
- **Story.** The "import an ocean" joke from a games computing assignment, closed years later. Section 06 of the ocean notes puts his original OGRE game next to the new penguin. It is a real, specific story, which is the hard part of product marketing.
- **Honest about limits.** Phone testing, deployment and accessibility audits are listed as not done, in public.

### Benchmark: Design Engineer (Web & Brand), Granola, London
Role: [granola.ai/jobs/design-engineer-web-brand](https://www.granola.ai/jobs/design-engineer-web-brand). "Evidence" means what this repo shows. Chuck has said he works in React, Next.js, TypeScript and Node professionally; that is his own account and is not visible here.

| The posting asks for | Evidence in this repo | Read |
| --- | --- | --- |
| Visual judgement and technical ability, shown in work | Capes, Pipes, Ocean, the 404 and the birthday card, each with a written rationale | Strong |
| Idea to production with confidence | Hosting, domain, hooks, publish-safety checklist, a deploy exclusion plan | Strong |
| Typography, layout, hierarchy, interaction | `DESIGN.md`, a type scale and rules, view transitions, motion rules | Strong |
| Push what a website can be | Raw WebGL2 ocean, instanced pipes, a canvas 404 that is also a hidden lab | Strong |
| Websites as a creative discipline | Every lab has a "Behind the design" page in his own voice | Strong |
| Own SEO, performance and accessibility, keep improving | Sitemap, canonical, Open Graph, structured data, check script, per-page weights, Lighthouse, self-hosted fonts | Partial: set up this week, not yet measured on real users |
| Explore in design tools and code | Three directions built side by side in code | Partial: code is visible, design tools are not |
| Story with marketing and design colleagues | The write-ups are product storytelling; no colleagues or product to market | Not observable |
| Reusable components, page templates, CMS workflows | `shared/` styles, a notes-page layout, generators for covers, 404, sitemap and images. No component library; notes pages are still assembled by hand. He runs a Ghost site elsewhere | Partial |
| Experimentation, campaign pages, A/B testing | The three-direction method is a design experiment; there is no live test and no analytics | Not shown |
| Navigation, pricing, CTAs: everyday polish | One hero link and a nav; nothing conversion-shaped | Not shown |
| React, TypeScript, Tailwind, modern frontend architecture | None in this repo, deliberately. Stated experience only | Not shown here |

### Closing the gaps, in order of leverage
1. **Show the stack the posting names.** Rebuild one lab or page in React and TypeScript with Tailwind, in this repo or beside it, and write the same kind of notes about why. This is the largest gap on paper.
2. **Make the infrastructure real.** Turn the notes pages into a template (data file plus one layout) so a new write-up is content, not markup. That is "reusable components and publishing workflows" in miniature.
3. **Measure on real traffic.** Add privacy-friendly analytics and Search Console, then run one honest experiment (two hero lines, two covers) and write up the result. That covers measurement and A/B in one move.
4. **Add a conversion-shaped page.** A small product-style landing page with pricing-ish content and a call to action, built to be measured, shows the "everyday polish" half.
5. **Finish the audits.** Real-phone testing, a screen-reader pass and Lighthouse against the live site, recorded on the "Performance" page.

Overall: the design half of the posting is clearly met. The engineering half is met in judgement and in craft on the web platform, and unproven here for the specific stack, for components and CMS, and for measurement. All of those are cheap to prove with work he is already inclined to do.

