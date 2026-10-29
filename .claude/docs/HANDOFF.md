# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Session 7, later (2026-10-28): G5d, the look reopened (in progress on `g5d-look`)

The owner found a two-headed poodle in the live header and said the page "looks like a nice ai generated web app";
he reopened G5c's goal for Opus, Sonnet and Astra. Plan: `.claude/docs/plans/g5d-look.md` (Astra's plan review
triaged, 15 findings). Read it, then `.claude/docs/reviews/g5d-directions.md`.

- **Done:** D58 (three clean figure-by-figure passes per shipped image, `docs/art-provenance/qa.md`,
  `tests/art/qa.test.ts` failing 20 on G5c's art by design); the tools (`npm run shots` 22 states, `npm run perf`
  with G5c's baseline in the plan, `Tools/Agent/art_qa.py`); the keyboard and runtime-words e2e (bans shared in
  `tests/ui/bans.ts`); the direction sprint (Floor, Ledger, Casebook in `Temp/direction/`, `compare.html`); four
  independent rankings, unanimous for **Floor** (D59); the rail seam `src/ui/rail.ts` (stub) with
  `tests/ui/rail.test.ts` failing 7. Commits on `g5d-look`: d93a027, 92e6cf5, fc2a8e5.
- **The fallback:** branch `g5c-fallback` at `611145a` (worktree `Temp/fallback`): G5c with the header cropped to
  its figure-free middle, three clean passes; tests 370/370, e2e 8/8. Not merged, not pushed: the live site still
  shows the poodle until the owner says "ship the fallback".
- **The method (D59):** the spike (`Temp/spike-a/`, `Temp/spike-b/`, `Temp/spike-hybrid/`) judged by the three readers:
  the hybrid. The cast (dogs, crew) generated under eight gates; the set and the GM modelled in three.js and rendered
  offline (`.claude/docs/reviews/g5d-directions.md`). The art contract: `src/assets/art/manifest.ts`. Ports for
  parallel worktrees: `E2E_PORT`, `SHOTS_PORT`, `PERF_PORT`.
