// tizen-shim.js — Platform adapter for Samsung Tizen TVs.
//
// The WebOS source tree (../ultralight-iptv-webos/dist/modern-neu/) is
// constrained to ES3 (Chromium 38). Tizen 6+ runs Chromium 76, so this
// shim is allowed to use modern syntax — but kept conservative for clarity.
//
// Responsibilities:
//   1. Register TV remote keys via tizen.tvinputdevice.registerKey()
//   2. Normalize back-button semantics (Tizen 'tizenhwkey' vs WebOS
//      'webOS.platformBack') under a single window.PlatformBack(handler).
//   3. Expose a window.PlatformExit() that calls tizen.application's
//      getCurrentApplication().exit() on Tizen, falls through to
//      window.close()/webOS equivalent elsewhere.

(function () {
    if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
        var keys = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
                    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
                    'MediaFastForward', 'MediaRewind', 'ChannelUp', 'ChannelDown'];
        for (var i = 0; i < keys.length; i++) {
            try { tizen.tvinputdevice.registerKey(keys[i]); } catch (e) {}
        }
    }

    window.PlatformBack = function (handler) {
        if (typeof tizen !== 'undefined' && tizen.application) {
            document.addEventListener('tizenhwkey', function (e) {
                if (e.keyName === 'back') handler();
            });
        } else if (window.webOS && window.webOS.platformBack) {
            window.webOS.platformBack = handler;
        }
    };

    window.PlatformExit = function () {
        try {
            if (typeof tizen !== 'undefined' && tizen.application) {
                tizen.application.getCurrentApplication().exit();
                return;
            }
        } catch (e) {}
        if (window.webOS && window.webOS.platformBack) {
            window.close();
        } else {
            window.close();
        }
    };
})();
