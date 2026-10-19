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
