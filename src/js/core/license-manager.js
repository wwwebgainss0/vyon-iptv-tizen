/**
 * License Manager - App Licensing & Trial System
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Features:
 * - 7-Day Trial for new devices
 * - License Key Activation
 * - Firebase Integration (when configured)
 * - Offline Grace Period (3 days)
 * - Self-Destruct on block/manipulation
 */

window.LicenseManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_license',
        TRIAL_DAYS: 7,
        OFFLINE_GRACE_DAYS: 3,
        CHECK_INTERVAL: 3600000,  // 1 hour
        // Laravel Admin Panel API URL
        API_URL: null,  // 'http://localhost:8080/api' or 'https://your-server.com/api'
        // Firebase URL (alternative to API_URL)
        FIREBASE_URL: null  // 'https://your-project.firebasedatabase.app'
    };

    // ===== STATE =====
    var state = {
        deviceId: null,
        isLicensed: false,
        isTrial: true,
        trialDaysLeft: 7,
        trialExpires: null,
        licenseKey: null,
        licenseType: null,  // 'trial', 'monthly', 'yearly', 'lifetime'
        licenseExpires: null,
        isBlocked: false,
        blockReason: '',
        lastOnlineCheck: null,
        initialized: false
    };

    // ===== INITIALIZATION =====
    function initialize(callback) {
        console.log('[LicenseManager] Initializing...');

        // Get device ID
        state.deviceId = getDeviceId();
        console.log('[LicenseManager] Device ID:', state.deviceId);

        // Load local license data
        loadLocalLicense();

        // Check license status
        checkLicense(function(status) {
            state.initialized = true;

            // Start periodic check
            setInterval(function() {
                checkLicense(function() {});
            }, CONFIG.CHECK_INTERVAL);

            if (callback) {
                callback(status);
            }
        });
    }

    // ===== DEVICE ID =====
    function getDeviceId() {
        // Try to get from ActivationScreen first
        if (window.ActivationScreen && window.ActivationScreen.getDeviceId) {
            var id = window.ActivationScreen.getDeviceId();
            if (id && id !== 'UNKNOWN') {
                return id;
            }
        }

        // Try WebOS device info
        if (window.webOS && window.webOS.deviceInfo) {
            try {
                var info = window.webOS.deviceInfo;
                if (info.deviceId) {
                    return info.deviceId;
                }
            } catch (e) {}
        }

        // Generate/retrieve persistent ID
        var storedId = localStorage.getItem('ultra_device_id');
        if (storedId) {
            return storedId;
        }

        // Generate new ID
        var newId = 'WOS_' + generateRandomId(12);
        localStorage.setItem('ultra_device_id', newId);
        return newId;
    }

    function generateRandomId(length) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var result = '';
        for (var i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // ===== LOCAL LICENSE STORAGE =====
    function loadLocalLicense() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                var data = JSON.parse(stored);
                state.isLicensed = data.isLicensed || false;
                state.isTrial = data.isTrial !== false;
                state.trialExpires = data.trialExpires || null;
                state.licenseKey = data.licenseKey || null;
                state.licenseType = data.licenseType || 'trial';
                state.licenseExpires = data.licenseExpires || null;
                state.isBlocked = data.isBlocked || false;
                state.blockReason = data.blockReason || '';
                state.lastOnlineCheck = data.lastOnlineCheck || null;
            }
        } catch (e) {
            console.error('[LicenseManager] Error loading local license:', e);
        }
    }

    function saveLocalLicense() {
        try {
            var data = {
                deviceId: state.deviceId,
                isLicensed: state.isLicensed,
                isTrial: state.isTrial,
                trialExpires: state.trialExpires,
                licenseKey: state.licenseKey,
                licenseType: state.licenseType,
                licenseExpires: state.licenseExpires,
                isBlocked: state.isBlocked,
                blockReason: state.blockReason,
                lastOnlineCheck: state.lastOnlineCheck
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[LicenseManager] Error saving local license:', e);
        }
    }

    // ===== LICENSE CHECK =====
    function checkLicense(callback) {
        var now = Date.now();

        // Check if blocked
        if (state.isBlocked) {
            callback(getStatus());
            return;
        }

        // Check if fully licensed
        if (state.isLicensed && state.licenseType !== 'trial') {
            // Check expiry for non-lifetime licenses
            if (state.licenseExpires && state.licenseExpires < now) {
                state.isLicensed = false;
                state.licenseType = 'expired';
                saveLocalLicense();
            }
            callback(getStatus());
            return;
        }

        // Check/Start trial
        if (!state.trialExpires) {
            // New device - start trial
            startTrial();
        }

        // Calculate trial days left
        var trialEnd = state.trialExpires || (now + CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000);
        var msLeft = trialEnd - now;
        state.trialDaysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

        if (state.trialDaysLeft <= 0) {
            state.isTrial = false;
            state.licenseType = 'expired';
        }

        saveLocalLicense();

        // Try API check if configured (Laravel Admin Panel)
        if (CONFIG.API_URL) {
            checkWithApi(callback);
        } else if (CONFIG.FIREBASE_URL) {
            // Fallback to Firebase if configured
            checkFirebase(callback);
        } else {
            callback(getStatus());
        }
    }

    // ===== LARAVEL API INTEGRATION =====
    function checkWithApi(callback) {
        if (!CONFIG.API_URL) {
            callback(getStatus());
            return;
        }

        var url = CONFIG.API_URL + '/license/validate';
        var postData = {
            device_id: state.deviceId,
            model: getDeviceInfo().model,
            webos_version: getDeviceInfo().webosVersion
        };

        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-App-Version', '11.2.0');
        xhr.timeout = 10000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        handleApiResponse(data);
                    } catch (e) {
                        console.error('[LicenseManager] API parse error:', e);
                    }
                }
                callback(getStatus());
            }
        };

        xhr.onerror = function() {
            console.warn('[LicenseManager] API check failed, using local data');
            checkOfflineValidity();
            callback(getStatus());
        };

        xhr.ontimeout = function() {
            console.warn('[LicenseManager] API timeout, using local data');
            checkOfflineValidity();
            callback(getStatus());
        };

        xhr.send(JSON.stringify(postData));
    }

    function handleApiResponse(data) {
        // Update state from API response
        if (data.blocked) {
            state.isBlocked = true;
            state.blockReason = data.reason || 'Geraet gesperrt';
        }

        if (data.status === 'active') {
            state.isLicensed = true;
            state.isTrial = false;
            state.licenseType = data.type || 'lifetime';
            if (data.daysLeft !== undefined) {
                state.trialDaysLeft = data.daysLeft;
            }
            if (data.expiresAt) {
                state.licenseExpires = new Date(data.expiresAt).getTime();
            }
        } else if (data.status === 'trial') {
            state.isTrial = true;
            state.isLicensed = false;
            state.trialDaysLeft = data.daysLeft || 0;
        } else if (data.status === 'expired') {
            state.isTrial = false;
            state.isLicensed = false;
            state.licenseType = 'expired';
            state.trialDaysLeft = 0;
        }

        state.lastOnlineCheck = Date.now();
        saveLocalLicense();
    }

    function activateLicenseWithApi(licenseKey, callback) {
        var url = CONFIG.API_URL + '/license/activate';
        var postData = {
            device_id: state.deviceId,
            license_key: licenseKey
        };

        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-App-Version', '11.2.0');
        xhr.timeout = 15000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        state.isLicensed = true;
                        state.isTrial = false;
                        state.licenseKey = licenseKey;
                        state.licenseType = data.type || 'lifetime';
                        if (data.expiresAt) {
                            state.licenseExpires = new Date(data.expiresAt).getTime();
                        }
                        saveLocalLicense();
                        callback({ success: true, type: state.licenseType });
                    } else {
                        callback({ success: false, error: data.error || 'Aktivierung fehlgeschlagen' });
                    }
                } catch (e) {
                    callback({ success: false, error: 'Serverfehler' });
                }
            }
        };

        xhr.onerror = function() {
            callback({ success: false, error: 'Netzwerkfehler' });
        };

        xhr.ontimeout = function() {
            callback({ success: false, error: 'Timeout - Server nicht erreichbar' });
        };

        xhr.send(JSON.stringify(postData));
    }

    function startTrial() {
        var now = Date.now();
        state.isTrial = true;
        state.trialExpires = now + (CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000);
        state.trialDaysLeft = CONFIG.TRIAL_DAYS;
        state.licenseType = 'trial';
        console.log('[LicenseManager] Trial started, expires:', new Date(state.trialExpires));
        saveLocalLicense();

        // Register with Firebase if configured
        if (CONFIG.FIREBASE_URL) {
            registerDevice();
        }
    }

    // ===== FIREBASE INTEGRATION =====
    function checkFirebase(callback) {
        if (!CONFIG.FIREBASE_URL) {
            callback(getStatus());
            return;
        }

        var url = CONFIG.FIREBASE_URL + '/devices/' + state.deviceId + '.json';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 10000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data) {
                            // Update state from Firebase
                            if (data.blocked) {
                                state.isBlocked = true;
                                state.blockReason = data.blockReason || 'Geraet gesperrt';
                            }
                            if (data.licensed) {
                                state.isLicensed = true;
                                state.licenseKey = data.licenseKey;
                                state.licenseType = data.licenseType || 'lifetime';
                                state.licenseExpires = data.licenseExpires || null;
                            }
                            state.lastOnlineCheck = Date.now();
                            saveLocalLicense();
                        }
                    } catch (e) {
                        console.error('[LicenseManager] Firebase parse error:', e);
                    }
                }
                callback(getStatus());
            }
        };

        xhr.onerror = function() {
            console.warn('[LicenseManager] Firebase check failed, using local data');
            checkOfflineValidity();
            callback(getStatus());
        };

        xhr.ontimeout = function() {
            console.warn('[LicenseManager] Firebase timeout, using local data');
            checkOfflineValidity();
            callback(getStatus());
        };

        xhr.send();
    }

    function registerDevice() {
        if (!CONFIG.FIREBASE_URL) return;

        var url = CONFIG.FIREBASE_URL + '/devices/' + state.deviceId + '.json';
        var data = {
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            trialStarted: Date.now(),
            trialExpires: state.trialExpires,
            licensed: false,
            blocked: false,
            deviceInfo: getDeviceInfo()
        };

        var xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(data));
    }

    function getDeviceInfo() {
        var info = {
            appVersion: '11.2.0',
            model: 'Unknown',
            webosVersion: 'Unknown'
        };

        if (window.webOS && window.webOS.deviceInfo) {
            try {
                info.model = window.webOS.deviceInfo.modelName || 'LG TV';
                info.webosVersion = window.webOS.deviceInfo.sdkVersion || '3.x';
            } catch (e) {}
        }

        return info;
    }

    // ===== OFFLINE VALIDATION =====
    function checkOfflineValidity() {
        if (!state.lastOnlineCheck) return;

        var now = Date.now();
        var offlineMs = now - state.lastOnlineCheck;
        var offlineDays = offlineMs / (24 * 60 * 60 * 1000);

        if (offlineDays > CONFIG.OFFLINE_GRACE_DAYS) {
            // Force online check on next use
            console.warn('[LicenseManager] Offline grace period exceeded');
        }
    }

    // ===== LICENSE ACTIVATION =====
    function activateLicense(licenseKey, callback) {
        if (!licenseKey || licenseKey.length < 10) {
            callback({ success: false, error: 'Ungueltiger Lizenzschluessel' });
            return;
        }

        // Keep dashes for API format (XXXX-XXXX-XXXX-XXXX)
        var formattedKey = licenseKey.toUpperCase();

        console.log('[LicenseManager] Activating license:', formattedKey);

        if (CONFIG.API_URL) {
            // Validate with Laravel Admin Panel API
            activateLicenseWithApi(formattedKey, callback);
        } else if (CONFIG.FIREBASE_URL) {
            // Validate with Firebase
            var cleanKey = formattedKey.replace(/-/g, '');
            validateLicenseWithFirebase(cleanKey, callback);
        } else {
            // Local validation (for testing)
            // Accept any 16-character key (with or without dashes)
            var cleanKey = formattedKey.replace(/-/g, '');
            if (cleanKey.length === 16) {
                state.isLicensed = true;
                state.isTrial = false;
                state.licenseKey = formattedKey;
                state.licenseType = 'lifetime';
                state.licenseExpires = null;
                saveLocalLicense();
                callback({ success: true, type: 'lifetime' });
            } else {
                callback({ success: false, error: 'Lizenzschluessel muss 16 Zeichen haben' });
            }
        }
    }

    function validateLicenseWithFirebase(licenseKey, callback) {
        var url = CONFIG.FIREBASE_URL + '/licenses/' + licenseKey + '.json';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 10000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && !data.usedBy) {
                            // License valid and unused - activate
                            markLicenseUsed(licenseKey, data.type, callback);
                        } else if (data && data.usedBy === state.deviceId) {
                            // Already activated on this device
                            state.isLicensed = true;
                            state.isTrial = false;
                            state.licenseKey = licenseKey;
                            state.licenseType = data.type || 'lifetime';
                            saveLocalLicense();
                            callback({ success: true, type: state.licenseType });
                        } else if (data && data.usedBy) {
                            // Already used on another device
                            callback({ success: false, error: 'Lizenz bereits auf anderem Geraet aktiviert' });
                        } else {
                            callback({ success: false, error: 'Ungueltiger Lizenzschluessel' });
                        }
                    } catch (e) {
                        callback({ success: false, error: 'Fehler bei Validierung' });
                    }
                } else {
                    callback({ success: false, error: 'Lizenz nicht gefunden' });
                }
            }
        };

        xhr.onerror = function() {
            callback({ success: false, error: 'Netzwerkfehler' });
        };

        xhr.send();
    }

    function markLicenseUsed(licenseKey, type, callback) {
        var url = CONFIG.FIREBASE_URL + '/licenses/' + licenseKey + '.json';
        var updateData = {
            usedBy: state.deviceId,
            usedAt: Date.now()
        };

        var xhr = new XMLHttpRequest();
        xhr.open('PATCH', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) {
                return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                // Also update device record
                updateDeviceLicense(licenseKey, type);

                state.isLicensed = true;
                state.isTrial = false;
                state.licenseKey = licenseKey;
                state.licenseType = type || 'lifetime';
                saveLocalLicense();

                callback({ success: true, type: state.licenseType });
            } else {
                callback({ success: false, error: 'SERVER_ERROR', status: xhr.status, message: 'Lizenzaktivierung fehlgeschlagen (Status ' + xhr.status + ')' });
            }
        };

        xhr.onerror = function() {
            callback({ success: false, error: 'NETWORK_ERROR', message: 'Netzwerkfehler bei Lizenzaktivierung' });
        };

        xhr.ontimeout = function() {
            callback({ success: false, error: 'TIMEOUT', message: 'Zeitueberschreitung bei Lizenzaktivierung' });
        };

        xhr.timeout = 10000;

        xhr.send(JSON.stringify(updateData));
    }

    function updateDeviceLicense(licenseKey, type) {
        if (!CONFIG.FIREBASE_URL) return;

        var url = CONFIG.FIREBASE_URL + '/devices/' + state.deviceId + '.json';
        var updateData = {
            licensed: true,
            licenseKey: licenseKey,
            licenseType: type,
            licensedAt: Date.now()
        };

        var xhr = new XMLHttpRequest();
        xhr.open('PATCH', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(updateData));
    }

    // ===== SELF-DESTRUCT =====
    function selfDestruct(reason) {
        console.error('[LicenseManager] SELF-DESTRUCT:', reason);

        // 1. Clear all storage
        try {
            localStorage.clear();
        } catch (e) {}

        // 2. Destroy critical modules
        var criticalModules = [
            'PlayerComponent', 'XtreamAPI', 'ChannelManager',
            'EPGManager', 'EPGGrid', 'FavoritesManager',
            'WatchHistory', 'ChannelOverlay', 'MovieOverlay',
            'SeriesOverlay', 'SearchOverlay'
        ];

        for (var i = 0; i < criticalModules.length; i++) {
            try {
                window[criticalModules[i]] = undefined;
            } catch (e) {}
        }

        // 3. Show blocked screen
        showBlockedScreen(reason);

        // 4. Remove all event listeners
        try {
            var clone = document.body.cloneNode(true);
            document.body.parentNode.replaceChild(clone, document.body);
        } catch (e) {}
    }

    function showBlockedScreen(reason) {
        document.body.innerHTML = '' +
            '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:Arial,sans-serif;">' +
            '  <div style="color:#e50914;font-size:48px;margin-bottom:20px;">&#9888;</div>' +
            '  <h1 style="color:#fff;font-size:28px;margin:0 0 15px 0;">App Deaktiviert</h1>' +
            '  <p style="color:#888;font-size:16px;margin:0 0 30px 0;text-align:center;max-width:400px;">' + (reason || 'Diese App wurde deaktiviert.') + '</p>' +
            '  <p style="color:#555;font-size:12px;">Device ID: ' + state.deviceId + '</p>' +
            '  <p style="color:#555;font-size:12px;margin-top:30px;">Kontakt: support@ultraiptv.io</p>' +
            '</div>';
    }

    // ===== INTEGRITY CHECK =====
    function checkIntegrity() {
        // Verify critical functions exist
        var checks = [
            typeof window.LicenseManager === 'object',
            typeof window.LicenseManager.check === 'function'
        ];

        for (var i = 0; i < checks.length; i++) {
            if (!checks[i]) {
                selfDestruct('Integritaetsfehler erkannt');
                return false;
            }
        }
        return true;
    }

    // Start integrity checks after init
    setTimeout(function() {
        setInterval(checkIntegrity, 300000); // Every 5 minutes
    }, 60000);

    // ===== STATUS =====
    function getStatus() {
        var isTrial = state.isTrial && !state.isLicensed;
        var isValid = state.isLicensed || (isTrial && state.trialDaysLeft > 0);
        var status = 'unknown';

        if (state.isBlocked) {
            status = 'blocked';
        } else if (state.isLicensed) {
            status = 'active';
        } else if (isTrial && state.trialDaysLeft > 0) {
            status = 'trial';
        } else {
            status = 'expired';
        }

        return {
            status: status,
            deviceId: state.deviceId,
            isLicensed: state.isLicensed,
            isTrial: isTrial,
            daysLeft: state.isLicensed ? null : state.trialDaysLeft,
            trialDaysLeft: state.trialDaysLeft,
            trialExpires: state.trialExpires,
            licenseType: state.licenseType,
            licenseExpires: state.licenseExpires,
            blocked: state.isBlocked,
            isBlocked: state.isBlocked,
            blockReason: state.blockReason,
            isValid: isValid,
            needsActivation: !state.isLicensed && state.trialDaysLeft <= 0
        };
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        check: checkLicense,
        activate: activateLicense,
        getStatus: getStatus,
        getDeviceId: function() { return state.deviceId; },
        isValid: function() { return getStatus().isValid; },
        needsActivation: function() { return getStatus().needsActivation; },
        selfDestruct: selfDestruct,

        // Config methods
        setApiUrl: function(url) {
            CONFIG.API_URL = url;
        },
        setFirebaseUrl: function(url) {
            CONFIG.FIREBASE_URL = url;
        }
    };
})();
