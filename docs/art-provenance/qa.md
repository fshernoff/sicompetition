# Art QA ledger (D58)

Every image in `src/assets/art/` ships only with three clean passes on these exact bytes: one by the main thread,
one by Astra, one by a fresh Sonnet agent. Each reader works from `Tools/Agent/art_qa.py` crops (every figure at 2×
or more, on cream and on near-black), never from the page or a downscaled view, against the checklist in D58:

- every animal: one head, two eyes, two ears, one nose, one mouth, four legs with one paw each, one tail (or none, by
  breed), no merged or doubled parts, the breed readable;
- every person: an adult, one head, two arms, two hands whose fingers make sense, two legs, clothes continuous;
- the GM: the same character in every pose;
- no text, letters or logos; no halo, fringe or speck on light or dark; one light direction and one finish across the
  set; no figure cut by the image's edges or the page's crop (scenery may run off the frame).

`file` is the path from `src/assets/art/` (`hero-yard.webp`, `cast/corgi-red-moving.webp`, `set/board.webp`). `sha` is the first 12 hex digits of the file's SHA-256 (`shasum -a 256 <file> | cut -c1-12`): a regenerated or
re-encoded file needs three new passes. `verdict` is `clean` or `defect: <what and where>`. `tests/art/qa.test.ts`
holds the page to this.

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| hero-yard.webp | 3ec45323bf0f | main thread | 2026-10-28 | defect: the poodle at the right edge has two heads | found by the owner; no G5c image had a figure-by-figure pass |

## The fallback (branch `g5c-fallback`, WP0)

G5c with the header repaired. Rows here name the fallback's file; they do not count for `src/assets/art/` on this
branch.

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| fallback: hero-yard.webp | (1998 px crop) | main thread | 2026-10-28 | clean | first crop, x 0 to 1998: golden, collie, corgi; the main thread missed what the other two found |
| fallback: hero-yard.webp | (1998 px crop) | Astra | 2026-10-28 | defect: the golden's forelegs (x 305 to 380) do not trace into two legs; an orange paw-like shape under the chest | confirmed at 4× by the main thread |
| fallback: hero-yard.webp | (1998 px crop) | Sonnet | 2026-10-28 | defect: ghost-coloured hind paws on the collie and the corgi; a soft patch in the right tree crown | the crop was dropped |
| fallback: hero-yard.webp | cf71a19dc0e0 | main thread | 2026-10-28 | clean | x 670 to 1740: fence, bushes, sky, grass; no figures, no text, no artefact; soft from the 1.28× scale on the page |
| fallback: hero-yard.webp | cf71a19dc0e0 | Sonnet | 2026-10-28 | clean | no figures; no text; one finish; notes the fence's slight bow and the baked cream fade |
| fallback: hero-yard.webp | cf71a19dc0e0 | Astra | 2026-10-28 | defect: scenery cut at the left and right edges | the checklist's "nothing cut off" read literally; Astra found the rest clean and proposed the wording now in the checklist; re-run below |
| fallback: hero-yard.webp | cf71a19dc0e0 | Astra | 2026-10-28 | clean | re-run with the edge rule clarified (scenery may run off the frame); no figures, no text, one finish |
