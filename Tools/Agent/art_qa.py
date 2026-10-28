"""Crops an image figure by figure for the art QA (D58), so a reader checks every animal and person at full size.

Usage (Pillow needed: a scratch venv, as for cut_sprites.py):
    python art_qa.py [--out Temp/art-qa] <image> [<image> ...]

A sprite or a sheet (an image with real transparency): one crop per figure, a figure being a connected group of
opaque pixels; specks too small to be a figure are counted and reported, since a speck is itself a defect. A scene
(no transparency): tiles of about 700 px of the original overlapping by half, so any figure up to half a tile wide is whole in one of them
and every tile shows at 2x or more. Every crop is scaled to at least 2x (a crop over 800 px is cut to 1600 on its long
side) and drawn twice, on the page's cream and on near-black,
so a halo or a fringe shows on one of them. Writes <out>/<stem>/crop-NN.png and <out>/<stem>/contact.png and prints
one line per image.
"""
import argparse
import os
import sys
from collections import deque

from PIL import Image

CREAM = (251, 246, 236, 255)
DARK = (30, 30, 30, 255)
ALPHA_MIN = 40  # the cutter's own threshold: fainter pixels are dropped from a shipped sprite
STEP = 4  # figures are found on a mask shrunk by this factor (fast enough in plain Python)


def has_alpha(im):
    if im.mode != "RGBA":
        return False
    lo, hi = im.getchannel("A").getextrema()
    return lo < 250


def figures(im):
    """Bounding boxes of the connected opaque groups, biggest first, and the number of specks dropped."""
    w, h = im.size
    small = im.getchannel("A").resize((max(1, w // STEP), max(1, h // STEP)), Image.Resampling.BOX)
    sw, sh = small.size
    px = small.load()
    seen = bytearray(sw * sh)
    boxes = []
    for y in range(sh):
        for x in range(sw):
            if seen[y * sw + x] or px[x, y] < ALPHA_MIN:
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
                    if 0 <= nx < sw and 0 <= ny < sh and not seen[ny * sw + nx] and px[nx, ny] >= ALPHA_MIN:
                        seen[ny * sw + nx] = 1
                        q.append((nx, ny))
            boxes.append((n, (x0 * STEP, y0 * STEP, min(w, (x1 + 1) * STEP), min(h, (y1 + 1) * STEP))))
    if not boxes:
        return [], 0
    biggest = max(n for n, _ in boxes)
    keep = [b for n, b in sorted(boxes, reverse=True) if n >= 0.02 * biggest]
    return keep, len(boxes) - len(keep)


def tiles(w, h, target=700, overlap=0.5):
    import math
    across = max(1, math.ceil((w / target - overlap) / (1 - overlap)))
    down = max(1, math.ceil((h / target - overlap) / (1 - overlap)))
    if across == 1 and down == 1:
        return [(0, 0, w, h)]
    across, down = max(across, 2), max(down, 1)
    tw, th = w / (across - (across - 1) * overlap), h / (down - (down - 1) * overlap)
    out = []
    for j in range(down):
        for i in range(across):
            x0, y0 = int(i * tw * (1 - overlap)), int(j * th * (1 - overlap))
            out.append((x0, y0, min(w, int(x0 + tw)), min(h, int(y0 + th))))
    return out


def on_backgrounds(crop):
    scale = 2.0
    long_side = max(crop.size) * scale
    if long_side > 1600:
        scale = 1600 / max(crop.size)
    size = (max(1, int(crop.width * scale)), max(1, int(crop.height * scale)))
    big = crop.resize(size, Image.Resampling.LANCZOS)
    pad = 24
    sheet = Image.new("RGBA", (size[0] * 2 + pad * 3, size[1] + pad * 2), (128, 128, 128, 255))
    for k, bg in enumerate((CREAM, DARK)):
        panel = Image.new("RGBA", size, bg)
        panel.alpha_composite(big)
        sheet.paste(panel, (pad + k * (size[0] + pad), pad))
    return sheet


def contact(crops, width=2000):
    thumbs = []
    for c in crops:
        s = min(1.0, (width / 3 - 20) / c.width)
        thumbs.append(c.resize((max(1, int(c.width * s)), max(1, int(c.height * s)))))
    rows, row, x = [], [], 0
    for t in thumbs:
        if row and x + t.width > width:
            rows.append(row)
            row, x = [], 0
        row.append(t)
        x += t.width + 10
    if row:
        rows.append(row)
    height = sum(max(t.height for t in r) + 10 for r in rows) + 10
    sheet = Image.new("RGB", (width, max(1, height)), (90, 90, 90))
    y = 10
    for r in rows:
        x = 10
        for t in r:
            sheet.paste(t.convert("RGB"), (x, y))
            x += t.width + 10
        y += max(t.height for t in r) + 10
    return sheet


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="Temp/art-qa")
    ap.add_argument("images", nargs="+")
    args = ap.parse_args()
    for path in args.images:
        im = Image.open(path).convert("RGBA")
        stem = os.path.splitext(os.path.basename(path))[0]
        out = os.path.join(args.out, stem)
        os.makedirs(out, exist_ok=True)
        for old in os.listdir(out):
            if old.endswith(".png"):
                os.remove(os.path.join(out, old))
        if has_alpha(im):
            boxes, specks = figures(im)
            kind = f"{len(boxes)} figure(s), {specks} speck(s)"
        else:
            boxes, specks = tiles(*im.size), 0
            kind = f"scene, {len(boxes)} tiles"
        crops = []
        for n, box in enumerate(boxes, 1):
            sheet = on_backgrounds(im.crop(box))
            sheet.save(os.path.join(out, f"crop-{n:02d}.png"))
            crops.append(sheet)
        if crops:
            contact(crops).save(os.path.join(out, "contact.png"))
        print(f"{path}: {kind} -> {out}/")
        if specks:
            print(f"  {specks} speck(s) outside the figures: a defect to fix at the cutter", file=sys.stderr)


if __name__ == "__main__":
    main()
