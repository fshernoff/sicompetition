# Reward the Pack: Presidential SI Challenge Plan

Oct 25, 2026 · Fredric Shernoff

## The project in one page

Reward the Pack is a browser lesson where AP Business student teams own a dog daycare, hire a reinforcement-learning agent as general manager, and write its bonus plan. They watch it learn live and discover what their reward actually asked for. Submit it on the educator track as a *teaching students about using or creating SI* project, built and taught entirely after August 1, 2026, by a team of one (Fred).

**The lesson in one line:** students own Good Dog Daycare and never work a shift. They hire an SI as general manager, and the only lever the owners hold is its bonus plan. The reward sliders are the comp plan, and the GM will earn every point of it in the cheapest way the rules allow.

**Why it wins points:** it is an original RL build (Innovation, 15; SI Accuracy, 15), it runs in any browser on a smartboard with no student accounts (Educational Impact, 20; Safety, 10), and reward hacking is the lesson itself, not a disclaimer (Safety, 10; Research & Evidence, 10). A daycare adds a stakeholder that cannot complain (the dogs) and a compliance rule (the staff-to-dog ratio), so the first thing students see go wrong is welfare, not margin.

**Headline timeline:** build Oct 26 to Nov 8, pilot with one class Nov 9 to 13, run the full unit Nov 16 to Dec 4, write and film Dec 5 to 13, register and submit by Dec 18, 2026 (official deadlines: register Dec 18, 2026, submit Dec 23, 2026, both 5:00 p.m. ET).

**What goes out the door:** one PDF (10 pages plus title page, 12-point font, 30 MB max), one video (4 minutes max, 300 MB max, public link), and the signed Adult Consent and Media Release form. Code is optional but a link to the repo strengthens SI Accuracy.

**What it builds on without reusing:** the classroom RL demos (four games, one algorithm, live on the smartboard) proved students will watch an agent learn for ten minutes. BizBattles proved teacher-paced rounds and team debriefs work in this class, and it keeps the food-truck setting for itself, so both can run in the same year. Reward the Pack is a new codebase in a different business that borrows the pedagogy of both and the code of neither.

## Challenge requirements

