/**
 * Secure Module Loader - Encrypted Code Protection
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Critical modules are AES encrypted and only decrypted
 * at runtime with a key from the server.
 */

window.SecureLoader = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        API_URL: null,  // Set via setApiUrl()
        KEY_CACHE_TIME: 3600000,  // 1 hour
        ENCRYPTED_MODULES: [
            'api-secure',
            'player-secure',
            'channel-manager-secure'
        ]
    };

    // ===== STATE =====
    var state = {
        decryptionKey: null,
        keyExpires: 0,
        modulesLoaded: false,
        deviceId: null
    };

    // ===== AES DECRYPTION (Simple XOR + Base64 for ES3) =====
    // Note: This is a simplified encryption for WebOS 3.x compatibility
    // For production, the server should use proper AES and we decode here

    function base64Decode(str) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var output = '';
        var i = 0;

        str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');

        while (i < str.length) {
            var enc1 = chars.indexOf(str.charAt(i++));
            var enc2 = chars.indexOf(str.charAt(i++));
            var enc3 = chars.indexOf(str.charAt(i++));
            var enc4 = chars.indexOf(str.charAt(i++));

            var chr1 = (enc1 << 2) | (enc2 >> 4);
            var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            var chr3 = ((enc3 & 3) << 6) | enc4;

            output += String.fromCharCode(chr1);
            if (enc3 !== 64) output += String.fromCharCode(chr2);
            if (enc4 !== 64) output += String.fromCharCode(chr3);
        }

        return output;
    }

    function xorDecrypt(encryptedBase64, key) {
        try {
            var encrypted = base64Decode(encryptedBase64);
            var decrypted = '';
            var keyLen = key.length;

            for (var i = 0; i < encrypted.length; i++) {
                var charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % keyLen);
                decrypted += String.fromCharCode(charCode);
            }

            return decrypted;
        } catch (e) {
            console.error('[SecureLoader] Decryption failed:', e);
            return null;
        }
    }

    // ===== KEY MANAGEMENT =====
    function getDecryptionKey(callback) {
        var now = Date.now();

        // Return cached key if still valid
        if (state.decryptionKey && state.keyExpires > now) {
            callback(state.decryptionKey);
            return;
        }

        // Get device ID
        if (!state.deviceId) {
            if (window.LicenseManager && window.LicenseManager.getDeviceId) {
                state.deviceId = window.LicenseManager.getDeviceId();
            } else if (window.ActivationScreen && window.ActivationScreen.getDeviceId) {
                state.deviceId = window.ActivationScreen.getDeviceId();
            } else {
                state.deviceId = localStorage.getItem('ultra_device_id') || 'UNKNOWN';
            }
        }

        if (!CONFIG.API_URL) {
            console.error('[SecureLoader] API_URL not configured');
            callback(null);
            return;
        }

        // Request key from server
        var url = CONFIG.API_URL + '/secure/key';
        var postData = {
            device_id: state.deviceId,
            timestamp: now
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
                        if (data.success && data.key) {
                            state.decryptionKey = data.key;
                            state.keyExpires = now + CONFIG.KEY_CACHE_TIME;
                            callback(data.key);
                        } else {
                            console.error('[SecureLoader] Server denied key:', data.error);
                            callback(null);
                        }
                    } catch (e) {
                        console.error('[SecureLoader] Parse error:', e);
                        callback(null);
                    }
                } else {
                    console.error('[SecureLoader] Key request failed:', xhr.status);
                    callback(null);
                }
            }
        };

        xhr.onerror = function() {
            console.error('[SecureLoader] Network error');
            callback(null);
        };

        xhr.send(JSON.stringify(postData));
    }

    // ===== MODULE LOADING =====
    function loadEncryptedModule(moduleName, encryptedCode, callback) {
        getDecryptionKey(function(key) {
            if (!key) {
                console.error('[SecureLoader] No decryption key for module:', moduleName);
                callback(false);
                return;
            }

            var code = xorDecrypt(encryptedCode, key);
            if (!code) {
                console.error('[SecureLoader] Decryption failed for module:', moduleName);
                callback(false);
                return;
            }

            try {
                // Execute decrypted code
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.text = code;
                document.head.appendChild(script);

                console.log('[SecureLoader] Module loaded:', moduleName);
                callback(true);
            } catch (e) {
                console.error('[SecureLoader] Execution failed for module:', moduleName, e);
                callback(false);
            }
        });
    }

    // ===== LOAD ALL ENCRYPTED MODULES =====
    function loadAllModules(encryptedModules, callback) {
        if (!encryptedModules || Object.keys(encryptedModules).length === 0) {
            console.log('[SecureLoader] No encrypted modules to load');
            callback(true);
            return;
        }

        var moduleNames = Object.keys(encryptedModules);
        var loadedCount = 0;
        var failedCount = 0;

        function onModuleLoaded(success) {
            if (success) {
                loadedCount++;
            } else {
                failedCount++;
            }

            if (loadedCount + failedCount === moduleNames.length) {
                state.modulesLoaded = failedCount === 0;
                console.log('[SecureLoader] Loaded ' + loadedCount + '/' + moduleNames.length + ' modules');
                callback(state.modulesLoaded);
            }
        }

        for (var i = 0; i < moduleNames.length; i++) {
            var name = moduleNames[i];
            loadEncryptedModule(name, encryptedModules[name], onModuleLoaded);
        }
    }

    // ===== INITIALIZATION =====
    function initialize(options, callback) {
        if (options && options.apiUrl) {
            CONFIG.API_URL = options.apiUrl;
        }

        // Dynamic script injection from XOR-decrypted server payload was
        // disabled 2026-04-27 (see docs/SECURITY.md and Phase 5 of the
        // hardening plan). The key endpoint was HTTP and the XOR cipher
        // is reversible — MITM-injectable code in app context is not an
        // acceptable security posture. Re-enable only with HTTPS-pinned
        // key endpoint + SHA-256 hash verification of decrypted code.
        if (window.ENCRYPTED_MODULES) {
            if (window.console && window.console.warn) {
                window.console.warn('[SecureLoader] ENCRYPTED_MODULES is set but dynamic injection is disabled. See docs/SECURITY.md.');
            }
        }
        if (callback) callback(true);
    }

    function showProtectionError() {
        document.body.innerHTML = '' +
            '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:Arial,sans-serif;">' +
            '  <div style="color:#e50914;font-size:48px;margin-bottom:20px;">&#128274;</div>' +
            '  <h1 style="color:#fff;font-size:28px;margin:0 0 15px 0;">Sicherheitsfehler</h1>' +
            '  <p style="color:#888;font-size:16px;margin:0;text-align:center;max-width:400px;">' +
            '    Die App konnte nicht verifiziert werden. Bitte stellen Sie sicher, dass Sie eine gueltige Lizenz haben.' +
            '  </p>' +
            '  <p style="color:#555;font-size:12px;margin-top:30px;">Fehlercode: SEC_LOAD_FAIL</p>' +
            '</div>';
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        loadModule: loadEncryptedModule,
        loadAll: loadAllModules,
        setApiUrl: function(url) {
            CONFIG.API_URL = url;
        },
        isLoaded: function() {
            return state.modulesLoaded;
        },
        getDeviceId: function() {
            return state.deviceId;
        }
    };
})();
