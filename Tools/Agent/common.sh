#!/bin/bash
# Shared paths for the agent scripts of this web repo. Sourced, never run:
#   source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
# ROOT is the repo root (this folder is Tools/Agent). Every script runs from ROOT. No Unity, no game.env:
# the repo's values are the npm scripts in package.json (dev, build, test, lint, sim).
AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$AGENT_DIR/../.." && pwd)"
export AGENT_DIR ROOT
cd "$ROOT" || exit 1