- **State at the last update (Oct 29):** `g5d-look` at `52e8f94`: WP2's and WP3's round 1 fixes merged; the cast
  (42 sprites: six breeds, two adult crew; the tan beagle and the cream poodle dropped, the sable corgi renamed
  mahogany, three pockets repaired in `build_cast.py`'s `POCKET_REPAIRS`) and the set (the done band neutral white)
  pass D58: `tests/art/qa.test.ts` green, the whole suite green. Round 2 of the look review: the main thread's notes
  and the fresh critic's (3 blocking, 9 high, 16 medium) are in; Astra's round 2 running; then the triage and the
  fixes (BRIEF words first: the booking rule's words, the cash and profit labels, the status line when the week is
  over, the picks' scope "this week"). The budget allows rounds 3 and 4.
- **Round 2 triaged (Oct 29, `99f0096`):** Astra 2 blocking, 9 high, 6 medium; the critic 3, 9, 16, 2 low; 34 rows in
  `.claude/docs/reviews/g5d-look-rounds.md`. The bible changed first (BRIEF 1, 1.1, 5, 7, 10; D60 to D63: one name
  per measure, the page's cash pays the GM, the scorecard in plain words) with 29 tests failing on purpose. Out:
  WP2 (the page, the report, the words, the sheets) and WP3 (placement, the schematic fallback, the load framing,
  one camera) resumed in their worktrees; two new art packages: WP4a-r2 (the crew remade faceted, with kneel and
  tired poses) and WP4b-r2 (three mess decals by cleanliness). Next: review and merge them, D58's three passes on
  the new art, WP3 draws the decals and the new poses, then round 3.
  - Gotchas: an Agent `isolation: worktree` starts from `main` (reset it to `g5d-look`); zsh does not split `$LIST`;
    a defect in the ledger closes only by the same reader's later clean pass on the same bytes.
- **Owner preferences this session:** no lists of questions (memory `feedback-no-quizzing`); act on his calls.

## Session 7 (2026-10-28): the submission thread started

- The rules were re-verified on the official pages; `docs/submission-checklist.md` carries what changed (registration
  closes Dec 18, hard; submission Dec 23; the school on the title page; Next Steps' four prompts).
- Fred: registered in the Educator category; no student faces, names or releases, the video shows the product.
  Fred asked not to be quizzed: take his calls, act, and ask only when blocked.
- `g5c-look` merged into `main` (fast-forward, Fred's call); `main` pushed to the public repo
  https://github.com/fshernoff/sicompetition ; live at **https://fshernoff.github.io/sicompetition/** through
  `.github/workflows/pages.yml` (tests, build, deploy on every push to `main`). Checked: run 40735849540 green, the
  page, its JS, CSS and all 18 art and font files return 200. Green before the merge: 370/370 tests, lint, build,
  e2e 8/8 (45.3 s).
- Still Fred's: the Chromebook and projector rehearsal at the live address. Next for Claude: the evidence kit for
  Nov 9 (checklist section 0).

## Where things stood (2026-10-28, end of session 6)

- `main` holds G0 to G7 (merged by the owner's request, `f784bbd`, the fallback for the pilot). `g5c-look` (one commit
  on top of `main`) is G5c, the look: not merged, nothing pushed.
- G5c (the owner: "professional, polished and gamified ... do not settle until you feel people would think this is
  created by a multimillion dollar ed tech company at first glance"): the page in concept A's art direction (warm,
  illustrated, rounded cards, Fredoka and Nunito bundled), four generated production images (D55; provenance in
  `docs/art-provenance/`), the prediction as five picks and a Why that turn into a scorecard (D56; BRIEF 1.1), the
  plan and the prediction side by side above the fold (D57), the report opening with five headline tiles. Nothing in
  the engine changed.
- Green on `g5c-look`: `npx vitest run` 35 files / 370 tests, lint, build, `npm run e2e` 8 tests (43.9 s), the pilot
  20 of 20 with G2's counts, `npm run capture` 23.3 s, 612 KB fetched. Numbers and commands in the Result of
  `.claude/docs/plans/g5c-look.md`; triages `g5c-plan-astra-triage.md` and `g5c-astra-triage.md`.
- Screenshots of every state at 1366 × 768: `Temp/g5c-shots/` (git-ignored).

## The owner gate for G5c (Fred), before the freeze on Nov 5

```
git checkout g5c-look
npm install && npm test && npm run e2e
npm run dev
```

1. Play a round as a student on the Mac: the picks, the wait, the week, the scorecard, the report. Say anything that
   still looks amateur or reads wrong.
2. **The shipped art (D55):** look at `src/assets/art/` and `docs/art-provenance/README.md` and approve the set (or
   say which to redo). This is separate from the lesson-materials disclosure you confirmed; the README now has one
   sentence on the illustrations, and the submission's References and Acknowledgements should carry both.
3. **The rehearsal on the Chromebook and the projector:** the five picks, Put the GM to work, the wait (Round 1, and
   Round 3 with only Incidents on), the week, the scorecard, Export this run, an edit, a rerun; cold load included.
   `?pilot=20` still 20 of 20. If anything fails, `main` at `f784bbd` is the signed-off page to deploy instead.
4. If satisfied: merge `g5c-look` into `main`, deploy, print the sheets (the briefs now ask the five picks).

## Decisions the owner should look at (docs/DECISIONS.md)

- **D55** generated art may ship, sparingly, with approval and provenance (supersedes D16).
- **D56** the prediction is five picks and a why; the scorecard; the lifecycle (locks, clears, the pilot).
- **D57** the plan and the prediction side by side above the fold (revises D42).

## What G5c found that later groups should know

- The picks' contract is in `src/ui/prediction.ts` (radios `#pick-<field>-<value>`, `#scorecard [data-field]
  [data-called]`, `#called-line`, `#picks-hint`); the e2e makes picks by clicking the chips, never forced.
- A closed day keeps its planned rate in the report; the rate pick reads the open days only.
- The art is awaited at the click, before training starts, so no frame is ever drawn without it; the vector yard
  of G4 stays as the fallback if an image fails.
- One icon and colour per measure: `src/ui/icons.ts` and the `--m-*` tokens; the editor, the yard's HUD and the
  report's tiles all use them.
- Three font files ship (Fredoka 600, Nunito 600 and 800); the canvas draws in those weights only.

## Next thread does first: the submission, with Fred (`docs/submission-checklist.md`)

The owner's ask (Oct 28): a thread that works through the competition submission with him. The submission is a PDF
narrative (10 pages plus a title page), a public video link (4:00) and the signed consent form; the code and the game
are links inside it, not the submission itself. The checklist is the working list: tick boxes with the proof, and
keep it current.

1. Read `docs/submission-checklist.md`, then `docs/challenge-plan.md` ("Challenge requirements", "Evidence plan",
   "The video and the written summary", "Open questions"), this HANDOFF, and the Results of `g7-lesson.md` and
   `g5c-look.md` (what the class sees now: the AI GM, the five picks and the scorecard, the export's fields).
2. **Re-verify the rules** on the official pages (the links at the top of the checklist) with a web fetch, and update
   the checklist where they differ: page and size limits, section order, video length and hosting, deadlines,
   consent, registration, SI disclosure. Say what changed. The plan's facts are from Oct 25 and must not be trusted
   as current.
3. Ask Fred where section 0 stands: registration, the consent form, the open questions, the district's SI guidance,
   student media releases, the G5c gate, the deploy, the public repo. Tick what is done.
4. Before the pilot on Nov 9, build the evidence kit (section 0): the export folder layout (`Evidence/` must be
   git-ignored: class data never goes in the repo), the concept-check scoring template, the team codes, the pilot
   notes sheet. Small enough for one group; write it as a plan (`.claude/docs/plans/g8-evidence-kit.md`) if it
   includes code, as the working model asks.
5. Then follow the checklist's dates: G6 after the pilot (from Fred's notes), the evidence script the week of Dec 5,
   the video script and the PDF drafts Dec 5 to 11, Fred's edits, submission by Dec 18. Every number in the PDF comes
   from the evidence script's output on Fred's data, with the command, never from memory.

Standing rules for this work: nothing with a student's name enters the repo or a prompt to Astra; Fred registers,
signs, uploads and submits; Claude drafts, Fred edits and approves every word that goes out under his name; ask
before pushing, merging or sending anything outside the repo.

## After the submission work: G6 (fixes from the pilot, Nov 10 to 13)

1. Branch `g6-pilot-fixes` from `main` (after the owner merges G5c, or from `f784bbd` if he keeps the old look). Read
   the ROADMAP, the Results of `g7-lesson.md` and `g5c-look.md`, the triages, and the owner's notes from the
   Chromebook rehearsal and the pilot class (Nov 9).
2. Write `.claude/docs/plans/g6-pilot-fixes.md` from those notes. A fix that changes a page word the sheets quote
   changes the sheet in the same group.
