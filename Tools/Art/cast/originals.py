"""Copy the cast's generated originals into docs/art-provenance/cast/ (D55): each shipping strip re-encoded as lossless
WebP (checked pixel for pixel against the PNG), and the two references the calls loaded re-encoded at WebP quality 90,
as the G5c concepts are. Prints each file's SHA-256 (first 12 hex digits) before and after.

usage: originals.py     (reads Temp/cast/raw/ and Temp/AgentMockups/; run from anywhere)
"""
import hashlib
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
RAW = os.path.join(ROOT, 'Temp', 'cast', 'raw')
REF = os.path.join(ROOT, 'Temp', 'AgentMockups')
OUT = os.path.join(ROOT, 'docs', 'art-provenance', 'cast')

SHIPPING = ['cast-golden-1', 'cast-corgi-1', 'cast-collie-1', 'cast-beagle-1', 'cast-poodle-1', 'cast-lab-3',
            'cast-crew-1', 'cast-crew2-1']
REFERENCES = {'key.png': 'reference-key-floor', 'crewref.png': 'reference-crew'}
# the second crew call also loaded crew1ref.png, a copy of cast-crew-1.png, whose lossless original is already here


def sha12(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name in SHIPPING:
        src = os.path.join(RAW, f'{name}.png')
        dst = os.path.join(OUT, f'{name}.webp')
        im = Image.open(src).convert('RGB')
        im.save(dst, 'WEBP', lossless=True, quality=100, method=6)
        same = list(Image.open(dst).convert('RGB').get_flattened_data()) == list(im.get_flattened_data())
        print(f'{name}: png {sha12(src)} -> webp {sha12(dst)} {os.path.getsize(dst)} B, lossless {same}')
        assert same, name
    for src_name, stem in REFERENCES.items():
        src = os.path.join(REF, src_name)
        dst = os.path.join(OUT, f'{stem}.webp')
        Image.open(src).convert('RGB').save(dst, 'WEBP', quality=90, method=6)
        print(f'{stem}: png {sha12(src)} -> webp q90 {sha12(dst)} {os.path.getsize(dst)} B')


if __name__ == '__main__':
    main()
