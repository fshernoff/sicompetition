# G5: Astra's review of the teacher panel diff, triaged

`Tools/Agent/astra.sh -e high` over the staged G5 diff (26 files against `g4b-words`), 2026-10-26. Astra ran lint
(clean) and the Round 1 pilot (20 of 20, every count matching G2), probed `paceSlice` against the pre-G5 arithmetic
with irregular frames (equivalent) and the export's JSON round trip (valid), and read the lifecycle (the prediction,
seed, round and applied speed retained; clears invalidate the export and the replay's key; per-seed pilot setups; the
export never re-runs the week and makes no request; the check line's conditions agree with the Trainer). Eight
findings, none a training or export regression: seven accepted, one accepted in part.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| 1 | Medium: the capture spawns `npx`, accepts any answer on its port (an older server would be recorded) and kills only the wrapper, which can leave Vite running | **Accepted** | The script refuses to start when something already answers at its address, spawns `node_modules/vite/bin/vite.js` with `process.execPath` so the process it holds is the server, fails if that process exits before answering, and stops it and waits for its exit at the end. |
| 2 | Medium: two captures in the same minute target one filename and `renameSync` overwrites | **Accepted** | The stamp carries seconds and an existing destination is refused (the recording stays at Playwright's path). |
| 3 | Medium: H6's "up to 10 in 100 of them" reads as a hard maximum; section 6 says an expected count with the fraction drawn (19 dogs at cleanliness 0 can send two home) | **Accepted** | H6 now says "on average up to 10 in 100 of them when the floor is at its dirtiest, fewer the cleaner it is, with the fraction of a case settled by a draw"; the pinned sentence follows. |
| 4 | Medium: the tray's height is measured on open and on window resize only; a check line that wraps at a narrow width leaves the padding stale | **Accepted** | A `ResizeObserver` on the tray re-measures whenever its size changes; `rejectSeed` measures after writing its message. |
| 5 | Low: "cleaning changes nothing" (H3) and "the full incident chance" (H9) were literals: `energy.delta.clean` and `activityIncidentMultiplier.freePlay` were not read | **Accepted** | Both read the config (`deltaWords`, `chanceTimes`) and keep the default wording; three patch cases added (clean +5, free play 0.8 in H9 and in H3). |
| 6 | Low: the pilot's "Pilot seed 2 of 2 · " prefix reaches `#status` outside the tray | **Accepted in part** | Inherited and intended: the pilot mode is the harness's page twin (D31), never a lesson page. Section 11 now says so (its table, its status prefix, never paced) instead of moving the prefix. |
| 7 | Low: the open-tray assertion compared the tray's top with the button's bottom measured before the tray opened | **Accepted** | The e2e measures the button again with the tray open, asserts it has not moved, and compares that measurement with the tray's top. |
| 8 | Low: `expect(text).not.toMatch(/NaN|Infinity/)` cannot see them: JSON writes both as `null` | **Accepted** | The test walks every number in the document before serialising and asserts `Number.isFinite` (over 1,800 numbers in the fixture). |

Not reviewed by Astra: a fresh build, vitest, Playwright, the download in a browser, the recorded video, Netlify,
the Chromebook; it used the e2e's logged geometry and edited no files.
