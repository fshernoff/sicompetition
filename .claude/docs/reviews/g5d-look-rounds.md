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

## Round 2 (Oct 29, `g5d-look` with WP2's and WP3's round 1 fixes merged)

Shots: `Temp/shots/20261028-233947/`. Checks on that build: `npx vitest run` 517 passed, 9 failed (all D58 rows
for six sprites awaiting Astra); lint 0; dist 772 KB; `npm run e2e` 9 passed (52.9 s); `npm run perf` 1,286 /
1,106 / 1,085 ms, p95 16.7 to 16.8 ms, 0 long tasks, 4.8 MB.

### The main thread (before reading the others)

| # | Severity | Shot | Finding |
|---|---|---|---|
| M1 | Medium | 05 | "The GM's bonus +$539.30" in How the business did keeps a plus sign: a payout reads as income on the business side |
| M2 | Medium | 01 | The empty board still sits small in a tall grey column on load |
| M3 | Low | 05 | Empty space under the plan summary in the left column after the week |

### Astra and the Opus critic (unanchored)

Astra: "polished classroom software", not at the bar: 2 blocking, 9 high, 6 medium (all 23 shots at full size; "no
definite anatomy error, child staff member, stray art text or cutout halo"). The critic: passes at five seconds, not
on a closer look: 3 blocking, 9 high, 16 medium, 2 low. Both rate the palette, the type, the numbered flow, the
picks, the gauge, the reconciled P&L arithmetic, the tray's groups and the yard's light and cutouts at the bar.

### Triage (the spec's words changed first: BRIEF 1, 1.1, 5, 7, 10, 10.1, 10.2; D60 to D63; 29 tests written failing)

| # | Sev | From | Finding | Verdict | Owner |
|---|---|---|---|---|---|
| 1 | Block | C1, M1 | The GM's bonus keeps its plus sign in the owners' ledger | Accepted (D62) | BRIEF 10.1: a fourth group, the owners' bottom line (Paid to the GM as a cost, Profit after, Cash at close); WP2 |
| 2 | Block | C2, A9 | Cash never pays the GM | Accepted (D62) | BRIEF 5: the page's cash less the bonus earned so far; `frame.bonusSoFar`; WP2 |
| 3 | Block | C3, A1, M3 | The long Why cut off with no mark; the primary button below the fold; the left column empty | Accepted | WP2: the full Why in the scorecard's empty lower-left cell; both buttons above the fold at 1366 × 768 |
| 4 | Block | A2, C11 | The tray slices the rerun button at 1024 and hides it at 1366 | Accepted | WP2: the open tray's height reserved as bottom padding |
| 5 | High | C4, A10, C27 | Scorecard and report lead with profit before the bonus; a 5 of 5 reads as a good week | Accepted in part | WP2: lead with the profit after the GM's bonus, reputation lost and incidents in the warning colour; no invented verdict (A rates the neutral called/missed at the bar) |
| 6 | High | C5 | "capped at a safe ratio" when nobody was turned away | Accepted | BRIEF 10.2; WP2 (`planWords`) |
| 7 | High | C6 | Sick dogs never leave the count | Accepted in part | Illness is found at pickup (BRIEF 6): the caption says so, "2 dogs sick at pickup"; WP2 |
| 8 | High | C7 | Tuesday's 10.4 does not reconcile | Accepted | A footnote under the table (BRIEF 10.1); WP2 |
| 9 | High | C8, A4, C30 | Identical cream Labs side by side; three corgis in one pose; three retrievers in one run | Accepted | WP3: in screen space, the same sprite never within 160 px, the same breed and pose never within 110 px; a test |
| 10 | High | C9, A6, A7 | Mid-week: the GM's action in the weakest text, no cost, the bookings unscoped | Accepted | BRIEF 10.2: "Today: …", a bold "This block: …", "The GM's bonus so far" beside the cash; WP2 |
| 11 | High | C10, A8 | Two picks have no scope | Accepted | BRIEF 1.1: "Nap blocks this week", "Incidents this week", "Your picks for the week", the 20 blocks; WP2 |
| 12 | High | C12, A3 | The fallback yard reads as a child's drawing | Accepted | WP3: a deliberate schematic (the floor plan in the palette, tokens for dogs and crew, the orb), no drawn anatomy |
| 13 | High | A5 (and round 1's A17) | The crew render smooth beside the faceted dogs | Accepted (the second time; the main thread sees it at 2×) | WP4a: the crew remade in the dogs' faceted treatment, with a kneel and a tired pose; D58 again |
| 14 | High | A11 | The report's 14 px table is too small to project | Accepted | WP2: the table's type scales from 1600 wide, the Week column marked |
| 15 | Med | A12 | A spotless lawn at cleanliness 0 | Accepted (state shown, nothing invented: D60) | WP4b: mess decals from the set; WP3 shows them by cleanliness |
| 16 | Med | A13 | The sliders' zero and ends unmarked | Accepted | WP2 |
| 17 | Med | A14, C17 | "3 or 4 (4)" repeats the bucket; the table wraps | Accepted (D63, reversing round 1) | BRIEF 1.1; WP2: plain words, fixed columns, no orphaned numbers |
| 18 | Med | A15, C28, M2 | Space: an empty yard small on load; getting ready half empty | Accepted | WP3: the board fills its column, the orb ready on the roof; WP2: phase proportions, a compact getting-ready |
| 19 | Med | A16 | "Watch the week again" and "Put the GM to work again" are not told apart | Accepted | WP2: one line under the buttons |
| 20 | Med | A17, C16 | The Activities row wraps and its arrow is unexplained | Accepted | BRIEF 10.1: three one-line rows and a count row; "free play (walk asked)" everywhere; WP2 |
| 21 | Med | C13 | One measure, several names | Accepted (D61, reversing round 1) | BRIEF 7; WP2 with the sheets (D54's test) |
| 22 | Med | C14 | The meters: no bad end, the threshold's unit | Accepted | WP2 |
| 23 | Med | C15 | Copy that reads like engine output | Accepted | BRIEF 10 (the sentence's clauses), 10.2 (the plan line, the streak); WP2 |
| 24 | Med | C18 | Headlines split numbers from nouns | Accepted | WP2: non-breaking spaces |
| 25 | Med | C19 | The scorecard's dividers misaligned | Accepted (with 3) | WP2 |
| 26 | Med | C20 | The done status narrates the layout | Accepted | BRIEF 1: "The week is over."; WP2 |
| 27 | Med | C21 | Off measures look active | Accepted | WP2: the row greyed |
| 28 | Med | C22 | The disabled button looks enabled; the round pill looks like a button | Accepted | WP2 |
| 29 | Med | C23 | The round pill twice or missing | Accepted | WP2: one rule, a compact sticky bar |
| 30 | Med | C24 | The scroll and the yard's size jump between states | Accepted | WP2 (the bar), WP3 (one camera) |
| 31 | Med | C25 | The plan sentence's indents; measure names wrap | Accepted | WP2 |
| 32 | Med | C26 | The Why box does not grow | Accepted | WP2 |
| 33 | Low | C29 | Blue link and focus ring | Accepted | WP2: navy or amber |
| 34 | Low | C30 | The tray's round control; "you write its bonus plan" with Round 1 locked | Accepted / declined | WP2 the control; the tagline is the bible's, and the round line says Round 1's plan is set |