A solo full-time K-12 teacher is eligible (teams are 1 to 3 educators, any subject, age 21+, U.S. citizen or permanent resident), and the whole submission is one PDF plus one video. Everything below is from the [Official Rules](https://orise.orau.gov/si-challenge/complete-the-challenge/rules.html), [Requirements](https://orise.orau.gov/si-challenge/complete-the-challenge/requirements.html), [Eligibility](https://orise.orau.gov/si-challenge/about/eligibility.html) and [FAQ](https://orise.orau.gov/si-challenge/resources/faq.html) pages.

| Requirement | Rule | What it means for this project |
| --- | --- | --- |
| Project type | Educator teams "demonstrate integrating SI technologies into their classrooms" by teaching students about using or creating SI, or by building an SI tool for admin workflows | This is the teaching route; the tool and the unit are both the project |
| Originality | "100% of each project's content must be original content and created specifically for the Challenge after August 1, 2026" | New repo, new code, new lesson materials; rl-demos and BizBattles are cited as prior work, not reused |
| Written PDF | Single PDF, 30 MB max, 10 pages plus a title page, 12-point or larger | Title page: project title, your name with grade and subject, public video link |
| PDF sections, in order | Summary (1 page max), The Approach, Safety, Learning Achievements, Next Steps, References and Acknowledgements | Next Steps must answer "what would change if this project advances to the regional competition" |
| Video | One video, 4 minutes max (judges stop at 4:00), 300 MB max, horizontal, public link with no password, credits count | Someone else may shoot or edit it; the subject and content must be yours |
| Code | Not required; "if seeing the code will strengthen your project, you can provide a link" | Link the public repo in The Approach and References |
| SI tools | No tools prohibited; teams are "encouraged" to use generative SI; not disclosing SI use is academic dishonesty | Disclose Claude Code as a build assistant in Acknowledgements |
| School policy | "Teachers must follow all school guidance on the use of SI technologies in their classrooms" | Students use only the tool you built; no third-party AI accounts needed |
| Consent | Signed Adult Consent and Media Release for Educators form before any training activity | Submit with registration; student releases are not stated for educator videos, so ask (see Open questions) |
| Correspondence | School email addresses must be used | Register with your school address, not the studio address |
| Tiers | State champion by educator category per state; regional champions present an updated project live online Mar 4 to Apr 8, 2027; nationals in Washington, DC, Jun 6 to 9, 2027 | Plan the Next Steps section as the regional update |
| Prizes | State: $200 gift card. Regional: $1,000 gift card plus the DC trip. National: Presidential Award Certificate and $10,000 | Subject to funding; per-person vs per-team not stated |

### Educator rubric and where the points come from

The [scoring guide](https://orise.orau.gov/si-challenge/resources/scoring-guides.html) is 100 points. Innovation is the first tie-breaker and Objective Definition the second.

| Criterion | Points | How Reward the Pack earns it |
| --- | --- | --- |
| Educational Impact Potential | 20 | Students write, test and revise a reward three times; pre/post concept check shows the gain; any teacher can run it from one URL |
| Innovation of Approach | 15 | Students train an RL agent in a business class, and the lesson is about specifying goals, not operating software |
| SI Accuracy and Technical Validity | 15 | A real policy-gradient or Q-learning agent, visible training curve, reproducible seeds, public code |
| Objective Definition and Relevance | 10 | One objective: students can design an incentive plan and explain why whoever is paid on it, human or SI, does what the plan pays for, not what its author meant |
| Research & Evidence | 10 | Pre/post scores, student reward drafts and predictions, exit tickets, cited reading on reward hacking |
| Safety & Responsible SI | 10 | Reward hacking is the content; no student data leaves the room; no accounts; aligned with school SI guidance |
| Process and Learning | 10 | Build log, pilot findings, what changed between pilot and full run |
| Video Quality | 10 | Smartboard footage of the agent learning, student reactions, 4:00 cut |

## The tool

One static web page (TypeScript, Vite, HTML canvas, no backend) that trains a small RL agent in the browser in under 60 seconds and lets a student team edit the reward between runs. New public repo `sicompetition` (product name Reward the Pack), created after August 1, 2026, deployed to Netlify like Homeroom.

### The environment: a week at Good Dog Daycare

An episode is one five-day week in 20 steps: four blocks a day (drop-off, late morning, afternoon, pickup). At drop-off the agent sets the day's plan; in every block it picks what the floor does. Students read the state on screen; the rules that connect the state are hidden.

| State the agent sees | Actions it can take | Hidden world rules (students discover these) |
| --- | --- | --- |
| Day and block, dogs on the floor, staff on shift, floor energy (how wound up the dogs are), cleanliness, staff fatigue, reputation score, cash, tomorrow's booking requests | At drop-off: bookings to accept (all / up to the legal ratio / a safe cap), day rate (low / standard / premium), staff on shift (1 / 2 / 3). Every block: free play / structured play / nap / walk / clean | Incident risk climbs steeply above 10 dogs per staffer; the game's legal maximum is 15 and an inspector may fine the business over it; free play raises floor energy and nap lowers it, and high energy plus crowding is where incidents happen; every incident means a refund, a chance of a vet bill and a review drop; reviews set tomorrow's requests; a dirty floor causes illness and cancellations; a staffer who works three days without help calls out; walks earn app photos that lift reputation but cost a staffer's block |

The hidden rules are what make the lesson work. The agent will find every one of them if the reward lets it, and the students have to read the behavior to work out what it found. The dogs cannot leave a review, so a reward with no welfare signal will not notice them until the owners do.

### The agent

Tabular Q-learning over a coarsened state (about 2,000 states) with epsilon-greedy exploration, or a tiny policy-gradient network in plain TypeScript if the Q-table feels too opaque in testing. Q-learning is the default because it trains in seconds, is explainable with a table on the board, and needs no library. Fixed random seeds per run so two teams with the same reward get the same agent, which makes the pre-run prediction a fair test.

### The reward editor

Students never touch code. The reward is the GM's bonus plan: a weighted sum of up to six named KPIs, each with a slider from -10 to +10 and a toggle, and the page shows the plan in words as they edit: "Each day, the GM earns 8 points per $100 of revenue, loses 6 points per incident, and loses 4 points for every block the floor runs over 12 dogs per staffer."

| KPI in the bonus plan | Default in Round 1 | What it tends to do when it is the only thing rewarded |
| --- | --- | --- |
| Revenue today ($) | +10 | Accepts every booking, premium rate, one staffer, no naps, no cleaning |
| Dogs served | off | Low rate, accepts everyone, floor packed, incidents ignored |
| Incidents (penalty) | off | Accepts almost no dogs, three staff all day, runs at a loss |
| Reputation change | off | Walks and photos all day, premium care that nobody pays for |
| Staff fatigue above 70% (penalty) | off | Three staff every day, overstaffed and unprofitable |
| Blocks over the legal ratio (penalty) | off | Caps bookings at exactly the legal line and never below it |

### The live training view

- A training curve (total reward per episode) that climbs in front of the class.
- An animated "watch one week" replay of the current best policy: the yard, dog sprites, staff, a ratio gauge, an incident flash, the reputation meter and the cash counter. An incident is an icon and a counter, never an injury on screen.
- A weekly P&L and operations report after each run, which the lesson calls the readout: "The agent accepted every booking on 5 of 5 days, scheduled 1 staffer on 4 days, chose nap 0 times, averaged 18 dogs per staffer, and had 11 incidents." This readout is what students compare to their prediction.
- A side-by-side panel: the team's prediction (typed in before training) next to the readout.

### Teacher controls

- Round presets (1, 2, 3) that lock or unlock signals.
- A seed field, a speed slider, and a "reveal hidden rules" button for the debrief.
- Export: one JSON file per run (reward weights, prediction text, readout, curve) that students download and hand in, so evidence collection costs nothing extra. Nothing is stored server-side, nothing identifies a student.

### Build order

1. Simulator and hidden rules, headless, with tests that confirm each rule has the effect intended (Oct 26 to 29).
2. Q-learning loop and training curve on canvas (Oct 30 to Nov 1).
3. Reward editor with the plain-English formula (Nov 2 to 3).
4. Replay animation and behavior readout (Nov 4 to 6).
5. Round presets, export, teacher panel, deploy, record a 30-second screen capture for the pilot (Nov 7 to 8).

**Definition of done for the pilot:** on a Chromebook, a Round 1 run trains to a stable policy in under 60 seconds and the readout shows the overbooked, one-staffer, no-nap behavior every time.

## The classroom unit

Eight class periods over three weeks, Nov 16 to Dec 4, in teams of four, with one predict-train-explain cycle per round. Each student holds a role for the whole unit and argues for one KPI in every bonus-plan negotiation: CFO (revenue and cost), COO (staff fatigue and incidents), CMO (reputation and dogs served), and compliance officer (the legal ratio). The team must agree on one plan, which is where the arguing and the learning happen; the roles are the same device that makes BizBattles' team decisions work. The unit fits AP Business with Personal Finance because the whole exercise is incentive design: every KPI is a business metric students already know, and the new idea is that whoever is paid on a metric treats it as the whole truth. It runs beside BizBattles, not on top of it, since the daycare shares no setting with the food trucks.

**Learning objectives.** By the end, a student can (1) explain what an incentive plan is to an optimizer, human or SI, and how an RL agent uses its reward, (2) predict at least one way a single-KPI plan will be gamed, (3) negotiate and justify a multi-KPI plan in terms of stakeholders, and (4) connect the principal-agent problem to a real company that paid for the wrong metric.

| Period | Date | What happens | Student artifact |
| --- | --- | --- | --- |
| 1 | Nov 16 | Pre-check (10 min). Hook: the class watches the Round 1 GM go from random to a packed yard with one staffer in 60 seconds on the smartboard. Mini-lesson: what the GM sees, what it can do, what its bonus plan is | Pre-check answers |
| 2 | Nov 17 | Teams read the Round 1 readout and write what the GM found. Introduce Goodhart's law: when a measure becomes a target, it stops being a good measure. Roles assigned; each role lists who revenue-only ignores: the dogs, the staff, the owners who pick up at 6, the inspector | Stakeholder list by role |
| 3 | Nov 18 | Round 2: each role pitches its KPI; the team negotiates a bonus plan with up to three KPIs, writes a one-paragraph prediction of the GM's behavior, trains, compares prediction to readout | Round 2 plan JSON + prediction |
| 4 | Nov 20 | Gallery walk: each team shows its Round 2 readout and the gap from its prediction. Class names the surprises | Gap notes |
| 5 | Nov 30 | Round 3: all six KPIs unlocked. Roles negotiate the weights, predict, train. Teacher reveals the hidden rules at the end | Round 3 plan JSON + prediction |
| 6 | Dec 1 | Debrief: the same problem in business. Short readings on Wells Fargo's cross-selling quotas, call-center handle-time targets and commissions that pay on bookings; teams map each to "what was the bonus plan, what got gamed" | Mapping sheet |
| 7 | Dec 3 | Board memo: each team writes a half-page memo to the daycare's owners recommending a bonus plan for the GM and naming the risk it still carries | Board memo |
| 8 | Dec 4 | Post-check (10 min). Student exit reflection: what would you tell someone hiring an SI to run a business? Film reactions for the video | Post-check, exit ticket |

**The Goodhart debrief** is the heart of the unit and should get a full period (6). Run it as three questions on the board: what did the owners actually want, what did we pay the GM for, and what was the cheapest way to earn it. Then swap the daycare for a bank branch paid on accounts opened, a call center paid on handle time, and a school judged on attendance, and ask the same three questions. The business name for the pattern is the principal-agent problem; the SI name is reward hacking; students should leave knowing they are the same thing.

**Differentiation.** Teams that finish early get a hard-mode seed where booking requests swing day to day. Teams that struggle get the two-signal preset in Round 3 instead of six.

**Materials to write (all new, all after Aug 1):** a two-page teacher guide, a one-page student brief per round, four role cards, the pre/post concept check, the board memo template, and the debrief reading list.

## Evidence plan

Collect four kinds of evidence during the unit so the Learning Achievements section can report numbers, not impressions. All of it is anonymous by design: teams are named by their daycare's name, exports carry no student identifiers, and the concept check is scored by team code.

| Evidence | When | What it shows | Rubric line it feeds |
| --- | --- | --- | --- |
| Pre/post concept check, 8 questions, same form both times | Periods 1 and 8 | Gain on reward functions, Goodhart's law, stakeholder reasoning | Educational Impact (20), Research & Evidence (10) |
| Prediction-vs-readout gap per team per round | Periods 3, 5 | Predictions get more accurate as rewards get richer, which is the learning | Educational Impact, SI Accuracy |
| Reward JSON exports, three per team | Periods 3, 5 | Bonus plans move from one KPI to balanced multi-KPI designs | Process and Learning (10) |
| Board memos and exit tickets | Periods 7, 8 | Transfer to real systems in students' own words; quotable in the PDF and video | Educational Impact, Video |

**Concept check design.** Four multiple-choice items (what a reward is, what an agent optimizes, which signal a given behavior points to, what Goodhart's law says) and four short-answer items (predict the behavior of a given reward, name a stakeholder a reward ignores, fix a bad reward, map one real system). Score short answers with a two-point rubric. Report the class mean and the share of students who can correctly predict a gaming behavior before and after.

**Pilot evidence** (Nov 9 to 13, one class, two periods): time to train, whether students read the readout correctly without help, and the three most common confusions. Report what changed as a result; that is the Process and Learning section.

**Cited reading for References:** Goodhart's original 1975 observation and Marilyn Strathern's 1997 restatement, Amodei et al. 2016 *Concrete Problems in AI Safety* (reward hacking section), the DeepMind specification gaming examples list, and a news account of the Wells Fargo cross-selling scandal for the business side. Cite the pages you actually open.

## Safety and responsible SI

The safety story is simple to tell and worth all 10 points: the misbehavior of an optimizer is the subject of the lesson, and the tool is built so there is no student data to protect.

| Area | Design choice | What to say in the Safety section |
| --- | --- | --- |
| Student data | Static page, no accounts, no server, no analytics; exports are team-coded JSON | "No personally identifiable student data is collected, stored or transmitted" |
| School SI policy | Students use only the tool you built; no generative SI accounts required | Quote the district's SI guidance and show the unit sits inside it |
| Physical and emotional safety | Team roles rotate so no student is the only one "wrong" when a prediction misses; the gallery walk celebrates surprises | Required by the rules: describe how you protect "the physical and emotional safety of students" |
| Responsible SI content | Reward hacking, specification gaming, stakeholder harm and the limits of metrics are the explicit content of periods 2, 5, 6 and 7 | This is where most projects write a disclaimer; here it is the curriculum |
| Accuracy | Hidden rules are deterministic and documented; seeds are fixed; the curve and readout are the real training data | Judges can rerun any claim in the PDF from the public repo |
| Generative SI in the build | Claude Code used as a coding assistant; the simulator rules, lesson design and all student-facing text are yours | Disclose in Acknowledgements, as the FAQ requires |
| Media | Students who appear in the video need a release on file; film the smartboard and hands, not faces, by default | Confirm with the organizers whether their youth release form or the school's form applies (Open questions) |

**Risks and mitigations.** The agent fails to converge on a Chromebook: cap the state space and precompute Round 1 as a fallback replay. Students game the editor instead of the daycare (all sliders to +10): make the signals conflict so that does not work, and treat it as a teachable moment. An incident reads as upsetting: the replay shows an icon and a counter, never an injured dog, and the debrief names welfare as a design input. The unit runs long: periods 4 and 7 can merge.

## Week-by-week schedule

| Workstream or milestone | Dates |
| --- | --- |
| Ask at office hours | Oct 26 |
| Build the tool | Oct 26 to Nov 8 |
| Write lesson materials | Nov 2 to Nov 13 |
| Register, consent form | Nov 2 |
| Pilot, one class | Nov 9 to Nov 13 |
| Full unit, 8 periods | Nov 16 to Dec 4 |
| Film in class | Nov 16 to Dec 4 |
| Write the PDF | Dec 5 to Dec 11 |
| Edit the video | Dec 5 to Dec 13 |
| Submit (target) | Dec 18 |
| Hard deadline | Dec 23, 5:00 p.m. ET |

The build finishes before the pilot, the pilot's fixes ship before the full unit, and filming happens inside the unit so the edit and the PDF run in parallel in the two weeks after. Register early in November once the consent form is signed; nothing depends on it, but the portal lets you edit until the deadline. The Dec 18 target leaves five days of buffer before the Dec 23 hard deadline.

## The video and the written summary

The video has four minutes to show an agent learning, a student being surprised, and a teacher explaining why that surprise is the point. The PDF has ten pages to prove it with numbers. Write the PDF first; the video script is its Summary page read aloud over footage.

### Video shot list (4:00, judges stop there)

| Time | Shot | Source |
| --- | --- | --- |
| 0:00 to 0:20 | Cold open: screen capture of Round 1 going from random to a packed yard with one staffer, incident counter climbing. Voice: "Nobody told it to do this" | Screen recording |
| 0:20 to 0:50 | You at the smartboard: the problem (students will hire and manage SI; almost none have seen one optimize) and the one-line idea | Classroom, period 1 |
| 0:50 to 1:40 | The tool: reward editor, plain-English formula, prediction box, training curve, behavior readout | Screen recording with cursor |
| 1:40 to 2:40 | Students: a team writing a prediction, the readout landing, the reaction; a gallery-walk moment; one exit-ticket line read aloud | Classroom, periods 3 to 8; faces only with releases |
| 2:40 to 3:20 | Evidence: pre/post gain, prediction accuracy by round, one quote from a board memo | Simple on-screen numbers |
| 3:20 to 3:50 | Safety and spread: no data, no accounts, one URL, any teacher. What changes for regionals | You, to camera |
| 3:50 to 4:00 | Title card, repo link, credits (they count toward the limit) | Title card |

Shoot horizontal, capture the smartboard with a phone on a tripod from the back of the room, and record screen captures at 1080p. Keep the file under 300 MB and host it unlisted on YouTube or the school's video platform with no password.

### PDF page plan (10 pages plus title page, 12-point)

| Section | Pages | Must contain |
| --- | --- | --- |
| Title page | 1 | Project title, your name, grade and subject, public video link |
| Summary | 1 | The idea, who it reached, the headline result, one sentence on safety |
| The Approach | 3 | Why RL in a business class, the environment and agent in plain words, the three rounds, the reward editor, a screenshot, the repo link, what the tool borrows in pedagogy from your earlier classroom RL demos and why the code is new |
| Safety | 1 | The Safety table from this plan, in prose, plus the district guidance you followed |
| Learning Achievements | 2.5 | Pre/post numbers, prediction accuracy by round, two student quotes, what the pilot changed |
| Next Steps | 1 | The regional update: a second SI employee (a front desk paid on bookings, a floor manager paid on incidents) so students watch sales sell what operations cannot deliver; a second class or school; a teacher guide for non-business classes; what you would show live |
| References and Acknowledgements | 1 | Readings cited, Claude Code disclosure, anyone who filmed or edited |

## Open questions and submission checklist

Five things the public pages do not settle. Ask at the next virtual office hours (Mondays 7:00 to 8:00 p.m. ET; the next is Oct 26, 2026) or by email at SI.Challenge@doe.gov, and paste the answers here.

- [ ] Does a reward-design lesson built on a new codebase satisfy the August 1 originality rule when it cites an earlier RL demo project as prior work?
- [ ] Students in an educator-track video: does the Challenge's youth media release apply, or does the school's own form suffice?
- [ ] Does a one-educator team need a separate Team Leader registration?
- [ ] Video hosting: is an unlisted YouTube link acceptable, and is there a required file format?
- [ ] Are the regional and national prizes per educator or per team, and is there a Tier II rubric or presentation length?

### Submission checklist

- [ ] Register with your school email by Dec 18, 2026 (5:00 p.m. ET); upload the signed Adult Consent and Media Release form
- [ ] Public repo `sicompetition` with README, license, and a one-click deploy link
- [ ] Pilot complete, three confusions logged, fixes shipped
- [ ] Full unit complete, pre/post scored, exports collected from every team
- [ ] Student media releases on file for anyone whose face appears
- [ ] PDF: 11 pages, 12-point, under 30 MB, sections in the required order, video link on the title page
- [ ] Video: under 4:00, under 300 MB, horizontal, public link tested in a private browser window
- [ ] Claude Code disclosed in Acknowledgements
- [ ] Submit by Dec 18, 2026 (target), hard deadline Dec 23, 2026 5:00 p.m. ET; edits allowed until the deadline

Repo setup and the session 1 prompt for Claude Code: [build-kickoff.md](build-kickoff.md)
