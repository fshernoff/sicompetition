# Submission checklist: Presidential SI Challenge, educator track

The working list from now to submission. Tick a box when it is done and say where the proof is. **Owner** is who
does it: Fred, or Claude (a thread in this repo, with Fred editing and approving). The rules below are from
`docs/challenge-plan.md` (written Oct 25 from the official pages); the first task is to check them again on the
official site, and this file wins over the plan once it is updated.

Official pages: [Rules](https://orise.orau.gov/si-challenge/complete-the-challenge/rules.html) ·
[Requirements](https://orise.orau.gov/si-challenge/complete-the-challenge/requirements.html) ·
[Eligibility](https://orise.orau.gov/si-challenge/about/eligibility.html) ·
[FAQ](https://orise.orau.gov/si-challenge/resources/faq.html) ·
[Scoring guide](https://orise.orau.gov/si-challenge/resources/scoring-guides.html) · questions: SI.Challenge@doe.gov,
office hours Mondays 7:00 to 8:00 p.m. ET.

## What gets submitted (to be re-verified)

- **One PDF**: 10 pages plus a title page, 12-point or larger, 30 MB at most. Sections in this order: Summary (1
  page max), The Approach, Safety, Learning Achievements, Next Steps (must say what would change if the project
  advances to regionals), References and Acknowledgements. Title page: project title, name with grade and subject,
  the public video link.
- **One video**: 4:00 at most (judges stop at 4:00; credits count), 300 MB at most, horizontal, a public link with no
  password.
- **The signed Adult Consent and Media Release form for Educators**, uploaded at registration.
- **Not required, but scored**: a link to the code ("if seeing the code will strengthen your project"). Ours: the
  public repo and the live game URL, so a judge can play it and rerun any claim.
- **Deadlines**: register (school email) and submit by **Dec 18, 2026, 5:00 p.m. ET** (our target); hard deadline
  **Dec 23, 2026, 5:00 p.m. ET**; edits allowed until the deadline.
- **SI disclosure**: undisclosed SI use counts as academic dishonesty. Ours: Claude Code (build, lesson drafts, this
  write-up's drafts), the Codex CLI with GPT-6-Astra (reviews), GPT image (the illustrations, `docs/art-provenance/`).

## 0. Now, before the pilot (by Nov 8)

- [ ] **Re-verify the rules** against the official pages above; update this file where they differ. (Claude, first
  thing in the next thread, with a web fetch; Fred confirms.)
- [ ] **Register** with the school email address, not the studio one. (Fred; the plan said early November.)
- [ ] **Sign and upload** the Adult Consent and Media Release form. (Fred)
- [ ] **Ask the open questions** at office hours or by email and paste the answers here. (Fred)
  - [ ] Do students in an educator-track video need the Challenge's youth media release, or does the school's own
    form suffice?
  - [ ] Does a one-educator team need a separate Team Leader registration?
  - [ ] Is an unlisted YouTube link acceptable; any required file format?
  - [ ] Are regional and national prizes per educator or per team; is there a Tier II rubric or presentation length?
  - [ ] (From Oct 25) Does a new codebase that cites an earlier RL demo project as prior work satisfy the August 1
    originality rule? (Now also: AI-generated illustrations made for the project after August 1, disclosed with
    provenance.)
- [ ] **School SI guidance**: find the district's policy on SI in classrooms; the Safety section quotes it. (Fred)
- [ ] **Student media releases**: decide the form, send it home before filming starts; film hands and the smartboard,
  not faces, without one. (Fred)
- [ ] **Play G5c, rehearse on the Chromebook and the projector, merge** `g5c-look` (or keep `main` at `f784bbd`).
  (Fred; see `.claude/docs/HANDOFF.md`.)
- [ ] **Deploy** to Netlify; put the address in `docs/lesson/teacher-guide.md`. (Fred deploys; Claude edits the guide.)
- [ ] **Push the repo public** (`sicompetition`), with the README, the licence and the deploy link. (Fred decides
  when; Claude checks nothing private is in it first.)
- [ ] **Evidence kit ready for Nov 9** (Claude prepares, Fred approves):
  - [ ] A folder layout for the exports: one folder per team code, one per period (e.g.
    `Evidence/<period>/<team-code>/*.json`), kept off the public repo (no student names anywhere, but class data
    stays private).
  - [ ] A scoring sheet for the concept check (team code, seat number, pre/post, the eight items' scores), as a
    spreadsheet or CSV template.
  - [ ] Team codes assigned (e.g. P1-A, P1-B), never names.
  - [ ] A pilot notes sheet: the three most common confusions, the wait on the Chromebooks, whether teams read the
    readout cold, any sheet word changed.

## 1. The pilot, Nov 9 to 13 (one class, two periods)

- [ ] Concept check, pre (15 min, alone). (Fred)
- [ ] Round 1 on the smartboard with the class's five picks; teams' runs; exports into the folders. (Fred)
- [ ] Pilot notes filled in. (Fred)
- [ ] **G6**: a plan from the pilot notes, fixes built, tested, merged before Nov 16. (Claude, Fred gates)
- [ ] Record what changed because of the pilot (it is the Process and Learning evidence and a PDF paragraph). (Claude
  drafts from G6's plan result)

## 2. The full unit, Nov 16 to Dec 4 (8 periods)

- [ ] Concept check pre (period 1) and post (period 8), same sheet, same conditions; scored with the key. (Fred)
- [ ] Every team's exports, Rounds 1 to 3, in the folders. (Fred)
- [ ] Mapping tables (period 6), board memos (period 7), exit tickets (period 8), scanned or typed, by team code.
  (Fred)
- [ ] Filming (see section 4): periods 1, 3, 4, 5, 8. (Fred, or a colleague; releases first)
- [ ] Two or three student quotes chosen for the PDF and the video (memos, exit tickets). (Fred)

## 3. The evidence, Dec 5 to 8 (Claude builds, Fred checks)

- [ ] A script that reads the export folders and the concept-check sheet and prints, with no student identifier:
  - [ ] pre/post: class mean, the gain, and the share scoring 2 on question 5 (predicts a gaming behaviour), before
    and after;
  - [ ] prediction accuracy by round: the five picks called per team per round ("called N of 5"), the mean per round;
  - [ ] how bonus plans moved from one measure to several (measures on, by round);
  - [ ] one or two figures (pre/post, accuracy by round) at print quality.
- [ ] The numbers checked by Fred against the raw sheets.

## 4. The video, Dec 5 to 13 (4:00)

Updated from the Oct 25 shot list for D50 to D56 (the class never watches the engine learn; the judges should):

| Time | Shot | Source |
|---|---|---|
| 0:00–0:20 | Cold open: the team's five picks, Put the GM to work, the packed yard, "You called 2 of 5." Voice: "Nobody told it to do this." | `npm run capture` or a screen recording |
| 0:20–0:50 | Fred at the smartboard: students will hire and manage AI; almost none have seen one optimise; the one-line idea | Classroom, period 1 |
| 0:50–1:40 | The tool: the bonus plan, the plan in words, the picks, the week, the scorecard, the report | Screen recording with cursor |
| 1:40–2:10 | Behind the curtain (for the judges): the Teacher tray, the learning curve, fixed seeds, the public code | Screen recording |
| 2:10–2:50 | Students: a team arguing a plan, the scorecard landing, the gallery walk, one exit-ticket line | Classroom; faces only with releases |
| 2:50–3:20 | Evidence: pre/post gain, accuracy by round, one memo quote | On-screen numbers from section 3 |
| 3:20–3:50 | Safety and spread: no data, no accounts, one URL, any teacher; what changes for regionals | Fred to camera |
| 3:50–4:00 | Title card, repo and game links, credits | Title card |

- [ ] Script and narration (Claude drafts from the PDF's Summary; Fred edits and records).
- [ ] Screen recordings at 1080p (Claude can produce them headless; Fred can record his own).
- [ ] Edit, under 4:00 and 300 MB, horizontal. (Fred, or whoever edits; credit them)
- [ ] Upload to a public, no-password link; test it in a private browser window. (Fred)

## 5. The PDF, Dec 5 to 11 (10 pages plus title page)

| Section | Pages | Contents | Draft |
|---|---|---|---|
| Title page | 1 | Reward the Pack; Fredric Shernoff, grade and subject (AP Business with Personal Finance); the video link | Claude |
| Summary | 1 | The idea, who it reached, the headline result, one sentence on safety | Claude, last |
| The Approach | 3 | Why an AI GM in a business class; the daycare and the GM in plain words; the bonus plan as the reward; the three rounds; the picks and the scorecard; one or two screenshots; the engine (tabular Q-learning, seeds, the 60 s budget, the learning curve) and the repo link; what it borrows in pedagogy from Fred's earlier classroom RL demos and why the code is new | Claude |
| Safety | 1 | No student data leaves the room; no accounts; team codes; incidents as icons; reward hacking as the content; the district's SI guidance quoted | Claude, Fred adds the guidance |
| Learning Achievements | 2.5 | Pre/post, accuracy by round, plan complexity by round, two student quotes, what the pilot changed | Claude, from section 3 |
| Next Steps | 1 | The regional update (a second AI employee so sales sells what operations cannot deliver; a second class or school; a guide for non-business classes; what Fred would show live) | Claude, Fred decides |
| References and Acknowledgements | 1 | The readings actually opened (`docs/lesson/debrief-readings.md` Sources); the SI disclosure (Claude Code, Codex/GPT-6-Astra, GPT image with provenance); anyone who filmed or edited | Claude, Fred verifies each source |

- [ ] Draft, then Fred's edit; every number traced to section 3's output. (Claude, Fred)
- [ ] 12-point or larger, 10 pages plus the title page, under 30 MB, sections in the required order. (Claude checks the
  file; Fred approves)
- [ ] Sources opened by Fred before they are cited. (Fred)

## 6. Submit (target Dec 18, 5:00 p.m. ET)

- [ ] The repo public and its README current; the game deployed and its link working. (Fred)
- [ ] The video link public, tested in a private window. (Fred)
- [ ] The PDF final. (Fred)
- [ ] Submitted through the portal with the school email; confirmation saved. (Fred)
- [ ] Media releases on file for every face in the video. (Fred)
