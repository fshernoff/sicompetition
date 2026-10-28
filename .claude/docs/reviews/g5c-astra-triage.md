# G5c: Astra's review of the staged diff and the screenshots, triaged

`Tools/Agent/astra.sh -e high` over `git diff --cached` (the redesign, the picks, the art, the docs) and seven
screenshots at 1366 × 768 (`Temp/g5c-shots/`: load, picks, preparing, mid-week, scorecard, report, tray), against
the concept, 2026-10-28. Astra held the visual sign-off ("not yet"), found the core prediction logic sound (the
click's copy, the locks, the clears, the rerun, the pilot), no points words, no safe-ratio leak, local fonts and
images only, and checked every plan-review fold. Fifteen findings: seven on the look, eight on correctness; fourteen
accepted, one in part. All went into round three of the packages.

| # | Finding (short) | Verdict | What changed |
|---|---|---|---|
| L1 | The yard mixes art systems: painterly lawn, glossy sprites, a flat tiled path, an oversized staffer, overlaps | **Accepted** | WP2: the strip outside the fence painted from the yard art's own lawn (no tiles, no scalloped hedge); the staffer back to about 1.1× a standing dog; dogs on a jittered grid with a minimum spacing (overlap only at 25+); contact shadows, one light, a warm edge so the cutouts sit in the painting. |
| L2 | Activity chips at 12.8 px in the report; evidence too small to project | **Accepted** | WP3: the Activities cell as block rows at ≥ 15 px, drop-off muted; every report text ≥ 15 px; the Week column in view at 1366. |
| L3 | The scorecard has no reading order | **Accepted** | WP1: "You called N of 5." and the comparison lead; the sentence quieter beneath; the Why and the two buttons a compact footer; the plan card used in the result state. |
| L4 | Round 1 opens with a wall of disabled sliders and switches | **Accepted** | WP1: a locked preset reads as a read-only plan (state pills "On"/"Off", the amounts as text); the disabled native inputs stay in the DOM, visually hidden, for the tests and assistive technology. |
| L5 | One measure, three icons (triangle, "!", flag) | **Accepted** | WP1 exports the six icons and measure colour tokens; WP2's HUD and WP3's tiles use the same shapes and colours. |
| L6 | The hero's crop cuts dogs and crowds the text | **Accepted** | WP1 art-directs the crop (whole silhouettes, a calm centre), up to 170 px if the fold holds. |
| L7 | Preparing reads as a loading overlay with the message twice | **Accepted** | The bubble is the one dominant message; WP2 moves the canvas line to a small caption near the bottom (text only, still under the 2% pixel check); WP1 makes the yard behind it legible as the yard before opening. |
| C1 | The art is awaited after Monday is drawn: a cold load could flash a vector frame | **Accepted** | WP1 awaits the art before any frame of the week is drawn (it counts in the engine's time, said in a comment); the pilot's contract unchanged. |
| C2 | Reduced motion skips the vector fallback | **Accepted** | WP2 applies the motion policy before choosing the renderer and checks the image-failure path. |
| C3 | Round 3's geometry and asset readiness not in the e2e | **Accepted** | A new e2e test: Round 1 and Round 3 with all six measures on, after `document.fonts.ready` and every image decoded, the button's bottom ≤ 700 px, unmoved under the open tray, no horizontal scroll. |
| C4 | The sliders' units hidden from assistive technology | **Accepted** | WP1: the accessible value is the whole incentive ("plus 10 dollars per 100 dollars of profit"). |
| C5 | Contrast below 4.5:1: the Why placeholder, white on the coral Closed sign; faint chip borders | **Accepted** | WP1 darkens the placeholder and the chip borders (≥ 3:1); WP2 darkens the sign to ≥ 4.5:1 with white. |
| C6 | The mixed-scorecard assertion accepts anything; the pilot, "Make a new prediction" and the rerun untested | **Accepted** | The edited plan's picks now call two and miss two or three, and the e2e requires both kinds and matching counts; the pilot leaves no scorecard, a disabled button and the hint; "Make a new prediction" clears with the picks kept, the idle status and the export off; the rerun is scored. |
| C7 | Five faces in four weights against a budget of three | **Accepted in part** | WP1 cuts to three files (Fredoka 600, Nunito 700 and 800); the woff fallbacks Vite also emits are never fetched by a browser that takes woff2. |
| C8 | The teacher guide lacks the pick definitions; HANDOFF has no G5c art item | **Accepted** | The guide says a closed day never counts as accepting every booking or as a solo day and the rate is over open days; HANDOFF carries the shipped-art approval as the owner's, separate from the lesson disclosure he confirmed. |

Not reviewed by Astra: the binary diffs, real browser and screen-reader behaviour, the Chromebook and the projector,
the art and font licences.

## Second look review (the screenshots after round three)

Astra: L2, L3, L4, L6 resolved; L1 (a lawn seam under the front fence, overlaps at 18 dogs), L5 (the report's icons
teal where the plan and the HUD use the measures' colours) and L7 (the waiting caption repeats the bubble) improved,
not resolved. The bar: "not yet", five polish items.

| # | Item | Verdict | What changed |
|---|---|---|---|
| 1 | The lawn seam; 18 dogs overlapping | **Accepted** | WP2 feathers the strip into the yard art's foliage under a soft fence shadow; spots for 12 to 20 dogs pushed apart until no two drawn boxes overlap (computed once per count); shrinking only from about 26. |
| 2 | Selected chips change size; check badges overlap the row above | **Accepted** | WP1: one padding for every chip, the check inside the chip's right end; sizes measured identical before and after. |
| 3 | The Teacher tab covers the report's Week column | **Accepted in part** | A compact 98 × 28 px pill and 84 px of bottom padding, so the end of any scroll is clear; mid-scroll it still floats (the one teacher's control on the student's screen, D46). |
| 4 | The report's icons not in the measures' colours | **Accepted** | Each tile's icon in its measure's token (the bonus in coral). |
| 5 | Shorten the waiting caption to "Monday · before opening" | **Accepted in part** | The words are the bible's (sections 1 and 10.2) and stay; the caption is smaller with a thinner, softer outline, so the bubble owns the message. |

