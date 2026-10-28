#!/bin/bash
# Ask GPT image generation (through the owner's logged-in Codex CLI) for one image, from the repo root.
# Usage: mockup.sh <name> "description"   -> Temp/AgentMockups/<name>.png (git-ignored), path printed on success.
# Mockups are references. A generated image ships only under D55: the owner's approval, used sparingly, kept in
# src/assets/art/ with its prompt beside it, and disclosed in the README.
source "$(dirname "$0")/common.sh"
command -v codex >/dev/null || PATH="$HOME/.local/bin:/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin:$PATH"
[ -z "$2" ] && { echo "usage: mockup.sh <name> \"description\""; exit 2; }
command -v codex >/dev/null || { echo "CODEX CLI NOT FOUND - ask the owner (see Tools/Agent/CODEX.md)"; exit 4; }
OUT="$ROOT/Temp/AgentMockups"; mkdir -p "$OUT"
rm -f "$OUT/$1.png"
codex exec -m gpt-6-astra -c 'model_reasoning_effort="low"' -s workspace-write --skip-git-repo-check --ephemeral -C "$OUT" \
  -o "$OUT/$1.reply.md" \
  "Use your image generation tool to create exactly one image: $2. Save it in the current working directory as $1.png, then reply with only the saved file path." \
  < /dev/null > "$OUT/$1.log" 2>&1
if grep -q "usage limit" "$OUT/$1.log"; then echo "CODEX USAGE LIMIT HIT - ask the owner to reset/upgrade"; exit 3; fi
if grep -q "401 Unauthorized" "$OUT/$1.log"; then echo "CODEX LOGIN STALE (401) - the owner runs: codex logout && codex login"; exit 5; fi
[ -f "$OUT/$1.png" ] && echo "$OUT/$1.png" || { echo "no image produced; see $OUT/$1.log and $OUT/$1.reply.md"; exit 1; }
