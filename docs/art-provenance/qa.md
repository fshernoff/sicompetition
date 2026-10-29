# Art QA ledger (D58)

Every image in `src/assets/art/` ships only with three clean passes on these exact bytes: one by the main thread,
one by Astra, one by a fresh Sonnet agent. Each reader sees every figure at least twice the size the page draws it (the images are made at 2× the page's
size, so the image's own pixels count; `Tools/Agent/art_qa.py` crops are 2× more), on cream and on near-black,
never only from the page or a downscaled view, against the checklist in D58:

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

## G5d: the set and the GM (WP4b, modelled in code, rendered offline)

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| set/board.webp | aa6b4e08f07f | main thread | 2026-10-28 | clean | full image at 0.86×, door, planter and gate at 2× on cream: clubhouse, fence, gate, bushes, bowl, path, soil edge coherent; square corners; no text; no figure; no halo |
| set/gm-ready.webp | b1b8da603706 | main thread | 2026-10-28 | clean | on cream and navy at 2×: faceted orb, band edge clean, no face, no halo; the state reads |
| set/gm-running.webp | 29701128ce03 | main thread | 2026-10-28 | clean | on cream and navy at 2×: faceted orb, band edge clean, no face, no halo; the state reads |
| set/gm-done.webp | 1907734cb8d2 | main thread | 2026-10-28 | clean | on cream and navy at 2×: the orb settled with a ring of light under it; band edge clean; no face, no halo above; low contrast on navy (use on the light rail) |
| set/gm-page-ready.webp | 82dc10ba9d63 | main thread | 2026-10-28 | clean | on cream and navy at 2×: faceted orb, band edge clean, no face, no halo; the state reads |
| set/gm-page-running.webp | e53d6dbde511 | main thread | 2026-10-28 | clean | on cream and navy at 2×: faceted orb, band edge clean, no face, no halo; the state reads |
| set/gm-page-done.webp | 41e6d014175c | main thread | 2026-10-28 | clean | on cream and navy at 2×: the orb settled with a ring of light under it; band edge clean; no face, no halo above; low contrast on navy (use on the light rail) |

## G5d: the cast (WP4a, generated)

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| cast/corgi-red-moving.webp | 9cf34cbd5a52 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/corgi-red-sitting.webp | 5fec9681b0ab | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/corgi-red-asleep.webp | 75f4ef24b9e1 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/corgi-sable-moving.webp | 033b668205c6 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/corgi-sable-sitting.webp | 598bad029eec | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/corgi-sable-asleep.webp | e8c21402c6f7 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/beagle-tricolour-moving.webp | c51424097ea4 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/beagle-tricolour-sitting.webp | d2f6d4749dcc | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/beagle-tricolour-asleep.webp | de188d479fd7 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/beagle-tan-moving.webp | 68a246d3740f | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/beagle-tan-sitting.webp | 389adf871597 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/beagle-tan-asleep.webp | 6bddb4d9ce24 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/collie-black-moving.webp | c296c9a98938 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/collie-black-sitting.webp | e276b5c2ba6f | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/collie-black-asleep.webp | 0f9302fe8f61 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/collie-red-moving.webp | 40ee259f6868 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/collie-red-sitting.webp | b8e3cc5677e2 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/collie-red-asleep.webp | b68a624cf019 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-brown-moving.webp | 754c38912cde | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-brown-sitting.webp | 2eeb7a3b5e92 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-brown-asleep.webp | a777c5b9cad7 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-black-moving.webp | 47ff2b2a063e | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-black-sitting.webp | a87ec6d596c6 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-black-asleep.webp | 33ff501640e6 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-cream-moving.webp | 2e24cc234ae9 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-cream-sitting.webp | 3466b55725fa | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/poodle-cream-asleep.webp | 68a264772b1d | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-black-moving.webp | 5ff67276e9a5 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-black-sitting.webp | 1ce903e286cc | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-black-asleep.webp | 7ab236e055ae | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-chocolate-moving.webp | daec0ae37f77 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-chocolate-sitting.webp | 5824fd2b65ef | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-chocolate-asleep.webp | 9ed4a79a7d2f | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-yellow-moving.webp | 99957d42c4ac | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-yellow-sitting.webp | dabb64aacb5c | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/lab-yellow-asleep.webp | 9d38fdc9f769 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/golden-gold-moving.webp | be47e00b8ae6 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/golden-gold-sitting.webp | 15d321073c58 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/golden-gold-asleep.webp | b782e45e2977 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/golden-red-moving.webp | ba78d64ebea1 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/golden-red-sitting.webp | 0ec8c1ff2a1d | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/golden-red-asleep.webp | d122851c6ce3 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/crew-leash.webp | db4af6a5305f | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/crew-ball.webp | 0cdad6f48b5d | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| cast/crew-mop.webp | 0e9a69e045e9 | main thread | 2026-10-28 | clean | at the image's own size (2× the page) on cream and near-black, its breed's sheet: one head, the pose's legs and paws, the tail by breed, no halo, no text |
| set/board.webp | aa6b4e08f07f | Astra | 2026-10-28 | defect: roof apex and left slab edge clipped; a coloured fringe under the lower-right slab | measured by the main thread: no opaque pixel on any edge (content from 5 px in), the "fringe" is the neutral drop shadow; the margin goes to 24 px in the re-render |
| set/gm-ready.webp | b1b8da603706 | Astra | 2026-10-28 | clean |  |
| set/gm-running.webp | 29701128ce03 | Astra | 2026-10-28 | clean |  |
| set/gm-done.webp | 1907734cb8d2 | Astra | 2026-10-28 | defect: reads as running with a flat yellow selection ring underneath |  |
| set/gm-page-ready.webp | 82dc10ba9d63 | Astra | 2026-10-28 | clean |  |
| set/gm-page-running.webp | e53d6dbde511 | Astra | 2026-10-28 | clean |  |
| set/gm-page-done.webp | 41e6d014175c | Astra | 2026-10-28 | defect: ambiguous done state; a flat selection-like ring over the lower orb, placed unlike gm-done |  |
| set/board.webp | aa6b4e08f07f | Sonnet | 2026-10-28 | defect: hard vertical tone steps in the lawn under the back-right fence posts (x~1331, y~440-663) and beside the small bush (x~1400); the big back bush notched and chopped (x~740-870, y~170-300); a cypress sliver behind the clubhouse; the faint shadow clipped at the right edge | the main thread missed these at 0.86×: confirmed |
| set/gm-ready.webp | b1b8da603706 | Sonnet | 2026-10-28 | clean |  |
| set/gm-running.webp | 29701128ce03 | Sonnet | 2026-10-28 | clean |  |
| set/gm-done.webp | 1907734cb8d2 | Sonnet | 2026-10-28 | defect: a flat unshaded ring (another finish); the orb 69 px lower than ready and running; the ring detached here and wrapping in the page size |  |
| set/gm-page-ready.webp | 82dc10ba9d63 | Sonnet | 2026-10-28 | clean | layout: the orb sits at the top with 33 px empty below |
| set/gm-page-running.webp | e53d6dbde511 | Sonnet | 2026-10-28 | clean |  |
| set/gm-page-done.webp | 41e6d014175c | Sonnet | 2026-10-28 | defect: a flat ring wrapping the orb like a Saturn ring; differs from gm-done; done is only running plus a ring |  |
| cast/corgi-red-moving.webp | 9cf34cbd5a52 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/corgi-red-sitting.webp | 5fec9681b0ab | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/corgi-red-asleep.webp | 75f4ef24b9e1 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/corgi-sable-moving.webp | 033b668205c6 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/corgi-sable-sitting.webp | 598bad029eec | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/corgi-sable-asleep.webp | e8c21402c6f7 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/beagle-tricolour-moving.webp | c51424097ea4 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/beagle-tricolour-sitting.webp | d2f6d4749dcc | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/beagle-tricolour-asleep.webp | de188d479fd7 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/beagle-tan-moving.webp | 68a246d3740f | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/beagle-tan-sitting.webp | 389adf871597 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/beagle-tan-asleep.webp | 6bddb4d9ce24 | Astra | 2026-10-28 | defect: gray recoloring residue on the upper back and beside the white shoulder collar. | the 2× crops and the breed sheets |
| cast/collie-black-moving.webp | c296c9a98938 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/collie-black-sitting.webp | e276b5c2ba6f | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/collie-black-asleep.webp | 0f9302fe8f61 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/collie-red-moving.webp | 40ee259f6868 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/collie-red-sitting.webp | b8e3cc5677e2 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/collie-red-asleep.webp | b68a624cf019 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-brown-moving.webp | 754c38912cde | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-brown-sitting.webp | 2eeb7a3b5e92 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-brown-asleep.webp | a777c5b9cad7 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-black-moving.webp | 47ff2b2a063e | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-black-sitting.webp | a87ec6d596c6 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-black-asleep.webp | 33ff501640e6 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-cream-moving.webp | 2e24cc234ae9 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-cream-sitting.webp | 3466b55725fa | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/poodle-cream-asleep.webp | 68a264772b1d | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-black-moving.webp | 5ff67276e9a5 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-black-sitting.webp | 1ce903e286cc | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-black-asleep.webp | 7ab236e055ae | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-chocolate-moving.webp | daec0ae37f77 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-chocolate-sitting.webp | 5824fd2b65ef | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-chocolate-asleep.webp | 9ed4a79a7d2f | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/lab-yellow-moving.webp | 99957d42c4ac | Astra | 2026-10-28 | defect: dark recoloring fleck on the forehead edge; coat-yellow nose blends into the muzzle. | the 2× crops and the breed sheets |
| cast/lab-yellow-sitting.webp | dabb64aacb5c | Astra | 2026-10-28 | defect: dark recoloring remnants on the forehead and between the legs; coat-yellow nose blends into the muzzle. | the 2× crops and the breed sheets |
| cast/lab-yellow-asleep.webp | 9d38fdc9f769 | Astra | 2026-10-28 | defect: coat-yellow nose lacks a clear boundary against the muzzle; harsh black remnants along ear and tucked-leg creases. | the 2× crops and the breed sheets |
| cast/golden-gold-moving.webp | be47e00b8ae6 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/golden-gold-sitting.webp | 15d321073c58 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/golden-gold-asleep.webp | b782e45e2977 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/golden-red-moving.webp | ba78d64ebea1 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/golden-red-sitting.webp | 0ec8c1ff2a1d | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/golden-red-asleep.webp | d122851c6ce3 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/crew-leash.webp | db4af6a5305f | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/crew-ball.webp | 0cdad6f48b5d | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/crew-mop.webp | 0e9a69e045e9 | Astra | 2026-10-28 | clean | the 2× crops and the breed sheets |
| cast/crew2-leash.webp | 5d9261ba81b5 | main thread | 2026-10-28 | clean | at 2× the image (4× the page) on cream and near-black: an adult man, two arms and hands coherent on the leash, two legs, uniform continuous, no halo, no text |
| cast/crew2-ball.webp | 5b1feea92c5f | main thread | 2026-10-28 | clean | at 2× the image (4× the page) on cream and near-black: an adult man, two arms and hands coherent on the ball, two legs, uniform continuous, no halo, no text |
| cast/crew2-mop.webp | 3c066a3eab13 | main thread | 2026-10-28 | clean | at 2× the image (4× the page) on cream and near-black: an adult man, two arms and hands coherent on the mop, two legs, uniform continuous, no halo, no text |
| cast/corgi-red-moving.webp | 9cf34cbd5a52 | Sonnet | 2026-10-28 | defect: only three legs show (far foreleg missing); tail is a long plume, inconsistent with the stub tail in sitting and asleep | the 2× crops |
| cast/corgi-red-sitting.webp | 5fec9681b0ab | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/corgi-red-asleep.webp | 75f4ef24b9e1 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/corgi-sable-moving.webp | 033b668205c6 | Sonnet | 2026-10-28 | defect: only three legs show (far foreleg missing); tail is a long plume, inconsistent with the stub tail in sitting and asleep | the 2× crops |
| cast/corgi-sable-sitting.webp | 598bad029eec | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/corgi-sable-asleep.webp | e8c21402c6f7 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/beagle-tricolour-moving.webp | c51424097ea4 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/beagle-tricolour-sitting.webp | d2f6d4749dcc | Sonnet | 2026-10-28 | defect: far hind paw shows as a grey/orange stub between the front legs (about x70-75, y55-65) | the 2× crops |
| cast/beagle-tricolour-asleep.webp | de188d479fd7 | Sonnet | 2026-10-28 | defect: small light speck and notch on the back near the hip (about x28, y17) | the 2× crops |
| cast/beagle-tan-moving.webp | 68a246d3740f | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/beagle-tan-sitting.webp | 389adf871597 | Sonnet | 2026-10-28 | defect: leftover dark grey saddle patch on the shoulder (about x66, y37); far hind paw stub between the front legs | the 2× crops |
| cast/beagle-tan-asleep.webp | 6bddb4d9ce24 | Sonnet | 2026-10-28 | defect: light/grey speck by the hip (about x28, y17); a leftover dark wedge near the neck (about x70, y8) | the 2× crops |
| cast/collie-black-moving.webp | c296c9a98938 | Sonnet | 2026-10-28 | defect: pink speck on the underbelly (about x109, y85) | the 2× crops |
| cast/collie-black-sitting.webp | e276b5c2ba6f | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/collie-black-asleep.webp | 0f9302fe8f61 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/collie-red-moving.webp | 40ee259f6868 | Sonnet | 2026-10-28 | defect: pink speck on the underbelly (about x109, y85) | the 2× crops |
| cast/collie-red-sitting.webp | b8e3cc5677e2 | Sonnet | 2026-10-28 | defect: black sliver on the right edge of the white chest (about x82, y81) on a red coat | the 2× crops |
| cast/collie-red-asleep.webp | b68a624cf019 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/poodle-brown-moving.webp | 754c38912cde | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/poodle-brown-sitting.webp | 2eeb7a3b5e92 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/poodle-brown-asleep.webp | a777c5b9cad7 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/poodle-black-moving.webp | 47ff2b2a063e | Sonnet | 2026-10-28 | defect: olive/yellow fringe along the near hind leg on dark (about x65, y91-97) | the 2× crops |
| cast/poodle-black-sitting.webp | a87ec6d596c6 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/poodle-black-asleep.webp | 33ff501640e6 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/poodle-cream-moving.webp | 2e24cc234ae9 | Sonnet | 2026-10-28 | defect: light halo/rim along the top contour, on cream and dark | the 2× crops |
| cast/poodle-cream-sitting.webp | 3466b55725fa | Sonnet | 2026-10-28 | defect: light halo/rim along the top contour, on cream and dark | the 2× crops |
| cast/poodle-cream-asleep.webp | 68a264772b1d | Sonnet | 2026-10-28 | defect: light halo/rim along the top contour, on cream and dark | the 2× crops |
| cast/lab-black-moving.webp | 5ff67276e9a5 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/lab-black-sitting.webp | 1ce903e286cc | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/lab-black-asleep.webp | 7ab236e055ae | Sonnet | 2026-10-28 | defect: dark hook/drip below the far ear at the right edge (about x156, y64) | the 2× crops |
| cast/lab-chocolate-moving.webp | daec0ae37f77 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/lab-chocolate-sitting.webp | 5824fd2b65ef | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/lab-chocolate-asleep.webp | 9ed4a79a7d2f | Sonnet | 2026-10-28 | defect: dark hook/drip below the far ear at the right edge (about x156, y64) | the 2× crops |
| cast/lab-yellow-moving.webp | 99957d42c4ac | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/lab-yellow-sitting.webp | dabb64aacb5c | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/lab-yellow-asleep.webp | 9d38fdc9f769 | Sonnet | 2026-10-28 | defect: dark hook/drip below the far ear at the right edge (about x156, y64) | the 2× crops |
| cast/golden-gold-moving.webp | be47e00b8ae6 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/golden-gold-sitting.webp | 15d321073c58 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/golden-gold-asleep.webp | b782e45e2977 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/golden-red-moving.webp | ba78d64ebea1 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/golden-red-sitting.webp | 0ec8c1ff2a1d | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/golden-red-asleep.webp | d122851c6ce3 | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/crew-leash.webp | db4af6a5305f | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/crew-ball.webp | 0cdad6f48b5d | Sonnet | 2026-10-28 | clean | the 2× crops |
| cast/crew-mop.webp | 0e9a69e045e9 | Sonnet | 2026-10-28 | clean | the 2× crops |

Second render of the set (WP4b, after the readers' findings):

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| set/board.webp | 52b91d3d8813 | main thread | 2026-10-29 | clean | native pixels (2× the page) in four quadrants on cream: no lawn steps, round bushes, both cypresses whole, path, gate, soil edge coherent, 24 px margin |
| set/gm-ready.webp | fe2d83398fc1 | main thread | 2026-10-29 | clean | at 2× the image on cream and white: the orb in the same place in all states; dim amber, bright amber, green done; band edge clean; no ring, face or halo |
| set/gm-running.webp | 17348d3a544a | main thread | 2026-10-29 | clean | at 2× the image on cream and white: the orb in the same place in all states; dim amber, bright amber, green done; band edge clean; no ring, face or halo |
| set/gm-done.webp | a45aa92689db | main thread | 2026-10-29 | clean | at 2× the image on cream and white: the orb in the same place in all states; dim amber, bright amber, green done; band edge clean; no ring, face or halo |
| set/gm-page-ready.webp | d4b7bfb2b2d9 | main thread | 2026-10-29 | clean | at 2× the image on cream and white: the orb in the same place in all states; dim amber, bright amber, green done; band edge clean; no ring, face or halo |
| set/gm-page-running.webp | 23e8fa0b7bc1 | main thread | 2026-10-29 | clean | at 2× the image on cream and white: the orb in the same place in all states; dim amber, bright amber, green done; band edge clean; no ring, face or halo |
| set/gm-page-done.webp | 50c2056da31a | main thread | 2026-10-29 | clean | at 2× the image on cream and white: the orb in the same place in all states; dim amber, bright amber, green done; band edge clean; no ring, face or halo |
| set/board.webp | 52b91d3d8813 | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/gm-ready.webp | fe2d83398fc1 | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/gm-running.webp | 17348d3a544a | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/gm-done.webp | a45aa92689db | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/gm-page-ready.webp | d4b7bfb2b2d9 | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/gm-page-running.webp | 23e8fa0b7bc1 | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/gm-page-done.webp | 50c2056da31a | Astra | 2026-10-29 | clean | the second render: full image and the 2× crops |
| set/board.webp | 52b91d3d8813 | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks; minor: a 1 px hairline at 87-94% alpha along the path's front curb, visible only on magenta |
| set/gm-ready.webp | fe2d83398fc1 | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks |
| set/gm-running.webp | 17348d3a544a | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks |
| set/gm-done.webp | a45aa92689db | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks |
| set/gm-page-ready.webp | d4b7bfb2b2d9 | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks |
| set/gm-page-running.webp | 23e8fa0b7bc1 | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks |
| set/gm-page-done.webp | 50c2056da31a | Sonnet | 2026-10-29 | clean | the second render: full image, the crops, 2× to 14× zooms on cream, near-black, white and magenta; alpha and flood-fill checks |

Round 2 of the cast (WP4a's fixes):

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| cast/beagle-tricolour-moving.webp | 0c67ddc98005 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/beagle-tricolour-sitting.webp | 476c8055863d | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/beagle-tricolour-asleep.webp | beadb9c7cff0 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/collie-black-moving.webp | 6037dba489ec | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/collie-black-sitting.webp | 6a2edcefa454 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/collie-black-asleep.webp | 41f46cd4d795 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/collie-red-moving.webp | 9b86aae70f7f | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/collie-red-sitting.webp | aa9cc6d2cc26 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/collie-red-asleep.webp | eb90dcd7e185 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/corgi-red-moving.webp | b5134e6eb61d | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/corgi-red-sitting.webp | 713f33476cbd | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/corgi-red-asleep.webp | 3e595c75e601 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/corgi-sable-moving.webp | 4ed78a5f9a73 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/corgi-sable-sitting.webp | 08612af0b812 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/corgi-sable-asleep.webp | 68f7c6917b02 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/lab-black-asleep.webp | 9d08b8e91c7f | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/lab-chocolate-asleep.webp | 6a8e8f6785ef | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/lab-yellow-moving.webp | 0c82acb8066a | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/lab-yellow-sitting.webp | 7719a501385f | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/lab-yellow-asleep.webp | 4bc6f8b727a2 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/poodle-black-moving.webp | 453fca12f563 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/poodle-black-sitting.webp | ea2cd62b24d8 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/poodle-black-asleep.webp | ee6656d11bf2 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/poodle-cream-moving.webp | 0a3fbe15795d | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/poodle-cream-sitting.webp | b2e372942906 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/poodle-cream-asleep.webp | 5e3c25399555 | main thread | 2026-10-29 | clean | at 2× the image (4× the page) on cream and near-black, its breed's sheet |
| cast/beagle-tricolour-moving.webp | 0c67ddc98005 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/beagle-tricolour-sitting.webp | 476c8055863d | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/beagle-tricolour-asleep.webp | beadb9c7cff0 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/collie-black-moving.webp | 6037dba489ec | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/collie-black-sitting.webp | 6a2edcefa454 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/collie-black-asleep.webp | 41f46cd4d795 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/collie-red-moving.webp | 9b86aae70f7f | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/collie-red-sitting.webp | aa9cc6d2cc26 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/collie-red-asleep.webp | eb90dcd7e185 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/corgi-red-moving.webp | b5134e6eb61d | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/corgi-red-sitting.webp | 713f33476cbd | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/corgi-red-asleep.webp | 3e595c75e601 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/corgi-sable-moving.webp | 4ed78a5f9a73 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/corgi-sable-sitting.webp | 08612af0b812 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/corgi-sable-asleep.webp | 68f7c6917b02 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/lab-black-asleep.webp | 9d08b8e91c7f | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/lab-chocolate-asleep.webp | 6a8e8f6785ef | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/lab-yellow-moving.webp | 0c82acb8066a | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/lab-yellow-sitting.webp | 7719a501385f | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/lab-yellow-asleep.webp | 4bc6f8b727a2 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/poodle-black-moving.webp | 453fca12f563 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/poodle-black-sitting.webp | ea2cd62b24d8 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/poodle-black-asleep.webp | ee6656d11bf2 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/poodle-cream-moving.webp | 0a3fbe15795d | Astra | 2026-10-29 | defect: pale fringe along belly and lower-leg contours on near-black. | round 2 of the cast: fresh 2× crops |
| cast/poodle-cream-sitting.webp | b2e372942906 | Astra | 2026-10-29 | defect: pale fringe around tail pom and lower haunch on near-black. | round 2 of the cast: fresh 2× crops |
| cast/poodle-cream-asleep.webp | 5e3c25399555 | Astra | 2026-10-29 | defect: pale fringe beneath tail pom and along lower ear edge on near-black. | round 2 of the cast: fresh 2× crops |
| cast/crew2-leash.webp | 5d9261ba81b5 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/crew2-ball.webp | 5b1feea92c5f | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| cast/crew2-mop.webp | 3c066a3eab13 | Astra | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops |
| set/gm-done.webp | e12e5f32915d | main thread | 2026-10-29 | clean | the third render: at 2× on cream and navy beside the other states; a neutral warm-white band, the orb in place |
| set/gm-page-done.webp | d44de11da266 | main thread | 2026-10-29 | clean | the third render: at 2× on cream and navy beside the other states; a neutral warm-white band, the orb in place |
| cast/beagle-tricolour-moving.webp | 0c67ddc98005 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/beagle-tricolour-sitting.webp | 476c8055863d | Sonnet | 2026-10-29 | defect: the white tail tip is clipped flat by the left canvas edge (6 opaque pixels in column 0) | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/beagle-tricolour-asleep.webp | beadb9c7cff0 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/collie-black-moving.webp | 6037dba489ec | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/collie-black-sitting.webp | 6a2edcefa454 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/collie-black-asleep.webp | 41f46cd4d795 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/collie-red-moving.webp | 9b86aae70f7f | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/collie-red-sitting.webp | aa9cc6d2cc26 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/collie-red-asleep.webp | eb90dcd7e185 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/corgi-red-moving.webp | b5134e6eb61d | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/corgi-red-sitting.webp | 713f33476cbd | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/corgi-red-asleep.webp | 3e595c75e601 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/corgi-sable-moving.webp | 4ed78a5f9a73 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/corgi-sable-sitting.webp | 08612af0b812 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/corgi-sable-asleep.webp | 68f7c6917b02 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/lab-black-asleep.webp | 9d08b8e91c7f | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/lab-chocolate-asleep.webp | 6a8e8f6785ef | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/lab-yellow-moving.webp | 0c82acb8066a | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/lab-yellow-sitting.webp | 7719a501385f | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/lab-yellow-asleep.webp | 4bc6f8b727a2 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/poodle-black-moving.webp | 453fca12f563 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/poodle-black-sitting.webp | ea2cd62b24d8 | Sonnet | 2026-10-29 | defect: pinhole gaps between the near front leg and the far leg (about x=74, y=123) show as light specks on cream | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/poodle-black-asleep.webp | ee6656d11bf2 | Sonnet | 2026-10-29 | defect: a 1x2 px translucent pinhole between the pompon tail and the hind leg (x=29, y=49-50) | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/poodle-cream-moving.webp | 0a3fbe15795d | Sonnet | 2026-10-29 | defect: a single dark speck in the groin notch (about x=62, y=78), visible on cream | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/poodle-cream-sitting.webp | b2e372942906 | Sonnet | 2026-10-29 | defect: pinhole gaps between the near front leg and the far leg and haunch, a dotted dark seam | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/poodle-cream-asleep.webp | 5e3c25399555 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/crew2-leash.webp | 5d9261ba81b5 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/crew2-ball.webp | 5b1feea92c5f | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |
| cast/crew2-mop.webp | 3c066a3eab13 | Sonnet | 2026-10-29 | clean | round 2 of the cast: fresh 2× crops, zooms to 12× |

Round 3 of the cast (every sprite re-framed with a 2 px margin; 42 sprites):

| file | sha | reader | date | verdict | notes |
|---|---|---|---|---|---|
| cast/beagle-tricolour-asleep.webp | 1f68be8e5639 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/beagle-tricolour-moving.webp | 2acbe2488aa4 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/beagle-tricolour-sitting.webp | 3b62276a5f02 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/collie-black-asleep.webp | 47c99bf161cc | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/collie-black-moving.webp | 62a679f04ed9 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/collie-black-sitting.webp | 0428112c6b21 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/collie-red-asleep.webp | c52ff76dc16b | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/collie-red-moving.webp | 6440fe2e0099 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/collie-red-sitting.webp | 322b4d90ee6e | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-red-asleep.webp | 20b93406a675 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-red-moving.webp | 85c7d93c615b | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-red-sitting.webp | 7ff6f0d7d79b | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-sable-asleep.webp | 972a0b7bfdf6 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-sable-moving.webp | a9eee0e1b316 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-sable-sitting.webp | ff6812da8f04 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/crew-ball.webp | 4d5c65b8b65b | main thread | 2026-10-29 | clean | breed sheets at 2.8× the page on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/crew-leash.webp | 481960bf1f5b | main thread | 2026-10-29 | clean | breed sheets at 2.8× the page on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/crew-mop.webp | d87c478f5edc | main thread | 2026-10-29 | clean | breed sheets at 2.8× the page on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/crew2-ball.webp | 98891867756b | main thread | 2026-10-29 | clean | breed sheets at 2.8× the page on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/crew2-leash.webp | 16b1bea96a7f | main thread | 2026-10-29 | clean | breed sheets at 2.8× the page on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/crew2-mop.webp | a22d049d3a85 | main thread | 2026-10-29 | clean | breed sheets at 2.8× the page on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/golden-gold-asleep.webp | e40f6bb2f856 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/golden-gold-moving.webp | 581e5377962f | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/golden-gold-sitting.webp | bf87645a12c7 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/golden-red-asleep.webp | 3f4de3bd700a | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/golden-red-moving.webp | f01eca4fa3c8 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/golden-red-sitting.webp | 17e75733e10f | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-black-asleep.webp | 71264f8940b8 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-black-moving.webp | 560e53e5a539 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-black-sitting.webp | 697963211828 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-chocolate-asleep.webp | 64fb35c73674 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-chocolate-moving.webp | 24a680b7f8ff | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-chocolate-sitting.webp | fab8c16682e3 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-yellow-asleep.webp | 566cacbe793e | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-yellow-moving.webp | 06fa277ac743 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/lab-yellow-sitting.webp | d4a37288eb54 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/poodle-black-asleep.webp | 28c4ec637909 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/poodle-black-moving.webp | 439e2b57ce1b | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/poodle-black-sitting.webp | b32043e386e9 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/poodle-brown-asleep.webp | 4ae73e9fc588 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/poodle-brown-moving.webp | 36428e3e4823 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/poodle-brown-sitting.webp | c5cb2c7dd119 | main thread | 2026-10-29 | clean | breed sheets at 4× the page (the golden sheet 3.7×) on cream and near-black; a script: no pixel in the outer two rings, no enclosed translucent pinhole (the open gaps between legs and in the leash loops are alpha 0) |
| cast/corgi-mahogany-moving.webp | a9eee0e1b316 | main thread | 2026-10-29 | clean | the same bytes as corgi-sable-moving (renamed after Astra's round 3: the coat reads as a deep red, so it is named mahogany); read in round 3 |
| cast/corgi-mahogany-sitting.webp | ff6812da8f04 | main thread | 2026-10-29 | clean | the same bytes as corgi-sable-sitting (renamed after Astra's round 3: the coat reads as a deep red, so it is named mahogany); read in round 3 |
| cast/corgi-mahogany-asleep.webp | 972a0b7bfdf6 | main thread | 2026-10-29 | clean | the same bytes as corgi-sable-asleep (renamed after Astra's round 3: the coat reads as a deep red, so it is named mahogany); read in round 3 |
| cast/beagle-tricolour-asleep.webp | 1f68be8e5639 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/beagle-tricolour-moving.webp | 2acbe2488aa4 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/beagle-tricolour-sitting.webp | 3b62276a5f02 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/collie-black-asleep.webp | 47c99bf161cc | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/collie-black-moving.webp | 62a679f04ed9 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/collie-black-sitting.webp | 0428112c6b21 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/collie-red-asleep.webp | c52ff76dc16b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/collie-red-moving.webp | 6440fe2e0099 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/collie-red-sitting.webp | 322b4d90ee6e | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/corgi-red-asleep.webp | 20b93406a675 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/corgi-red-moving.webp | 85c7d93c615b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/corgi-red-sitting.webp | 7ff6f0d7d79b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/corgi-sable-asleep.webp | 972a0b7bfdf6 | Astra | 2026-10-29 | defect: coat reads red-and-white; dark sable markings are absent from the head and back. | round 3; the bytes now ship as cast/corgi-mahogany-asleep.webp (renamed for this finding) |
| cast/corgi-sable-moving.webp | a9eee0e1b316 | Astra | 2026-10-29 | defect: coat reads red-and-white; dark sable markings are absent from the head and back. | round 3; the bytes now ship as cast/corgi-mahogany-moving.webp (renamed for this finding) |
| cast/corgi-sable-sitting.webp | ff6812da8f04 | Astra | 2026-10-29 | defect: coat reads red-and-white; dark sable markings are absent from the head and back. | round 3; the bytes now ship as cast/corgi-mahogany-sitting.webp (renamed for this finding) |
| cast/crew-ball.webp | 4d5c65b8b65b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/crew-leash.webp | 481960bf1f5b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/crew-mop.webp | d87c478f5edc | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/crew2-ball.webp | 98891867756b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/crew2-leash.webp | 16b1bea96a7f | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/crew2-mop.webp | a22d049d3a85 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-gold-asleep.webp | e40f6bb2f856 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-gold-moving.webp | 581e5377962f | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-gold-sitting.webp | bf87645a12c7 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-red-asleep.webp | 3f4de3bd700a | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-red-moving.webp | f01eca4fa3c8 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-red-sitting.webp | 17e75733e10f | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-black-asleep.webp | 71264f8940b8 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-black-moving.webp | 560e53e5a539 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-black-sitting.webp | 697963211828 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-chocolate-asleep.webp | 64fb35c73674 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-chocolate-moving.webp | 24a680b7f8ff | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-chocolate-sitting.webp | fab8c16682e3 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-yellow-asleep.webp | 566cacbe793e | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-yellow-moving.webp | 06fa277ac743 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/lab-yellow-sitting.webp | d4a37288eb54 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/poodle-black-asleep.webp | 28c4ec637909 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/poodle-black-moving.webp | 439e2b57ce1b | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/poodle-black-sitting.webp | b32043e386e9 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/poodle-brown-asleep.webp | 4ae73e9fc588 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/poodle-brown-moving.webp | 36428e3e4823 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/poodle-brown-sitting.webp | c5cb2c7dd119 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| set/gm-done.webp | e12e5f32915d | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| set/gm-page-done.webp | d44de11da266 | Astra | 2026-10-29 | clean | round 3: fresh 2× crops |
| cast/golden-gold-moving.webp | 36d3aa00cb2d | main thread | 2026-10-29 | clean | after the pocket repair: at 2× (4× the page) and the repaired spot at 6×, on cream and near-black |
| cast/golden-red-moving.webp | 6213ec05c958 | main thread | 2026-10-29 | clean | after the pocket repair: at 2× (4× the page) and the repaired spot at 6×, on cream and near-black |
| cast/lab-yellow-asleep.webp | 30ec72368b93 | main thread | 2026-10-29 | clean | after the pocket repair: at 2× (4× the page) and the repaired spot at 6×, on cream and near-black |
| cast/corgi-mahogany-moving.webp | a9eee0e1b316 | Astra | 2026-10-29 | defect: tail tip touches the top image edge. | measured by the main thread: the outer two pixel rings are fully transparent on every cast sprite; re-check asked |
| cast/corgi-mahogany-sitting.webp | ff6812da8f04 | Astra | 2026-10-29 | defect: ear tip and front paws touch the top and bottom image edges. | measured by the main thread: the outer two pixel rings are fully transparent on every cast sprite; re-check asked |
| cast/corgi-mahogany-asleep.webp | 972a0b7bfdf6 | Astra | 2026-10-29 | defect: back and forepaws touch the top and bottom image edges. | measured by the main thread: the outer two pixel rings are fully transparent on every cast sprite; re-check asked |
| cast/golden-gold-moving.webp | 36d3aa00cb2d | Sonnet | 2026-10-29 | clean | after the pocket repair: 3× on cream and dark, the spots at 9-12×, a pocket script (0 enclosed at alpha ≤ 128 and < 250, 4- and 8-connected) |
| cast/golden-red-moving.webp | 6213ec05c958 | Sonnet | 2026-10-29 | clean | after the pocket repair: 3× on cream and dark, the spots at 9-12×, a pocket script (0 enclosed at alpha ≤ 128 and < 250, 4- and 8-connected) |
| cast/lab-yellow-asleep.webp | 30ec72368b93 | Sonnet | 2026-10-29 | clean | after the pocket repair: 3× on cream and dark, the spots at 9-12×, a pocket script (0 enclosed at alpha ≤ 128 and < 250, 4- and 8-connected) |
| cast/corgi-red-moving.webp | 85c7d93c615b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/corgi-red-sitting.webp | 7ff6f0d7d79b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/corgi-red-asleep.webp | 20b93406a675 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/corgi-mahogany-moving.webp | a9eee0e1b316 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe); read as corgi-sable-*, the same bytes |
| cast/corgi-mahogany-sitting.webp | ff6812da8f04 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe); read as corgi-sable-*, the same bytes |
| cast/corgi-mahogany-asleep.webp | 972a0b7bfdf6 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe); read as corgi-sable-*, the same bytes |
| cast/beagle-tricolour-moving.webp | 2acbe2488aa4 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/beagle-tricolour-sitting.webp | 3b62276a5f02 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/beagle-tricolour-asleep.webp | 1f68be8e5639 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/collie-black-moving.webp | 62a679f04ed9 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/collie-black-sitting.webp | 0428112c6b21 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/collie-black-asleep.webp | 47c99bf161cc | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/collie-red-moving.webp | 6440fe2e0099 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/collie-red-sitting.webp | 322b4d90ee6e | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/collie-red-asleep.webp | c52ff76dc16b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/poodle-brown-moving.webp | 36428e3e4823 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/poodle-brown-sitting.webp | c5cb2c7dd119 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/poodle-brown-asleep.webp | 4ae73e9fc588 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/poodle-black-moving.webp | 439e2b57ce1b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/poodle-black-sitting.webp | b32043e386e9 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/poodle-black-asleep.webp | 28c4ec637909 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-black-moving.webp | 560e53e5a539 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-black-sitting.webp | 697963211828 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-black-asleep.webp | 71264f8940b8 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-chocolate-moving.webp | 24a680b7f8ff | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-chocolate-sitting.webp | fab8c16682e3 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-chocolate-asleep.webp | 64fb35c73674 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-yellow-moving.webp | 06fa277ac743 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/lab-yellow-sitting.webp | d4a37288eb54 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/golden-gold-sitting.webp | bf87645a12c7 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/golden-gold-asleep.webp | e40f6bb2f856 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/golden-red-sitting.webp | 17e75733e10f | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/golden-red-asleep.webp | 3f4de3bd700a | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/crew-leash.webp | 481960bf1f5b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/crew-ball.webp | 4d5c65b8b65b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/crew-mop.webp | d87c478f5edc | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/crew2-leash.webp | 16b1bea96a7f | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/crew2-ball.webp | 98891867756b | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| cast/crew2-mop.webp | a22d049d3a85 | Sonnet | 2026-10-29 | clean | round 3: crops, a pixel script (margins, holes, fringe) |
| set/gm-done.webp | e12e5f32915d | Sonnet | 2026-10-29 | clean | the third render: the same object and place as ready and running; a neutral warm-white band |
| set/gm-page-done.webp | d44de11da266 | Sonnet | 2026-10-29 | clean | the third render: the same object and place as ready and running; a neutral warm-white band |
| cast/golden-gold-moving.webp, cast/golden-red-moving.webp, cast/lab-yellow-asleep.webp | (round 3 bytes) | Sonnet | 2026-10-29 | defect: an enclosed translucent pocket (the brisket; the ear and cheek) | repaired: POCKET_REPAIRS; the new bytes' rows are above |
| cast/golden-gold-moving.webp | 36d3aa00cb2d | Astra | 2026-10-29 | clean | after the pocket repair: the spot at 6×, anatomy, coat and margins |
| cast/golden-red-moving.webp | 6213ec05c958 | Astra | 2026-10-29 | clean | after the pocket repair: the spot at 6×, anatomy, coat and margins |
| cast/lab-yellow-asleep.webp | 30ec72368b93 | Astra | 2026-10-29 | clean | after the pocket repair: the spot at 6×, anatomy, coat and margins |
| cast/corgi-mahogany-moving.webp | a9eee0e1b316 | Astra | 2026-10-29 | clean | re-check against the measured 2 px margin on every side: whole, nothing cut; anatomy and coat as before |
| cast/corgi-mahogany-sitting.webp | ff6812da8f04 | Astra | 2026-10-29 | clean | re-check against the measured 2 px margin on every side: whole, nothing cut; anatomy and coat as before |
| cast/corgi-mahogany-asleep.webp | 972a0b7bfdf6 | Astra | 2026-10-29 | clean | re-check against the measured 2 px margin on every side: whole, nothing cut; anatomy and coat as before |
| cast/crew-leash.webp | cfb8fa235715 | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: the woman: face, two arms, the coiled red leash in her near hand, two legs and shoes; faceted like the dogs; no fringe on cream or dark |
| cast/crew-ball.webp | 8df5561ab94c | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: the ball held in the raised near hand, fingers around it; the other arm relaxed; two legs, shoes; whole |
| cast/crew-mop.webp | 4dd83e1c8575 | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: both hands on one straight handle, the strands at its foot; two legs and shoes; whole |
| cast/crew-kneel.webp | 489cd3065176 | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: near knee down with the foot behind, far knee up, the near hand on her thigh, the far hand out low; one head, face; whole |
| cast/crew-tired.webp | aaacae783ff8 | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: head bowed, the near hand at the back of her neck, the other arm hanging; reads weary, not hurt; whole |
| cast/crew2-leash.webp | af0616af2fdb | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: the man (beard, short hair): the coiled leash in his near hand; two arms, legs, shoes; a different person from crew |
| cast/crew2-ball.webp | ef1ea40cbddf | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: the ball in the raised near hand; the other hand relaxed; whole |
| cast/crew2-mop.webp | 7c4cfef8a428 | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: both hands on one straight handle; the strands at its foot; whole |
| cast/crew2-kneel.webp | 6729451c9807 | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: near knee down, the near hand on the raised knee, the far hand out low; face; whole |
| cast/crew2-tired.webp | ef884233984b | main thread | 2026-10-29 | clean | round 2 crew (faceted), 2× art_qa crop on cream and dark: head bowed, the near hand at the back of his neck; reads weary; whole |
| cast/crew-leash.webp | cfb8fa235715 | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): coiled red leash, one cord with a handle loop; face in three-quarter view; legs and shoes clean |
| cast/crew-ball.webp | 8df5561ab94c | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): fist around the ball at shoulder height, in front of the ponytail (overlap, not merged) |
| cast/crew-mop.webp | 4dd83e1c8575 | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): one straight handle, both fists on it, ferrule and mop head clean; nothing cut off |
| cast/crew-kneel.webp | 489cd3065176 | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): back knee down, front foot flat, one hand on the knee, the other reaching with plausible fingers |
| cast/crew-tired.webp | aaacae783ff8 | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): head bowed, forearm to the nape, the other arm hanging; tired, not hurt |
| cast/crew2-leash.webp | af0616af2fdb | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): short hair, beard, face; the same coiled leash, one cord |
| cast/crew2-ball.webp | ef1ea40cbddf | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): ball held up clear of the head, fingers around it |
| cast/crew2-mop.webp | 7c4cfef8a428 | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): one straight handle, fists at the belt and low on the shaft |
| cast/crew2-kneel.webp | 6729451c9807 | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): one knee down, hand on the front knee, the other reaching with readable fingers |
| cast/crew2-tired.webp | ef884233984b | Sonnet | 2026-10-29 | clean | a fresh agent; 2× crops on cream and dark, 6× zooms of head, hands and feet, alpha check (2 px margin, one shape): head bowed, hand at the nape with fingertips visible; tired, not hurt |
| cast/crew-leash.webp | cfb8fa235715 | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew-ball.webp | 8df5561ab94c | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew-mop.webp | 4dd83e1c8575 | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew-kneel.webp | 489cd3065176 | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew-tired.webp | aaacae783ff8 | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew2-leash.webp | af0616af2fdb | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew2-ball.webp | ef1ea40cbddf | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew2-mop.webp | 7c4cfef8a428 | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew2-kneel.webp | 6729451c9807 | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
| cast/crew2-tired.webp | ef884233984b | Astra | 2026-10-29 | clean | round 2 crew (faceted): the 2× art_qa crop on cream and dark and the yard composite, against the crew checklist (adult, face, two arms and hands on what they hold, two legs, the same person across poses, finish, no fringe or text) |
