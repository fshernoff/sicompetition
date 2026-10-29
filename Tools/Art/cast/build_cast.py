"""Build the shipped cast from the keyed, cut figures: one scale per subject, the coats (recolours of one model), one
colour grade and a light sharpen, the foot anchors, WebP with real alpha, and src/assets/art/cast.json.

usage: build_cast.py <cutdir>     (the figures key_cut.py wrote: <subject>-01.png .. -03.png; the crew's subjects are
                                  crew, crewb, crew2 and crew2b: each person's two strips)
Pillow only. Run from anywhere; writes src/assets/art/cast/*.webp and src/assets/art/cast.json.

The scale table (gate 1). Sprites are stored at 2x the yard's CSS scale, on the set's metric camera (spike B: 88 px
per metre at 1x, so 176 at 2x). A breed's scale is fixed by its moving pose's length (the trimmed width, nose to tail
along the screen): the corgi's is CORGI_LENGTH px, every other breed's a real-world ratio of it, and the sit and the
sleep share the moving pose's scale (one model, one camera). The crew's height is CREW_TO_GOLDEN x the golden's
standing height (the head top to the feet in its moving pose); the second crew member's is CREW2_TO_CREW x the
first one's (their leash poses); each person's second strip (kneel, tired) is matched to the first by the leash pose
it repeats. Nothing is rescaled afterwards.

The steps for every sprite, in order: the recorded repairs (REPAIRS) on the cut figure; the coat (if not the generated
one) recoloured at full size; the figure padded by PAD transparent px, resized with LANCZOS on premultiplied alpha,
faint alpha (below 6) dropped, trimmed and framed with MARGIN transparent px (every sprite has a clear margin, and no
edge is cut flat by the canvas); alpha over 245 made 255; enclosed pin holes up to PINHOLE_MAX px closed; the grade (saturation x GRADE_SAT, contrast x
GRADE_CONTRAST about mid grey, red x 1.01 and blue x 0.985: the set's warm key light); the colours pushed four
pixels out under the transparent edge (so the sharpen and the encoder see the figure's own colour there, never black);
an unsharp mask (radius 0.8, 35%, threshold 2) on the colour only; alpha kept as it was; WebP quality WEBP_Q, alpha
lossless, exact (the pushed colours are kept under the transparent pixels).
"""
import colorsys
import json
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'art', 'cast')
MANIFEST = os.path.join(ROOT, 'src', 'assets', 'art', 'cast.json')

PPM = 176                 # px per metre at 2x (spike B's camera: 88 at the yard's 1x)
CORGI_LENGTH = 130        # px, the corgi's moving pose at 2x (spike B's metric corgi, 65 px at 1x)
CREW_TO_GOLDEN = 2.2      # the crew's height over a standing golden's
CREW2_TO_CREW = 1.07      # the second crew member (a man) over the first (a woman): about 1.77 m against 1.65 m
GRADE_SAT, GRADE_CONTRAST = 0.93, 0.96
PAD, MARGIN = 8, 2         # px round the cut figure before the resize; px of clear margin round every sprite
PINHOLE_MAX = 24          # px: an enclosed translucent group in a sprite up to this size is closed (close_pinholes)
WEBP_Q = 90

DOG_POSES = ['moving', 'sitting', 'asleep']
CREW_POSES = ['leash', 'ball', 'mop']   # a person's first strip, figures 1 to 3
CREW_POSES_2 = ['kneel', 'tired']       # the second strip's figures 2 and 3 (figure 1, the leash pose, is its scale)

# length of the moving pose relative to the corgi's (real-world ratios, checked on the contact sheet)
BREEDS = {
    'corgi': 1.0,
    'beagle': 1.15,
    'collie': 1.35,
    'poodle': 1.3,
    'lab': 1.55,
    'golden': 1.6,
}


def hsv(p):
    return colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)


# The coat masks: which pixels are the coat a recolour changes (eyes, nose, mouth, white markings and pink inner ears
# stay). Each is a test on (h, s, v).
def warm_coat(h, s, v):
    return 0.03 <= h <= 0.15 and s > 0.22 and v > 0.22


def poodle_coat(h, s, v):
    return (h <= 0.14 or h >= 0.97) and s > 0.2 and v > 0.17


