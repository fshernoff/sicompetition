# G5d review rounds (the stop rule: two rounds in a row with no blocking or high finding and at most three mediums
# from any reader; the budget is four rounds)

## Round 1 (Oct 28, `g5d-look` at `b0b5757`: WP2, WP3, the cast and the second set merged)

Shots: `Temp/shots/20261028-223844/` (22 states). Checks on that build: `npx vitest run` 503 passed, 40 failed (all
D58 rows for the cast, awaiting WP4a's fixes and the crew2 passes); lint 0; dist 824 KB; `npm run e2e` 9 passed
(52.7 s); `npm run perf` 1,252 / 1,148 / 1,146 ms, p95 16.7 to 16.8 ms, 0 long tasks, 4.8 MB.

### The main thread (written before reading the others)

Five seconds: it reads as a studio's management game. The bar, the three columns, the rail with its big red 18
against the 15, the yard with eighteen varied dogs and an adult crew member, the orb, the scorecard beside the
business, the P&L. My findings:

| # | Severity | Shot | Finding | Fix |
|---|---|---|---|---|
| M1 | High | 05, 06 | After the week, the last block's caption chip ("2 dogs sent home sick") still shows: a stale event reads as current | Clear the captions when the week is over (or label them "Friday pickup") |
| M2 | Medium | 04 | "0 this block" carries the warning icon and the badge's frame at zero | Show the badge only when the block had an incident; a quiet "none this block" otherwise |
| M3 | Medium | 01 | On load the yard column shows the empty board small in a large grey field | Scale the board to the column (as mid-week), or crop the surround |
| M4 | Medium | 05 | After the week the board is small in a large grey area beside the scorecard | The same scale as mid-week, or a deliberate after-week composition |
| M5 | Medium | 04 | About 160 px of the rail is empty below the meters at 1366 × 768 | Distribute the rail or give the meters and the facts more room |
| M6 | Low | 05 | The plan and the Why repeat below the scorecard, making the after-week page long | Collapse them under the scorecard |

### Astra and the Opus critic (both unanchored: the bar, the severity scale and the shots only)

Astra: "polished prototype", not at the bar: 1 blocking, 9 high, 8 medium. The critic: passes at five seconds, not
on a closer look: 4 blocking, 11 high, 14 medium, 2 low. Both: the palette, the type, the first screen's flow, the
picks, the ratio display, the P&L and the tray's groups are at the bar and must not regress.

### Triage (A = Astra, C = critic, M = main thread)

| # | Sev | From | Finding | Verdict | Owner |
|---|---|---|---|---|---|
| 1 | Block | C | A raised cream slab juts from the yard's front-left edge (WP3's code-drawn walk path; the set has its own path) | Accepted | WP3: remove it; walkers on `set.json`'s `walk` strip |
| 2 | Block | A, C | "Days the crew ran solo: 0" beside "1 staffer on the floor" (a streak through yesterday, unlabelled) | Accepted: a scope label | BRIEF 10.2 changed; WP2: "Days in a row the crew ran solo, before today" |
| 3 | Block | C | Tuesday "Dogs per staffer 10.4" with 19 dogs and 2 crew (a block average: a walk takes dogs and a staffer off) | Accepted: a scope label | BRIEF 10.1 changed, test failing; WP2: "Dogs per staffer, the day's average" |
| 4 | Block | C | The fallback dogs read as cats or bears; an empty capsule; overlaps; no GM | Accepted (also A's high 8) | WP3: dogs with a muzzle and a dog's ears, varied, spaced, the orb, no capsule |
| 5 | High | A, C, M1 | The last block's caption survives the week, no scope | Accepted | WP3: clear captions when the week is over; chips say "this block" |
| 6 | High | A, C | The scorecard's only headline is the prediction | Accepted | WP2: an equal factual business headline ("Profit $5,393 before the GM's bonus · 7 incidents · reputation down 18"), the same size as "You called N of 5." |
| 7 | High | A, C | The two crew are one person, mirrored; dogs repeat side by side | Accepted | WP3: crew and crew2 are different staff, different poses; the same sprite and pose never within about 150 px |
| 8 | High | A, C | The P&L stops before the owners' bottom line; the bonus tile reads as income | Accepted (reversing the earlier "owner's call": it is a row, not a new rule) | BRIEF 10.1 changed, test failing; WP2: the row, `formatDollars`, the profit tile's "after the GM's bonus" line, the bonus tile as "paid to the GM" |
| 9 | High | C | "Bonus this week ($)" over daily values | Accepted | BRIEF changed: "The GM's bonus ($)"; WP2 |
| 10 | High | A, C | Projector (1920): the same small type and 30 to 40% empty height | Accepted | WP2: type and panels scale above 1366 wide |
| 11 | High | A, C | "Put the GM to work" looks disabled when ready | Accepted | WP2: the amber primary state the moment it is ready |
| 12 | High | C | The pick's check badge touches "Premium" | Accepted | WP2 |
| 13 | High | A, C | The sliders fill from the left, no zero, a penalty looks like "none" | Accepted | WP2: fill from a marked zero, pay and penalty coloured |
| 14 | High | A | Mid-week does not show what today is costing | Accepted in part | WP2: today's cash change beside the cash; the full money stays in the report |
| 15 | High | A, C | "Blocks" have no denominator | Accepted in part | WP2: "of 20" on the scorecard and the tile; one line under the picks: "A day has four blocks: drop-off, late morning, afternoon and pickup." |
| 16 | High | C | The Activities row: "walk" Mon to Thu against "walk 1", the arrow unexplained, wraps | Accepted | WP2: a key ("asked → ran"), no-wrap phrases, its own alignment |
| 17 | High | A | The crew render smoother than the faceted dogs | Not now | C rates the staffer at the bar; revisit if round 2 flags it again |
| 18 | Med | M2, C | "0 this block" carries the warning badge | Accepted | WP2 |
| 19 | Med | M3, M4, C | The yard small on load and on the scorecard; the scale jumps | Accepted | WP3 with WP2: one scale, filling the column |
| 20 | Med | M5, C | Empty rail height; getting ready empty below; the status said twice | Accepted | WP2: use the space, show the Why; WP3: drop the canvas's duplicate status line, the orb in the yard while it gets ready |
| 21 | Med | A, C | Plan and Why repeat after the week, look editable; no link to the P&L | Accepted | WP2: collapse to a read-only summary, the Why as a quote, "See the weekly P&L" |
| 22 | Med | A, C | The meters' subjects and thresholds | Accepted | BRIEF changed ("Dogs' energy"); WP2: the 70% mark, warning colour past it |
| 23 | Med | C | Step 2's heading above step 1's; the instruction repeated | Accepted | WP2 |
| 24 | Med | C | The pick table's columns run together | Accepted | WP2 |
| 25 | Med | C | The legal-limit label not under its tick | Accepted | WP2 |
| 26 | Med | C | The orb's done band is green on a bad week (reads "good") | Accepted | WP4b: a neutral done band (white, steady); D58 passes again |
| 27 | Med | C | The orb overlaps the parapet; its shadow far away | Accepted | WP3: hover clearly, the shadow under its centre |
| 28 | Med | A, C | The tray's telemetry line; the divider at 1024 | Accepted | WP2: "Training details" disclosure; the divider |
| 29 | Med | A | The round 3 plan sentence a bold paragraph | Accepted | WP2: one clause a line, regular weight, amounts bold |
| 30 | Med | C | Names drift ("Blocks over the legal ratio" and "Blocks over 15 dogs per staffer"; "Staff fatigue above 70%" and "Crew fatigue") | Declined | They are different things (a measure and its count; a measure and a meter), and the measures' names are the sheets' (D54) |
| 31 | Med | A | Scorecard "3 or 4 (4)" | Declined | D56's words, on the sheets |
| 32 | Low | C | "chose nap 0 times" | Declined | describeWeek's sentence, quoted by the teacher guide (D54) |
| 33 | Low | C | The bar scrolls away on the run screens | Accepted | WP2: the round in the run header |
