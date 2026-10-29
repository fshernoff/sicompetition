"""Key a flat magenta strip to real alpha and cut it into one trimmed RGBA PNG per figure (Pillow only).

usage: key_cut.py <strip.png> <outdir> <prefix> [--no-pink]    (figures are numbered left to right)
Writes <outdir>/<prefix>-keyed.png and <outdir>/<prefix>-NN.png and prints what it did. KEY_VERBOSE=1 lists every
closed gap.

Spike A's keyer (Temp/spike-a/work/key_cut.py), reworked for three things the spike left in its sprites: salmon or
pink pixels where fur meets a small gap the key filled (a leg gap, a hand round a leash, the creases between toes);
a lavender or pink rim where the model lit a pale surface with the magenta round it; and edge pixels that only the
magenta strength judged. Every pixel is compared with the median colour M of its 9 x 9 neighbourhood (the surface it
sits on), and the edge band is matted against the figure colour that best explains it.

The steps, in order:
1. The key colour K: the median of the border pixels.
2. The key mask: magenta strength s = min(r, b) - g >= HI, or the key darkened in a crevice (green far below red and
   blue, red and blue balanced). Key pixels get alpha 0.
3. Each other pixel c is compared with M, the median taken over the figure alone (the key pixels next to a figure
   first take the figure's colour from inside its anti-aliased rim, pushed outward ring by ring; M is skipped where
   it is still key, s(M) >= LO):
   - key-mixed: |c - M| >= MIXED_MIN and c - M points at the key (cosine with K - M above MIXED_COS); its key share
     t is the projection of c - M on K - M (salmon on a golden has a negative magenta strength, so only this sees it);
   - bounce-lit: within SPILL px of the key, red and blue both above M's and c - M along (1, 0, 1) (cosine above
     BOUNCE_COS, at least BOUNCE_MIN long): magenta light added, no key mixed in.
4. Closed gaps. Key and key-mixed pixels form 4-connected groups. A group that does not reach the image's edge is
   closed (each pixel takes M, opaque) when it holds no pure key and is no bigger than HOLE_MAX px (a painted smudge)
   or holds pure key and is no bigger than PINHOLE px (a pin hole). Real gaps (the loops of a coiled leash, the space
   between an arm and the body) hold pure key, are bigger, and stay open for the matte.
5. Unmixing, for every pixel not touching the key (the silhouette's own anti-aliasing is the matte's): a key-mixed
   pixel becomes (c - tK) / (1 - t), opaque (M if t > 0.6); a bounce-lit pixel loses the mean of its red and blue
   excess over M from red and blue.
6. The band is matted: every non-key pixel within BAND px of the key, and every pixel with a magenta tint (s > TINT).
   Candidates are the clean figure pixels (s <= CLEAN, further than BAND px from the key) within RADIUS px (2 x RADIUS
   if none); for each, a = clamp((c-K).(F-K) / |F-K|^2) and the residual |c - (aF + (1-a)K)|; the least residual
   wins and the pixel becomes F with alpha a (a >= KEEP keeps the pixel as it is). With no candidate in reach, the
   spike's strength rule applies.
7. Key haze (pink connected to the background through pink pixels) fades by its saturation, as in the spike.
8. Any pixel still magenta in hue (0.70 to 0.96: a red leash or a pink inner ear, hue above 0.96, is left alone)
   loses its magenta: a light one by lifting its green, a dark one by taking the magenta out of red and blue; only a
   pixel within BAND px of the key may also fade. A near-neutral edge pixel with a green cast loses the cast.
8b. The wide sweep. A crease the model drew as a sub-pixel gap (between toes, under a belly) comes back as a line of
   salmon or pink several pixels wide, wide enough to be its own 9 x 9 median. So every visible pixel is compared
   once more with the surface's colour at a wider scale (the figure-only image at a quarter size, a 5 x 5 median,
   scaled back: about a 20 px window); a pixel in the key's direction from it (cosine above WIDE_COS) carrying at
   least WIDE_MIN of the key is unmixed, its alpha kept.
8c. With --no-pink (a coat with no pink in it: every breed here but the corgi, whose inner ears are pink, and never
   the crew, whose skin, lips and leash sit in that hue), any visible pixel (saturation above 0.12, value above 0.3)
   redder or pinker than its surface's wide colour (a hue 0.025 to 0.3 short of it) takes that hue at its own value,
   no more saturated than it was; on a near-neutral surface (white, black) a pink or lavender pixel (hue 0.80 to
   0.05, saturation above 0.05) goes neutral. The last of the key bled into a crease sits a little redward of the
   coat (salmon on a yellow Lab).
9. Alpha below 10 becomes 0.
10. Figures are connected opaque groups (alpha >= 40), grouped by overlapping columns, specks under 0.4% of the
    biggest dropped, each cut and trimmed.
"""
import colorsys
import os
import sys
from collections import deque

