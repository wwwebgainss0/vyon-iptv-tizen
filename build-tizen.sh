#!/bin/bash
# build-tizen.sh — Package the Tizen widget (.wgt) for Samsung Smart TV.
#
# Requires:
#   - tizen-cli (Tizen Studio CLI) on PATH
#   - signing profile "VYON" registered via `tizen security-profiles add`
#
# On Windows / hosts without tizen-cli installed, this script no-ops with a
# message rather than crashing — useful for CI matrix runs and dev laptops.

set -e

SRC=src
OUT=dist
PROFILE=VYON
VERSION=${VERSION:-1.0.0}

if ! command -v tizen >/dev/null 2>&1; then
    echo "[build-tizen] tizen-cli not found on PATH — skipping native build."
    echo "[build-tizen] Install Tizen Studio (or headless tizen-cli) and re-run."
    exit 0
fi

rm -rf "$OUT"
mkdir -p "$OUT"

# Tizen build-web resolves -out relative to the project dir (SRC), not the
# current working directory, so the actual build output ends up at
# $SRC/$OUT/build, not $OUT/build. Reflect that when cd'ing into the result.
tizen build-web -- "$SRC" -out "$OUT/build"

cd "$SRC/$OUT/build"
tizen package -t wgt -s "$PROFILE"

# Tizen names the .wgt after the application name in config.xml ("VYON IPTV")
# Move + rename to canonical bundle ID + version.
WGT_FILE=$(ls *.wgt 2>/dev/null | head -1)
if [ -z "$WGT_FILE" ]; then
    echo "[build-tizen] ERROR: no .wgt produced." >&2
    exit 1
fi
# Move out of $SRC/$OUT/build all the way to repo-root $OUT, so the final
# artifact path is dist/com.vyoniptv.tizen_<ver>.wgt (matches the CI artifact
# upload glob `dist/*.wgt`).
mv "$WGT_FILE" "../../../$OUT/com.vyoniptv.tizen_${VERSION}.wgt"

echo "[build-tizen] OK -> $OUT/com.vyoniptv.tizen_${VERSION}.wgt"
