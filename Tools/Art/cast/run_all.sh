#!/bin/bash
# The cast from the generated strips to the shipped sprites, the contact sheets and the QA crops (no image calls).
# Run from anywhere. PY is a Python with Pillow (the scratch venv); every script runs with -I.
#   Tools/Art/cast/run_all.sh
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
PY=${PY:-python3}
T=Tools/Art/cast
RAW=Temp/cast/raw
CUT=Temp/cast/cut
mkdir -p "$CUT"
# the strip each subject ships from (the call that came back clean; see docs/art-provenance/cast/README.md)
STRIPS="golden:cast-golden-1 corgi:cast-corgi-2 collie:cast-collie-1 beagle:cast-beagle-2 poodle:cast-poodle-1 lab:cast-lab-3 labyellow:cast-labyellow-1 crew:cast-crew-1 crew2:cast-crew2-1"
for pair in $STRIPS; do
  subject=${pair%%:*}; strip=${pair#*:}
  # --no-pink: every dog but the corgi (pink inner ears); --no-green: the dogs whose green fringe the D58 readers
  # found or whose strip was remade in that round (beagle, collie, corgi, the yellow Lab), so the passed golden, black
  # Lab and brown poodle keep their bytes; the crew neither (skin, a teal shirt)
  case "$subject" in
    crew|crew2) flags= ;;
    corgi) flags=--no-green ;;
    beagle|collie|labyellow) flags="--no-pink --no-green" ;;
    *) flags=--no-pink ;;
  esac
  $PY -I $T/key_cut.py "$RAW/$strip.png" "$CUT" "$subject" $flags > "$CUT/$subject.txt" &
done
wait
$PY -I $T/build_cast.py "$CUT"
$PY -I $T/contact.py
$PY -I Tools/Agent/art_qa.py --out Temp/cast/qa src/assets/art/cast/*.webp > Temp/cast/qa.txt
cat Temp/cast/qa.txt
