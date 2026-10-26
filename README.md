# Reward the Pack

A browser lesson for AP Business. Student teams own Good Dog Daycare and never work a shift. They hire a
reinforcement-learning agent as general manager, and the only lever the owners hold is its bonus plan. They write
the plan, put the GM to work and watch its bonus climb in under a minute, then read the weekly P&L and operations
report to find out what their plan actually paid for.

One static page: Vite, TypeScript, HTML canvas. No backend, no accounts, no analytics, no network calls at runtime,
nothing stored anywhere but the student's download folder.

Built by Fredric Shernoff (Whitemarsh Games) as an entry in the Presidential SI Challenge, educator track. All code
and lesson material in this repository was created for the Challenge after August 1, 2026.

## Run

Install with `npm install` (Node 24 or newer). Then:

- `npm run dev` serves the page locally; `npm run build` writes the static site to `dist/`.
- `npm test` runs the rule tests, `npm run lint` runs ESLint and the type check, `npm run e2e` runs one browser smoke test against the built page.

The headless simulator runs on Node's native TypeScript, so it needs no extra tools:

```
npm run sim -- --episodes 200 --seed 1 --reward round1 --policy random
npm run sim -- --episodes 500 --seed 7 --reward balanced --policy careful
node src/sim/cli.ts --reward my-plan.json --policy reckless
```

To pipe the JSON into a file, call node directly or add `--silent` (`npm run sim --silent -- ...`), because npm prints its own banner first. `npm run calibrate` prints the ranking of 385 fixed policies under the Round 1 plan, with the profit margin between the reckless week and each one-decision alternative (a nap block, a clean block, a cheaper day, fewer bookings, more staff).

To see the learner, run `npm run dev`, open the page and press Put the GM to work. This is Round 1: the GM is paid on profit only (the seed, any whole number, is in the Teacher tray; the default is 1). The page scrolls to the status line ("The GM is 1,200 weeks into the job and still changing how it runs the place."), the curve of the GM's weekly bonus in dollars climbing on the left and, on the right, a week the GM's way playing block by block in the yard: the dogs, the crew, a dogs-per-staffer gauge, an incident counter, a reputation meter and a cash counter. The sentence beside the prediction describes the week that is playing. When the GM has settled, the final week plays once more and the weekly P&L and operations report appears under it as a table: a column per day and the week, the operations lines (requests, dogs accepted, rate, crew, activities, dogs per staffer, incidents, dogs sent home sick, fines, fatigue, reputation, cleanliness), the money lines (day rates, add-ons, revenue, wages, refunds, vet bills, fines, supplies, profit, cash) and the bonus the GM earned under the plan, in dollars. The same seed gives the same result. To time it on a school Chromebook, open the page with `?pilot=20` (on the dev server or the built page): it trains seeds 1 to 20 in turn and prints a table. The same check runs without a browser with `npm run pilot -- --seeds 20 --budget 60000`.

The page also lets a team write the bonus plan. The round, chosen in the Teacher tray, sets the rules: Round 1 is the set plan (profit only, read it and predict), Round 2 allows three measures, Round 3 all six. Each of the six measures has a toggle and a slider, the plan is shown in words under them, and a prediction box takes the team's guess before the GM is put to work. Open the page with `?round=2` or `?round=3` on the address to preload a round. To measure any plan without a browser, run `npm run pilot -- --seeds 5 --reward balanced` (or `--reward my-plan.json`): it prints, per seed, the episodes, whether the GM settled (stable) and the outcome key.

It prints one JSON document: the full world config, the bonus plan it used, the seed, the episode count and the policy name, a summary across all episodes (the mean of every weekly total, and the spread of profit, incidents and reward), and the weekly P&L and operations report of the last episode, day by day. The same seed always gives the same output. `--help` lists every option.

## Teacher panel and export

The Teacher tab in the bottom-right corner opens a tray with the round presets, the seed, the speed (Slow, Normal, Fast, Full speed), Reveal the hidden rules, and Export this run: one JSON file per run holding the plan, the prediction as it stood when the GM was put to work, the readout, the bonus curve and the seed, and nothing that names a student. `?round=2` still preloads a round and `?pilot=20` still runs the Chromebook check.

`npm run capture` after `npm run build` records a 30-second Round 1 run to `Temp/capture/`; `docs/capture.md` is the shot list for your own recording.

## Deploy

Netlify builds with `npm run build` and publishes `dist/` (see `netlify.toml`; Node 24). Connect the repository to a Netlify site, or drag the `dist/` folder onto Netlify Drop. The asset paths are relative, so the same build works at the site root or under a path. Nothing calls out at runtime.

## Disclosure of SI use

Claude Code (Anthropic) assisted the build as a coding agent, and the Codex CLI (OpenAI, GPT-6-Astra) reviewed plans
and diffs. The simulator rules, the lesson design and all student-facing text are the author's. Nothing in this
repository was copied from any earlier project.

## License

MIT. See [LICENSE](LICENSE).
