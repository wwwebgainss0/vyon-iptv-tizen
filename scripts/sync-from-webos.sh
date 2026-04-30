#!/bin/bash
# scripts/sync-from-webos.sh
#
# Refresh src/js and src/css from the WebOS source tree. Run from any
# directory — the script cd's to the Tizen repo root before sync'ing.
#
# Source of truth: ../ultralight-iptv-webos/dist/modern-neu/{js,css}
# Destination: src/{js,css}
#
# Preserves our own files:
#   - src/js/tizen-shim.js  (NEVER overwritten)
#   - src/js/app.js         (regenerated from src/js/core/app-main.js)
#
# Requires: rsync. On Windows, run from WSL or Git-Bash with rsync available.

set -e
cd "$(dirname "$0")/.."

WEBOS_SRC=../ultralight-iptv-webos/dist/modern-neu

if [ ! -d "$WEBOS_SRC" ]; then
    echo "ERROR: WebOS source tree not found at $WEBOS_SRC" >&2
    echo "       Make sure vyon-iptv-tizen lives next to ultralight-iptv-webos." >&2
    exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
    echo "ERROR: rsync is required. Install via brew/apt/wsl." >&2
    exit 1
fi

rsync -av --delete --exclude='.DS_Store' "$WEBOS_SRC/js/" src/js/ \
    --exclude='tizen-shim.js'  # never overwrite our shim
rsync -av --delete "$WEBOS_SRC/css/" src/css/

# Note: app-main.js entry point is renamed to app.js in our index.html
cp src/js/core/app-main.js src/js/app.js

echo "WebOS source synced into Tizen src/."
