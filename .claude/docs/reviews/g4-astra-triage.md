# G4: Astra's review of the replay and readout diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G4 diff (21 files against `g3-editor`), 2026-10-26. Astra ran lint
(clean), the Round 1 pilot (20 of 20, every episode count matching G2's table), the build's type check (Vite's
temporary config write hit the sandbox, as always), a node probe of `reportTable` over 250 weeks and 5,000 frames
including 212 closed-day frames (every bonus day cell matched the step deltas, summed to the week cell and to
`totals.reward`, the closure hit included), a probe of `replayFrame` against `step.ts` at drop-off, in the floor
blocks, at pickup and on a closed day (no wrong field), a mocked lifecycle probe of the token and `clearRun`, and a
drawing-call probe of the header and the path. Five findings, none high: four accepted, one accepted in part. No
production defect in the learner, the table or the frame sources.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Medium: `ReplayFrame.bookings` never reached the screen; `all` and `safe` drew the same header (the plan review's finding 8 asked for the booking choice) | **Accepted** | The plan line reads "20 asked · 20 accepted, every booking · premium rate · crew 1 scheduled, 1 in", "15 accepted, capped at the legal ratio", "10 accepted, capped at a safe ratio" (the choice in words, never the number behind it, D44). `planParts` and `planWords` are exported and tested on the covered, closed, safe and legal weeks; BRIEF 10.2 and the plan carry the wording. |
| 2 | Medium: the e2e's pixel test could pass on any yard and the clearing check never looked at the canvas; the twin's training before the edit could outlast the playback, leaving no producer to cancel | **Accepted in part** | The editor test now clicks "Watch the week again", waits 150 ms, confirms the yard is drawn, edits, and after two frames and a resize asserts the placeholder's pixels (under 2 % differ) along with the attributes. Week identity between the sentence and the replay is not asserted from the e2e: the page has no hook for the trace, `showWeek` is the one function that sets both, and Astra's own lifecycle probe confirmed it. |
| 3 | Medium: sampling the status twice a second from after the click could miss a click-time sentence overwritten 100 ms later | **Accepted** | A mutation observer is installed on `#status` before the click and records every write; the test asserts the pre-click text, over 50 writes, and every later text in the student's form with none of the learner's words. |
| 4 | Low: a resolved walk with no dogs (a zero-request configuration) drew no staffer on the path | **Accepted** | `drawPath` draws the staffer whenever `walkingStaff` is above 0; the dogs and the leashes depend on their count. |
| 5 | Low: the geometry poll's successful sample did not require the report to be hidden or the replay to be in its training week | **Accepted** | One polled sample must have the report hidden, `data-week` "training", the status within 16 px of the top, both canvases inside 768 px and no horizontal scroll. |

Astra also noted what remains outside G4 on purpose: the title "Reward the Pack", the Seed and Fast controls (D39,
G5) and the invalid-seed message (a teacher's control until G5). Not reviewed by Astra: browser pixels, the table's
scrolling on a phone, smartboard readability, Chromebook performance, the owner's acceptance; it did not run vitest
or Playwright and edited no files.
