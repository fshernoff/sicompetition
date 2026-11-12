# The evidence kit

What the class produces for the submission, and where it goes. The templates live here; the class's own copies live
in `Evidence/` at the repo root, which is git-ignored: class data never enters the repo, even with team codes only.
No sheet, file or folder anywhere carries a student's name.

## Team codes

A team code is the class period and a letter: `P2-A`, `P2-B`, ... `P5-H`. Give each team its code on day one; the
team writes it on every sheet (the briefs, the concept check, the memo, the exit ticket) and you name its folder with
it. A student is the team code plus a seat number, 1 to 4, kept the same all unit: `P2-C seat 3`. That pairs a
student's pre and post concept checks without a name.

| Period | Codes |
|---|---|
| P_ | P_-A · P_-B · P_-C · P_-D · P_-E · P_-F · P_-G · P_-H |
| P_ | P_-A · P_-B · P_-C · P_-D · P_-E · P_-F · P_-G · P_-H |

## The folders

```
Evidence/
  pilot/                      Nov 9 to 13, the pilot class
    pilot-notes.md            one copy per pilot period
    concept-check-scores.csv
    P2/
      class/                  the smartboard runs (Round 1 in period 1)
      P2-A/
        reward-the-pack-round1-seed1-20261109-1012.json
  unit/                       Nov 16 to Dec 4, the full unit
    concept-check-scores.csv
    P4/
      class/
      P4-A/                   the team's exports, Rounds 1 to 3, as the page names them
      ...
    paper/                    scans or typed copies, named by team code: P4-A-memo.pdf, P4-A-mapping.pdf,
                              P4-A-3-exit.pdf (seat 3)
```

Export each run before any edit (an edit clears it) and drop the file in the team's folder unrenamed: the name
carries the round and the seed, and the file carries the plan, the five picks, the Why and what was called.

## The concept check scores

`concept-check-scores.csv`: one row per student per sitting, scored with `docs/lesson/concept-check-key.md`.

| Column | Values |
|---|---|
| `phase` | `pilot` or `unit` |
| `team_code` | `P2-C` |
| `seat` | 1 to 4 |
| `sitting` | `pre` or `post` |
| `form` | `nov12` (the sheet revised on Nov 12) or `oct28` (the earlier sheet) |
| `q1` to `q4` | 0 or 1 |
| `q5` to `q8` | 0, 1 or 2 |

A blank answer is a 0, entered as 0; a student absent from a sitting has no row. The total (out of 12), the class mean, the gain and the share scoring 2 on question 5 come
from the evidence script (checklist section 3), not from the sheet.

The items (`nov12`): the sheet first says, in one line, what an SI is (the Round 1 brief's words). Questions 1, 2, 5,
6 and 7 are about an SI put in charge with a bonus plan and no other instructions (what its bonus plan is to it; a
human manager swapped for an SI built to earn as much bonus as it can, on the same plan; predict how it games a
warehouse's per-hour measure; an audit of a bakery's week, which number the plan did not pay for got worse and why the
SI let it, so it measures reading a week for what the plan left out; what the owners should add to a gym's plan, and
whether a person in that job would have needed it written down); 3, 4 and 8 are about people, the comparison (read a
store's falling costs back to its plan; a measure that becomes a target; a hardware chain's staff paid on surveys,
mapped with the debrief's three questions). No item uses the daycare or a case the readings teach, so a gain is not
recall, though Question 7 is near transfer from the readings' salesperson case (signed deals, cancellations). Question 5 is still the one that predicts a gaming behaviour. A class that sat the `oct28` sheet as its
pre-check sits it again as its post-check. Print that sheet and its key from commit `0b33197`, the last version a
class could have sat (it says "AI"; later commits changed it):

```
git show 0b33197:docs/lesson/concept-check.md
git show 0b33197:docs/lesson/concept-check-key.md
```

Compare a student's pre and post only within one form.

## The pilot notes

`pilot-notes.md`: one copy per pilot period, filled in during and right after class. It feeds G6 (the fixes before
the full unit) and the Process and Learning paragraph of the PDF.
