# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-28, end of session 6)

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