def red_patch(h, s, v):          # a corgi's red, not its white and not the pink of its inner ears
    return 0.035 <= h <= 0.14 and s > 0.3 and v > 0.3


def black_patch(h, s, v):        # a collie's or a beagle's black
    return v < 0.45 and s < 0.35


def grey_coat(h, s, v):          # the Lab, generated black: its whole charcoal coat
    return s < 0.3


def whole_coat(h, s, v):         # a dog whose whole coat is one colour (the poodle): every pixel, the nose and eyes
    return True                  # kept by keep_dark


# Each breed's coats: the generated one (None), another subject's generated strip (its name: the Lab's yellow coat is
# its own call, cast-labyellow-1, since a recolour of the black Lab lost the nose and kept black in the creases), or a
# recolour of the generated strip. A recolour: mask (which pixels are coat), target colour, gamma, and options. A
# recoloured pixel becomes target x (L / L0) ** gamma, L its luminance and L0 the median luminance of the mask in the
# breed's moving pose, so the facets keep their shading. Options: "protect" leaves the nose, the eyes and the lip line
# inside a patch alone (see protect_small); "keep_dark" (a ratio r) keeps a pixel darker than r x L0 as it was,
# fading in over the 0.1 above it (the nose and the eyes of a dog whose whole coat is recoloured); "band" also takes
# the patch's anti-aliased border (see recolour), so no grey or dark rim of the old patch survives in the new coat.
COATS = {
    'golden': {'gold': None, 'red': dict(mask=warm_coat, target=(190, 112, 58), gamma=1.0)},
    'lab': {'black': None,
            'chocolate': dict(mask=grey_coat, target=(116, 76, 50), gamma=0.75, keep_dark=0.3),
            'yellow': 'labyellow'},
    'poodle': {'brown': None,
               'black': dict(mask=whole_coat, target=(54, 51, 49), gamma=1.25, keep_dark=0.3)},
    # the cream poodle was dropped in D58 round 2: the brown model's rim light became a pale fringe on dark and its
    # deepest crease a dark speck in cream, so one model does not carry that coat; the poodle ships brown and black
    'corgi': {'red': None, 'mahogany': dict(mask=red_patch, target=(172, 98, 48), gamma=1.1)},
    'collie': {'black': None, 'red': dict(mask=black_patch, target=(128, 74, 44), gamma=0.85)},
    # the beagle ships in its tricolour only: a tan recolour of the saddle left grey and dark borders, a recoloured
    # far paw and creases at every setting tried (the D58 readers' round 1), so one model cannot carry that coat
    'beagle': {'tricolour': None},
}

# Controlled repairs on a cut figure, before any recolour or scaling (each recorded in the provenance):
# ('close', box): the transparent pixels between the opaque ones on each row of the box are filled with the colour
# of the opaque pixels round them (pushed in ring by ring), alpha 255.
# ('flatten', box, lo, hi): every pixel in the box brighter (luminance) than hi takes the median colour of the box's
# coloured pixels (saturation above 0.5: the coat, not a grey border) between lo and hi (a facet the model lit far brighter than the coat round
# it, a speck at the sprite's size).
REPAIRS = {
    # the black Lab asleep: the far ear's tip hangs right of the cheek with a sliver of background between, which
    # reads as a detached hook at the sprite's size; the gap is closed so the ear lies against the cheek
    ('lab', 3): [('close', (398, 148, 420, 174))],
    # the beagle (cast-beagle-2): a small pale facet (luminance about 200 in tan of about 145) at the tip of the tan
    # wedge that meets the black saddle by the hip, trotting and asleep, a light speck at the sprite's size
    ('beagle', 1): [('flatten', (112, 117, 126, 128), 120, 160)],
    ('beagle', 3): [('flatten', (60, 32, 74, 46), 120, 160)],
}


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def coat_mask(im, test):
    W, H = im.size
    return [p[3] > 0 and test(*hsv(p)) for p in im.get_flattened_data()]


def components(mask, W, H):
    from collections import deque
    seen = bytearray(W * H)
    for s in range(W * H):
        if not mask[s] or seen[s]:
            continue
        seen[s] = 1
        q, part = deque([s]), []
        while q:
            i = q.popleft()
            part.append(i)
            y, x = divmod(i, W)
            for j in (i - 1 if x > 0 else -1, i + 1 if x < W - 1 else -1, i - W, i + W):
                if 0 <= j < W * H and mask[j] and not seen[j]:
                    seen[j] = 1
                    q.append(j)
        yield part


