# Reward the Pack

A browser lesson for AP Business. Student teams own Good Dog Daycare and never work a shift. The old GM quit, and
the owners have put an AI in the GM's chair; the only lever they hold is its bonus plan. They write the plan, predict
what the GM will do, put it to work and watch it run one week, then read the weekly P&L and operations report beside
their prediction to find out what their plan actually paid for. Underneath, the GM is a reinforcement-learning agent
that works out, before Monday, what earns it the most bonus; the students never see how it decides.

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

To see the class's view, run `npm run dev`, open the page, make the five picks (days it accepts every booking, day rate, days with 1 staffer, nap blocks, incidents) and type a Why, then press Put the GM to work; the button waits until all five picks are made. This is Round 1: the GM is paid on profit only (the seed, any whole number, is in the Teacher tray; the default is 1). The page slides down to the yard and the status line says the GM is getting ready for Monday. Then the GM runs one week in the yard, block by block: the dogs, the crew, a dogs-per-staffer gauge, an incident counter, a reputation meter and a cash counter. When the week is over the page slides back up and the prediction card turns into a scorecard, each pick beside what the GM did, with "You called N of 5."; the weekly P&L and operations report opens with five big numbers and carries the full table below them: a column per day and the week, the operations lines (requests, dogs accepted, rate, crew, activities, dogs per staffer, incidents, dogs sent home sick, fines, fatigue, reputation, cleanliness), the money lines (day rates, add-ons, revenue, wages, refunds, vet bills, fines, supplies, profit, cash) and the bonus the GM earned under the plan, in dollars. There is no curve and no weeks count on the student's page. The same seed gives the same result. To time it on a school Chromebook, open the page with `?pilot=20` (on the dev server or the built page): it trains seeds 1 to 20 in turn and prints a table. The same check runs without a browser with `npm run pilot -- --seeds 20 --budget 60000`.

The page also lets a team write the bonus plan. The round, chosen in the Teacher tray, sets the rules: Round 1 is the set plan (profit only, read it and predict), Round 2 allows three measures, Round 3 all six. Each of the six measures has a toggle and a slider, the plan is shown in words under them, and a prediction box takes the team's guess before the GM is put to work. Open the page with `?round=2` or `?round=3` on the address to preload a round. To measure any plan without a browser, run `npm run pilot -- --seeds 5 --reward balanced` (or `--reward my-plan.json`): it prints, per seed, the episodes, whether the GM settled (stable) and the outcome key.

It prints one JSON document: the full world config, the bonus plan it used, the seed, the episode count and the policy name, a summary across all episodes (the mean of every weekly total, and the spread of profit, incidents and reward), and the weekly P&L and operations report of the last episode, day by day. The same seed always gives the same output. `--help` lists every option.

## Teacher panel and export

The Teacher tab in the bottom-right corner opens a tray with the round presets, the seed, Reveal the hidden rules, Show the learning curve (the teacher's view of how the AI behind the GM practised), Export this run, and the check line. There is no speed control: the engine always runs at full speed. Export this run writes one JSON file per run holding the plan, the prediction as it stood when the GM was put to work, the readout, the bonus curve and the seed, and nothing that names a student. `?round=2` still preloads a round and `?pilot=20` still runs the Chromebook check.

## Lesson materials

`docs/lesson/` holds the unit on paper, Markdown that prints: a two-page teacher guide (start there), a one-page
student brief per round, four role cards, the pre/post concept check and its key, the board memo template and the
debrief readings. The sheets quote the page, and `npm test` fails if a quoted word drifts from it.

`npm run capture` after `npm run build` records a 30-second Round 1 run to `Temp/capture/`; `docs/capture.md` is the shot list for your own recording.

## Deploy

Netlify builds with `npm run build` and publishes `dist/` (see `netlify.toml`; Node 24). Connect the repository to a Netlify site, or drag the `dist/` folder onto Netlify Drop. The asset paths are relative, so the same build works at the site root or under a path. Nothing calls out at runtime.

## Disclosure of SI use

Claude Code (Anthropic) assisted the build as a coding agent, and the Codex CLI (OpenAI, GPT-6-Astra) reviewed plans
and diffs. The simulator rules and the lesson design are the author's. Claude Code drafted the lesson materials in
`docs/lesson/` from the author's unit design; the author reviews, edits as needed and approves every sheet before it reaches a class.
The page's illustrations (the yard, the dogs, the crew and the AI GM) were generated with GPT image through the Codex CLI for this project and edited by the author; docs/art-provenance/ records each prompt and step.
Nothing in this repository was copied from any earlier project.

## License

MIT. See [LICENSE](LICENSE). The bundled typefaces, Fredoka and Nunito (from the `@fontsource` packages), are under the
SIL Open Font License 1.1.
