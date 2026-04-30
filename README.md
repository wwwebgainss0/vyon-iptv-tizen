# vyon-iptv-tizen

VYON IPTV Player for Samsung Smart TVs (Tizen 6.x+).

## Why this repo exists

Samsung's Tizen platform ships Chromium 76, which is dramatically newer than
LG webOS 3.x's Chromium 38. We can therefore reuse the WebOS source tree
(`../ultralight-iptv-webos/dist/modern-neu/`) as-is. Cross-platform
differences are routed through `src/js/core/platform.js` (synced from the
WebOS source — see [docs/TIZEN-VS-WEBOS-DELTA.md](docs/TIZEN-VS-WEBOS-DELTA.md)).

The ES3 constraint that pins the WebOS-side code applies to the shared source
as well, so the same files run on both targets without preprocessing.

## Layout

```
vyon-iptv-tizen/
├── src/
│   ├── config.xml             # Tizen App manifest (W3C Widget format)
│   ├── index.html             # Entry — loads js/core/platform.js BEFORE app.js
│   ├── js/                    # Synced from ../ultralight-iptv-webos/dist/modern-neu/js/
│   │   ├── core/platform.js   # Platform abstraction (synced; detects tizen vs webos)
│   │   └── app.js             # Renamed copy of src/js/core/app-main.js
│   └── css/                   # Synced from WebOS dist/modern-neu/css/
├── scripts/
│   └── sync-from-webos.sh     # Re-sync the WebOS source tree into src/
├── build-tizen.sh             # Produces dist/com.vyoniptv.tizen_<version>.wgt
└── docs/
    ├── ARCHITECTURE.md        # Reuse model, build flow, signing
    └── TIZEN-VS-WEBOS-DELTA.md # Per-platform delta from a Tizen perspective
```

## Build

```bash
./build-tizen.sh
# → dist/com.vyoniptv.tizen_1.0.0.wgt
```

Requires `tizen-cli` (Tizen Studio CLI) and a registered signing profile
named `VYON`. See `docs/ARCHITECTURE.md` for setup.

## Refresh from WebOS source

```bash
./scripts/sync-from-webos.sh
```

All shared files (including `src/js/core/platform.js`) are pulled from the
WebOS `dist/modern-neu/` tree. Only Tizen-specific bootstrap files
(`src/index.html`, `src/config.xml`) live outside the synced tree.

## Target

- **Platform:** Samsung Tizen 6.0+
- **Engine:** Chromium 76 (ES6+ available)
- **Bundle:** `.wgt` (W3C Widget)
- **Package ID:** `VYONiptvTz` (10-char Samsung ID)
- **Application ID:** `VYONiptvTz.VYONIPTV`
- **Resolution:** 1920×1080
