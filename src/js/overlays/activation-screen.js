/**
 * Activation Screen - Device Registration
 * ES3 Compatible - WebOS 3.x optimized
 * Shows Device ID, Activation Code & QR Code
 *
 * ACTIVATION CODE IS REVERSIBLE!
 * Use decodeActivationCode(code, secret) to get Device ID back
 */

window.ActivationScreen = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        portalUrl: 'https://ultraiptv.io/activate',
        secretKey: 'ULTRAIPTV2025KEY'  // 16 chars for better encryption
    };

    // Base62 alphabet for encoding
    var BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    // ===== STATE =====
    var state = {
        deviceId: '',
        activationCode: '',
        isActivated: false,
        focusIndex: 0,
        mode: 'activation',  // 'activation' or 'license'
        licenseKey: ['', '', '', ''],  // 4 groups of 4 chars
        licenseKeyIndex: 0,
        isInputActive: false
    };

    // ===== CACHED DOM =====
    var cache = {
        container: null,
        deviceIdDisplay: null,
        activationCodeDisplay: null,
        qrCodeImg: null,
        statusMessage: null,
        licenseSection: null,
        licenseInputs: [],
        activateBtn: null
    };

    // ===== INITIALIZATION =====
    var isInitialized = false;

    function initialize() {
        console.log('[ActivationScreen] init() called');
        if (isInitialized) return;
        isInitialized = true;

        createScreenDOM();
        getDeviceId();
        setupKeyHandler();
    }

    function createScreenDOM() {
        var container = document.createElement('div');
        container.id = 'activation-screen';
        container.className = 'activation-screen';

        var html = '';

        // Logo Section
        html += '<div class="activation-logo-section">';
        html += '  <div class="activation-logo">ULTRA IPTV</div>';
        html += '  <div class="activation-subtitle">Device Activation</div>';
        html += '</div>';

        // QR Code Section (Main Feature)
        html += '<div class="activation-qr-section">';
        html += '  <div class="activation-qr-code">';
        html += '    <img id="activation-qr-img" src="" alt="QR Code">';
        html += '  </div>';
        html += '  <div class="activation-qr-info">';
        html += '    <h3>Scan to Activate</h3>';
        html += '    <p>Scan this QR code with your smartphone to register your device, or enter the code manually on our portal.</p>';
        html += '    <div class="activation-portal-url" id="activation-portal-url"></div>';
        html += '  </div>';
        html += '</div>';

        // Activation Code Card (Prominent Display)
        html += '<div class="activation-card" style="text-align:center;">';
        html += '  <div class="activation-card-header" style="justify-content:center;">';
        html += '    <svg class="activation-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';
        html += '    <span>Your Activation Code</span>';
        html += '  </div>';
        html += '  <div id="activation-code-display" class="activation-code-large">Loading...</div>';
        html += '  <div class="activation-hint">Enter this code on the portal to activate your device</div>';
        html += '</div>';

        // Device Info Card
        html += '<div class="activation-card">';
        html += '  <div class="activation-card-header">';
        html += '    <svg class="activation-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>';
        html += '    <span>Full Device ID</span>';
        html += '  </div>';
        html += '  <div class="activation-device-id">';
        html += '    <span id="activation-device-id">Loading...</span>';
        html += '  </div>';
        html += '  <div class="activation-hint">This is your unique device identifier (LGUDID)</div>';
        html += '</div>';

        // Instructions Card
        html += '<div class="activation-card">';
        html += '  <div class="activation-card-header">';
        html += '    <svg class="activation-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
        html += '    <span>How to Activate</span>';
        html += '  </div>';
        html += '  <div style="color:#aaa;font-size:16px;line-height:1.8;">';
        html += '    <div style="margin-bottom:8px;">1. Scan the QR code or visit <strong style="color:#4CAF50;">ultraiptv.io/activate</strong></div>';
        html += '    <div style="margin-bottom:8px;">2. Enter the activation code shown above</div>';
        html += '    <div style="margin-bottom:8px;">3. Complete payment or enter your subscription key</div>';
        html += '    <div>4. Restart the app - your device will be activated!</div>';
        html += '  </div>';
        html += '</div>';

        // License Key Input Section (Hidden by default)
        html += '<div id="license-section" class="license-section" style="display:none;">';
        html += '  <div class="license-header">';
        html += '    <div class="license-icon">&#128274;</div>';
        html += '    <h2>Lizenz aktivieren</h2>';
        html += '    <p>Geben Sie Ihren Lizenzschluessel ein</p>';
        html += '  </div>';
        html += '  <div class="license-input-container">';
        html += '    <input type="text" class="license-input" id="license-input-0" maxlength="4" readonly>';
        html += '    <span class="license-separator">-</span>';
        html += '    <input type="text" class="license-input" id="license-input-1" maxlength="4" readonly>';
        html += '    <span class="license-separator">-</span>';
        html += '    <input type="text" class="license-input" id="license-input-2" maxlength="4" readonly>';
        html += '    <span class="license-separator">-</span>';
        html += '    <input type="text" class="license-input" id="license-input-3" maxlength="4" readonly>';
        html += '  </div>';
        html += '  <div class="license-keyboard" id="license-keyboard"></div>';
        html += '  <button class="license-activate-btn" id="license-activate-btn">AKTIVIEREN</button>';
        html += '  <div class="license-hint">';
        html += '    <p>Noch keine Lizenz? Besuchen Sie <strong>ultraiptv.io/buy</strong></p>';
        html += '    <p class="license-device-id">Device ID: <span id="license-device-id"></span></p>';
        html += '  </div>';
        html += '</div>';

        // Status Message
        html += '<div id="activation-status" class="activation-status"></div>';

        // Footer
        html += '<div class="activation-footer">';
        html += '  <span>Ultra IPTV v11.2.0</span>';
        html += '  <span>Press BACK to return</span>';
        html += '</div>';

        container.innerHTML = html;
        document.body.appendChild(container);

        // Cache references
        cache.container = container;
        cache.deviceIdDisplay = document.getElementById('activation-device-id');
        cache.activationCodeDisplay = document.getElementById('activation-code-display');
        cache.qrCodeImg = document.getElementById('activation-qr-img');
        cache.portalUrlDisplay = document.getElementById('activation-portal-url');
        cache.statusMessage = document.getElementById('activation-status');
        cache.licenseSection = document.getElementById('license-section');
        cache.activateBtn = document.getElementById('license-activate-btn');

        // Cache license inputs
        cache.licenseInputs = [];
        for (var i = 0; i < 4; i++) {
            cache.licenseInputs.push(document.getElementById('license-input-' + i));
        }

        // Setup license keyboard
        setupLicenseKeyboard();

        // Setup activate button
        if (cache.activateBtn) {
            cache.activateBtn.addEventListener('click', function() {
                submitLicenseKey();
            });
        }

        console.log('[ActivationScreen] DOM created, container:', cache.container);
    }

    // ===== LICENSE KEYBOARD =====
    function setupLicenseKeyboard() {
        var keyboard = document.getElementById('license-keyboard');
        if (!keyboard) return;

        var keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var html = '<div class="license-keyboard-row">';

        for (var i = 0; i < keys.length; i++) {
            if (i === 13 || i === 26) {
                html += '</div><div class="license-keyboard-row">';
            }
            html += '<button class="license-key" data-key="' + keys[i] + '">' + keys[i] + '</button>';
        }

        html += '<button class="license-key license-key-del" data-key="DEL">&#9003;</button>';
        html += '</div>';

        keyboard.innerHTML = html;

        // Add click handlers
        var keyButtons = keyboard.querySelectorAll('.license-key');
        for (var j = 0; j < keyButtons.length; j++) {
            keyButtons[j].addEventListener('click', function() {
                handleLicenseKeyPress(this.getAttribute('data-key'));
            });
        }
    }

    function handleLicenseKeyPress(key) {
        if (key === 'DEL') {
            // Delete last character
            for (var i = 3; i >= 0; i--) {
                if (state.licenseKey[i].length > 0) {
                    state.licenseKey[i] = state.licenseKey[i].slice(0, -1);
                    break;
                }
            }
        } else {
            // Add character to current group
            for (var j = 0; j < 4; j++) {
                if (state.licenseKey[j].length < 4) {
                    state.licenseKey[j] += key;
                    break;
                }
            }
        }

        updateLicenseInputs();
    }

    function updateLicenseInputs() {
        for (var i = 0; i < 4; i++) {
            if (cache.licenseInputs[i]) {
                cache.licenseInputs[i].value = state.licenseKey[i];

                // Highlight current input group
                var isCurrent = state.licenseKey[i].length < 4 &&
                               (i === 0 || state.licenseKey[i - 1].length === 4);
                cache.licenseInputs[i].classList.toggle('active', isCurrent);
            }
        }
    }

    function submitLicenseKey() {
        var fullKey = state.licenseKey.join('-');

        if (fullKey.replace(/-/g, '').length < 16) {
            showStatus('Bitte vollstaendigen Lizenzschluessel eingeben', 'error');
            return;
        }

        showStatus('Pruefe Lizenz...', 'info');

        if (window.LicenseManager) {
            window.LicenseManager.activate(fullKey, function(result) {
                if (result.success) {
                    showStatus('Lizenz aktiviert! App wird neu gestartet...', 'success');
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    showStatus(result.error || 'Aktivierung fehlgeschlagen', 'error');
                }
            });
        } else {
            showStatus('LicenseManager nicht verfuegbar', 'error');
        }
    }

    // ===== DEVICE ID =====
    function getDeviceId() {
        // Try WebOS 3+ LGUDID first
        if (window.webOS && window.webOS.service && window.webOS.service.request) {
            try {
                window.webOS.service.request('luna://com.webos.service.sm', {
                    method: 'deviceid/getIDs',
                    parameters: {
                        idType: ['LGUDID']
                    },
                    onSuccess: function(result) {
                        if (result && result.idList && result.idList.length > 0) {
                            state.deviceId = result.idList[0].idValue;
                            onDeviceIdReady();
                        } else {
                            getOrCreateUUID();
                        }
                    },
                    onFailure: function(error) {
                        getOrCreateUUID();
                    }
                });
            } catch (e) {
                getOrCreateUUID();
            }
        } else {
            getOrCreateUUID();
        }
    }

    function getOrCreateUUID() {
        var storedId = localStorage.getItem('ultra_iptv_device_id');

        if (storedId) {
            state.deviceId = storedId;
        } else {
            state.deviceId = generateUUID();
            localStorage.setItem('ultra_iptv_device_id', state.deviceId);
        }

        onDeviceIdReady();
    }

    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid.toUpperCase();
    }

    function onDeviceIdReady() {
        // Generate reversible activation code from device ID
        state.activationCode = encodeDeviceId(state.deviceId, CONFIG.secretKey);

        // Update displays
        updateDisplays();
    }

    // ===== REVERSIBLE ACTIVATION CODE =====
    // Encodes Device ID into ~22 char activation code (can be decoded back!)

    function encodeDeviceId(deviceId, secret) {
        // Remove dashes and uppercase
        var hex = deviceId.replace(/-/g, '').toUpperCase();

        // Convert hex string to bytes (16 bytes for UUID)
        var bytes = [];
        for (var i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }

        // XOR with secret key
        for (var j = 0; j < bytes.length; j++) {
            bytes[j] = bytes[j] ^ secret.charCodeAt(j % secret.length);
        }

        // Convert bytes to Base62 (process 3 bytes → 4 chars)
        var result = '';
        for (var k = 0; k < bytes.length; k += 3) {
            var b0 = bytes[k] || 0;
            var b1 = bytes[k + 1] || 0;
            var b2 = bytes[k + 2] || 0;

            // Combine 3 bytes into 24-bit number
            var val = (b0 << 16) + (b1 << 8) + b2;

            // Convert to 4 Base62 chars
            var chars = '';
            for (var m = 0; m < 4; m++) {
                chars = BASE62.charAt(val % 62) + chars;
                val = Math.floor(val / 62);
            }
            result += chars;
        }

        // Trim padding and format: XXXXX-XXXXX-XXXXX-XXXXX (20 chars + 3 dashes)
        result = result.substring(0, 22); // 16 bytes needs ~22 Base62 chars

        var formatted = '';
        for (var n = 0; n < result.length; n++) {
            if (n > 0 && n % 5 === 0 && n < 20) {
                formatted += '-';
            }
            formatted += result.charAt(n);
        }

        return formatted;
    }

    // Decode activation code back to Device ID
    function decodeActivationCode(code, secret) {
        // Remove dashes
        var clean = code.replace(/-/g, '');

        // Pad to multiple of 4
        while (clean.length % 4 !== 0) {
            clean += '0';
        }

        // Convert from Base62 back to bytes
        var bytes = [];
        for (var i = 0; i < clean.length; i += 4) {
            // Get 4 Base62 chars
            var val = 0;
            for (var j = 0; j < 4; j++) {
                var idx = BASE62.indexOf(clean.charAt(i + j));
                if (idx === -1) idx = 0;
                val = val * 62 + idx;
            }

            // Split into 3 bytes
            bytes.push((val >> 16) & 0xFF);
            bytes.push((val >> 8) & 0xFF);
            bytes.push(val & 0xFF);
        }

        // Take only first 16 bytes (UUID length)
        bytes = bytes.slice(0, 16);

        // XOR back with secret
        for (var k = 0; k < bytes.length; k++) {
            bytes[k] = bytes[k] ^ secret.charCodeAt(k % secret.length);
        }

        // Convert bytes back to hex
        var hex = '';
        for (var m = 0; m < bytes.length; m++) {
            var h = bytes[m].toString(16).toUpperCase();
            if (h.length < 2) h = '0' + h;
            hex += h;
        }

        // Format as UUID
        return hex.substring(0, 8) + '-' +
               hex.substring(8, 12) + '-' +
               hex.substring(12, 16) + '-' +
               hex.substring(16, 20) + '-' +
               hex.substring(20, 32);
    }

    // Verify an activation code is valid and get device ID
    function verifyAndDecode(code, secret) {
        var deviceId = decodeActivationCode(code, secret);
        if (deviceId && deviceId.length >= 32) {
            return deviceId;
        }
        return null;
    }

    // ===== UPDATE DISPLAYS =====
    function updateDisplays() {
        // Update device ID display
        if (cache.deviceIdDisplay) {
            cache.deviceIdDisplay.textContent = state.deviceId;
        }

        // Update activation code display
        if (cache.activationCodeDisplay) {
            cache.activationCodeDisplay.textContent = state.activationCode;
        }

        // Build full URL with deviceid parameter
        var fullUrl = CONFIG.portalUrl + '?deviceid=' + encodeURIComponent(state.activationCode);

        // Update portal URL display (show full URL)
        if (cache.portalUrlDisplay) {
            cache.portalUrlDisplay.textContent = fullUrl;
        }

        // Generate QR code with full URL
        updateQRCode(fullUrl);
    }

    function updateQRCode(url) {
        if (cache.qrCodeImg) {
            // Use QR Server API (free, no API key needed)
            var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
            cache.qrCodeImg.src = qrUrl;
        }
    }

    // ===== STATUS MESSAGES =====
    function showStatus(message, type) {
        if (cache.statusMessage) {
            cache.statusMessage.textContent = message;
            cache.statusMessage.className = 'activation-status ' + (type || 'info');
            cache.statusMessage.style.display = 'block';
        }
    }

    // ===== KEY HANDLING =====
    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!isVisible()) return;

            var keyCode = e.keyCode;

            // Back button - close activation screen
            if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();

                // Pop from NavigationStack (will trigger hideActivation)
                if (window.NavigationStack) {
                    window.NavigationStack.pop('activation-screen');
                }
            }
        }, true);
    }

    // ===== SHOW/HIDE =====
    function show(mode) {
        console.log('[ActivationScreen] show() called, mode:', mode);

        state.mode = mode || 'activation';

        if (cache.container) {
            cache.container.style.display = 'block';

            // Toggle sections based on mode
            var activationSections = cache.container.querySelectorAll('.activation-qr-section, .activation-card');
            var licenseSection = cache.licenseSection;

            if (state.mode === 'license') {
                // Hide activation, show license input
                for (var i = 0; i < activationSections.length; i++) {
                    activationSections[i].style.display = 'none';
                }
                if (licenseSection) {
                    licenseSection.style.display = 'block';
                    // Show device ID in license section
                    var deviceIdEl = document.getElementById('license-device-id');
                    if (deviceIdEl) {
                        deviceIdEl.textContent = state.deviceId;
                    }
                }
                // Reset license key input
                state.licenseKey = ['', '', '', ''];
                updateLicenseInputs();
            } else {
                // Show activation, hide license
                for (var j = 0; j < activationSections.length; j++) {
                    activationSections[j].style.display = '';
                }
                if (licenseSection) {
                    licenseSection.style.display = 'none';
                }
            }

            console.log('[ActivationScreen] display set to block, mode:', state.mode);
        } else {
            console.log('[ActivationScreen] ERROR: container is null! Was init() called?');
        }
    }

    function hide() {
        if (cache.container) {
            cache.container.style.display = 'none';
        }
    }

    function isVisible() {
        return cache.container && cache.container.style.display === 'block';
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: isVisible,
        getDeviceId: function() { return state.deviceId; },
        getActivationCode: function() { return state.activationCode; },
        // IMPORTANT: These functions can be used on your server to decode the activation code!
        encode: function(deviceId) { return encodeDeviceId(deviceId, CONFIG.secretKey); },
        decode: function(code) { return decodeActivationCode(code, CONFIG.secretKey); },
        // For custom secret (use on server with same secret)
        decodeWithSecret: decodeActivationCode,
        encodeWithSecret: encodeDeviceId,
        isActivated: function() { return state.isActivated; }
    };
})();

