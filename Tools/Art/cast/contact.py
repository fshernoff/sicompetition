"""The cast's contact sheets (gate 8): the six breeds in their three poses (6 x 3, the generated coat of each) and the
crew, standing on a board at the yard's 1x and at 2x, each on a contact shadow drawn here; the same sheets with every
figure mirrored (gate 5: mirroring at run time only after a mirrored sheet passes); and every shipped sprite, every
coat, on one sheet at 2x on the lawn's green and on cream.

usage: contact.py
Writes, in Temp/cast/: contact-1x.png, contact-2x.png and their -mirrored twins on spike B's 4 x 4 board
(Temp/spike-b/board.png, the brief's stand-in); contact-set-1x.png, contact-set-2x.png and their -mirrored twins on
WP4b's board (src/assets/art/set.json and set/board.webp) when it is there; and sheet-all.png. Prints any two
figures whose opaque pixels touch, and any anchor off the set's lawn (inside its margin) or on a blocked footprint.

Both boards are rendered at 2x on the cast's camera (176 px per metre of the orthographic view; a metre straight up
152.4 px; the set's map.ppm, 139.14, is a metre along a lawn edge in the same camera), so nothing is rescaled: a
sprite's foot anchor goes on the board pixel of its ground point. The shadow is the hybrid composite's
(Temp/spike-hybrid/hybrid.js) in Pillow, the same spec as set.json's "shadow": the silhouette thrown 0.72 px right and
0.185 px up per px of height, blurred 3.2 px, 30% in deep green, combined with a contact ellipse under the feet (0.42 x
0.11 of the width, blurred 5.2 px, 42%). WP3 draws the real ones; these only let a reader judge ground contact and
scale.
"""
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ART = os.path.join(ROOT, 'src', 'assets', 'art')
OUT = os.path.join(ROOT, 'Temp', 'cast')
PAGE = (233, 237, 240, 255)          # Floor's steel page
LAWN = (108, 162, 63, 255)
CREAM = (251, 246, 236, 255)
SHADOW = (12, 30, 18)
A_SH, B_SH = 0.72, -0.185            # the key light's throw per px of height (spike B's KEY through its camera)

# where each figure's foot anchor stands, in board pixels at 2x (rows from the back: goldens and Labs, poodles and
# collies, corgis and beagles; staggered so a figure's head clears the feet of the one behind), and the crew by the
# clubhouse door
PLACES = [
    ('crew-leash', 655, 640),
    ('golden-gold-moving', 250, 700), ('golden-gold-sitting', 500, 688), ('golden-gold-asleep', 690, 722),
    ('lab-black-moving', 950, 700), ('lab-black-sitting', 1130, 690), ('lab-black-asleep', 1300, 716),
    ('poodle-brown-moving', 200, 836), ('poodle-brown-sitting', 380, 842), ('poodle-brown-asleep', 600, 838),
    ('collie-black-moving', 880, 846), ('collie-black-sitting', 1060, 840), ('collie-black-asleep', 1250, 846),
    ('corgi-red-moving', 420, 958), ('corgi-red-sitting', 560, 946), ('corgi-red-asleep', 690, 962),
    ('beagle-tricolour-moving', 860, 958), ('beagle-tricolour-sitting', 1000, 956), ('beagle-tricolour-asleep', 1130, 964),
]


# the same on WP4b's board (2317 x 1427, a 7.2 m lawn): corgis and beagles at the back, goldens and Labs, poodles and
# collies at the front; the first crew member in front of the clubhouse door, the second by the gate
PLACES_SET = [
    ('crew-leash', 758, 748), ('crew2-ball', 1816, 779),
    ('corgi-red-moving', 900, 686), ('corgi-red-sitting', 1050, 686), ('corgi-red-asleep', 1190, 692),
    ('beagle-tricolour-moving', 1350, 686), ('beagle-tricolour-sitting', 1510, 686), ('beagle-tricolour-asleep', 1650, 692),
    ('golden-gold-moving', 920, 855), ('golden-gold-sitting', 1110, 850), ('golden-gold-asleep', 1270, 860),
    ('lab-black-moving', 1470, 855), ('lab-black-sitting', 1660, 850), ('lab-black-asleep', 1820, 880),
    ('poodle-brown-moving', 810, 1020), ('poodle-brown-sitting', 955, 1026), ('poodle-brown-asleep', 1090, 1026),
    ('collie-black-moving', 1295, 1010), ('collie-black-sitting', 1478, 1016), ('collie-black-asleep', 1610, 1012),
]


def set_world(m, px, py):
    """board pixel -> world metres on the set's map (the inverse of origin + x * ppm * (2, -1) / sqrt5 + y * ppm *
    (-2, -1) / sqrt5)"""
    k = m['ppm'] / 5 ** 0.5
    u, v = (px - m['origin'][0]) / (2 * k), (m['origin'][1] - py) / k      # u = x - y, v = x + y
    return (u + v) / 2, (v - u) / 2


def off_lawn(m, px, py):
    x, y = set_world(m, px, py)
    g = m['margin']
    if not (g <= x <= m['lawn'][0] - g and g <= y <= m['lawn'][1] - g):
        return f'off the lawn at ({x:.2f}, {y:.2f}) m'
    for bx, by, bw, bh in m['blocked']:
        if bx <= x <= bx + bw and by <= y <= by + bh:
            return f'on a blocked footprint at ({x:.2f}, {y:.2f}) m'
    return None


def load_cast():
    with open(os.path.join(ART, 'cast.json')) as f:
        m = json.load(f)
    return {s['id']: s for s in m['sprites']}


def sprite(cast, sid, mirrored):
    s = cast[sid]
    im = Image.open(os.path.join(ART, s['file'])).convert('RGBA')
    ax, ay = s['anchor']
    if mirrored:
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        ax = im.width - ax
    return im, ax, ay


