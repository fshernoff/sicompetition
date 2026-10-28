# G7: the lesson materials (and the GM is an AI)

## Goal

A teacher who has never seen the page can run the eight-period unit from paper: a two-page teacher guide, a
one-page student brief per round, four role cards, the pre/post concept check with its key, the board memo template
and the debrief reading list, under `docs/lesson/`. Fred teaches period 1 from them.

Starting G7, the owner changed the frame (Oct 28): the entry is for the SI Challenge, so the unit has to be clear
that the GM is not a person. "You're putting an SI in charge of scheduling, etc. for the business. That can be spun
in a fun way, but we still don't need to show all the training." His choices: the old GM quit and the owners put
an AI in the GM's chair (a plain business story, not a vendor pitch); one line on the page says so; students get one
sentence about how it decides, and the teacher may show the learning curve in the period 6 debrief. Everything
else of D50 stands: the screen never shows the engine (no training, no weeks count, no curve), and the bonus is
dollars (D45).

## Decisions

- **D53 The GM is an AI the owners put in charge; the screen still never shows how it decides.** Supersedes the
  "person" half of D50. The story: the old GM quit, and the owners (the team) put an AI in the GM's chair. It books
  the dogs, sets the day rate, schedules the crew and runs the floor; nobody supervises it; the only lever the owners
  hold is its bonus plan, in dollars, and it chases the biggest bonus the plan allows and ignores whatever the plan
  leaves out. The page's tagline says it: "Good Dog Daycare. You own it. The GM is an AI: it runs the week, and you
  write its bonus plan." The student's one sentence of how: "Before Monday it tries out its choices and keeps
  whatever earns the most bonus." The learner's instruments stay the teacher's; the learning curve is the teacher's
  optional "behind the curtain" in period 6. The GM is "it", never "he" or "she". In the debrief the principal-agent
  problem and reward hacking (specification gaming) are named as two related problems this game shows meeting.
  (Owner, Oct 28: "we need to be clear the GM isnt a person ... we still dont need to show all the training.")
- **D54 The lesson materials quote the page, and a test holds them to it.** Every round brief carries its round's
  label and note as the page shows them, the role cards name the measures by the page's names, the teacher guide
  carries the Round 1 sentence of seed 1 as the engine writes it and the tray's buttons by their labels, the Round 1
  brief carries the tagline and the plan in words as the page writes them. A page edit that changes one of those
  words fails `tests/lesson/materials.test.ts` until the sheet is changed with it.

## Acceptance

