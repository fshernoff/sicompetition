#!/bin/bash
# Ask GPT-6-Astra (OpenAI, via the owner's logged-in Codex CLI) something, from the repo root.
# Usage: astra.sh [-w] [-e low|medium|high|xhigh] "prompt"
#   default  read-only sandbox: Astra can read the repo and run commands (npm test, npm run sim), can't edit files.
#   -w       workspace-write sandbox: may edit files in the repo. Owner approval first; only on a branch; review the diff.
# The final reply is printed and saved to Temp/AgentCodex/<timestamp>.md (git-ignored), the run log beside it.
source "$(dirname "$0")/common.sh"
# The standalone CLI has gone missing from PATH before; the ChatGPT app ships one that uses the same ~/.codex login.
command -v codex >/dev/null || PATH="$HOME/.local/bin:/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin:$PATH"
SANDBOX=read-only; EFFORT=medium
while getopts "we:" opt; do
  case $opt in
    w) SANDBOX=workspace-write ;;
    e) EFFORT=$OPTARG ;;
    *) echo "usage: astra.sh [-w] [-e effort] \"prompt\""; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
[ -z "$1" ] && { echo "usage: astra.sh [-w] [-e effort] \"prompt\""; exit 2; }
command -v codex >/dev/null || { echo "CODEX CLI NOT FOUND - ask the owner to install it (see Tools/Agent/CODEX.md)"; exit 4; }
OUT="$ROOT/Temp/AgentCodex"; mkdir -p "$OUT"
FILE="$OUT/$(date +%Y%m%d-%H%M%S).md"
codex exec -m gpt-6-astra -c "model_reasoning_effort=\"$EFFORT\"" -s "$SANDBOX" --ephemeral -C "$ROOT" -o "$FILE" "$1" < /dev/null > "$FILE.log" 2>&1
code=$?
# A reply wins: the log also holds every file Astra read. The usage limit and the stale-login case are named so the
# main thread can tell the owner instead of working around them.
[ -s "$FILE" ] && { cat "$FILE"; echo; exit 0; }
if grep -q "usage limit" "$FILE.log"; then echo "CODEX USAGE LIMIT HIT - ask the owner to reset/upgrade (see $FILE.log)"; exit 3; fi
if grep -q "401 Unauthorized" "$FILE.log"; then echo "CODEX LOGIN STALE (401) - the owner runs: codex logout && codex login (see $FILE.log)"; exit 5; fi
echo "no reply (exit $code); see $FILE.log"; exit 1
