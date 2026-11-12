# G11: Astra's review, triaged

Nov 12, 2026. Astra (`Tools/Agent/astra.sh -e high`, read-only, exit 0) reviewed `git diff main...HEAD -- docs/lesson
docs/evidence tests/lesson tests/ui/bans.ts README.md docs/BRIEF.md docs/DECISIONS.md src` on `g6-fixes` (`f0b8477`):
the first independent read of round 2's fixes (`3c52b00`). Reply: `Temp/AgentCodex/20261112-121644.md`. Counts:
0 blocking, 3 high, 9 medium, 1 low. It reproduced the key's seed-1 weeks for Round 1, the walk exhibit, Reputation
change alone and Incidents alone, and ran `npm run calibrate`. It did not review printed pagination, run a timed
class, run vitest or the browser tests, or check the readings' citations.

Each finding was reproduced here before it was taken (the commands are in the table). Fixes are in `docs/lesson/`,
`docs/evidence/README.md` and `tests/lesson/materials.test.ts`; every fix a test can hold has a test, seen failing
(13 failed, 121 passed) before the sheets changed.

## High

| # | Finding | Reproduced | Call |
|---|---|---|---|
| H1 | "It sees everything on the floor, but protects nothing the plan leaves out" (guide), "no plan pays for a clean floor" (key), "it does only what the plan pays for" (memo) teach the wrong mechanism: an unpaid result still matters to the GM when it costs paid ones (sick dogs cost reputation; Round 1's one day of help keeps the daycare open for profit). | Yes: the Round 1 week (`node Tools/balance/probe.ts --plans P10 --seeds 1`) has help on one day so the lone staffer never calls out: the GM looks after the crew, which no measure names, because a closed day costs profit. | Taken. Guide: "it looks after what the plan leaves out only where that earns bonus". Key: "no plan pays directly for a clean floor; the sick dogs cost 7 reputation points and the photos earn 45". Memo: "it looks after only what earns it bonus". The key's SI section says the same. Test: no sheet says "protects nothing"; the exhibit says "directly". |
| H2 | The key's H1 gives 2 in 100 as the chance in a block; energy and the activity multiply it (1.8 in 100 in free play at energy 40, 0.18 in a nap). | Yes: `incidentProbability(10, 40, 'freePlay')` 0.018, `'nap'` 0.0018. | Taken. H3 now carries the page's sentence "A block's incident chance is the ratio's chance times (0.5 + energy ÷ 100) times the activity ...". The zero-dogs sentence was cut for words. Test: H3 carries that sentence, read from `hiddenRules(config)`. |
| H3 | "No plan with profit in it has the dogs nap or clean" is false: Profit can be on at $0 or less; the test checks only positive plans. | Yes: `probe.ts --plans P-1,P0I-5 --seeds 1`: P-1 cleans 15 blocks (profit −$5,114), P0I-5 naps 8 and cleans 4. | Taken in the key: "No plan tried with Profit at +$1 or more ...; at $0 or below they do: Profit at −$1 alone cleans every block." Test: the scope words, and the engine's P-1 cleans. BRIEF 7 and 14 say the same false sentence: needs the main thread. |

## Medium

| # | Finding | Reproduced | Call |
|---|---|---|---|
| M1 | The walk week is stated beyond what was measured: BRIEF 7 "at +$2 to +$10, with or without other measures", D69 "at any amount", the key's "Nine plans ... from +$2 to +$10". | Yes: P2R10 is three staffers on 2 days, profit $4,242; P1R10 three staffers every day, $3,372; P10R2I10 (paying for incidents) is a Round 1 week with 10 incidents. P2R2 and P5R2 are the walk week. | Taken in the key: "Every plan tried with Profit at +$5 to +$10 and Reputation change at +$2 to +$10 gives the walk week, fines or not. With Profit small beside reputation (+$2 against +$10) the GM hires a third staffer." Test: P2R10 differs and has a third staffer; no "Nine plans". BRIEF 7 and D69: needs the main thread. |
| M2 | "One staffer on 4 days and help on the fifth" reads as Friday; seed 1's help is Tuesday, and Friday help would not stop Thursday's call-out. | Yes: the week's floor staff are [1, 2, 1, 1, 1]. | Taken: "help on Tuesday". Test: the help day read from the engine's week. H7's longer wording not added (word limit; the reveal prints it). |
| M3 | "Stable" is not "its choices stop changing": the outcome key matched on five checks while days and profit still moved. | Yes: `src/learn/train.ts` `isStable`: ε at its floor and the last `stableEvals` (5) outcome keys equal. | Taken: "when it gives the same kind of week on five checks in a row ("stable"; its days may still differ in detail)". Test: the wording and `stableEvals` 5. |
| M4 | "Profit $5,393" is ambiguous: the page leads with the profit after the GM's bonus ($4,853.70). | Yes: `src/ui/app.ts` and `report.ts` lead with "Profit after the GM's bonus". | Taken: the guide says "$5,393 before the GM's bonus ($4,853.70 after it)", the key "before the GM's bonus"; each brief's report line asks for "profit after the GM's bonus", the page's first number. Tests on all three. |
| M5 | Period 4 needs each team's Round 2 readout, which a reload loses; the export has no viewer. | Yes by reading: the page keeps no run after a reload (BRIEF 14 already says so for Round 1). | Taken for period 4: "Teams rerun their Round 2 plans from the briefs (5)", the gallery walk 25. Period 7 uses the numbers copied onto the Round 3 brief, so it stands. The time a rerun takes on a Chromebook is unmeasured. Test: period 4 reruns Round 2. |
| M6 | Q1's premise gives its key. | Read. | Declined, as in round 2: the premise must be stated for one best answer; the short answers carry the gain; pre-check scores will show any ceiling. The owner may revisit before a class sits it. |
| M7 | Q6's full-credit example "even at a loss" claims a loss the report does not show ($300 profit). | Yes. | Taken: "sold more loaves while profit fell". Test: no "at a loss" in Q6's key. |
| M8 | Q7 (a gym paid on memberships signed) is near the readings' salesperson case, so "a gain is not recall" overclaims. | Yes by reading case 3. | Taken as a qualification, not a new item (no new scenario four days out): the key and the evidence README say Question 7 is near transfer. Test on both. |
| M9 | The hidden-rule test passes on title-only lines; `/\d/` is met by "H1". | Yes: H12 was title only. | Taken: each rule needs a page sentence beyond its title, and a number past its id. H12 now carries the page's wage sentence. |

## Low

| # | Finding | Call |
|---|---|---|
| L1 | The guide says the button waits for "five picks and a Why"; the page says the Why is "Not needed to start". | Taken: "The button waits for the five picks; ask for the Why too." Test. |

## Found here, not by Astra

| # | Finding | Call |
|---|---|---|
| P1 | Printed, the sheets run past BRIEF 14's page counts. Rendered from the Markdown to US Letter in headless Chromium two ways (GitHub's sizes, 12 pt, Chrome's 0.4 in margins; and an 11 pt word-processor setting, 1 in margins): before this pass the briefs were 2 pages each in both, the teacher guide 4, the readings 3 to 4, the concept check 3. | Tightened by words only: the briefs (1 page each; Round 2 exactly full), role cards, memo, key (1.8) and concept check (1.96, one sheet both sides) now fit at 11 pt; at GitHub's 12 pt none fits (briefs 1.2 to 1.3 pages, key 2.3, guide 3.8). The teacher guide (3.1 pages at 11 pt) and the readings (2.5) cannot reach two pages by tightening at the word limits the tests hold: the owner's call (raise BRIEF 14's counts, move the mapping table to its own sheet, or add a print command with a print sheet, as `submission:pdf` does on the `submission` branch). Outputs under `Temp/lesson-print/`. |
| P2 | The readings' mapping table prints one line high per cell: no room to write. | Not changed (it would lengthen an over-long sheet): the owner's call, with P1. |
| P3 | The key said Incidents −$5 alone "takes the longest"; Dogs served +$5 alone also runs all 150,000 weeks on seed 1. | Taken by the key's trim: the phrase is gone. |

## Needs the main thread

- BRIEF 7 (lines 322 to 330): "at +$2 to +$10, with or without other measures" becomes "with Profit at +$5 to +$10 and Reputation
  change at +$2 to +$10, with or without fines on the other measures"; add "with Profit small beside reputation (+$2 against
  +$10) the GM hires a third staffer"; "No plan with Profit on naps or cleans, alone or beside any other measure" becomes
  "No plan tried with Profit at +$1 or more naps or cleans"; "naps and cleans appear only in plans without Profit" becomes
  "... only in plans with Profit off or at $0 or below (Profit −$1 alone cleans every block)".
- BRIEF 14 (line 613): "that no plan with Profit on naps or cleans" becomes "that no plan paying Profit +$1 or more naps or cleans".
- D69: "at any amount" becomes "at the amounts measured (Profit +$5 to +$10, Reputation change +$2 to +$10)".
- BRIEF 14's page counts against P1, and whether the briefs' tighter layout (bold lead lines in place of two headings) is kept.
