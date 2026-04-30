# vyon-iptv-tizen

VYON IPTV Player for Samsung Smart TVs (Tizen 6.x+).

## Why this repo exists

Samsung's Tizen platform ships Chromium 76, which is dramatically newer than
LG webOS 3.x's Chromium 38. We can therefore reuse the WebOS source tree
(`../ultralight-iptv-webos/dist/modern-neu/`) as-is, plus a small Tizen-only
adapter (`src/js/tizen-shim.js`).

The ES3 constraint that pins the WebOS-side code does **not** apply to the
shim layer — the shim is allowed to use modern syntax.

## Layout

```
vyon-iptv-tizen/
├── src/
│   ├── config.xml         # Tizen App manifest (W3C Widget format)
│   ├── index.html         # Entry — loads tizen-shim.js BEFORE app.js
│   ├── js/                # Synced from ../ultralight-iptv-webos/dist/modern-neu/js/
│   │   ├── tizen-shim.js  # Tizen-specific platform adapter (NOT overwritten by sync)
│   │   └── app.js         # Renamed copy of src/js/core/app-main.js
│   └── css/               # Synced from WebOS dist/modern-neu/css/
├── scripts/
│   └── sync-from-webos.sh # Re-sync the WebOS source tree into src/
├── build-tizen.sh         # Produces dist/com.vyoniptv.tizen_<version>.wgt
└── docs/
    └── ARCHITECTURE.md    # Adapter pattern, build flow, signing
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

The shim (`src/js/tizen-shim.js`) is preserved across syncs.

## Target

- **Platform:** Samsung Tizen 6.0+
- **Engine:** Chromium 76 (ES6+ available)
- **Bundle:** `.wgt` (W3C Widget)
- **Package ID:** `VYONiptvTz` (10-char Samsung ID)
- **Application ID:** `VYONiptvTz.VYONIPTV`
- **Resolution:** 1920×1080
