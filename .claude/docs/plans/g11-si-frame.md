# G11: the SI frame

Branch `claude/stoic-keller-lfb14w` (a cloud session, Nov 12, 2026), from `main` at `0b33197`. Nothing here reaches
`main` or the live site until the owner merges.

## Why

The owner, Nov 12, after a review of the whole entry: the Challenge is about bringing SI into the classroom; the
machine-learning view was taken off the student's screen on purpose (business students do not care how the sausage is
made, D50), and that left the unit reading as an incentives lesson with an SI as a prop. His calls:

1. "It should always say SI": the Challenge's word, never "AI".
2. Lean into the story the page already tells: the owners explicitly put an SI in charge. The lesson is what that
   demands of an owner that managing a person does not. This is the Challenge's "teaching students about **using**
   SI" route; the engine stays out of sight.
3. "Polish this into the version you know it can be. The plan is yours."

The review also measured a balance problem (this session, seed 1, `Trainer.runFor` on the default config): once
Reputation change is on beside Profit, at any weight, the GM walks dogs in 15 of 15 floor blocks with two staffers
and four different plans give the identical week (profit $4,678, reputation +34, 2 incidents, 0 blocks over 15, 7 dogs
sick). Rounds 2 and 3 then have one answer and the weights stop mattering.

## Decisions (add to `docs/DECISIONS.md` at the next free numbers, one line each)

- **The word is SI.** Wherever a student, a teacher or a judge reads: the page, the sheets, the README, the bible,
  the checklist, the Challenge plan, the capture list, the evidence templates, CLAUDE.md's word rules, code comments.
  "an SI". Supersedes the word in D53, not the idea. SI is never expanded: no file in this repo carries the official
  expansion and the official site could not be reached from this session, so nothing guesses it. Where a reader needs
  it explained it is described, not expanded (for example "an SI, a computer system that makes the decisions itself").
  Kept as published: titles of cited works and company or product names ("Concrete Problems in AI Safety", OpenAI).
  Left as written: history (old HANDOFF entries, plan results, review triages, DECISIONS D1 to D66, ROADMAP rows).
- **The unit teaches managing an SI.** The human cases stay but become the comparison. What the class should be able
  to say, with no machine learning in it:
  1. A human GM has brakes the plan never mentions: conscience, fear of being fired, common sense about what the
     owners meant. The SI has none of them.
  2. The SI takes the plan literally. It knows what was written, not what was meant.
  3. It finds the loophole faster and more completely than a person would (Round 1: one day of help, exactly, so the
     daycare never closes).
  4. So the owner's job changes: with a person you can under-specify and lean on judgment; with an SI the plan is the
     supervision, and the owner must read the week for what the plan left out.
- **The balance** (only if WP3's gate passes): one hidden-rule change, the bible first.

## Acceptance

1. No "AI" as a word on the page at runtime or in any lesson sheet, pinned by a test that was seen failing; the
   allowlist is the cited titles only.
2. The sheets carry the frame: the teacher guide's objectives and a short "why this is an SI lesson"; the period 6
   debrief asks whether a human GM would have run this week and what stopped a person that did not stop the SI; at
   least four of the eight concept-check questions are about an SI in charge and one asks for something an owner must
   write into an SI's plan that a person never needs to be told; the Round 3 brief and the board memo ask the team to
   read the report for something the plan did not pay for. All still inside G7's rules (BRIEF 14, D54): the page's
   words, no hidden rule before the reveal, none of the teacher's words on a student's sheet, the page counts
   (teacher guide two pages, a brief one page).
3. WP3's gate (below), or no change to the rules.
4. `npm test`, `npm run lint`, `npm run build`, `npm run e2e`, `npm run pilot -- --seeds 20 --budget 60000` (20 of
   20 target met) green at the end; numbers in the Result from this session's runs.

## Packages

All Opus. Astra is not installed in this container (`codex` is absent): a fresh reviewer agent that has not seen the
plan's reasoning stands in for it before the last commit. The main thread commits; packages leave the tree uncommitted
(WP3 commits inside its own worktree for hand-over).

- **WP1, the words.** The bible first (BRIEF 1, 11, 14 and wherever the word stands; DECISIONS; CLAUDE.md), then the
  ban test failing (`tests/ui/bans.ts` is shared by the unit tests and the e2e), then the page, the sheets and the
  docs. Also the README's two stale lines (the Teacher button is in the top bar; the e2e is 10 tests).
- **WP2, the lesson frame.** After WP1. BRIEF 14 first, `tests/lesson/materials.test.ts` failing, then
  `docs/lesson/*`, `docs/evidence/` where it mirrors the concept check, and a line in `docs/submission-checklist.md`
  for the PDF's objective statement.
- **WP3, the balance lab.** In a worktree, in parallel. Read-only until a candidate passes the gate.
- **WP4, the review and the checks.** The fresh reviewer; fixes; the full check list; screenshots at 1366 × 768.

### WP3's gate

Candidates, at most three, simplest first. The first to try: **a walk's photo counts once a day** (the first walk
block of a day that takes at least one dog lifts reputation; later walks that day do not). Others only if it fails:
a smaller `walk.reputationGain`; a larger reputation cost per sick dog.

The panel (P profit, D dogs served, I incidents, R reputation, F fatigue, O over-ratio; seeds 1 to 3, seed 1 is what
a class sees): P10 · P10 I−5 O−5 · P10 R2 · P10 R5 · P10 R10 · P10 I−10 · P10 I−10 R5 · P5 I−10 R10 · P3 I−10 ·
P10 I−5 F−5 O−5 · P10 D5 R5 · all six at ±10 · P10 D2 I−8 R6 F−4 O−6 · each measure alone at its suggested weight.

A candidate passes only with all of:

