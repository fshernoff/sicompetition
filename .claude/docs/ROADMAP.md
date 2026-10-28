# Roadmap

Dates are the brief's build order (docs/challenge-plan.md). Each group has a plan in `.claude/docs/plans/` and an
owner gate before it is merged.

| Group | Builds | Owner gate | Dates |
|---|---|---|---|
| G0 | Repo, tooling, the bible, decisions, this roadmap | Fred reads BRIEF and DECISIONS | Oct 25 (done, on `main`) |
| G1 | The simulator: world rules, step function, seeded RNG, episode runner, default config, headless sim CLI, one test per hidden rule | Fred runs `npm test` and `npm run sim` and reads HANDOFF | Oct 26 to 29 (built Oct 25 on `g1-simulator`, merged to `main` Oct 28) |
| G2 | The learner: observation coarsening, tabular Q-learning with epsilon-greedy, training loop with a time budget, training curve on canvas; proof that Round 1 trains to the reckless policy in under 60 s on a Chromebook | Fred watches Round 1 train on the smartboard; `?pilot=20` on a Chromebook | Oct 30 to Nov 1 (built Oct 25 on `g2-learner`, merged to `main` Oct 28; the Chromebook check is the owner's, before Nov 9) |
| G3 | The bonus plan editor: six KPIs, sliders and toggles, the plan in words, the prediction box | Fred edits a plan without reading any instructions | Nov 2 to 3 (built Oct 26 on `g3-editor`, merged to `main` Oct 28) |
| G4 | The week replay on canvas (yard, dogs, crew, ratio gauge, incident counter, reputation meter, cash counter), the weekly P&L and operations report, prediction side by side, the status line in the student's words (D38), the layout under the controls (the Chromebook fold) | Fred reads a report cold and can say what the GM did | Nov 4 to 6 (built Oct 26 on `g4-replay`, merged to `main` Oct 28) |
| G5 | Teacher panel (a tray: round presets, seed, speed, reveal hidden rules, the learner's check line; D38, D39: the student page keeps the plan, the prediction and Put the GM to work), JSON export, Netlify deploy (Node 24, relative paths), the 30-second screen capture (`npm run capture` and the shot list) | Pilot class, Nov 9 | Nov 7 to 8 (built Oct 26 on `g5-teacher`, merged to `main` Oct 28) |
| G5b | The GM is a person (D50 to D52; the "person" half superseded by D53 in G7): the engine trains out of sight, the class watches one week, the readout follows; the learning curve and the check line are the teacher's; no speed control | Fred plays a round as a student and finds nothing that shows the engine | Oct 28 (built on `g5b-person`, signed off by the owner, merged to `main` Oct 28) |
| G6 | Fixes from the pilot's three confusions | Full unit, Nov 16 | Nov 10 to 13 (branch `g6-pilot-fixes` from `main`) |
| G7 | Lesson materials: teacher guide, round briefs, role cards, concept check, memo template, debrief readings (Sonnet packages; Astra reviews for clarity); the GM is openly an AI (D53) | Fred prints the sheets, confirms the disclosure line and teaches period 1 | Nov 2 to 13 (built Oct 28 on `g7-lesson`, merged to `main` Oct 28) |

## What each group leaves behind

- A plan with a result section (numbers from that session's runs).
- Tests that were seen failing first.
- An Astra triage file.
- One commit, and a HANDOFF for the next thread.
