/**
 * Platform Abstraction - single platform-detection point.
 *
 * ES3-compatible. Loaded BEFORE app-main.js (and before every module that
 * touches webOS / tizen globals) in index.html.
 *
 * Contract:
 *   window.Platform.name         - 'webos' | 'tizen' | 'browser'
 *   window.Platform.isWebOS      - boolean
 *   window.Platform.isTizen      - boolean
 *   window.Platform.onBack(fn)   - register a back-button handler
 *   window.Platform.exit()       - terminate the app
 *   window.Platform.getDeviceInfo(cb)        - cb({ model, osVersion, serial })
 *   window.Platform.getSerialNumber(cb)      - cb(serialOrNull)
 *   window.Platform.launchExternalApp(appHints, params, cb) - cb(success)
 *   window.Platform.canUseLunaService()      - boolean (webOS Luna API available?)
 *   window.Platform.requestLunaService(url, opts) - thin webOS Luna wrapper
 *   window.Platform.triggerBack()            - programmatic back-button
 *
 * appHints shape: { webos: '<webos-app-id>', tizen: '<tizen-app-id>' }
 *
 * Luna-service notes:
 *   - requestLunaService is webOS-only (Tizen has no equivalent generic IPC
 *     for SmartTV apps for the same set of services). On Tizen / browser the
 *     wrapper invokes opts.onFailure({errorText:'luna-unsupported'}) and
 *     returns null. Callers must tolerate a null return + onFailure invocation.
 *
 * triggerBack notes:
 *   - On webOS this calls webOS.platformBack() (root-scene exit semantics).
 *   - On Tizen this dispatches a synthetic 'tizenhwkey' DOM event with
 *     keyName:'back', which Platform.onBack listeners (and any other
 *     tizenhwkey handlers) will pick up.
 *   - On browser it falls back to window.close().
 */
