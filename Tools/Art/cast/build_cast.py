"""Build the shipped cast from the keyed, cut figures: one scale per subject, the coats (recolours of one model), one
colour grade and a light sharpen, the foot anchors, WebP with real alpha, and src/assets/art/cast.json.

usage: build_cast.py <cutdir>     (the figures key_cut.py wrote: <subject>-01.png .. -03.png)
Pillow only. Run from anywhere; writes src/assets/art/cast/*.webp and src/assets/art/cast.json.

The scale table (gate 1). Sprites are stored at 2x the yard's CSS scale, on the set's metric camera (spike B: 88 px
per metre at 1x, so 176 at 2x). A breed's scale is fixed by its moving pose's length (the trimmed width, nose to tail
along the screen): the corgi's is CORGI_LENGTH px, every other breed's a real-world ratio of it, and the sit and the
sleep share the moving pose's scale (one model, one camera). The crew's height is CREW_TO_GOLDEN x the golden's
standing height (the head top to the feet in its moving pose); the second crew member's is CREW2_TO_CREW x the
first one's (their leash poses). Nothing is rescaled afterwards.

The steps for every sprite, in order: the coat (if not the generated one) recoloured at full size; resized with
LANCZOS on premultiplied alpha; faint alpha (below 6) dropped; the grade (saturation x GRADE_SAT, contrast x
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
WEBP_Q = 90

DOG_POSES = ['moving', 'sitting', 'asleep']
CREW_POSES = ['leash', 'ball', 'mop']

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


# Each breed's coats: the generated one (None) or a recolour: (mask, target colour, gamma, protect small parts, keep
# darks). A recoloured pixel becomes target x (L / L0) ** gamma, L its luminance and L0 the median luminance of the
# mask in the breed's moving pose, so the facets keep their shading. "protect" leaves a small connected part of the
# mask in the head end alone (an eye or a nose inside a black patch; see protect_small). "keep darks" (a ratio r) keeps a
# pixel darker than r x L0 as it was, fading in over the 0.1 above it (the nose, the eyes and the lip line of a dog
# whose whole coat is recoloured).
COATS = {
    'golden': {'gold': None, 'red': (warm_coat, (190, 112, 58), 1.0, False, None)},
    'lab': {'black': None,
            'chocolate': (grey_coat, (116, 76, 50), 0.75, False, 0.3),
            'yellow': (grey_coat, (212, 180, 124), 0.45, False, 0.3)},
    'poodle': {'brown': None,
               'black': (poodle_coat, (54, 51, 49), 1.25, False, None),
               'cream': (poodle_coat, (232, 214, 182), 0.85, False, None)},
    'corgi': {'red': None, 'sable': (red_patch, (172, 98, 48), 1.1, False, None)},
    'collie': {'black': None, 'red': (black_patch, (128, 74, 44), 0.85, True, None)},
    'beagle': {'tricolour': None, 'tan': (black_patch, (182, 112, 56), 0.85, True, None)},
}


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def coat_mask(im, test):
    W, H = im.size
    return [p[3] > 0 and test(*hsv(p)) for p in im.get_flattened_data()]


def protect_small(mask, W, H, total):
    """drop the connected parts of the mask smaller than 1.5% of the figure whose middle is in the head end (the
    front 28% of the width, the dog facing right): the eyes, the nose, the lip line; a small piece of a saddle or a
    tail band elsewhere is coat and is recoloured"""
    from collections import deque
    seen = bytearray(W * H)
    out = list(mask)
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
        xs = [i % W for i in part]
        if len(part) < 0.015 * total and (min(xs) + max(xs)) / 2 > 0.72 * W:
            for i in part:
                out[i] = False
    return out


def recolour(im, spec, L0):
    test, target, gamma, protect, keep_dark = spec
    W, H = im.size
    px = list(im.get_flattened_data())
    mask = coat_mask(im, test)
    if protect:
        mask = protect_small(mask, W, H, sum(1 for p in px if p[3] > 128))
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


def coat_l0(im, test):
    vals = sorted(lum(p) for p, m in zip(im.get_flattened_data(), coat_mask(im, test)) if m and p[3] == 255)
    return vals[len(vals) // 2]


def resize(im, s):
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    out = im.convert('RGBa').resize((w, h), Image.Resampling.LANCZOS).convert('RGBA')
    out.putalpha(out.getchannel('A').point(lambda v: 0 if v < 6 else v))
    return out.crop(out.getbbox())


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


def save(im, name):
    path = os.path.join(OUT, f'{name}.webp')
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
    for breed, ratio in BREEDS.items():
        figs = [load(breed, n) for n in (1, 2, 3)]
        s = ratio * CORGI_LENGTH / figs[0].width
        if breed == 'golden':
            golden_scale = s
            golden_stand = (figs[0].height - head_top(figs[0])) * s
        L0 = {name: coat_l0(figs[0], spec[0]) for name, spec in COATS[breed].items() if spec}
        for name, spec in COATS[breed].items():
            for pose, fig in zip(DOG_POSES, figs):
                src = recolour(fig, spec, L0[name]) if spec else fig
                sp = finish(resize(src, s))
                sid = f'{breed}-{name}-{pose}'
                path = save(sp, sid)
                anchor = dog_anchor(sp)
                sprites.append({'id': sid, 'file': f'cast/{sid}.webp', 'kind': 'dog', 'breed': breed, 'coat': name,
                                'pose': pose, 'facing': 'right', 'size': list(sp.size), 'anchor': anchor})
                report.append((sid, sp.size, anchor, os.path.getsize(path), round(s, 4)))
    crew = [load('crew', n) for n in (1, 2, 3)]
    s_crew = CREW_TO_GOLDEN * golden_stand / crew[0].height
    for pose, fig in zip(CREW_POSES, crew):
        sp = finish(resize(fig, s_crew))
        sid = f'crew-{pose}'
        path = save(sp, sid)
        anchor = crew_anchor(sp)
        sprites.append({'id': sid, 'file': f'cast/{sid}.webp', 'kind': 'crew', 'pose': pose, 'facing': 'right',
                        'size': list(sp.size), 'anchor': anchor})
        report.append((sid, sp.size, anchor, os.path.getsize(path), round(s_crew, 4)))
    # the second crew member (a different adult in the same uniform): CREW2_TO_CREW x the first one's height, from
    # the two leash poses (both standing straight)
    crew2 = [load('crew2', n) for n in (1, 2, 3)]
    s_crew2 = CREW2_TO_CREW * crew[0].height * s_crew / crew2[0].height
    for pose, fig in zip(CREW_POSES, crew2):
        sp = finish(resize(fig, s_crew2))
        sid = f'crew2-{pose}'
        path = save(sp, sid)
        anchor = crew_anchor(sp)
        sprites.append({'id': sid, 'file': f'cast/{sid}.webp', 'kind': 'crew', 'pose': pose, 'facing': 'right',
                        'size': list(sp.size), 'anchor': anchor})
        report.append((sid, sp.size, anchor, os.path.getsize(path), round(s_crew2, 4)))
    manifest = {
        'scale': {'corgiLength': CORGI_LENGTH, 'goldenToCorgi': BREEDS['golden'], 'crewToStandingGolden': CREW_TO_GOLDEN},
        'sprites': sprites,
        '_notes': [
            'CastManifest (src/assets/art/manifest.ts) plus these notes. Every sprite is stored at 2x the yard\'s CSS size on '
            'the set\'s camera: 176 px per metre of the orthographic view (a metre straight up is 152.4 px; set.json\'s '
            'map.ppm, 139.14, is a metre along a lawn edge in the same camera), so the yard draws each at 0.5 and never '
            'rescales one breed differently.',
            'scale: corgiLength is the corgi\'s moving pose, trimmed width, in px at 2x; each other breed\'s moving pose is a '
            'fixed ratio of it (beagle 1.15, collie 1.35, poodle 1.3, Lab 1.55, golden 1.6), and its sit and sleep share '
            'that scale; the crew (crew-*) is crewToStandingGolden x the golden\'s standing height, and the second crew '
            'member (crew2-*: a different adult in the same uniform, so two or three staff on the floor are not one '
            'person repeated) is 1.07 x the first one\'s height.',
            'anchor: the ground point in the image\'s pixels (a dog: between its near and far feet; the crew: between the '
            'shoes). facing: every sprite faces right, along the camera-facing diagonal toward the lower right; mirror '
            'for the other diagonal (gate 5). No shadow is drawn in any sprite (gate 3).',
            'coat: the generated coat of each breed (golden gold, Lab black, poodle brown, corgi red, collie black, beagle '
            'tricolour) and its recolours in code (gate 6); docs/art-provenance/cast/README.md has every step.',
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