from PIL import Image, ImageFilter

LO, HI = 45, 175     # magenta strength: <= LO a solid figure pixel, >= HI pure key
BAND = 3             # px from the key that are matted
TINT = 12            # a magenta tint above this is matted wherever it is
CLEAN = 2            # a figure pixel at or below this strength can explain an edge pixel
RADIUS = 6           # px searched for the figure colour that explains an edge pixel
KEEP = 0.96          # a matte above this keeps the pixel as it is
MIXED_MIN = 14       # a pixel this far (RGB) from its neighbourhood's median ...
MIXED_COS = 0.85     # ... and this closely in the key's direction is key-mixed
HOLE_MAX = 64        # px: a closed group of key-mixed pixels (no pure key) no bigger than this is a gap to close
PINHOLE = 12         # px: a closed group holding pure key is closed only up to this size (a real gap stays open)
SPILL = 12           # px from the key where a pixel may be bounce-lit
BOUNCE_MIN = 6       # RGB length of the bounce ...
BOUNCE_COS = 0.88    # ... and how closely it runs along (1, 0, 1)
PUSH = 10            # rings of figure colour pushed into the key before the median (so M is never the key)
WIDE_COS = 0.8       # the wide sweep: a pixel this closely in the key's direction from its surface's colour ...
WIDE_MIN = 0.05      # ... carrying at least this share of the key is unmixed