1. `npm test` green; every new test seen failing first. `tests/lesson/materials.test.ts` checks, file by file:
   - the nine files exist: `teacher-guide.md`, `brief-round1.md`, `brief-round2.md`, `brief-round3.md`,
     `role-cards.md`, `concept-check.md`, `concept-check-key.md`, `board-memo.md`, `debrief-readings.md`;
   - the length of each, in words (markdown syntax stripped): the guide at most 1,250 (two printed pages), each brief
     at most 450 (one page), the role cards at most 640 (one page cut in four), the concept check at most 700 (one
     sheet, both sides with room to write), the memo template at most 300, the readings at most 1,100 (two pages);
   - the words in every file before any `## Sources` heading (`engineWords`, whole words, with a test of its
     exceptions): never "reward function", "train" in any form (the teacher's sheets may quote the check line's
     "Weeks trained"), "episode", "injur", "practi", "Q-learning", "epsilon" or "ε", "points" (the page's "point of
     reputation", "reputation point", "per point" and "one-point" are the only points allowed, so a rubric scores
     "Score 2"); the GM is "it": no "he", "him", "his", "she", "her" anywhere; no write-on line of underscores alone
     (it prints as a rule); in the student's files (all but the guide and the key) also no "seed", "settled",
     "learning curve", "reward" outside the debrief's "reward hacking", and no line that asks for a name (`Name:` or
     `Name ____`); every student sheet asks for a "Team code";
   - no hidden rule in a student's file before the reveal: not the safe ratio in any of its wordings (H1, D43), not
     three days alone or without help (H7), not "a walk needs" (H8), not "structured play needs" (H9), no energy
     beside incidents (H3), no dirty floor beside illness (H6), no walk beside reputation or photos (H8), no nap or
     clean beside the add-on or the supplies (H10), no fatigue beside the call-out (H7, H11), no "if you pay ... the
     GM will" (section 7's outcomes are the students' prediction); the patterns are a net, and the diff review reads
     every student sheet against H1 to H12;
   - the Round 1 brief carries the page's tagline (read from `index.html`), the sentence of how (D53), the Round 1
     plan in words (`describeBonusPlan` of the preset), the day rates and the wage from the config ("$28", "$40",
     "$52", "$300") and "15 dogs per staffer";
   - each round brief carries its round's label (`presets.json`) and note (`ROUND_NOTES`), "Put the GM to work",
     "What the GM did" and "Never type a name in the prediction box." (section 11: the prediction is exported as typed);
   - the role cards: four cards headed CFO, COO, CMO and Compliance officer; each names its measures by the page's
     names (`kpiInfo`): CFO Profit today ($); COO Incidents and Staff fatigue above 70%; CMO Reputation change and
     Dogs served; Compliance officer Blocks over the legal ratio; all six covered, none twice;
   - the concept check: exactly eight numbered questions, 1 to 4 each with options A to D and 5 to 8 with none, and
     "Pre or post" to circle, a "Seat number" (pairs the two sheets without a name), and question 8 prints the three
     questions it uses; the key: eight answers, 1 to 4 a single letter among that question's options, 5 to 8
     each with "Score 2", "Score 1" and "Score 0";
   - the teacher guide: periods 1 to 8, the Round 1 sentence of seed 1 exactly as the engine writes it
     (`describeWeek` of a `Trainer` on seed 1, computed in the test), that week's profit and reputation as the report
     writes them ("$5,393", "50 → 32"), the tray's labels "Reveal the hidden rules", "Show the learning curve" and
     "Export this run" (read from `index.html`), the three debrief questions, the sentence of how, the team code
     folders and "Never type a name in the prediction box.";
   - the readings: the three debrief questions verbatim ("What did the owners actually want?", "What did we pay the GM
     for?", "What was the cheapest way to earn it?"), "principal-agent problem" and "reward hacking", and a Sources
     section with each source's year on its line (Goodhart 1975, Strathern 1997, Kerr 1975, Jensen 1976, Amodei
     2016, Krakovna 2020, Clark 2016, the CFPB on Wells Fargo 2016) and an address for the four on the web, and the
     boat race by its name, CoastRunners;
   - the board memo: "Team code", the plan in words, a risk section.
2. `tests/ui/words.test.ts`: the tagline is D53's sentence, and the learning curve's caption begins "Behind the
   curtain, for the debrief if you choose to show it." instead of "The class never sees this." (both seen failing).
   The student's page keeps every ban it has; "AI" is allowed.
3. `npm run lint`, `npm run build`, `npm run e2e` (under 60 s of Playwright time; the button's bottom still ≤ 700 px
   at 1366 × 768 with the new tagline), `npm run pilot -- --seeds 20 --budget 60000` at G2's twenty counts (nothing
   in the engine changes; the run proves it).
4. The main thread's review of every sheet, then Astra's: clarity as a student and as a substitute teacher would
   read it; every student sheet against H1 to H12; the key's answers right and its rubrics consistent; question 1 to
   8 answerable before the unit; the prediction written and typed before every run; the export before any edit; the
   citations as given. Findings triaged and folded.

## Seams (main thread, before any package)

- `src/ui/roundNotes.ts`: `ROUND_NOTES` moves out of `app.ts` (which imports it), so a node test can read the page's
  round notes without the DOM.
- `tests/lesson/materials.test.ts` as above, with a `words(text)` counter and a `studentFiles` list; seen failing on
  the empty `docs/lesson/`.
- `tests/ui/words.test.ts`: the tagline assertion; then `index.html`'s tagline (one line, no package).

## Packages (all Sonnet: one file family each, written to a spec; none edits a test, a seam or `src/`)

