# Cut a transparent sprite sheet into clean, trimmed sprites: per grid cell, scale down, drop faint alpha, keep the
# figure's connected shape (and any piece at least `keep` of its size, e.g. a held ball), trim, save PNG.
import sys
from collections import deque
from PIL import Image

def clean(cell, max_side, alpha_floor=40, keep=0.03):
    cell = cell.convert('RGBA')
    w, h = cell.size
    s = min(1.0, max_side / max(w, h))
    if s < 1: cell = cell.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    w, h = cell.size
    px = cell.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or px[x, y][3] < alpha_floor: continue
            q = deque([(x, y)]); seen[y][x] = True; pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3] >= alpha_floor:
                        seen[ny][nx] = True; q.append((nx, ny))
            comps.append(pts)
    if not comps: return None
    big = max(len(c) for c in comps)
    keepset = set()
    for c in comps:
        if len(c) >= keep * big: keepset.update(c)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    for (x, y) in keepset: op[x, y] = px[x, y]
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else None

if __name__ == '__main__':
    src, cols, rows, max_side, outdir, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6].split(',')
    im = Image.open(src)
    W, H = im.size
    i = 0
    for r in range(rows):
        for c in range(cols):
            box = (round(c * W / cols), round(r * H / rows), round((c + 1) * W / cols), round((r + 1) * H / rows))
            sprite = clean(im.crop(box), max_side)
            name = names[i]; i += 1
            if name == '-' or sprite is None: continue
            sprite.save(f'{outdir}/{name}.png', optimize=True)
            print(name, sprite.size)
