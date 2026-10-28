# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-28, end of session 5)

- `main`: scaffold and G0. Branches, stacked: `g1-simulator`, `g2-learner`, `g3-editor`, `g4-replay`, `g4b-words`,
  `g5-teacher` (G5, `5280cd5`), `g5b-person` (G5b, one commit on top of G5). Nothing pushed, nothing merged.
- G5b, the owner's steer after G5 (D50): the GM is a person and the AI is the game engine. The student's screen never
  shows the learner: Put the GM to work → "The GM is getting ready for Monday." (the engine trains unpaced, out of
  sight; 0.3 s for Round 1 on the Mac) → "The GM is running the week." (the yard plays the final week once, 7.5 s) →
  the sentence beside the prediction under "What the GM did", the table below, and the page scrolls back to the
  prediction (D51). No weeks count, no "settled", no curve, no speed control (D52). The teacher's tray keeps the
  round, the seed, the hidden rules, the export, the check line, and gains "Show the learning curve".
- Green: `npm test` 33 files / 298 tests, lint, build, `npm run e2e` (7 tests, 41.8 s), the pilot 20 of 20 with G2's
  counts, `npm run capture` 20.5 s. Numbers and commands in the Result of `.claude/docs/plans/g5b-person.md`;
  triages `g5b-plan-astra-triage.md` and `g5b-astra-triage.md`.
- Astra tooling: detached `nohup … > reply.md 2>&1 &` and a background waiter on the reply file.

## The owner gate for G5 and G5b (Fred): play it as a student, then the pilot class Nov 9

```
git checkout g5b-person        # contains G1 to G5b
npm install && npm test && npm run e2e
npm run dev
```

1. Play a round as a student with the tray closed: read every word and watch the whole run. Say anything that still
   shows the engine or reads like a class about AI.
2. Open the tray: pick a round and a seed, run Round 1 with the tray open, read the check line, export a file, show
   the learning curve, reveal the rules.
3. On a Chromebook at 1366 × 768: the wait before the week for Round 1, and for the incidents-only plan in Round 3
   (Profit off, Incidents on: the slowest, to the 150,000 cap), from the click to the week starting; say whether it
   reads as the GM getting ready or as a loading screen. `?pilot=20` still 20 of 20.
4. Deploy (Netlify, connect the repo or drop `dist/`), repeat 3 on the deployed address, record the capture or your
   own from `docs/capture.md`, and merge `g5b-person` into `main` if satisfied (it brings G1 to G5b).

## Decisions the owner should look at (all in docs/DECISIONS.md)

- **D50** the GM is a person; the AI is the game engine; nothing of the learner on the student's screen.
- **D51** the readout arrives when the week is over; the engine's 60 s budget and the 7.5 s playback are two times.
- **D52** no speed control; the engine always trains unpaced.

- **D46** the tray at the bottom, opened by the corner tab; the tab is the one teacher's control on the student's
  screen.
- **D47** the export carries the prediction as it stood at the click.
- **D48** four named speeds (superseded by D52).
- **D49** the export is the whole run, columnar, compact JSON, in cents; (`speed` dropped in G5b).
- The bible's section 11 is rewritten as built; sections 1 and 13 are unchanged.

## What G5 found that later groups should know

- The export is the hook for any "same week" check: `readout.report` in the file is `page.trace.report`, the same
  trace the sentence, the replay and the table show, and the e2e compares the whole report with a node-side twin.
  `#replay[data-key]` is the outcome key of the trace the renderer was handed; what the pixels show is still
  unproven (no oracle for the drawing).
- `page.setup` (seed, round, prediction) is snapshotted at the click and `page.result` set when a run
  resolves; the export waits for `page.readoutShown`; `clearRun` drops all three. A seed change after a run does not clear it
  (the file carries the click's); a plan edit or a round change does (D37).
- The hidden rules are the config's, not the run's: `hiddenRules(config)` is rendered once and the section stays
  through runs and clears. Every number in it is a config read; the test patches one field at a time.
- The tray is 96 px tall at 1366 wide and the button's bottom is at 600 px; `html.teacher-open` carries the tray's
  measured height as `--tray-height` for the page's bottom padding.

## Next thread does first (G6: fixes from the pilot's three confusions; G7: the lesson materials)

1. Read `.claude/docs/ROADMAP.md`, the Result of `.claude/docs/plans/g5-teacher.md`, the two G5 triages, and the
   owner's notes from the pilot class (Nov 9): the three most common confusions, the time to train on the
   Chromebooks, whether students read the readout cold.
2. Write `.claude/docs/plans/g6-pilot-fixes.md` from those notes; the words stay the owner's (D45) and the student's
   screen stays the lesson (D39). If the owner asks for the "big replay" switch or the hard-mode preset, they go in
   the tray (section 11).
3. G7 (the teacher guide, the round briefs, the role cards, the concept check, the memo template) is Sonnet packages
   under `docs/lesson/`, Astra reviewing for clarity; it can start before the pilot if the owner wants it for
   period 1.