def shadow(canvas_size, im, ax, ay, AX, AY):
    W, H = canvas_size
    a = im.getchannel('A')
    k = A_SH / B_SH
    cast = a.transform((W, H), Image.Transform.AFFINE,
                       (1, -k, -AX + ax + k * AY, 0, -1 / B_SH, ay + AY / B_SH), resample=Image.Resampling.BILINEAR)
    cast = cast.filter(ImageFilter.GaussianBlur(3.2)).point(lambda v: round(v * 0.30))
    e = Image.new('L', (W, H), 0)
    cx = AX + (im.width / 2 - ax) * 0.5
    ImageDraw.Draw(e).ellipse((cx - im.width * 0.42, AY - 2 - im.width * 0.11, cx + im.width * 0.42,
                               AY - 2 + im.width * 0.11), fill=255)
    e = e.filter(ImageFilter.GaussianBlur(5.2)).point(lambda v: round(v * 0.42))
    return ImageChops.screen(cast, e)          # a = 1 - (1 - a1)(1 - a2)


def compose(cast, board, mirrored, places):
    pad = 40
    W, H = board.width + 2 * pad, board.height + 2 * pad
    frame = Image.new('RGBA', (W, H), PAGE)
    frame.alpha_composite(board, (pad, pad))
    items = []
    for sid, bx, by in places:
        im, ax, ay = sprite(cast, sid, mirrored)
        items.append((by, sid, im, ax, ay, bx + pad, by + pad))
    shade = Image.new('L', (W, H), 0)
    for _, sid, im, ax, ay, X, Y in items:
        sh = shadow((W, H), im, ax, ay, X, Y)
        shade = ImageChops.screen(shade, sh)
    layer = Image.new('RGBA', (W, H), SHADOW + (255,))
    layer.putalpha(shade)
    frame.alpha_composite(layer)
    masks = []
    for _, sid, im, ax, ay, X, Y in sorted(items, key=lambda t: t[0]):
        x0, y0 = round(X - ax), round(Y - ay)
        frame.alpha_composite(im, (x0, y0))
        masks.append((sid, x0, y0, im.getchannel('A')))
    touching = []
    for i, (s1, x1, y1, m1) in enumerate(masks):
        for s2, x2, y2, m2 in masks[i + 1:]:
            ox0, oy0 = max(x1, x2), max(y1, y2)
            ox1, oy1 = min(x1 + m1.width, x2 + m2.width), min(y1 + m1.height, y2 + m2.height)
            if ox0 >= ox1 or oy0 >= oy1:
                continue
            a = m1.crop((ox0 - x1, oy0 - y1, ox1 - x1, oy1 - y1)).point(lambda v: 255 if v > 40 else 0)
            b = m2.crop((ox0 - x2, oy0 - y2, ox1 - x2, oy1 - y2)).point(lambda v: 255 if v > 40 else 0)
            both = sum(1 for p, q in zip(a.get_flattened_data(), b.get_flattened_data()) if p and q)
            if both:
                touching.append((s1, s2, both))
    return frame, touching


def half(im):
    return im.convert('RGBa').resize((im.width // 2, im.height // 2), Image.Resampling.LANCZOS).convert('RGBA')


def sheet_all(cast):
    rows = {}
    for sid, s in cast.items():
        rows.setdefault((s.get('breed', 'crew'), s.get('coat', '')), []).append(s)
    cw, ch = 270, 320
    keys = list(rows)
    per = 2
    ncols = 3 * per
    nrows = (len(keys) + per - 1) // per
    W, H = cw * ncols, ch * nrows
    sheet = Image.new('RGBA', (W * 2 + 20, H), (128, 128, 128, 255))
    for k, bg in enumerate((LAWN, CREAM)):
        panel = Image.new('RGBA', (W, H), bg)
        for n, key in enumerate(keys):
            r, c0 = divmod(n, per)
            for j, s in enumerate(rows[key]):
                im = Image.open(os.path.join(ART, s['file'])).convert('RGBA')
                ax, ay = s['anchor']
                X, Y = (c0 * 3 + j) * cw + cw // 2, r * ch + ch - 34
                panel.alpha_composite(im, (round(X - ax), round(Y - ay)))
        sheet.paste(panel, (k * (W + 20), 0))
    return sheet


def main():
    os.makedirs(OUT, exist_ok=True)
    cast = load_cast()
    boards = [('', os.path.join(ROOT, 'Temp', 'spike-b', 'board.png'), PLACES)]
    set_json = os.path.join(ART, 'set.json')
    if os.path.exists(set_json):
        with open(set_json) as f:
            sm = json.load(f)['board']
        boards.append(('-set', os.path.join(ART, sm['file']), PLACES_SET))
        for sid, bx, by in PLACES_SET:
            why = off_lawn(sm['map'], bx, by)
            if why:
                print(f'  {sid}: {why}')
    for name, path, places in boards:
        board = Image.open(path).convert('RGBA')
        for mirrored, tag in ((False, ''), (True, '-mirrored')):
            two, touching = compose(cast, board, mirrored, places)
            two.convert('RGB').save(os.path.join(OUT, f'contact{name}-2x{tag}.png'), optimize=True)
            half(two).convert('RGB').save(os.path.join(OUT, f'contact{name}-1x{tag}.png'), optimize=True)
            print(f'contact{name}{tag}: {len(places)} figures; touching: {touching or "none"}')
    sheet_all(cast).convert('RGB').save(os.path.join(OUT, 'sheet-all.png'), optimize=True)
    print('sheet-all: every sprite at 2x on the lawn and on cream')


if __name__ == '__main__':
    main()
