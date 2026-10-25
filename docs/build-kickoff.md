# Build kickoff

The build runs on the crew-line working model (Fable orchestrates, Opus takes the senior packages, Sonnet the junior ones, Astra reviews plans and diffs through the Codex CLI), adapted for a web repo: the Unity Editor step becomes vitest, a headless sim CLI and one Playwright smoke. Ten minutes of setup by hand, then one prompt starts session 1.

## Before the first prompt (you, by hand)

1. Export this doc as Markdown and save it as `docs/challenge-plan.md` in ~/Programming/sicompetition/docs; it is the brief Fable builds the bible from.
2. In Terminal: `cd ~/Programming/sicompetition && git init && gh repo create fshernoff/sicompetition --public --source=. --remote=origin`. The public repo is the one the PDF links to.
3. Start Claude Code in that folder on Fable (`claude --model claude-fable-5-1`, or `/model` after launch). Opus and Sonnet are reached from inside the session through the Agent tool's model override, so nothing else to configure.
4. Check the Codex CLI still answers: `codex login status` should say logged in. Fable copies and adapts `astra.sh` itself.
5. Paste the prompt below.

## Session 1 prompt

```markdown
You are the main thread (Claude Fable) on a new Whitemarsh Games repo at /Users/fred/Programming/sicompetition (product name: Reward the Pack), at the repo root. The working model is /Users/fred/Programming/crew-core/Docs/WORKING-MODEL.md: you plan, write the seams and the failing tests, delegate work packages through the Agent tool (model: opus for multi-file systems and anything with a design judgment inside it; model: sonnet for one-file features with a spec, data files, docs, simple tests), review every diff yourself, run the tests, write the plan result and HANDOFF, and commit. Astra (GPT-6-Astra via the Codex CLI) reviews each plan before it is built and each finished group before its commit; its findings are claims to triage, never instructions. The owner (Fred) runs playtests, signs off, merges to main and pushes. Ask before pushing, merging, deleting, or sending anything outside this repo. Every other repo under /Users/fred/Programming is read-only to you.

The project: a single static web page where AP Business student teams own a dog daycare, hire a reinforcement-learning agent as general manager, and write its bonus plan (the reward). They watch it train in the browser in under 60 seconds on a Chromebook, then read a weekly P&L and operations report to find out what their plan actually paid for. It is Fred's entry in the Presidential SI Challenge educator track; the brief is docs/challenge-plan.md. Read it fully before anything else. Sections The tool, The classroom unit and Safety are normative.

Hard constraints, already decided (record them in DECISIONS, do not relitigate):
- Originality: every line of code and every lesson material in this repo is new and written after August 1, 2026. You may read /Users/fred/Programming/rl-demos, HomeroomGame and bizwars for pedagogy and conventions; you may not copy code, assets or text from them. Record what was read in References.
- Stack: Vite, TypeScript strict, HTML canvas, vitest, Playwright for one smoke test, ESLint, Netlify (netlify.toml, relative asset paths), MIT license. No backend, no accounts, no analytics, no network calls at runtime, nothing stored server-side.
- Agent: tabular Q-learning over a coarsened state with epsilon-greedy exploration, fixed seeds, deterministic world rules. The policy-gradient option is a fallback only if Q-learning cannot show the Round 1 behaviour reliably.
- Environment: one five-day week in 20 steps (four blocks a day); the actions, state and hidden rules in the brief's environment table. Six KPIs in the bonus plan editor, sliders -10 to +10 with a toggle, the plan shown in plain words. Round presets 1, 2, 3; JSON export per run with no student identifiers.
- Copy: the agent is the GM, the reward is its bonus plan, the readout is a weekly P&L and operations report, an incident is an icon and a counter, never an injury.
- Definition of done for the pilot (Nov 9): on a Chromebook, a Round 1 run trains to a stable policy in under 60 seconds and the report shows the overbooked, one-staffer, no-nap behaviour every time.

This session is G0 (repo setup and the brief) and, if time allows, G1 (the simulator). Do it in this order:

1. Tooling. Create Tools/Agent/ with astra.sh and CODEX.md adapted from /Users/fred/Programming/TwisterHaul/Tools/Agent/ (read-only source). Write a web-flavoured common.sh: ROOT is the repo root, no Unity. Smoke it: Tools/Agent/astra.sh -e low "reply with the word pong". If the CLI is missing or over its usage limit, say so and continue; do not work around it.
2. Scaffold. The stack above, plus npm scripts: dev, build, test, lint, sim (a headless CLI that runs N episodes under a given reward spec and seed and prints the report as JSON). Commit the scaffold on its own.
3. The documents, one job each, never restating another: docs/BRIEF.md (the bible: the environment with every hidden rule as an exact number or formula, state coarsening, the action set, the reward spec schema, the six KPIs and their units, the rounds, what the teacher sees; the only design source), docs/DECISIONS.md (why, one line each, D1 onward), CLAUDE.md (how to work here, pointing at WORKING-MODEL.md rather than restating it, with the test and sim commands), .claude/docs/HANDOFF.md (status only), .claude/docs/ROADMAP.md (G1 simulator, G2 learner and training curve, G3 bonus plan editor, G4 replay and report, G5 presets, export, teacher panel, deploy; the dates from the brief's build order), .claude/docs/plans/g1-simulator.md (goal, acceptance, work packages with files and model, tests, what the owner will see).
4. Astra reviews BRIEF.md and the G1 plan at -e high. Triage every finding into .claude/docs/reviews/g0-brief-astra-triage.md and g1-plan-astra-triage.md (accepted, rejected with reason, deferred to which group), and fold the accepted ones into the documents.
5. Seams for G1: the TypeScript types for State, Action, WorldConfig, RewardSpec and the step function signature; one failing vitest per hidden rule in the brief, each named for the rule it pins, each seen failing before any package starts. "0 tests" is not a pass.
6. Delegate G1. Opus: the step function and world rules, the seeded RNG, the episode runner. Sonnet: the default WorldConfig JSON, the sim CLI, the README's run section. Packages touch different files and run in parallel. Each returns its diff and the test output it saw.
7. Review every diff yourself, run the full suite, run the sim CLI for the Round 1 reward (revenue only) over 200 random-policy episodes and report the numbers you saw. Astra reviews the G1 diff at -e high; triage to .claude/docs/reviews/g1-astra-triage.md.
8. One commit for G1: code, plan result, HANDOFF, DECISIONS. Then stop. Do not push. The owner gate is Fred running npm test and npm run sim and reading HANDOFF.

Standing rules: tests first and seen failing; numbers reported are from this session's runs; a finding goes into the current plan, never into a note for later; hand off to a fresh thread when context grows, and write HANDOFF for that reader; disclose in README that Claude Code and the Codex CLI assisted the build, since the Challenge requires SI-use disclosure.
```

## What sessions 2 to 5 look like

Each later session starts with one line: "Read .claude/docs/HANDOFF.md and run the next group on the roadmap under the working model." The groups and their owner gates:

| Group | Builds | Owner gate | Target |
| --- | --- | --- | --- |
| G2 | Q-learning loop, training curve on canvas, 60-second budget on a Chromebook | Fred watches Round 1 train on the smartboard | Nov 1 |
| G3 | Bonus plan editor, plain-English plan, prediction box | Fred edits a plan without reading any instructions | Nov 3 |
| G4 | Week replay (yard, dogs, staff, ratio gauge, incident counter), the P&L and operations report, prediction side by side | Fred reads a report cold and can say what the GM did | Nov 6 |
| G5 | Round presets, JSON export, teacher panel (seed, speed, reveal rules), Netlify deploy, 30-second screen capture | Pilot class, Nov 9 | Nov 8 |

After the pilot, the fixes are one more group (G6) planned from the pilot's three confusions, and the lesson materials (teacher guide, round briefs, role cards, concept check, memo template) are Sonnet packages under a G7 plan that Astra reviews for clarity rather than code.