Common to all (the package prompts carry it in full): read `CLAUDE.md`, `docs/BRIEF.md` sections 1, 4 to 8, 10, 11
and 14, D43 to D45, D50 and D53, this plan, the plan triage and `tests/lesson/materials.test.ts`. Plain words for
16-year-olds; short sentences; the game's words (GM, bonus plan, the weekly P&L and operations report or the readout,
crew, incident, Good Dog Daycare, measure); the GM is an AI and "it". Dollars, never points. **The hidden-rule
boundary:** a student's sheet says what the GM can choose, what the page shows and what the report counts, never
why one thing leads to another (no rule's number: the safe ratio, the solo streak, the walk's gain, cleanliness's 40,
the supplies; no causal link between two lines of the report), and never what a measure will make the GM do (that is
the students' prediction). **The run sequence**, the same everywhere: agree the plan, write the prediction on paper,
type it into the box ("Never type a name in the prediction box."), Put the GM to work, read What the GM did and the
report, and the teacher exports before any edit, retry or round change. Markdown for print: headings, short lists,
write-on lines that start with a word or "→" (a line of underscores alone prints as a rule), tables only where they
help. All text new (D1). A package reports any test it believes wrong with the bible line that contradicts it.

| Package | Files | Spec |
|---|---|---|
| WP1 the teacher guide | `docs/lesson/teacher-guide.md` | The idea (the old GM quit, the AI in the chair, the bonus plan as the one lever; the lesson is incentive design; the principal-agent problem and reward hacking as two related problems the game shows meeting); the four objectives; before class (one URL, a Chromebook per team of four, the smartboard, what to print); the Teacher tab (round, seed, Reveal the hidden rules, Show the learning curve, Export this run, the check line, one plain sentence each); what a run looks like (the status sentences of section 1; getting ready usually takes a few seconds, up to a minute on a slow Chromebook; the week, about 8 s; the readout beside the prediction); what Round 1 does on seed 1 (the sentence, the profit, the reputation, as given below); the eight periods as a table with minutes summing to 50 each (what happens, the sheet, what is collected), the Challenge plan's unit in D53's frame, period 1 typing the class's prediction before the smartboard run, the concept check 15 minutes alone; what to say when asked how the AI decides (the sentence of how; it is literal, not malicious) and the optional behind-the-curtain look in period 6; evidence (Export this run after each team's run and before any edit; each file into a folder named by team code; nothing added to the file; scoring the check with the key; team code and seat number pair pre and post); differentiation (the teacher tells a struggling team to turn on only two measures in Round 3; for early finishers the teacher sets a second seed to see whether the GM does the same thing; no hard mode on the page); safety (an incident is an icon and a counter; no accounts; nothing leaves the Chromebook but the file the teacher saves; a missed prediction is the lesson). |
| WP2 the round sheets | `docs/lesson/brief-round1.md`, `brief-round2.md`, `brief-round3.md`, `docs/lesson/role-cards.md` | Each brief one page, titled with the round's label, its note quoted: the story (Round 1 tells it in full: the old GM quit, the AI in the chair, the tagline, the sentence of how, the plan in words); the choices the GM has (bookings: every booking, capped at the legal ratio of 15 dogs per staffer, capped at a safe ratio with no number; rate low $28, standard $40, premium $52; crew 1, 2 or 3 at $300 a day each; each block free play, structured play, nap, walk or clean); the run sequence; prediction prompts with write-on lines (dogs, rate, crew, naps, incidents, why); after-the-week questions (what matched, what surprised, who paid for the GM's bonus). Round 2: the six measures by their page names, one line each on what it counts (no rule, no outcome), each role pitches, up to three on, dollar amounts from −$10 to +$10, copy the plan in words onto the sheet. Round 3: all six, negotiate, predict, the teacher reveals the hidden rules at the end; "which rule did your GM find?". Role cards: four cards headed `## CFO`, `## COO`, `## CMO`, `## Compliance officer`, each at most 150 words with a `**Your measures:**` line (CFO: Profit today ($); COO: Incidents, Staff fatigue above 70%; CMO: Reputation change, Dogs served; Compliance officer: Blocks over the legal ratio): who you speak for, the question you ask of every plan, who a profit-only plan forgets, a pitch starter. |
| WP3 the concept check | `docs/lesson/concept-check.md`, `docs/lesson/concept-check-key.md` | One sheet, the same pre and post, answered alone in 15 minutes, fair before the unit (no game knowledge needed), with "Team code", "Seat number (1 to 4)" and "Pre or post" (circle). `### Question N` headings; options as `- A. ...`. 1 MC: what a bonus plan is to whoever is paid on it. 2 MC: an AI GM given a bonus plan and told to earn as much bonus as it can: it aims at what the plan pays for, and what the plan leaves out can suffer (no claim about every AI, no promise of a perfect answer). 3 MC: a behaviour described, which plan points to it. 4 MC: Goodhart's law in plain words. 5 short: predict one way a plan will be gamed (a call centre paid on calls handled per hour). 6 short: a stakeholder a plan ignores and what happens to them. 7 short: fix a bad plan and name the risk the fix still carries. 8 short: a bank paying branch staff on new accounts opened, answered through the three questions printed in the item. The key: `### Question N`, `**Answer:** X` and one line of why for 1 to 4; for 5 to 8 Score 2, Score 1, Score 0 with an example answer each. |
| WP4 the debrief and the memo | `docs/lesson/debrief-readings.md`, `docs/lesson/board-memo.md` | Readings: the three questions; five short cases in new words, about 120 each: Wells Fargo (on September 8, 2016 the Consumer Financial Protection Bureau fined the bank $100 million after employees, pushed by sales goals, opened accounts customers had not asked for; the CFPB's penalty only, no other figures); a call centre paid on handle time, a salesperson paid on deals signed, a school judged on attendance (each labelled a made-up example); CoastRunners (a boat-racing game whose AI scored by hitting targets that kept coming back, and kept circling a lagoon hitting them instead of finishing the race); the principal-agent problem and reward hacking (specification gaming), defined briefly, as two related problems the daycare shows meeting; a mapping table (case × the three questions) with a team code; `## Sources` with the full citations given in the package prompt. Memo: To the owners of Good Dog Daycare, From team code, Subject; four prompts with write-on lines: our recommendation (keep the AI GM, and on what plan: the plan in words copied from the page), what it did with that plan (numbers from the Round 3 report), the risk it still carries (what the plan leaves out, who could be hurt), what the owners should check every week that the plan does not pay for; "under 250 words". |

The main thread writes the seams, the tests, the tagline and the curve's caption, BRIEF section 1 (D53's frame) and
section 14 (the lesson materials and their rules), D53 and D54, CLAUDE.md's document table and words line, the
README's opening, its lesson section and its disclosure, the roadmap, HANDOFF and the triages.

