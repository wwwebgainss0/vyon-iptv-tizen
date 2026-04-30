# Architecture — vyon-iptv-tizen

## Code-reuse strategy

This repo is a thin Tizen wrapper around the WebOS source tree. There is
**no separate Tizen UI codebase**. Everything user-facing lives in
`../ultralight-iptv-webos/dist/modern-neu/{js,css}` and is mirrored into
`src/js/` and `src/css/` via `scripts/sync-from-webos.sh`.

### Why this works

- WebOS 3.x ships Chromium 38 → the WebOS code is constrained to ES3 (no
  `let`, `const`, arrow fns, `Array.prototype.map`).
- Tizen 6.x ships Chromium 76 → ES3 runs perfectly. Anything ES6+ also runs
  perfectly, but we don't need it because the WebOS code already works.
- Both platforms expose remote-key + back-button as JavaScript APIs, but
  with platform-specific names. That delta is absorbed by the shim.

### Why we don't symlink

Symlinks across `../ultralight-iptv-webos/` and `vyon-iptv-tizen/src/` are
not portable on Windows and don't survive `git clone` cleanly. We pay the
cost of a copy + a sync script in exchange for cross-platform reproducibility.

## The shim layer (`src/js/tizen-shim.js`)

Loaded BEFORE `app.js` in `index.html`. Provides:

| Concern | WebOS | Tizen | Shim exposes |
|---|---|---|---|
| Color/media key registration | implicit | `tizen.tvinputdevice.registerKey(...)` | runs at script-load |
| Back button | `webOS.platformBack = fn` | `document.addEventListener('tizenhwkey', ...)` | `window.PlatformBack(fn)` |
| App exit | `window.close()` | `tizen.application.getCurrentApplication().exit()` | `window.PlatformExit()` |

The WebOS code currently calls `webOS.platformBack` directly. Future iteration
should replace those call sites with `window.PlatformBack(...)` so the WebOS
build also goes through the shim — at which point the shim can become the
single platform-detection point.

## Build pipeline

```
src/                      tizen build-web                 tizen package -t wgt
config.xml + index.html   ────────────────►  dist/build  ──────────────────►  *.wgt
+ js/ + css/              (validation)       (staged)                          (signed widget)
```

Signing requires a Samsung Seller Office certificate, packaged into a
`security-profile` named `VYON`:

```bash
tizen certificate -a VYON -p vyon123 -f vyon-author -- ~/SamsungCertificate/
tizen security-profiles add -n VYON -a ~/SamsungCertificate/vyon-author.p12 -p vyon123
```

The `build-tizen.sh` no-ops (exit 0 with a friendly message) on hosts
without `tizen-cli`, so the same script runs harmlessly on a developer's
Windows laptop and on the Mac Mini orchestrator.

## Bundle ID conventions

Samsung Tizen requires the application package to be a 10-character
alphanumeric string starting with a letter:

- **Package:** `VYONiptvTz`
- **Application ID:** `VYONiptvTz.VYONIPTV`
- **Widget ID (URI):** `http://vyoniptv.com/com.vyoniptv.tizen`

The Android/iOS sibling apps use `com.vyoniptv.player`. The Tizen package
ID is intentionally distinct because Samsung's package-id format collides
with reverse-domain conventions.

## Asset notes

- `src/icon.png` MUST exist at 117×117 px (Samsung TV icon spec). It is
  not yet checked in — copy from the WebOS `dist/modern-neu/icon.png` (which
  is 80×80) and rescale, or commission a fresh 117² asset.
- The WebOS `appinfo.json` is intentionally NOT synced — it's WebOS-specific
  and would conflict with Tizen's `config.xml`.

## Next steps (post-scaffold)

The repo is scaffolded locally and committed. Remaining one-time setup
operations require user account credentials and are NOT auto-runnable:

```bash
# 1. Create the GitHub repo (run from a host with `gh` authenticated)
gh repo create webwest/vyon-iptv-tizen --private --source=. --remote=origin

# 2. Push the initial commit
git push -u origin main

# 3. (Optional) Add CI workflow per Phase 3.4 of the cross-platform plan
mkdir -p .github/workflows
# … paste ci.yml content from docs/plans/2026-04-30-cross-platform-testing-pipelines.md
```

A 117×117 `src/icon.png` and a Samsung Seller Office signing certificate
are also required before `./build-tizen.sh` can produce a publishable `.wgt`.