def protect_small(mask, px, W, H, total):
    """the mask without the nose, the eyes and the lip line: connected parts smaller than 1% of the figure, darker
    than a saddle (median value under 0.30) and in the front of the figure (their middle beyond 60% of the width, the
    dog facing right); a small piece of a saddle or a tail band is lighter or further back and is recoloured. Returns
    the mask and the protected pixels."""
    out, kept = list(mask), []
    for part in components(mask, W, H):
        xs = [i % W for i in part]
        vs = sorted(max(px[i][:3]) for i in part)
        if len(part) < 0.01 * total and vs[len(vs) // 2] < 0.30 * 255 and (min(xs) + max(xs)) / 2 > 0.6 * W:
            for i in part:
                out[i] = False
            kept += part
    return out, kept


def dilate(mask, W, H, r):
    m = Image.new('L', (W, H))
    m.putdata([255 if v else 0 for v in mask])
    return [v > 0 for v in m.filter(ImageFilter.MaxFilter(2 * r + 1)).get_flattened_data()]


def recolour(im, spec, L0):
    """spec: a COATS recolour. With band (a patch on a white and tan dog: the beagle's saddle), only the patch's own
    parts are recoloured: its connected parts of at least 0.15% of the figure, and any smaller part within 4 px of
    those (a fragment of the saddle); a small dark part elsewhere is shading in the white (a crease in a paw) and
    stays. Then the pixels within 3 px of the recoloured parts that are grey or dark (saturation under 0.3 and value
    under 0.75, or value under 0.5: the anti-aliased border between the patch and the white or the tan) are recoloured
    with them, except next to a protected nose or eye."""
    W, H = im.size
    N = W * H
    px = list(im.get_flattened_data())
    total = sum(1 for p in px if p[3] > 128)
    mask = coat_mask(im, spec['mask'])
    kept = []
    if spec.get('protect'):
        mask, kept = protect_small(mask, px, W, H, total)
    if spec.get('band'):
        parts = list(components(mask, W, H))
        core = [False] * N
        for part in parts:
            if len(part) >= 0.0015 * total:
                for i in part:
                    core[i] = True
        near_core = dilate(core, W, H, 4)
        mask = list(core)
        for part in parts:
            if len(part) < 0.0015 * total and any(near_core[i] for i in part):
                for i in part:
                    mask[i] = True
        near = dilate(mask, W, H, 3)
        kept_set = set(kept)
        keep_away = dilate([i in kept_set for i in range(N)], W, H, 3) if kept else [False] * N
        for i, p in enumerate(px):
            if mask[i] or not near[i] or keep_away[i] or p[3] == 0:
                continue
            h, s_, v = hsv(p)
            if (s_ < 0.3 and v < 0.75) or v < 0.5:
                mask[i] = True
    target, gamma, keep_dark = spec['target'], spec['gamma'], spec.get('keep_dark')
    out = []
    for p, m in zip(px, mask):
        if not m:
            out.append(p)
            continue
        ratio = max(1.0, lum(p)) / L0
        k = ratio ** gamma
        new = [c * k for c in target]
        if keep_dark is not None:
            w = max(0.0, min(1.0, (keep_dark + 0.1 - ratio) / 0.1))
            new = [n * (1 - w) + o * w for n, o in zip(new, p[:3])]
        out.append(tuple(max(0, min(255, round(c))) for c in new) + (p[3],))
    res = Image.new('RGBA', im.size)
    res.putdata(out)
    return res


def repair(im, steps):
    """REPAIRS' steps on a cut figure"""
    im = im.copy()
    W, H = im.size
    px = im.load()
    for kind, (x0, y0, x1, y1), *extra in steps:
        if kind == 'flatten':
            lo, hi = extra
            box = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if px[x, y][3] == 255]
            mid = sorted((px[q] for q in box if lo <= lum(px[q]) <= hi and hsv(px[q])[1] > 0.5), key=lum)
            ref = mid[len(mid) // 2]
            hot = [q for q in box if lum(px[q]) > hi]
            for q in hot:
                px[q] = ref
            print(f'  repair: flattened {len(hot)} px in {(x0, y0, x1, y1)} to {ref[:3]}')
            continue
        assert kind == 'close'
        fill = []
        for y in range(y0, y1):
            xs = [x for x in range(x0, x1) if px[x, y][3] >= 128]
            if len(xs) >= 2:
                fill += [(x, y) for x in range(xs[0], xs[-1] + 1) if px[x, y][3] < 255]
        todo = set(fill)
        while todo:
            done = {}
            for x, y in todo:
                acc = [0, 0, 0, 0]
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        q = (x + dx, y + dy)
                        if q in todo or not (0 <= q[0] < W and 0 <= q[1] < H) or px[q][3] < 255:
                            continue
                        r, g, b, a = px[q]
                        acc[0] += r
                        acc[1] += g
                        acc[2] += b
                        acc[3] += 1
                if acc[3]:
                    done[(x, y)] = (acc[0] // acc[3], acc[1] // acc[3], acc[2] // acc[3], 255)
            if not done:
                break
            for q, c in done.items():
                px[q] = c
            todo -= set(done)
        print(f'  repair: closed {len(fill)} px in {(x0, y0, x1, y1)}')
    return im


def coat_l0(im, spec):
    vals = sorted(lum(p) for p, m in zip(im.get_flattened_data(), coat_mask(im, spec['mask'])) if m and p[3] == 255)
    return vals[len(vals) // 2]


def resize(im, s):
    """the figure at scale s: padded by PAD transparent px first (so the resize can draw the soft edge past the cut's
    own bounds instead of truncating it flat at the canvas edge), LANCZOS on premultiplied alpha, alpha under 6
    dropped and alpha over 245 made 255 (the filter's ringing inside the coat), trimmed, then MARGIN transparent px
    added round it (every sprite has a clear margin)"""
    padded = Image.new('RGBA', (im.width + 2 * PAD, im.height + 2 * PAD), (0, 0, 0, 0))
    padded.paste(im, (PAD, PAD))
    w, h = max(1, round(padded.width * s)), max(1, round(padded.height * s))
    out = padded.convert('RGBa').resize((w, h), Image.Resampling.LANCZOS).convert('RGBA')
    out.putalpha(out.getchannel('A').point(lambda v: 0 if v < 6 else 255 if v > 245 else v))
    out = out.crop(out.getbbox())
    framed = Image.new('RGBA', (out.width + 2 * MARGIN, out.height + 2 * MARGIN), (0, 0, 0, 0))
    framed.paste(out, (MARGIN, MARGIN))
    return close_pinholes(framed)


def close_pinholes(im):
    """a group of not-quite-opaque pixels (alpha under 255) that does not reach the canvas's edge and is no bigger than
    PINHOLE_MAX px is a pin hole or a seam the resize left in the coat (a 1 x 2 slit between a pom-pom and a leg, a
    dotted seam between a sitting poodle's legs, a chink between the crew's fingers): it becomes opaque, coloured as
    the opaque pixels round it. Real gaps (between a sitting golden's or beagle's front legs, the crew's arm and body,
    the leash's loops: 32 px and more) stay."""
    from collections import deque
    W, H = im.size
    px = im.load()
    seen = bytearray(W * H)
    closed = []
    for start in range(W * H):
        y, x = divmod(start, W)
        if seen[start] or px[x, y][3] == 255:
            continue
        seen[start] = 1
        q, group, outside = deque([start]), [], False
        while q:
            i = q.popleft()
            group.append(i)
            yy, xx = divmod(i, W)
            if xx in (0, W - 1) or yy in (0, H - 1):
                outside = True
            for nx, ny in ((xx + 1, yy), (xx - 1, yy), (xx, yy + 1), (xx, yy - 1)):
                j = ny * W + nx
                if 0 <= nx < W and 0 <= ny < H and not seen[j] and px[nx, ny][3] < 255:
                    seen[j] = 1
                    q.append(j)
        if not outside and len(group) <= PINHOLE_MAX:
            closed.append(group)
    for group in closed:
        for i in group:
            y, x = divmod(i, W)
            acc = [0, 0, 0, 0]
            for yy in range(max(0, y - 1), min(H, y + 2)):
                for xx in range(max(0, x - 1), min(W, x + 2)):
                    r, g, b, a = px[xx, yy]
                    if a == 255:
                        acc[0] += r
                        acc[1] += g
                        acc[2] += b
                        acc[3] += 1
            if acc[3]:
                px[x, y] = (acc[0] // acc[3], acc[1] // acc[3], acc[2] // acc[3], 255)
            else:
                px[x, y] = px[x, y][:3] + (255,)
    return im


def push_colour(im, rings=4):
    """the colours of the visible pixels pushed `rings` px out under the transparent ones (alpha unchanged)"""
    W, H = im.size
    px = list(im.get_flattened_data())
    col = [p[:3] if p[3] > 0 else None for p in px]
    for _ in range(rings):
        new = {}
        for i, c in enumerate(col):
            if c is not None:
                continue
            y, x = divmod(i, W)
            acc = [0, 0, 0, 0]
            for yy in range(max(0, y - 1), min(H, y + 2)):
                for xx in range(max(0, x - 1), min(W, x + 2)):
                    q = col[yy * W + xx]
                    if q is not None:
                        acc[0] += q[0]
                        acc[1] += q[1]
                        acc[2] += q[2]
                        acc[3] += 1
            if acc[3]:
                new[i] = (acc[0] // acc[3], acc[1] // acc[3], acc[2] // acc[3])
        for i, c in new.items():
            col[i] = c
    rgb = Image.new('RGB', im.size)
    rgb.putdata([c if c is not None else (128, 128, 128) for c in col])
    return rgb


def finish(im):
    """the grade, the push, the sharpen; alpha untouched"""
    alpha = im.getchannel('A')
    rgb = push_colour(im)
    rgb = ImageEnhance.Color(rgb).enhance(GRADE_SAT)
    rgb = ImageEnhance.Contrast(rgb).enhance(GRADE_CONTRAST)
    r, g, b = rgb.split()
    r = r.point(lambda v: min(255, round(v * 1.01)))
    b = b.point(lambda v: round(v * 0.985))
    rgb = Image.merge('RGB', (r, g, b))
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=0.8, percent=35, threshold=2))
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def head_top(im):
    """the top of the head of a dog facing right: the highest opaque pixel in the front 40% of the width"""
    px = im.load()
    for y in range(im.height):
        for x in range(int(im.width * 0.6), im.width):
            if px[x, y][3] > 128:
                return y
    return 0


def dog_anchor(im):
    """the middle of the ground contact: x the centre of the opaque columns whose lowest pixel is in the bottom 30%,
    y the mean of those lowest pixels (between the near and the far feet)"""
    px = im.load()
    W, H = im.size
    lows = []
    for x in range(W):
        for y in range(H - 1, -1, -1):
            if px[x, y][3] > 128:
                if y >= H * 0.7 - 1:
                    lows.append((x, y))
                break
    xs = [p[0] for p in lows]
    return [round((min(xs) + max(xs)) / 2, 1), round(sum(p[1] for p in lows) / len(lows), 1)]


def crew_anchor(im):
    """between the shoes: the bright white, unsaturated pixels in the bottom 22% (the sneakers; the mop's grey head
    and the leash are not that white), x the middle of their columns, y the mean of each column's lowest one"""
    px = im.load()
    W, H = im.size
    cols = {}
    for y in range(int(H * 0.78), H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a > 200:
                h, s, v = hsv((r, g, b))
                if v > 0.86 and s < 0.08:
                    cols[x] = max(cols.get(x, 0), y)
    xs = sorted(cols)
    return [round((xs[0] + xs[-1]) / 2, 1), round(sum(cols.values()) / len(cols), 1)]


# A recorded repair (D58 round 3, Sonnet, Oct 29): three small pockets the hole rule above leaves, because each holds a
# fully transparent core that the soft edge links to the background. In each box, a pixel with alpha 128 or less that
# cannot reach the image's edge through such pixels is a pocket's core; it and its non-opaque ring (alpha below 255,
# not touching the background) are filled from their opaque neighbours. A larger gap (between legs, a leash loop)
# reaches the background and stays open. The boxes are in the sprite's own pixels.
POCKET_REPAIRS = {
    'golden-gold-moving': [(130, 81, 145, 96)],  # by the brisket feathering, about (136-138, 87-89)
    'golden-red-moving': [(130, 81, 145, 96)],
    'lab-yellow-asleep': [(145, 53, 160, 70)],  # the far ear and the cheek, about (151-153, 59-63)
}


def repair_pockets(im, name):
    boxes = POCKET_REPAIRS.get(name)
    if not boxes:
        return 0
    W, H = im.size
    px = im.load()
    clear = bytearray(W * H)  # reachable from the edge through alpha <= 128
    q = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    while q:
        x, y = q.pop()
        if clear[y * W + x] or px[x, y][3] > 128:
            continue
        clear[y * W + x] = 1
        q.extend((nx, ny) for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= nx < W and 0 <= ny < H)

    def near_clear(x, y):
        return any(clear[ny * W + nx] for nx in (x - 1, x, x + 1) for ny in (y - 1, y, y + 1) if 0 <= nx < W and 0 <= ny < H)

    todo = {(x, y) for x0, y0, x1, y1 in boxes for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)
            if px[x, y][3] < 255 and not clear[y * W + x] and not near_clear(x, y)}
    filled = len(todo)
    while todo:
        done = []
        for x, y in todo:
            nb = [px[nx, ny] for nx in (x - 1, x, x + 1) for ny in (y - 1, y, y + 1)
                  if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in todo and px[nx, ny][3] == 255]
            if nb:
                px[x, y] = tuple(sum(c[i] for c in nb) // len(nb) for i in range(3)) + (255,)
                done.append((x, y))
        if not done:
            break
        todo -= set(done)
    print(f'  repair {name}: {filled} px filled')
    return filled


def save(im, name):
    path = os.path.join(OUT, f'{name}.webp')
    repair_pockets(im, name)
    rgb = push_colour(im, rings=6)
    out = rgb.convert('RGBA')
    out.putalpha(im.getchannel('A'))
    out.save(path, 'WEBP', quality=WEBP_Q, alpha_quality=100, method=6, exact=True)
    return path


def main(cutdir):
    os.makedirs(OUT, exist_ok=True)
    load = lambda s, n: Image.open(os.path.join(cutdir, f'{s}-0{n}.png')).convert('RGBA')
    sprites, report = [], []
    golden_scale = golden_stand = None
    def figures(subject):
        return [repair(load(subject, n), REPAIRS[(subject, n)]) if (subject, n) in REPAIRS else load(subject, n)
                for n in (1, 2, 3)]

    for breed, ratio in BREEDS.items():
        figs = figures(breed)
        s = ratio * CORGI_LENGTH / figs[0].width
        if breed == 'golden':
            golden_scale = s
            golden_stand = (figs[0].height - head_top(figs[0])) * s
        L0 = {name: coat_l0(figs[0], spec) for name, spec in COATS[breed].items() if isinstance(spec, dict)}
        for name, spec in COATS[breed].items():
            own, s_own = figs, s
            if isinstance(spec, str):          # another generated strip of the breed, at the breed's own ratio
                own = figures(spec)
                s_own = ratio * CORGI_LENGTH / own[0].width
            for pose, fig in zip(DOG_POSES, own):
                src = recolour(fig, spec, L0[name]) if isinstance(spec, dict) else fig
                sp = finish(resize(src, s_own))
                sid = f'{breed}-{name}-{pose}'
                path = save(sp, sid)
                anchor = dog_anchor(sp)
                sprites.append({'id': sid, 'file': f'cast/{sid}.webp', 'kind': 'dog', 'breed': breed, 'coat': name,
                                'pose': pose, 'facing': 'right', 'size': list(sp.size), 'anchor': anchor})
                report.append((sid, sp.size, anchor, os.path.getsize(path), round(s_own, 4)))
    # The crew, two people (G5d round 2: remade in the dogs' faceted treatment). Each comes from two strips: the first
    # (<person>: leash, ball, mop) and the second (<person>b: the leash pose again, kneel, tired), the second locked
    # to the first. The first crew member's height is CREW_TO_GOLDEN x the golden's standing height, from her leash
    # pose; the second's is CREW2_TO_CREW x the first one's, from the two leash poses (both standing straight). A
    # second strip's scale matches its own leash figure's height to the first strip's: that figure is only the
    # measure, and ships nothing.
    crew_h = s_crew = None
    for person in ('crew', 'crew2'):
        first = [load(person, n) for n in (1, 2, 3)]
        if crew_h is None:
            s_first = s_crew = CREW_TO_GOLDEN * golden_stand / first[0].height
            crew_h = first[0].height * s_first
        else:
            s_first = CREW2_TO_CREW * crew_h / first[0].height
        second = [load(f'{person}b', n) for n in (1, 2, 3)]
        s_second = s_first * first[0].height / second[0].height
        for figs, s, poses in ((first, s_first, CREW_POSES), (second[1:], s_second, CREW_POSES_2)):
            for pose, fig in zip(poses, figs):
                sp = finish(resize(fig, s))
                sid = f'{person}-{pose}'
                path = save(sp, sid)
                # standing, between the shoes; kneeling, the middle of the ground contact (the back toe, the knee,
                # the planted foot), by the dogs' rule: the shoe rule finds one shoe or two depending on how far back
                # the kneeling leg's shoe sits
                anchor = dog_anchor(sp) if pose == 'kneel' else crew_anchor(sp)
                sprites.append({'id': sid, 'file': f'cast/{sid}.webp', 'kind': 'crew', 'pose': pose, 'facing': 'right',
                                'size': list(sp.size), 'anchor': anchor})
                report.append((sid, sp.size, anchor, os.path.getsize(path), round(s, 4)))
    manifest = {
        'scale': {'corgiLength': CORGI_LENGTH, 'goldenToCorgi': BREEDS['golden'], 'crewToStandingGolden': CREW_TO_GOLDEN},
        'sprites': sprites,
        '_notes': [
            'CastManifest (src/assets/art/manifest.ts) plus these notes. Every sprite is stored at 2x the yard\'s CSS size on '
            'the set\'s camera: 176 px per metre of the orthographic view (a metre straight up is 152.4 px; set.json\'s '
            'map.ppm, 139.14, is a metre along a lawn edge in the same camera), so the yard draws each at 0.5 and never '
            'rescales one breed differently.',
            'Every sprite has a clear margin of 2 transparent px round the figure; anchors are in the framed image\'s pixels. '
            'scale: corgiLength is the corgi\'s moving pose, its cut figure\'s width, in px at 2x (the sprite adds a soft '
            'edge and the margin); each other breed\'s moving pose is a '
            'fixed ratio of it (beagle 1.15, collie 1.35, poodle 1.3, Lab 1.55, golden 1.6), and its sit and sleep share '
            'that scale; the crew (crew-*) is crewToStandingGolden x the golden\'s standing height, and the second crew '
            'member (crew2-*: a different adult in the same uniform, so two or three staff on the floor are not one '
            'person repeated) is 1.07 x the first one\'s height. Each person has five poses: leash, ball and mop from one '
            'strip, kneel (crouched at a dog\'s height, a hand out low) and tired (shoulders down, a hand at the back of '
            'the neck) from a second strip of the same person, scaled to the first by the leash pose both strips show.',
            'anchor: the ground point in the image\'s pixels (a dog: between its near and far feet; the crew: between the '
            'shoes, and kneeling the middle of the ground contact from the back toe to the planted foot). facing: every '
            'sprite faces right, along the camera-facing diagonal toward the lower right; mirror '
            'for the other diagonal (gate 5). No shadow is drawn in any sprite (gate 3).',
            'coat: the generated coat of each breed (golden gold, Lab black, poodle brown, corgi red, collie black, beagle '
            'tricolour) and its recolours in code (gate 6: golden red, Lab chocolate, poodle black, corgi mahogany, collie '
            'red); the yellow Lab is its own generated strip, at the Lab\'s ratio; the beagle has no second coat and the '
            'poodle no cream (dropped in D58 rounds 1 and 2); docs/art-provenance/cast/README.md has every step.',
        ],
    }
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=1)
        f.write('\n')
    total = 0
    for sid, size, anchor, nbytes, s in report:
        total += nbytes
        print(f'{sid:28s} {size[0]:4d} x {size[1]:4d}  anchor {anchor[0]:6.1f},{anchor[1]:6.1f}  {nbytes:6d} B  scale {s}')
    print(f'{len(report)} sprites, {total} bytes; golden standing height {golden_stand:.1f} px; crew scale {s_crew:.4f}')


if __name__ == '__main__':
    main(sys.argv[1])
