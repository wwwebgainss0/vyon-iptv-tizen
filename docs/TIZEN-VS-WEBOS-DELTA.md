# Tizen vs WebOS — Per-Platform Delta

This document mirrors and inverts the perspective of the WebOS-side
`CROSS-PLATFORM.md`. The Tizen reader's question is "what makes my target
different from the source-of-truth WebOS build?" — this file answers that
without re-explaining the reuse model.

For the canonical reuse-model write-up (why webOS is the source of truth, how
the sync works, anti-patterns), see the sibling repo:

- [`../ultralight-iptv-webos/docs/CROSS-PLATFORM.md`](../../ultralight-iptv-webos/docs/CROSS-PLATFORM.md)
- [`../ultralight-iptv-webos/docs/PLATFORM-API.md`](../../ultralight-iptv-webos/docs/PLATFORM-API.md)
  — full contract for `js/core/platform.js`.

What lives **here** is the Tizen-flavoured cheat sheet.

## 1. The five differences that matter at runtime

Every other concern (UI, focus, Xtream API, HLS playback, settings persistence,
favorites/watchlist, EPG rendering, search) runs verbatim on both targets. The
only deltas are:

| Concern | WebOS | Tizen | Routed through |
|---|---|---|---|
| Back button | `webOS.platformBack = fn` | `document.addEventListener('tizenhwkey', e => e.keyName === 'back')` | `Platform.onBack(fn)` |
| App exit | `window.close()` | `tizen.application.getCurrentApplication().exit()` | `Platform.exit()` |
| Device info | `webOS.deviceInfo(cb)` | `tizen.systeminfo.getPropertyValue('BUILD', cb, err)` | `Platform.getDeviceInfo(cb)` |
| Serial number | `luna://com.webos.service.sm` `deviceid/getIDs` (`LGUDID`) | `tizen.systeminfo.getPropertyValue('DEVICE_INFO', cb, err)` (`.serialNumber`) | `Platform.getSerialNumber(cb)` |
| External app launch | `luna://com.webos.applicationManager/launch` | `tizen.application.launch(appId, ok, fail)` | `Platform.launchExternalApp({webos, tizen}, params, cb)` |

Three additional files in the synced source (`utils/voice-control.js`,
`utils/sleep-timer.js`, `user/parental-control.js`) still call `webOS.X` directly
because Phase 2 of the 2026-04-30 hardening plan only abstracted the
highest-traffic call sites. They no-op on Tizen (the `webOS` global is
undefined; the existence checks fail). Migration is tracked as a follow-up.

The CI guard at `.github/workflows/ci.yml` greps for direct `webOS.X` calls
outside `core/platform.js` and currently runs with `continue-on-error: true`
because of those three files. When they migrate, drop the flag.

## 2. Color and media keys (the one Tizen-only bootstrap)

Tizen requires explicit registration for the color buttons (Red/Green/Yellow/
Blue) and media-transport keys (Play, Pause, Stop, FF, Rewind, ChannelUp/Down)
before they emit `keydown` events:

```js
tizen.tvinputdevice.registerKey('ColorF0Red');  // etc.
```

webOS fires these automatically. To keep the synced source platform-agnostic,
the Tizen registration lives in `src/index.html` as an inline `<script>` block,
guarded by `Platform.isTizen`. It runs after `core/platform.js` (so detection
has happened) and before `app.js` (so all subsequent listeners see the
registered keys).

If you ever add new keys to the registration list, they need to also be
recognized by `core/navigation-handler.js` on the keydown side — search there
for the `KEY_*` constants.

## 3. Tizen-specific app IDs (third-party app launches)

`Platform.launchExternalApp` takes a hint object `{ webos, tizen }`. The Tizen
IDs are not reverse-domain — Samsung uses 10-digit numeric IDs. Known IDs used
in this codebase:

| External app | webOS hint | Tizen hint |
|---|---|---|
| YouTube | `youtube.leanback.v4` | `111299001912` |

