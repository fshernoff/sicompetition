# HANDOFF

Status only. Updated at the end of every thread; read first by the next one.

## Where things stand (2026-10-25, session 1, in progress)

- Scaffold committed on `main` (`ce78079`): Vite, TS strict, vitest, Playwright smoke, ESLint, Netlify, MIT.
  `npm run lint`, `npm test` (1 test), `npm run build`, `npm run e2e` (1 test) all green in this session.
- Astra tooling smoke: `Tools/Agent/astra.sh -e low "reply with the word pong"` → `pong` in 6.7 s (codex-cli 0.162.0).
- G0 documents written and committed on `main`: BRIEF, DECISIONS, CLAUDE.md, ROADMAP, G1 plan. Astra reviewed the
  brief (13 findings, 12 accepted, one already covered) and the plan (12 findings, all accepted or already covered);
  triage in `.claude/docs/reviews/`. The brief review moved three numbers (wages $300, $250 per clean, reputation
  slope 0.05) and rewrote the call-out rule (D17); the calibration test in G1 checks the result.
- G1 (the simulator): on branch `g1-simulator`. Seams and 18 test files written and seen failing (105 tests, 1
  passing: the scaffold's). Packages delegated; not yet committed.

## Next thread does first

1. Read `.claude/docs/ROADMAP.md` and the current group's plan under `.claude/docs/plans/`.
2. Run `npm test` and `npm run sim -- --episodes 200 --seed 1 --reward round1` and compare with the numbers in the
   plan's result section.
