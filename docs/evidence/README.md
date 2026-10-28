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
| `q1` to `q4` | 0 or 1 |
| `q5` to `q8` | 0, 1 or 2 |

A blank answer is a 0, entered as 0; a student absent from a sitting has no row. The total (out of 12), the class mean, the gain and the share scoring 2 on question 5 come
from the evidence script (checklist section 3), not from the sheet.

## The pilot notes

`pilot-notes.md`: one copy per pilot period, filled in during and right after class. It feeds G6 (the fixes before
the full unit) and the Process and Learning paragraph of the PDF.
