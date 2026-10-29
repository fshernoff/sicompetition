#!/bin/bash
# gen.sh <call-name> <subject> [<extra sentence>]: one timed image call through Tools/Agent/mockup.sh for one cast
# subject (a breed in subjects.json, or crew). Saves the exact prompt to Temp/cast/work/<call-name>.prompt.txt, copies
# the image to Temp/cast/raw/<call-name>.png, and appends a line to Temp/cast/calls.txt. Stops on the two codex
# account errors (exit 3 usage limit, exit 5 stale login) without retrying.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT" || exit 1
PY=${PY:-python3}
name="$1"; subject="$2"; extra="$3"
mkdir -p Temp/cast/work Temp/cast/raw
prompt="$($PY -I Tools/Art/cast/make_prompt.py "$subject" "$extra")" || exit 1
printf '%s\n' "$prompt" > "Temp/cast/work/$name.prompt.txt"
t0=$(date +%s)
out=$(Tools/Agent/mockup.sh "$name" "$prompt" 2>&1); rc=$?
t1=$(date +%s)
echo "$(date '+%Y-%m-%d %H:%M:%S') $name subject=$subject rc=$rc secs=$((t1-t0)) :: $out" >> Temp/cast/calls.txt
[ $rc -eq 0 ] && cp "Temp/AgentMockups/$name.png" "Temp/cast/raw/$name.png"
echo "$out"
exit $rc