**The disclosure.** The README said "the lesson design and all student-facing text are the author's". From G7 on,
Claude drafts the sheets from the author's design, and the README says so: "Claude Code drafted the lesson materials
in `docs/lesson/` from the author's unit design; the author reviews, edits as needed and approves every sheet before
it reaches a class." The owner confirms or rewrites that line at the gate and carries it into the submission's
Acknowledgements (the Challenge counts undisclosed SI use as academic dishonesty).

## What the owner will see

- `docs/lesson/`: nine sheets in Markdown. The word limits are editorial; the page counts are the owner's to check
  on paper (Letter, from GitHub's rendering or VS Code's preview).
- The page's tagline: "Good Dog Daycare. You own it. The GM is an AI: it runs the week, and you write its bonus
  plan." In the tray's learning section the caption begins "Behind the curtain, for the debrief if you choose to show
  it." Nothing else on the page changes.
- In the teacher guide, Round 1 on seed 1 as this session's engine runs it: "The GM accepted every booking on 5 of 5
  days, ran the floor with 1 staffer on 4 days, chose nap 0 times, averaged 16 dogs per staffer, and had 7
  incidents.", profit $5,393, reputation 50 → 32 (`node` on `Trainer` seed 1, round 1; the test recomputes it).

## Plan review

Astra (`.claude/docs/reviews/g7-plan-astra-triage.md`): eleven findings, eight accepted and three in part. The
changes: the bans are one tested function with the page's own exceptions; the writers get the hidden-rule boundary
and the leak test casts a wider net; one run sequence everywhere, the prediction typed before the click and the export
before any edit; "Never type a name in the prediction box." and team-code folders; question 2 is about this GM, not
every AI; the principal-agent problem and reward hacking are related, not identical; the curve's caption; a seat
number and a 15-minute check; the citations with years and addresses; no promise of page counts from word counts.

## Owner gate

