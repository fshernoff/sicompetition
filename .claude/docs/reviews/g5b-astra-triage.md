# G5b: Astra's review of the person flow diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G5b diff, 2026-10-28. Astra ran lint (clean) and the Round 1 pilot (20
of 20). It found no learner's word in the runtime strings, the stylesheet's content strings or the aria labels, and
confirmed the normal path trains unpaced, draws only the final week and gates the export on the published readout.
Seven findings, none high: six accepted, one in part.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Medium: a drawing failure in the error path's recovery `redraw` throws out of the catch and leaves the controls locked; the preparing redraw ran outside the guard | **Accepted** | The whole locked lifecycle (the preparing redraw, training, playback, the readout) is one guarded operation; unlocking is in an owner-checked `finally`; the recovery drawing is best effort. |
| 2 | Medium: the pilot's row used the post-readout time while `page.result`, the check line and the export kept the earlier one | **Accepted** | The pilot publishes its own timing back into `page.result` and rewrites the check line from it, so the row, the check line and the export agree. |
| 3 | Medium: below 900 px the yard lost its height budget (an 800 × 600 window overflows) | **Accepted** | The narrow rule keeps the height-derived width and adds the 640 px cap: `min(100%, 640px, max(320px, room × 32 / 27))`. Computed, not measured in a browser. |
| 4 | Medium: sampling the 1.3 s wait through separate round trips can miss it or straddle its end | **Accepted** | A sampler installed before the click runs every animation frame inside the page while the status says the GM is getting ready, recording the yard's pixels, the readout, the table and `data-week` together; the e2e asserts every sample (17 frames for Round 1, 79 for the unsettled plan). |
| 5 | Medium: the `data-week` assertions allowed an extra state between preparing and final; `data-plays` counts `playWeek` calls, not drawing | **Accepted in part** | The transitions are asserted exactly (none, preparing, final after collapsing repeats). The sampler of 4 now proves every frame drawn while training shows no yard. `data-plays` stays a count of the click's playbacks (Watch the week again is not counted, by design); no controlled frame clock. |
| 6 | Low: an error from a stale run could write the error line over a newer run's status | **Accepted** | The catch returns before any write when the token has moved. |
| 7 | Low: the post-clear resize repeated the mid-week size, so it no longer resized | **Accepted** | It resizes to 1100 × 760 and waits four frames. |

Not reviewed by Astra: the browser rendering, the Chromebook's wait, the capture; no build, vitest or Playwright.