def main(src, outdir, prefix, no_pink=False):
    verbose = bool(os.environ.get('KEY_VERBOSE'))
    os.makedirs(outdir, exist_ok=True)
    im = Image.open(src).convert('RGB')
    W, H = im.size
    N = W * H
    data = list(im.get_flattened_data())

    # 1, 2
    border = [data[x] for x in range(W)] + [data[(H - 1) * W + x] for x in range(W)]
    border += [data[y * W] for y in range(H)] + [data[y * W + W - 1] for y in range(H)]
    K = tuple(sorted(p[c] for p in border)[len(border) // 2] for c in range(3))
    KR, KG, KB = K
    print(f'key colour measured {KR},{KG},{KB}')

    def is_key(r, g, b):
        m = max(r, b)
        return (min(r, b) - g) >= HI or (m > 50 and (min(r, b) - g) >= 0.72 * m and abs(r - b) <= 0.3 * m)

    keymask = [is_key(*p) for p in data]

    def within(mask, px_):
        m = Image.new('L', (W, H))
        m.putdata([255 if v else 0 for v in mask])
        return list(m.filter(ImageFilter.MaxFilter(2 * px_ + 1)).get_flattened_data())

    spillzone = within(keymask, SPILL)

    # 3: the median is taken over the figure only: key pixels near a figure first take the figure's colour, pushed
    # outward ring by ring (the mean of their already-filled 8-neighbours), so an edge pixel's M is its surface
    rim = within(keymask, 2)   # the silhouette's own anti-aliased rim is not pushed (it carries the key)
    fill = [None if rim[i] else data[i] for i in range(N)]
    ring = [i for i, v in enumerate(within([not r for r in rim], PUSH + 2)) if v and rim[i]]
    for _ in range(PUSH + 2):
        newly = []
        for i in ring:
            if fill[i] is not None:
                continue
            y, x = divmod(i, W)
            acc = [0, 0, 0, 0]
            for yy in range(max(0, y - 1), min(H, y + 2)):
                for xx in range(max(0, x - 1), min(W, x + 2)):
                    f = fill[yy * W + xx]
                    if f is not None:
                        acc[0] += f[0]
                        acc[1] += f[1]
                        acc[2] += f[2]
                        acc[3] += 1
            if acc[3]:
                newly.append((i, (acc[0] // acc[3], acc[1] // acc[3], acc[2] // acc[3])))
        for i, c in newly:
            fill[i] = c
    filled = Image.new('RGB', (W, H))
    filled.putdata([f if f is not None else K for f in fill])
    med = list(filled.filter(ImageFilter.MedianFilter(9)).get_flattened_data())
    mixed = bytearray(N)
    share = [0.0] * N
    bounce = [0.0] * N
    for i, (r, g, b) in enumerate(data):
        if keymask[i]:
            mixed[i] = 1
            continue
        mr, mg, mb = med[i]
        if min(mr, mb) - mg >= LO:
            continue
        dr, dg, db = r - mr, g - mg, b - mb
        dd = dr * dr + dg * dg + db * db
        if dd >= MIXED_MIN * MIXED_MIN:
            er, eg, eb = KR - mr, KG - mg, KB - mb
            ee = er * er + eg * eg + eb * eb
            dot = dr * er + dg * eg + db * eb
            if dot > 0 and dot * dot > MIXED_COS * MIXED_COS * dd * ee:
                mixed[i] = 1
                share[i] = min(1.0, dot / ee)
                continue
        if spillzone[i] and dr > 0 and db > 0 and dd >= BOUNCE_MIN * BOUNCE_MIN:
            along = dr + db
            if along * along > BOUNCE_COS * BOUNCE_COS * 2 * dd:
                bounce[i] = along / 2

    # 4
    seen = bytearray(N)
    sealed = groups = 0
    for start in range(N):
        if not mixed[start] or seen[start]:
            continue
        seen[start] = 1
        q, group, outside = deque([start]), [], False
        while q:
            i = q.popleft()
            group.append(i)
            y, x = divmod(i, W)
            if x == 0 or y == 0 or x == W - 1 or y == H - 1:
                outside = True
            for j in (i - 1 if x > 0 else -1, i + 1 if x < W - 1 else -1, i - W, i + W):
                if 0 <= j < N and mixed[j] and not seen[j]:
                    seen[j] = 1
                    q.append(j)
        haskey = any(keymask[i] for i in group)
        if outside or len(group) > (PINHOLE if haskey else HOLE_MAX):
            continue
        groups += 1
        if verbose:
            ys, xs = [i // W for i in group], [i % W for i in group]
            print(f'  closed {len(group)} px at x {min(xs)}..{max(xs)}, y {min(ys)}..{max(ys)}')
        for i in group:
            data[i] = med[i]
            keymask[i] = False
            mixed[i] = 0
            sealed += 1
    print(f'closed gaps: {groups} ({sealed} px)')

    # 5
    near = within(keymask, BAND)
    edge = within(keymask, 1)
    unmixed = unlit = 0
    for i in range(N):
        if keymask[i] or edge[i]:
            continue
        r, g, b = data[i]
        if mixed[i]:
            t = share[i]
            if t > 0.6:
                data[i] = med[i]
            else:
                data[i] = tuple(max(0, min(255, round((c - t * k) / (1 - t)))) for c, k in zip((r, g, b), K))
            unmixed += 1
        elif bounce[i]:
            p = round(bounce[i])
            data[i] = (max(0, r - p), g, max(0, b - p))
            unlit += 1
    print(f'unmixed: {unmixed} px, bounce taken out: {unlit} px')
    strength = [min(r, b) - g for (r, g, b) in data]

    # 6
    px = [(r, g, b, 0) if keymask[i] else (r, g, b, 255) for i, (r, g, b) in enumerate(data)]

    def solid(j):
        return not keymask[j] and not near[j] and strength[j] <= CLEAN

    def explain(i, rad):
        """the clean figure pixel within rad px that best explains pixel i as a mix with the key: (residual, a, F)"""
        r, g, b = data[i]
        y, x = divmod(i, W)
        cr, cg, cb = r - KR, g - KG, b - KB
        best = None
        for yy in range(max(0, y - rad), min(H, y + rad + 1)):
            row = yy * W
            for xx in range(max(0, x - rad), min(W, x + rad + 1)):
                j = row + xx
                if not solid(j):
                    continue
                fr, fg, fb = data[j]
                dr, dg, db = fr - KR, fg - KG, fb - KB
                den = dr * dr + dg * dg + db * db
                if den < 400:
                    continue
                a = (cr * dr + cg * dg + cb * db) / den
                a = 0.0 if a < 0 else 1.0 if a > 1 else a
                er, eg, eb = r - (KR + a * dr), g - (KG + a * dg), b - (KB + a * db)
                res = er * er + eg * eg + eb * eb + 0.5 * ((xx - x) ** 2 + (yy - y) ** 2)
                if best is None or res < best[0]:
                    best = (res, a, data[j])
        return best

    matted = fallback = 0
    for i in range(N):
        if keymask[i] or not (near[i] or strength[i] > TINT):
            continue
        r, g, b = data[i]
        best = explain(i, RADIUS) or explain(i, 2 * RADIUS)
        if best is None:
            s = strength[i]
            if s <= LO:
                continue
            a = max(0.0, min(1.0, 1 - (s - LO) / (HI - LO)))
            m = max(0, min(r, b) - g)
            px[i] = (r - m, g, b - m, round(a * 255))
            fallback += 1
            continue
        _, a, F = best
        if a >= KEEP:
            continue
        px[i] = (F[0], F[1], F[2], round(a * 255))
        matted += 1
    print(f'edge band matted: {matted} px, strength fallback: {fallback} px')

    # 7
    def pinkish(r, g, b):
        if min(r, b) <= g:
            return False
        h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        return 0.75 <= h <= 0.95 and s_ > 0.05

    reached = bytearray(N)
    q = deque()
    for i, (r, g, b, a) in enumerate(px):
        if a == 0:
            y, x = divmod(i, W)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H:
                    j = ny * W + nx
                    if not reached[j] and px[j][3] > 0 and pinkish(*px[j][:3]):
                        reached[j] = 1
                        q.append(j)
    while q:
        i = q.popleft()
        y, x = divmod(i, W)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H:
                j = ny * W + nx
                if not reached[j] and px[j][3] > 0 and pinkish(*px[j][:3]):
                    reached[j] = 1
                    q.append(j)
    bled = 0
    for i in range(N):
        if not reached[i]:
            continue
        r, g, b, a = px[i]
        h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        keep = max(0.0, min(1.0, 1 - (s_ - 0.06) / 0.07))
        m = min(r, b) - g
        px[i] = (r - m, g, b - m, round(a * keep))
        bled += 1
    print(f'key haze pixels faded: {bled}')

    # 8
    despilled = 0
    for i, (r, g, b, a) in enumerate(px):
        if a == 0 or min(r, b) <= g:
            continue
        h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        m = min(r, b) - g
        if 0.70 <= h <= 0.96 and m > 6:
            k = m / max(r, b)
            keep = max(0.0, min(1.0, 1 - (k - 0.12) / 0.25)) if near[i] else 1.0
            if v > 0.55:
                r2, g2, b2 = r, min(r, b), b
            else:
                r2, g2, b2 = r - m, g, b - m
            px[i] = (r2, g2, b2, round(a * keep))
            despilled += 1
    print(f'despilled: {despilled} px')
    A2 = Image.new('L', (W, H))
    A2.putdata([p[3] for p in px])
    inner = list(A2.filter(ImageFilter.MinFilter(5)).get_flattened_data())
    for i, (r, g, b, a) in enumerate(px):
        if a == 0 or inner[i] == 255:
            continue
        hi = max(r, b)
        if abs(r - b) < 24 and 0 < g - hi <= 40:
            px[i] = (r, hi, b, a)
    # 8b: the wide sweep (see the docstring)
    q4 = filled.resize((W // 4, H // 4), Image.Resampling.BOX).filter(ImageFilter.MedianFilter(5))
    wide = list(q4.resize((W, H), Image.Resampling.BILINEAR).get_flattened_data())
    swept = 0
    for i, (r, g, b, a) in enumerate(px):
        if a == 0:
            continue
        mr, mg, mb = wide[i]
        if min(mr, mb) - mg >= LO:
            continue
        dr, dg, db = r - mr, g - mg, b - mb
        dd = dr * dr + dg * dg + db * db
        er, eg, eb = KR - mr, KG - mg, KB - mb
        ee = er * er + eg * eg + eb * eb
        dot = dr * er + dg * eg + db * eb
        if dot <= 0 or dot * dot <= WIDE_COS * WIDE_COS * dd * ee:
            continue
        t = dot / ee
        if t < WIDE_MIN:
            continue
        t = min(t, 0.6)
        px[i] = tuple(max(0, min(255, round((c - t * k) / (1 - t)))) for c, k in zip((r, g, b), K)) + (a,)
        swept += 1
    print(f'wide sweep unmixed: {swept} px')
    # 8c: no pink in a coat that has none (see the docstring)
    if no_pink:
        repinked = 0
        for i, (r, g, b, a) in enumerate(px):
            if a == 0:
                continue
            h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s_ <= 0.05 or v <= 0.3:
                continue
            wh, ws, wv = colorsys.rgb_to_hsv(*(c / 255 for c in wide[i]))
            if ws < 0.12:
                if not (h >= 0.80 or h <= 0.05):
                    continue
                nr = ng = nb = v                              # pink on a near-neutral surface (white, black): neutral
            else:
                if s_ <= 0.12 or not 0.025 < (wh - h) % 1.0 < 0.3:
                    continue                                  # not redder or pinker than its surface
                nr, ng, nb = colorsys.hsv_to_rgb(wh, min(ws, s_), v)
            px[i] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
            repinked += 1
        print(f'pink taken out of the coat: {repinked} px')
    # 9
    px = [(r, g, b, 0 if a < 10 else a) for (r, g, b, a) in px]

    out = Image.new('RGBA', (W, H))
    out.putdata(px)
    out.save(os.path.join(outdir, f'{prefix}-keyed.png'))

    # 10
    A = out.getchannel('A').point(lambda v: 255 if v >= 40 else 0)
    sw, sh = W // 2, H // 2
    small = A.resize((sw, sh), Image.Resampling.BOX).load()
    seen = bytearray(sw * sh)
    comps = []
    for y in range(sh):
        for x in range(sw):
            if seen[y * sw + x] or small[x, y] < 60:
                continue
            q = deque([(x, y)])
            seen[y * sw + x] = 1
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while q:
                cx, cy = q.popleft()
                n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < sw and 0 <= ny < sh and not seen[ny * sw + nx] and small[nx, ny] >= 60:
                        seen[ny * sw + nx] = 1
                        q.append((nx, ny))
            comps.append([n, x0 * 2, y0 * 2, (x1 + 1) * 2, (y1 + 1) * 2])
    big = max(c[0] for c in comps)
    specks = [c for c in comps if c[0] < 0.004 * big]
    parts = sorted([c for c in comps if c[0] >= 0.004 * big], key=lambda c: c[1])
    figs = []
    for c in parts:
        if figs and c[1] <= figs[-1][3] + 6:
            f = figs[-1]
            f[0] += c[0]
            f[1], f[2], f[3], f[4] = min(f[1], c[1]), min(f[2], c[2]), max(f[3], c[3]), max(f[4], c[4])
        else:
            figs.append(list(c))
    print(f'{len(figs)} figures, {len(specks)} specks dropped')
    for i, (n, x0, y0, x1, y1) in enumerate(figs, 1):
        pad = 4
        box = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))
        c = out.crop(box)
        for s in specks:
            if s[1] >= box[0] and s[3] <= box[2] and s[2] >= box[1] and s[4] <= box[3]:
                c.paste((0, 0, 0, 0), (s[1] - box[0] - 2, s[2] - box[1] - 2, s[3] - box[0] + 2, s[4] - box[1] + 2))
        bb = c.getchannel('A').point(lambda v: 255 if v >= 8 else 0).getbbox()
        c = c.crop(bb)
        c.save(os.path.join(outdir, f'{prefix}-{i:02d}.png'))
        print(i, box, c.size)


if __name__ == '__main__':
    main(*sys.argv[1:4], no_pink='--no-pink' in sys.argv[4:])
