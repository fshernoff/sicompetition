# Reward the Pack (Whitemarsh Games)

A static web page where AP Business student teams own a dog daycare, hire a reinforcement-learning agent as GM and
write its bonus plan. Fred's entry in the Presidential SI Challenge, educator track.

## How to work here

The working model is `/Users/fred/Programming/crew-core/Docs/WORKING-MODEL.md`: read it, do not restate it. In
short: the main thread plans, writes seams and failing tests, delegates packages (Opus for multi-file systems and
design judgment, Sonnet for one-file features with a spec), reviews every diff, runs the suite, writes the plan
result and HANDOFF, commits. Astra (`Tools/Agent/astra.sh -e high`) reviews each plan before it is built and each
group before its commit; triage files live in `.claude/docs/reviews/`. The owner playtests, signs off, merges and
pushes. Ask before pushing, merging, deleting, or sending anything outside this repo.

Every other repo under `/Users/fred/Programming` is read-only to a thread here. Nothing is copied from them.

## Documents, one job each

| File | Job |
|---|---|
| `docs/BRIEF.md` | The bible: every rule as a number, state, actions, reward schema, KPIs, rounds. The only design source. |
| `docs/DECISIONS.md` | Why, one line each, D1 onward. |
| `docs/challenge-plan.md` | The Challenge brief this was built from. Intent, not design. |
| `.claude/docs/HANDOFF.md` | Status only: where the last thread stopped, what the next one does first. |
| `.claude/docs/ROADMAP.md` | The groups G1 to G5 and their dates. |
| `.claude/docs/plans/<group>.md` | One plan per group: goal, acceptance, packages, tests, what the owner sees, result. |
| `docs/capture.md` | The shot list for the 30-second screen capture. |
| `Tools/Agent/CODEX.md` | How to call Astra and what it is for. |

## Commands

```
npm run dev        # Vite dev server
npm run build      # tsc --noEmit && vite build  -> dist/ (relative asset paths)
npm test           # vitest run (tests/**/*.test.ts)
npm run lint       # eslint . && tsc --noEmit
npm run sim -- --episodes 200 --seed 1 --reward round1 --policy random   # headless week report as JSON
npm run calibrate -- --episodes 100 --seed 1   # the Round 1 calibration ranking and margins (G1 acceptance 3)
npm run pilot -- --seeds 20 --budget 60000     # the 20-seed learner check (G2 acceptance 2); ?pilot=20 on the page is the Chromebook version
npm run pilot -- --seeds 5 --reward balanced   # any plan headless (a preset or a .json file): episodes to stable, stable, the outcome key
npm run e2e        # the Playwright smoke against the built page (7 tests, about 35 s)
npm run capture    # after a build: a 30-second recording of one Round 1 run in headless Chromium, to Temp/capture/
```

`npm run sim` runs on Node 24's native TypeScript: erasable syntax only, relative imports end in `.ts`.

## Rules that are easy to break

- Tests first and seen failing; "0 tests" is not a pass. One test per hidden rule, named for the rule.
- The numbers in code come from `src/world/config.default.json`, which matches `docs/BRIEF.md` section 6. Change
  the bible first, then the JSON, then the test.
- Words: GM, bonus plan, weekly P&L and operations report (readout), incident (an icon and a counter), crew, Good
  Dog Daycare. The GM's bonus is dollars, never points; the GM is put to work and is weeks into the job, never
  trained or practising; a run shows a week the GM's way (D45). Never "injury", never "reward function" on the page.
- No network at runtime, no analytics, no fonts or scripts from a CDN. `tests/scaffold.test.ts` and the Playwright
  smoke pin this.
- Exports carry no student identifiers.
- The student's screen carries business words only. ε, evaluation counts, "target met", the seed and the speed are
  the teacher's (BRIEF sections 1 and 11, D38, D39); the status line says weeks on the job and whether the GM has
  settled into its routine or is still changing how it runs the place.
- Numbers reported in HANDOFF or a plan result are from this session's runs, with the command that produced them.