- **A. Round 1 is untouched.** 20 of 20 seeds target met; on seed 1 the sentence, the week's profit ($5,393), the
  incidents (7) and reputation (50 → 32) are exactly today's, so every printed sheet stays true.
- **B.** The calibration test passes unchanged.
- **C. Spread.** On seed 1 the plans P10 R2, P10 R5, P10 R10, P10 I−10 R5, all six, and the mixed six give at least
  three distinct outcome keys (today: one).
- **D. No free lunch.** No panel plan on seed 1 keeps profit at or above 85% of Round 1's ($4,584) with reputation up
  10 or more and 2 incidents or fewer (today's walk week does).
- **E. It still settles.** Every panel plan stable today is stable within the budget on seeds 1 to 3.
- **F.** The rule reads as fair in one line of the reveal panel.

If none passes: no tracked file changes but the lab report (`.claude/docs/reviews/g11-balance-lab.md`).

## What the owner sees

- The tagline and every sheet say SI.
- The sheets ask the human-versus-SI question; the concept check is revised (**if a class has already sat the old
  sheet as a pre-check, the owner decides which form that class keeps**).
- If WP3 passes: Rounds 2 and 3 where the reputation weight changes the week; Round 1 on seed 1 exactly as printed.
- Still his: the official expansion of SI if he wants it on a sheet; the hidden-rule change, which the README's
  disclosure ("the simulator rules ... are the author's") makes his to approve; the Chromebook check; the merge.

## Result

Built Nov 12, 2026 in one cloud session, on `claude/stoic-keller-lfb14w` (pushed; `main` and the live site untouched).
Commits: `c8a3d60` the plan, `5839c16` WP1, `e3b8d7c` WP3's report, `776da9f` WP2, `8a42a0d` the first triage,
`2e893a5` WP2b, `28b398d` WP4, `71b7e5f` the second triage, `3c52b00` WP5.

**Acceptance.**

1. Met. The page, every sheet and the docs say SI (D67). `tests/ui/bans.ts` bans the old word in any case on the
   whole page and on every sheet, with the cited titles and company names allowed; 9 tests failed before the text
   changed.
2. Met, and changed by two review rounds. The unit teaches managing an SI (D68), scoped to what the game can show:
   the GM is one kind of SI, built to chase a number and given only a bonus plan. The teacher guide has the
   objectives and "Why this is an SI lesson"; period 6 asks "Would a human GM have run this week? What would have
   stopped a person that did not stop the SI?"; the Round 3 brief and the memo ask for the audit; the concept check
   defines an SI under its instructions and has five SI questions (1, 2, 5, 6, 7) and three about people, one of them
   an audit item (Q6, a bakery's report) and one asking what the owners should add to the plan and whether a person
   would have needed it written down (Q7). A tenth sheet, `docs/lesson/teacher-key.md`, gives the teacher the twelve
   hidden rules (pinned to the page's reveal), what each family of plan does on seed 1 (pinned to the engine), the
   check line, and how to judge "Which rule did your GM find?".
3. No candidate passed WP3's gate, so no rule changed (D69; `.claude/docs/reviews/g11-balance-lab.md`). Six
   candidates were measured with `node Tools/balance/probe.ts`. Gate A (Round 1's exact week on seed 1) cannot be met
   by any rule that touches reputation: the class held on 20 of 20 seeds under five of six candidates, the exact week
   on 0 to 6 of 20. The walk week (Profit with Reputation change: two staffers, 15 walks, profit $4,678, reputation
   50 → 84, 2 incidents, 7 dogs found sick) is now the unit's Round 3 exhibit, in the teacher's key.
4. Met, on the tree of `3c52b00`: `npm test` 38 files, 668 tests (603 before the group); `npm run lint` clean;
   `npm run build` built. `npx playwright test --trace off` 11 of 11 (1.2 min) and
   `npm run pilot -- --seeds 20 --budget 60000` 20 of 20 target met, both run on the same tree less one sentence of
   `teacher-key.md` trimmed afterwards. The e2e ran with `PLAYWRIGHT_BROWSERS_PATH` pointing at symlinks, because this
   container has Chromium headless shell 1243 and Playwright asks for 1248; no tracked file changed for it.

**The reviews.** Astra was not available (no `codex` in the container). Two fresh Opus reviewers stood in, neither
shown the plan's reasoning: round 1 on `776da9f` (0 blocking, 3 high, 7 medium, 6 low), round 2 on `28b398d` (0, 4,
10, 7). Every finding is in `.claude/docs/reviews/g11-review-triage.md`; all were taken but two left with reasons
(Q1's stem states its premise; the safe ratio's number stays hidden, D44). Round 2's fixes (WP5) were checked by their
tests and the main thread's read of the teacher's key, not by a third reviewer.

**What the main thread got wrong and the reviews caught.** The frame as first planned stated what is true of this GM
as true of SIs in general. It is now conditional everywhere, and a test fails on the unscoped forms.

**Not done, and the owner's.**

- The official expansion of SI: the repo has none and `orise.orau.gov` is outside this session's network. The sheets
  describe an SI ("a computer system that makes the decisions itself") and never expand it.
- Whether any class has sat a concept check. The form of Oct 28 prints with the command in `docs/evidence/README.md`;
  the score sheet has a `form` column; never report one gain across two forms. Today's two intermediate versions were
  never printed.
- Round 1 as one smartboard run with each team's picks on paper (the second review's H1) is a call made here; a run
  per team is the alternative.
- Print the ten sheets and check the page counts by eye (the tests hold word limits, not pages): the teacher guide is
  1,248 of 1,250 words, the teacher's key about 1,000 of 1,000.
- The Chromebook: nothing in the page's code changed but the word in the tagline and the teacher's curve caption.
- The merge to `main`, which deploys.
