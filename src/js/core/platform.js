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
 *
 * appHints shape: { webos: '<webos-app-id>', tizen: '<tizen-app-id>' }
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
