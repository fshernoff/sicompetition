# Roadmap

Dates are the brief's build order (docs/challenge-plan.md). Each group has a plan in `.claude/docs/plans/` and an
owner gate before it is merged.

| Group | Builds | Owner gate | Dates |
|---|---|---|---|
| G0 | Repo, tooling, the bible, decisions, this roadmap | Fred reads BRIEF and DECISIONS | Oct 25 |
| G1 | The simulator: world rules, step function, seeded RNG, episode runner, default config, headless sim CLI, one test per hidden rule | Fred runs `npm test` and `npm run sim` and reads HANDOFF | Oct 26 to 29 |
| G2 | The learner: observation coarsening, tabular Q-learning with epsilon-greedy, training loop with a time budget, training curve on canvas; proof that Round 1 trains to the reckless policy in under 60 s on a Chromebook | Fred watches Round 1 train on the smartboard | Oct 30 to Nov 1 |
| G3 | The bonus plan editor: six KPIs, sliders and toggles, the plan in words, the prediction box | Fred edits a plan without reading any instructions | Nov 2 to 3 |
| G4 | The week replay on canvas (yard, dogs, crew, ratio gauge, incident counter, reputation meter, cash counter), the weekly P&L and operations report, prediction side by side | Fred reads a report cold and can say what the GM did | Nov 4 to 6 |
| G5 | Round presets, JSON export, teacher panel (seed, speed, reveal hidden rules), Netlify deploy, 30-second screen capture | Pilot class, Nov 9 | Nov 7 to 8 |
| G6 | Fixes from the pilot's three confusions | Full unit, Nov 16 | Nov 10 to 13 |
| G7 | Lesson materials: teacher guide, round briefs, role cards, concept check, memo template (Sonnet packages; Astra reviews for clarity) | Fred teaches period 1 | Nov 2 to 13 |

## What each group leaves behind

- A plan with a result section (numbers from that session's runs).
- Tests that were seen failing first.
- An Astra triage file.
- One commit, and a HANDOFF for the next thread.
