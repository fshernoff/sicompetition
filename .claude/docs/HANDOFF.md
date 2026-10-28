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

## Next thread does first (G6: fixes from the pilot, Nov 10 to 13)

1. Branch `g6-pilot-fixes` from `main` (after the owner merges G5c, or from `f784bbd` if he keeps the old look). Read
   the ROADMAP, the Results of `g7-lesson.md` and `g5c-look.md`, the triages, and the owner's notes from the
   Chromebook rehearsal and the pilot class (Nov 9).
2. Write `.claude/docs/plans/g6-pilot-fixes.md` from those notes. A fix that changes a page word the sheets quote
   changes the sheet in the same group.