/**
 * ============================================
 * SERVER-SIDE DECODE FUNCTION (Copy this!)
 * ============================================
 *
 * Activation Code Format: XXXXX-XXXXX-XXXXX-XXXXX-XX (~22 chars)
 * URL Parameter: ?deviceid=XXXXX-XXXXX-XXXXX-XXXXX-XX
 *
 * PHP Example:
 * -------------
 * function decodeActivationCode($code, $secret = 'ULTRAIPTV2025KEY') {
 *     $base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
 *     $clean = str_replace('-', '', $code);
 *
 *     // Pad to multiple of 4
 *     while (strlen($clean) % 4 !== 0) $clean .= '0';
 *
 *     // Convert Base62 to bytes
 *     $bytes = [];
 *     for ($i = 0; $i < strlen($clean); $i += 4) {
 *         $val = 0;
 *         for ($j = 0; $j < 4; $j++) {
 *             $idx = strpos($base62, $clean[$i + $j]);
 *             if ($idx === false) $idx = 0;
 *             $val = $val * 62 + $idx;
 *         }
 *         $bytes[] = ($val >> 16) & 0xFF;
 *         $bytes[] = ($val >> 8) & 0xFF;
 *         $bytes[] = $val & 0xFF;
 *     }
 *
 *     // Take first 16 bytes
 *     $bytes = array_slice($bytes, 0, 16);
 *
 *     // XOR with secret
 *     $hex = '';
 *     foreach ($bytes as $k => $byte) {
 *         $decrypted = $byte ^ ord($secret[$k % strlen($secret)]);
 *         $hex .= sprintf('%02X', $decrypted);
 *     }
 *
 *     // Format as UUID
 *     return substr($hex,0,8).'-'.substr($hex,8,4).'-'.
 *            substr($hex,12,4).'-'.substr($hex,16,4).'-'.substr($hex,20,12);
 * }
 *
 * // Usage:
 * $deviceId = decodeActivationCode($_GET['deviceid']);
 * // Returns: 550E8400-E29B-41D4-A716-446655440000
 *
 */
