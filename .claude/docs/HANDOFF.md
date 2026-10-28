# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-28, end of session 6)

- `main`: scaffold and G0. Branches, stacked: `g1-simulator`, `g2-learner`, `g3-editor`, `g4-replay`, `g4b-words`,
  `g5-teacher`, `g5b-person` (signed off by the owner Oct 28, not merged), `g7-lesson` (G7, one commit on top of
  `g5b-person`). Nothing pushed, nothing merged.
- G7: the unit on paper, nine sheets in `docs/lesson/` (BRIEF section 14): `teacher-guide.md` (start there),
  `brief-round1.md`, `brief-round2.md`, `brief-round3.md`, `role-cards.md`, `concept-check.md`,
  `concept-check-key.md`, `board-memo.md`, `debrief-readings.md`. `tests/lesson/materials.test.ts` holds them to the
  page's words (D54) and to the game's words and keeps the hidden rules off the student's sheets.
- The owner's steer at the start of G7 (D53, superseding D50's "person"): the GM is openly an AI the owners put in
  charge (the old GM quit). The page's tagline says so: "Good Dog Daycare. You own it. The GM is an AI: it runs the
  week, and you write its bonus plan." Students get one sentence of how ("Before Monday it tries out its choices and
  keeps whatever earns the most bonus."); the learning curve is the teacher's optional look in the period 6 debrief
  (its caption now begins "Behind the curtain, for the debrief if you choose to show it."). Nothing else on the page
  changed; the screen still never shows the engine.
- Green: `npx vitest run` 34 files / 360 tests, lint, build, `npm run e2e` (7 tests, 41.8 s), the pilot 20 of 20
  with G2's counts. Numbers and commands in the Result of `.claude/docs/plans/g7-lesson.md`; triages
  `g7-plan-astra-triage.md` and `g7-astra-triage.md`.

## The owner gate for G7 (Fred)

```
git checkout g7-lesson        # contains G1 to G7
npm install && npm test
```

1. Read `docs/lesson/teacher-guide.md` as the teacher of period 1, then the Round 1 brief and the concept check as a
   student. Edit any word you want; if `npm test` then fails, its message names the page word a sheet must keep.
2. Print every sheet on Letter (from GitHub's rendering or VS Code's preview) and check the page counts: the guide and
   the readings two pages, each brief, the role cards, the check and the memo one page, with room to write.
3. **The disclosure.** The README now says: "Claude Code drafted the lesson materials in `docs/lesson/` from the
   author's unit design; the author reviews, edits as needed and approves every sheet before it reaches a class."
   Confirm or rewrite it, and carry it into the submission's Acknowledgements.
4. Open each source in the readings' Sources before citing it in the PDF (the Challenge plan: cite the pages you
   actually open). Astra checked the CFPB and OpenAI pages; the journal citations are from memory.
5. Add the deployed address to the guide's "Before class" once the Netlify site exists.
6. Still open from G5b: the Chromebook checks (the wait before the week, `?pilot=20`), the Netlify deploy, the capture,
   and the merge (`g7-lesson` brings G1 to G7).

## Decisions the owner should look at (docs/DECISIONS.md)

- **D53** the GM is openly an AI the owners put in charge; the screen still never shows how it decides.
- **D54** the lesson sheets quote the page, and a test holds them to it.

## What G7 found that later groups should know

- The page keeps no run after a reload. The sheets have teams copy the report's numbers ("From the report") and the
  guide reruns a plan from its seed (same plan and seed, same week) for the gallery walk and the memo. If the pilot
  finds this clumsy, an on-page "print this report" is a G6 candidate.
- The round notes live in `src/ui/roundNotes.ts` so the lesson test can read them; change a note there and the
  briefs' test fails until the brief quotes the new words.
- Signed measures: under a negative dollar amount a loss or a drop pays the GM (the page's hint says so); any sheet
  that explains a measure must say "counts the opposite", never "counts against".

## Next thread does first (G6: fixes from the pilot)

1. Read `.claude/docs/ROADMAP.md`, the Result of `.claude/docs/plans/g7-lesson.md`, the two G7 triages, and the
   owner's notes from the pilot class (Nov 9): the three most common confusions, the time to the week on the
   Chromebooks, whether students read the readout cold, and whatever the owner changed in the sheets.
2. Write `.claude/docs/plans/g6-pilot-fixes.md` from those notes. The words stay the owner's (D45, D53); the student's
   screen stays the lesson (D39). A fix that changes a page word the sheets quote changes the sheet in the same group.
