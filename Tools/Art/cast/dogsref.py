"""The crew remake's style reference (G5d round 2, row 13): seven of the shipped dogs, at the resolution their sprites
are scaled from, on one sheet at one scale, so the image calls for the crew see the dogs' facets, light and camera up
close and draw the people to match.

usage: dogsref.py     (reads Temp/cast/cut/, which run_all.sh writes; writes Temp/AgentMockups/dogsref.png)
Pillow only. Each figure is the keyed, cut figure of a shipped strip (key_cut.py), resized by its breed's scale over
the golden's (build_cast.py's scale table), so every dog stands at the golden strip's scale: the crew, drawn about
2.2 x a standing golden's height on this sheet, comes back with facets of the dogs' size. Floor's steel page behind,
no shadow, no text.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True          # no __pycache__ in Tools/
sys.path.insert(0, HERE)
from build_cast import BREEDS, CORGI_LENGTH  # noqa: E402  (the scale table: one source)

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CUT = os.path.join(ROOT, 'Temp', 'cast', 'cut')
OUT = os.path.join(ROOT, 'Temp', 'AgentMockups', 'dogsref.png')
PAGE = (233, 237, 240, 255)
SIZE = (1536, 1024)

# (subject, figure, foot point on the sheet); two rows, the back row higher, every figure facing right
LAYOUT = [
    ('golden', 1, (310, 440)), ('collie', 1, (800, 440)), ('lab', 2, (1260, 440)),
    ('beagle', 1, (240, 960)), ('corgi', 2, (610, 960)), ('poodle', 2, (940, 960)), ('golden', 2, (1300, 960)),
]


def main():
    scale = {}
    for breed, ratio in BREEDS.items():
        w = Image.open(os.path.join(CUT, f'{breed}-01.png')).width
        scale[breed] = ratio * CORGI_LENGTH / w
    sheet = Image.new('RGBA', SIZE, PAGE)
    for subject, n, (fx, fy) in LAYOUT:
        im = Image.open(os.path.join(CUT, f'{subject}-0{n}.png')).convert('RGBA')
        k = scale[subject] / scale['golden']
        if abs(k - 1) > 1e-6:
            im = im.convert('RGBa').resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS).convert('RGBA')
        sheet.alpha_composite(im, (round(fx - im.width / 2), round(fy - im.height)))
        print(f'{subject}-0{n}: x {k:.3f} -> {im.size}')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.convert('RGB').save(OUT)
    print(OUT)


if __name__ == '__main__':
    main()
