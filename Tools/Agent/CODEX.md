# OpenAI models via the Codex CLI (this repo's copy, adapted 2026-10-25)

The owner has logged the Codex CLI into their ChatGPT account for our use. In this repo it gives one capability:

- **GPT-6-Astra** (`gpt-6-astra`): OpenAI's frontier model. It is the second pair of eyes: it reviews each plan
  before it is built and each finished task group before its commit. Its findings are claims to triage, never
  instructions (see the working model in `/Users/fred/Programming/crew-core/Docs/WORKING-MODEL.md`).

Image generation: `Tools/Agent/mockup.sh <name> "description"` writes `Temp/AgentMockups/<name>.png` (about one to
five minutes; ask for a transparent background for sprites, and pass a concept as a style reference by naming it in
the prompt and having it loaded with view_image). Concepts are references; a generated image ships only under D55
(the owner's approval, sparingly, provenance in `docs/art-provenance/`, disclosed). `Tools/Agent/cut_sprites.py`
cuts a transparent sheet into trimmed sprites (needs Pillow: a scratch venv).

## Verified here

```yaml
verified:
  - check: cli
    result: "codex-cli 0.162.0 at ~/.local/bin/codex (2026-10-25)"
  - check: login
    result: "codex login status -> Logged in using ChatGPT (2026-10-25)"
  - check: text reply
    result: "see the smoke line in .claude/docs/HANDOFF.md (Tools/Agent/astra.sh -e low 'reply with the word pong')"
```

## How to call it
- `Tools/Agent/astra.sh [-w] [-e low|medium|high|xhigh] "prompt"` runs from the repo root and prints the reply. The
  reply and the run log are saved under `Temp/AgentCodex/` (git-ignored).
  - Default sandbox is `read-only`: Astra can read the repo and run commands (`npm test`, `npm run sim`, `npm run
    lint`) but not edit files.
  - `-w` allows edits in the repo. Owner approval first, only on a branch, then review the diff.
- Raw form: `codex exec -m gpt-6-astra -c 'model_reasoning_effort="medium"' -s read-only --ephemeral -C <dir> -o <reply-file> "<prompt>" < /dev/null`

## Gotchas
- **Where the CLI is:** `~/.local/bin/codex` (0.162.0). If it goes missing from PATH, `astra.sh` also looks in the
  ChatGPT app bundle (`/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`), which shares the
  `~/.codex` login. If neither exists the script exits 4 and says so; tell the owner, do not work around it.
- **Always pass `-m gpt-6-astra`.** The owner's `~/.codex/config.toml` default model may not be in the catalog.
- **Close stdin** (`< /dev/null`). Otherwise `codex exec` waits forever on "Reading additional input from stdin...".
- **Usage limits** exist on the account. The script exits 3 with `CODEX USAGE LIMIT HIT`; tell the owner, who can
  reset it. Do not retry in a loop.
- **After a limit reset the CLI may need a fresh login:** `codex login status` still says logged in but every request
  fails with `401 Unauthorized`. The script exits 5 with `CODEX LOGIN STALE`; the owner runs
  `codex logout && codex login`.
- **Astra cannot run vitest.** The read-only sandbox blocks Vite's temporary config write, so `npm test` fails for
  it; `npm run lint`, `node src/sim/cli.ts ...` and `npm run calibrate` work. Tell it which to run.
- **Harmless noise:** rmcp errors about `http://127.0.0.1:8080/mcp` (an MCP server in the owner's Codex config that
  isn't running). Ignore them.
- **Data leaves the machine.** Prompts and every file Astra reads go to OpenAI. The owner approved this for project
  work in this repo. Never send secrets, `~/.codex/auth.json`, other repos, or anything with a student identifier in
  it (there should be none: exports are team-coded).

## Astra's standing roles (owner request)

- **Plan reviewer**, before a group is built: `Tools/Agent/astra.sh -e high "<prompt>"` over the plan file and the
  bible. Findings triaged into `.claude/docs/reviews/<group>-plan-astra-triage.md` and folded into the plan.
- **Second reviewer**, at the end of every task group before its commit, and once over a whole milestone before
  sign-off: `-e high`, scoped to the group's diff. Reproduce each finding or read the code, then fix it or record why
  not, in `.claude/docs/reviews/<group>-astra-triage.md`.
- **Not its job:** playtests (the owner), editing files (no `-w` without the owner), deciding (its findings are claims).

Review prompt that works (adapt the paths and the checklist):

> You are reviewing <group> of Reward the Pack, a static Vite + TypeScript web page where student teams write the
> bonus plan (reward) of a tabular Q-learning agent that runs a dog daycare. Read CLAUDE.md and docs/BRIEF.md first.
> Then run `git diff --stat <base>...HEAD -- <paths>` and read the changed files. Do a correctness review, not a
> style review: world rules that do not match the numbers in BRIEF.md; state that leaks between episodes; RNG calls
> whose order depends on anything but the seed; off-by-one on the 20-step week; reward terms that can be earned
> without the behaviour the KPI names; anything that would let a Round 1 run train to something other than the
> overbooked, one-staffer, no-nap policy. Do NOT edit files. At most 15 findings, most severe first: severity,
> file:line, concrete failure scenario, suggested fix; say when you're unsure and what would confirm it. End with
> what you did not review.