Fred reads the nine sheets as the teacher of period 1 and as a student, prints them (Letter) and checks the page
counts, edits any word he wants (the tests say which page words a sheet must keep), confirms the disclosure line, and
teaches period 1 from the guide, the Round 1 brief and the concept check.

## Result (2026-10-28, session 6; every number from this session's runs on the owner's Mac)

**Tests.** `npx vitest run`: 34 files, 360 tests, all passing (298 before G7). New: `tests/lesson/materials.test.ts`,
61 tests, seen failing on the empty `docs/lesson/` (59 of 60 failed; the word counter's own test passed) before any
package started, then the exceptions test with its negative examples and the briefs' "From the report:" line seen
failing (3 briefs) before the diff review's folds; in `tests/ui/words.test.ts` the tagline and the curve's caption,
each seen failing on the old text. No package disputed a test. `npm run lint` exit 0; `npm run build` clean (75.3 kB
of script, 7.7 kB of style).

**Round 1 unchanged.** `node src/learn/pilot.ts --seeds 20 --budget 60000`: 20 of 20 target met; episodes to stable
24,000, 27,500, 23,500, 25,500, 28,000, 22,500, 22,000, 23,500, 27,500, 23,500, 27,000, 27,500, 28,000, 24,000,
31,000, 25,000, 25,000, 25,000, 25,000, 22,000: G2's twenty numbers (3.7 s wall clock). Round 1 on seed 1 (`Trainer`
on the round 1 preset, `runEpisodes(maxEpisodes)`, `evaluate()`): "The GM accepted every booking on 5 of 5 days, ran
the floor with 1 staffer on 4 days, chose nap 0 times, averaged 16 dogs per staffer, and had 7 incidents.", profit
$5,393, reputation 50 → 32; seeds 2 and 3 give the same class (7 and 9 incidents).

**Page.** `npm run e2e`: 7 passed in 41.8 s of Playwright's time (42.2 s wall clock); the button's bottom at 600 px at
1366 × 768 with the new tagline; the report's last row at 655 px with the tray from 672 px.

**The sheets** (words as the test counts them, markdown stripped): teacher guide 1,157 (limit 1,250); Round 1 brief
309, Round 2 281, Round 3 209 (450 each); role cards 200 (640; each card under 150); concept check 562 (700); key 837
(900); board memo 117 (300); readings 813 (1,100). The page counts on Letter are the owner's to check.

**What moved during G7, in order.** (1) The owner's steer at the start (D53): the GM is openly an AI, the old-GM-quit
story, one line on the page, one sentence of how, the curve as an optional debrief look; and no pilot log. (2) Astra's
plan review (`.claude/docs/reviews/g7-plan-astra-triage.md`): eleven findings, eight accepted and three in part (see
Plan review above). (3) Four Sonnet packages in parallel, each green on its own files at hand-back. (4) The main
thread's review fixed: Round 2's fatigue measure (it said each staffer; it counts each block the crew's fatigue ends
above 70%), the Round 1 story's choices, Round 3's "each of the six" (a team turns on the ones it wants), two role
cards' lines, question 8's "the three questions we use" (unfair before the unit), the readings' principal-agent
sentence and two cases that answered the mapping table for the students, the memo's write-on lines (Markdown would
have run them into one line), the guide's collected column and "dog owners". (5) Astra's diff review
(`.claude/docs/reviews/g7-astra-triage.md`): nine findings, all accepted: the signed measures under a negative amount,
question 8's rubric, the report's numbers copied onto paper and rerun from the seed, drop-off is arrivals, "knows
nothing" corrected, question 7's rubric, the seed's range, period 3's minutes, the exceptions narrowed.

**Packages.** WP1 (Sonnet): `teacher-guide.md`. WP2 (Sonnet): the three round briefs and `role-cards.md`. WP3
(Sonnet): `concept-check.md` and its key. WP4 (Sonnet): `debrief-readings.md` and `board-memo.md`. The main thread
wrote the plan, the seam, the tests, the tagline and the caption, BRIEF sections 1 and 14, D53 and D54, CLAUDE.md, the
README, the review fixes, the triages, the roadmap and HANDOFF.

**Not built, on purpose.** The pilot log (the owner: the six materials only); a hard-mode or two-signal preset on the
page (G6 if the pilot asks; the guide says there is none); a printed PDF of the sheets (Markdown, printed by the owner).
