# G5d plan review: Astra's findings, triaged (2026-10-28)

`Tools/Agent/astra.sh -e high`, two steps: an unanchored figure-by-figure read of the G5c art and screenshots before
reading the plan, then the plan. Reply saved under `Temp/AgentCodex/`.

## Step 1, the art and the screens (folded into the plan's "Why G5c fell short" and the sprint's brief)

Confirmed the hero's two-headed poodle (x2000 to 2260, y210 to 370) and the child-proportioned crew in both poses
(hands unclear around the ball and the mop handle); the sheets' red and yellow transparency streaks; no one
illustration system (painterly scene, plush figures, plastic robot, flat outline icons); figures with no shared camera
or ground contact ("stickers over a painting"); the washed band under the front fence. UI: a preschool register for
AP Business; everything a card or a pill, containers in containers; read-only On/Off pills that look clickable; the
prediction's ragged grid and the Why box indented around the robot; a waiting screen that is mostly empty lawn and a
big robot; the mascot taking a third of the stage mid-week; a HUD whose scopes are unclear ("2 dogs sent home sick"
beside "Sent home sick 3"); **"You called 5 of 5" celebrating a week with 7 incidents** (prediction accuracy reads as
business success); a report that is not visibly a P&L; the tray like a debug toolbar.

## Step 2, the plan

| # | Finding | Verdict | Change to the plan |
|---|---|---|---|
| 1 | High: QA approvals not bound to the pixels | **Accepted; already built** | `tests/art/qa.test.ts` (written while the review ran) counts a pass only on the file's SHA-256 prefix. Added: each pass names the original's hash in the provenance and the figure inventory in its notes; readers also check the full image at 1× and the page's own crops (the shots at 2×), not only tiles. |
| 2 | High: "nobody finds a defect" unprovable; "medium" undefined; correlated model blind spots; no attempt budget | **Accepted** | Severity defined (blocking, high, medium, low with examples). Budget: at most four review rounds and three regenerations per asset before the owner decides. The owner sees the three directions as a checkpoint before production (one look, not a quiz; the team's pick stands if he is silent). |
| 3 | High: the fallback moves and is untested; Nov 9 missing | **Accepted** | WP0 now: G5c with the hero repaired (the poodle and tunnel cropped out), QA'd under D58, e2e green, on branch `g5c-fallback` with a fixed commit. Dated schedule to Nov 5; Nov 6 to 8 for deploy and pilot prep. |
| 4 | High: the sprint compares the easy screen only; directions may converge | **Accepted** | Each direction also shows the crowded yard (18 dogs) and a report excerpt; must differ in hierarchy and composition, not palette; the finalist's hardest states are prototyped in the real page first (WP2 and WP3 start there). |
| 5 | High: file ownership and asset contracts incomplete | **Accepted** | Ownership table: the ledger, the manifest, the shots and the tests are the main thread's; WP2 owns `package.json` and `package-lock.json` (fonts only); WP4 owns the art files, the originals and the provenance README. Seam before Phase 2: `src/assets/art/manifest.ts` (ids, file, kind, native size, foot anchor, facing) and the canvas tokens contract (WP3 reads named CSS custom properties; names frozen). |
| 6 | High: transfer size is not a Chromebook budget | **Accepted in part** | Added a throttled headless measure (CPU 4×): time from click to the first frame of the week, replay frame time p95, heap after three runs, budgets set from G5c's numbers before building. The real Chromebook run (cold load, `?pilot=20`, a Round 3 plan) is the owner's rehearsal; we cannot reach his device. |
| 7 | High: 1920 × 1080 is not a projector test | **Accepted** | Minimum sizes written into acceptance (text ≥ 15 px, canvas labels ≥ 16 px at 1366 × 768; non-colour cues for warnings and thresholds); the lit-room back-row rehearsal is in the owner's gate, before the freeze. |
| 8 | High: accessibility unproven in interaction | **Accepted in part** | A keyboard-only e2e (picks, Why, Put the GM to work, focus to the called line, the tray's focus return) and the live regions checked; reduced motion in both renderers. A screen-reader walk-through is the owner's or later; noted as not done if not done. |
| 9 | High: the shots are not "every state" | **Accepted** | The shots add a mixed and an all-missed scorecard, a long Why, slider extremes, Round 3 careful (naps, a clean, a walk), the vector fallback (image requests blocked), the tray after a run at 1024; waits on the page's own state, not sleeps, where the page exposes it. |
| 10 | High: animation can invent business behaviour | **Accepted** | Rule: nothing moves to show an action the trace does not record; decorative motion is limited to idle life (breathing, a tail) and never suggests supervision, walking or care; visual randomness from its own seeded generator, never the engine's; the displayed counts and captions tested against the trace. |
| 11 | High: the disclosure chain stops at the README | **Accepted** | The main thread updates `docs/submission-checklist.md` (Approach and References rows) and the README's disclosure; provenance records tool, model, dates, prompts, references, transformations and repairs; a fonts inventory (package, version, copyright, OFL notice) ships in `docs/art-provenance/`. AI-assisted SVG is disclosed like generated art. |
| 12 | Medium: business hierarchy not specified | **Accepted** | Each state now names its primary question, evidence and action in the brief; the scorecard must show "how the business did" beside "what you called" with equal weight (D56's words stay). |
| 13 | Medium: the checklist is mechanically wrong in places | **Accepted** | D58 reworded: coherent visible parts with plausible occlusion; adult proportions (not "taller than a dog"); explicit figure bounds where components fail; controlled repair allowed, recorded in provenance, with a full re-review; masks checked after resizing on light and dark. |
| 14 | Medium: the word test misses runtime and canvas text | **Accepted** | An e2e collects the page's text and every string drawn on the canvas (a `fillText` hook) across a run and asserts the bans; the two sick counts get scoped words (bible first). |
| 15 | Medium: cut ornament before verification | **Accepted** | Pose counts conditional (at least two per breed: moving and asleep, mirrored; more only if a review asks); no idle bob or eased paths unless a review asks; a restrained GM treatment is allowed. |