(function () {
    'use strict';

    function detect() {
        if (typeof tizen !== 'undefined' && tizen.systeminfo) {
            return 'tizen';
        }
        if (typeof window !== 'undefined' && window.webOS) {
            return 'webos';
        }
        return 'browser';
    }

    var current = detect();

    window.Platform = {
        name: current,
        isWebOS: current === 'webos',
        isTizen: current === 'tizen',

        // Back-button registration. Single point; replaces direct
        // webOS.platformBack assignments + tizenhwkey listeners.
        onBack: function (handler) {
            if (current === 'tizen') {
                document.addEventListener('tizenhwkey', function (e) {
                    if (e.keyName === 'back') {
                        handler();
                    }
                });
            } else if (current === 'webos' && window.webOS && window.webOS.platformBack) {
                window.webOS.platformBack = handler;
            }
            // 'browser' fallback handled by the navigation-handler keyCode 8/27/461 paths
        },

        // App exit
        exit: function () {
            try {
                if (current === 'tizen' && typeof tizen !== 'undefined' && tizen.application) {
                    tizen.application.getCurrentApplication().exit();
                    return;
                }
            } catch (e) {}
            window.close();
        },

        // Device info - async because Tizen API is callback-based.
        // Callback receives { model, osVersion, serial }.
        getDeviceInfo: function (callback) {
            if (current === 'webos' && window.webOS && window.webOS.deviceInfo) {
                try {
                    window.webOS.deviceInfo(function (info) {
                        callback({
                            model: (info && info.modelName) || 'LG TV',
                            osVersion: (info && info.sdkVersion) || '3.x',
                            serial: null
                        });
                    });
                    return;
                } catch (e) {
                    callback({ model: 'LG TV', osVersion: '3.x', serial: null });
                    return;
                }
            }
            if (current === 'tizen' && typeof tizen !== 'undefined' && tizen.systeminfo) {
                try {
                    tizen.systeminfo.getPropertyValue('BUILD', function (build) {
                        callback({
                            model: (build && build.model) || 'Samsung TV',
                            osVersion: (build && build.buildVersion) || 'Tizen',
                            serial: null
                        });
                    }, function () {
                        callback({ model: 'Samsung TV', osVersion: 'Tizen', serial: null });
                    });
                    return;
                } catch (e) {
                    callback({ model: 'Samsung TV', osVersion: 'Tizen', serial: null });
                    return;
                }
            }
            callback({ model: 'Browser', osVersion: 'unknown', serial: null });
        },

        // Serial number (separate because async on both platforms)
        getSerialNumber: function (callback) {
            if (current === 'webos' && window.webOS && window.webOS.service && window.webOS.service.request) {
                try {
                    window.webOS.service.request('luna://com.webos.service.sm', {
                        method: 'deviceid/getIDs',
                        parameters: { idType: ['LGUDID'] },
                        onSuccess: function (res) {
                            callback((res && res.idList && res.idList[0] && res.idList[0].idValue) || null);
                        },
                        onFailure: function () { callback(null); }
                    });
                    return;
                } catch (e) {}
            }
            if (current === 'tizen' && typeof tizen !== 'undefined' && tizen.systeminfo) {
                try {
                    tizen.systeminfo.getPropertyValue('DEVICE_INFO', function (info) {
                        callback((info && info.serialNumber) || null);
                    }, function () { callback(null); });
                    return;
                } catch (e) {}
            }
            callback(null);
        },

        // External app launch (YouTube, browser, etc.)
        // appHints = { webos: 'com.webos.app.youtube', tizen: '111299001912' }
        launchExternalApp: function (appHints, params, callback) {
            callback = callback || function () {};
            params = params || {};
            if (current === 'webos') {
                var webosId = appHints && appHints.webos;
                if (!webosId) {
                    return callback(false);
                }
                if (window.webOS && window.webOS.service && window.webOS.service.request) {
                    try {
                        window.webOS.service.request('luna://com.webos.applicationManager', {
                            method: 'launch',
                            parameters: { id: webosId, params: params },
                            onSuccess: function () { callback(true); },
                            onFailure: function () {
                                tryWindowOpen(params, callback);
                            }
                        });
                        return;
                    } catch (e) {
                        tryWindowOpen(params, callback);
                        return;
                    }
                }
                tryWindowOpen(params, callback);
                return;
            }
            if (current === 'tizen' && typeof tizen !== 'undefined' && tizen.application) {
                try {
                    var tizenId = appHints && appHints.tizen;
                    if (!tizenId) {
                        return callback(false);
                    }
                    tizen.application.launch(
                        tizenId,
                        function () { callback(true); },
                        function () { tryWindowOpen(params, callback); }
                    );
                    return;
                } catch (e) {
                    tryWindowOpen(params, callback);
                    return;
                }
            }
            tryWindowOpen(params, callback);
        },

        // ----- Luna Service Wrapper (webOS-only) ---------------------------
        // canUseLunaService() - cheap synchronous availability probe used by
        // call-sites that want to skip the request entirely on Tizen/browser.
        canUseLunaService: function () {
            return current === 'webos'
                && typeof window !== 'undefined'
                && !!window.webOS
                && !!window.webOS.service
                && typeof window.webOS.service.request === 'function';
        },

        // requestLunaService(url, opts) - thin webOS.service.request wrapper.
        // On webOS: identical surface to webOS.service.request, returning the
        //   subscription handle (or whatever request() returns). Internal
        //   try/catch routes throws to opts.onFailure for caller simplicity.
        // On Tizen / browser: invokes opts.onFailure({errorText:'luna-unsupported'})
        //   asynchronously via setTimeout(0) and returns null so callers can
        //   short-circuit without crashing.
        requestLunaService: function (url, opts) {
            opts = opts || {};
            if (current === 'webos'
                && typeof window !== 'undefined'
                && window.webOS
                && window.webOS.service
                && typeof window.webOS.service.request === 'function') {
                try {
                    return window.webOS.service.request(url, opts);
                } catch (e) {
                    if (typeof opts.onFailure === 'function') {
                        opts.onFailure({ errorText: 'luna-throw', errorCode: -1 });
                    }
                    return null;
                }
            }
            // Non-webOS: emit failure asynchronously to mirror real Luna timing.
            if (typeof opts.onFailure === 'function') {
                setTimeout(function () {
                    opts.onFailure({ errorText: 'luna-unsupported', errorCode: -1 });
                }, 0);
            }
            return null;
        },

        // ----- Programmatic Back Button -----------------------------------
        // Used when an in-app flow needs to invoke the platform's "back" action
        // (e.g. sleep-timer fallback close, cancelling a parental PIN prompt).
        // Sleep-timer used to call webOS.platformBack() with window.close()
        // fallback; this preserves that exact behavior on webOS, mirrors it on
        // Tizen via the documented synthetic tizenhwkey dispatch, and falls
        // back to window.close() in the browser harness.
        triggerBack: function () {
            try {
                if (current === 'webos'
                    && typeof window !== 'undefined'
                    && window.webOS
                    && typeof window.webOS.platformBack === 'function') {
                    window.webOS.platformBack();
                    return;
                }
                if (current === 'tizen'
                    && typeof document !== 'undefined'
                    && typeof document.createEvent === 'function') {
                    var evt = null;
                    try {
                        evt = document.createEvent('CustomEvent');
                        if (evt && typeof evt.initCustomEvent === 'function') {
                            evt.initCustomEvent('tizenhwkey', true, true, { keyName: 'back' });
                        }
                    } catch (ce) {
                        evt = null;
                    }
                    if (!evt) {
                        try {
                            evt = document.createEvent('Event');
                            evt.initEvent('tizenhwkey', true, true);
                        } catch (ee) {
                            evt = null;
                        }
                    }
                    if (evt) {
                        // Tizen onBack handlers read e.keyName.
                        evt.keyName = 'back';
                        document.dispatchEvent(evt);
                        return;
                    }
                }
            } catch (e) {}
            if (typeof window !== 'undefined' && typeof window.close === 'function') {
                try { window.close(); } catch (e) {}
            }
        }
    };

    // Final-fallback: use window.open with the URL hint inside `params`.
    // The `target` field is the convention used by webOS browser launches.
    function tryWindowOpen(params, callback) {
        var url = params && (params.target || params.contentTarget || params.url);
        if (!url) {
            return callback(false);
        }
        try {
            window.open(url, '_blank');
            callback(true);
        } catch (e) {
            callback(false);
        }
    }
})();