When integrating a new external launch (e.g. Samsung TV Plus, Apple TV, etc.),
you can find the Tizen app ID via `tizen.application.getAppsInfo` from a
running WGT, or by inspecting the manifest of the target app on a paired
device with `sdb shell`.

The Samsung Apps Store ID for VYON IPTV itself is a placeholder until the
WGT clears Seller Office review — see `docs/ARCHITECTURE.md` for the package
ID conventions (`VYONiptvTz.VYONIPTV`).

## 4. Build pipeline differences

| Step | WebOS | Tizen |
|---|---|---|
| Source bundle | `dist/modern-neu/` (working tree) → `dist/release/` (obfuscated) | `src/` (synced) → `dist/build/` (staged) |
| Manifest | `appinfo.json` (LG-specific) | `config.xml` (W3C Widget format) |
| CLI to package | `ares-package -o output .` | `tizen build-web && tizen package -t wgt -s VYON` |
| Output bundle | `com.jam.iptv8_*_all.ipk` | `VYONiptvTz_<version>.wgt` |
| Install | `ares-install --device tv <ipk>` | `sdb -s <ip>:26101 install <wgt>` |
| Launch | `ares-launch --device tv com.jam.iptv8` | `sdb -s <ip>:26101 shell 0 was_execute VYONiptvTz.VYONIPTV` |
| Signing | None at LG-Content-Store-staging time | Required upfront (Samsung security profile, `.p12`) |
| Store | LG Content Store | Samsung Apps Store (via Seller Office) |

`build-tizen.sh` in this repo wraps the Tizen-side steps and exits cleanly on
hosts without `tizen-cli` so it stays harmless in CI and on developer Windows
laptops.

## 5. Real-device test caveats

Pairing differs:

- **WebOS:** `ares-setup-device --add` with the TV's IP and a developer-mode
  passphrase from the LG Developer Mode app on the TV.
- **Tizen:** `sdb connect <tv-ip>:26101` (port is fixed). The TV must be in
  Developer Mode (`Apps → my-apps → 12345 button combo → enable + reboot`)
  and the host must have its IP whitelisted in the TV's developer-mode UI.

Once paired:

- WebOS Inspector: Chromium DevTools served by the TV at
  `http://<tv-ip>:9998/`.
- Tizen Web Inspector: launch via `sdb shell 0 debug <appId>` then connect
  Chromium DevTools to `http://<host>:<port-from-sdb>/`. Port is dynamic.

Tizen's `sdb` is roughly an Android `adb` clone — same `push`/`shell`/`logcat`
shape — so most adb muscle memory transfers. WebOS' `ares-*` tools are higher
level (no per-command subshell) and slightly slower for iterative work.

## 6. Build-time vs runtime detection

Detection is **always runtime** via `Platform.isWebOS` / `Platform.isTizen`.
There is no preprocessor step, no platform-conditional bundling. Both apps
run the same JavaScript bytes; the runtime picks the right branch based on
which globals exist.

This means a `console.log(Platform.name)` in any synced file will print
`'webos'` on LG and `'tizen'` on Samsung — and the same build artifact runs
in a desktop browser as `'browser'` (helpful for local dev with `npm test`).

## 7. What does NOT differ

To pre-empt the question "should I add a Tizen-specific X?": no, unless X is
on the table above. Specifically:

- Focus management uses the same `core/focus-manager.js` (keyboard arrow keys,
  not platform-specific).
- HLS playback uses the same `hls.js` build (both Chromium versions support
  Media Source Extensions).
- The Xtream API client, EPG parser, settings store, favorites/watchlist DAOs
  — all platform-neutral.
- localStorage works identically on both (sandboxed per-app).

If you find yourself reaching for a `Platform.isTizen` check **outside** the
five concerns in section 1, stop and reconsider. The reuse model only stays
sustainable if the delta surface stays small.

## 8. Plan reference

This document was created by Phase 3 of the
[2026-04-30 Tizen-adaptation plan](../../docs/plans/2026-04-30-tizen-adaptation-and-webos-doc-extension.md),
which also dropped the obsolete `tizen-shim.js` (replaced by the synced
`Platform` abstraction).
