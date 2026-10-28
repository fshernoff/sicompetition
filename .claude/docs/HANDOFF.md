# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-28, end of session 6)

- `main` holds everything: G0 to G7, fast-forwarded from `g7-lesson` on Oct 28 at the owner's request (`5f1c2bf`
  before this HANDOFF's commit). The group branches (`g1-simulator` to `g7-lesson`) are kept; nothing is pushed. The
  next group branches from `main`.
- The game (G1 to G5b) and the unit on paper (G7, nine sheets in `docs/lesson/`, BRIEF section 14) are built. What is
  left before the pilot class on Nov 9 is the owner's: the tests below, the deploy and the printing.
- The owner's steer at the start of G7 (D53, superseding D50's "person"): the GM is openly an AI the owners put in
  charge (the old GM quit). The page's tagline says so: "Good Dog Daycare. You own it. The GM is an AI: it runs the
  week, and you write its bonus plan." Students get one sentence of how ("Before Monday it tries out its choices and
  keeps whatever earns the most bonus."); the learning curve is the teacher's optional look in the period 6 debrief.
  The screen still never shows the engine.
- Green on `main` after the merge: `npx vitest run` 34 files / 360 tests. Before the merge, on the same commit: lint,
  build, `npm run e2e` (7 tests, 41.8 s), the pilot 20 of 20 with G2's counts (the Result of
  `.claude/docs/plans/g7-lesson.md`).
- The disclosure line in the README is confirmed by the owner (Oct 28); carry it into the submission's
  Acknowledgements.

## Before the pilot class, Nov 9 (Fred)

1. **The Chromebook** (the one unmeasured gate, D6): open the page with `?pilot=20` and confirm 20 of 20; time the
   wait from Put the GM to work to the week starting, for Round 1 and for Round 3 with only Incidents on (Profit off,
   the slowest plan, to the 150,000-week cap); say whether "The GM is getting ready for Monday." reads as the GM getting
   ready or as a loading screen. Too slow is the first G6 fix.
2. **Deploy** `main` to Netlify (connect the repo, or `npm run build` and drop `dist/` on Netlify Drop); repeat 1 on
   the deployed address; put the address in `docs/lesson/teacher-guide.md` under "Before class".
3. **Print** for the pilot's two periods: the teacher guide, the concept check (pre), the Round 1 brief, the role
   cards, and the Round 2 brief if the second period runs Round 2. Check the page counts on Letter; edit any word (if
   `npm test` then fails, its message names the page word a sheet must keep).
4. **Sources:** open each source in `docs/lesson/debrief-readings.md` before citing it in the PDF; Astra checked the
   CFPB and OpenAI pages, the journal citations are from memory.
5. **Optional:** the 30-second capture (`npm run build && npm run capture`, or your own from `docs/capture.md`).
6. **At the pilot, write down:** the three most common confusions, the real wait on the class's Chromebooks, whether
   students read the readout without help, and any word changed on the sheets. G6 is planned from these notes.

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

## Next thread does first (G6: fixes from the pilot, Nov 10 to 13)

1. Branch `g6-pilot-fixes` from `main`. Read `.claude/docs/ROADMAP.md`, the Result of
   `.claude/docs/plans/g7-lesson.md`, the two G7 triages, and the owner's notes from the Chromebook checks and the
   pilot class (Nov 9).
2. Write `.claude/docs/plans/g6-pilot-fixes.md` from those notes. The words stay the owner's (D45, D53); the student's
   screen stays the lesson (D39). A fix that changes a page word the sheets quote changes the sheet in the same group.
   The full unit starts Nov 16.
