/**
 * Channel Number Input - Direct Channel Tuning
 * Press number keys (0-9) to jump directly to a channel
 * ES3 Compatible - WebOS 3.x optimized
 */

window.ChannelNumberInput = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        TIMEOUT_MS: 3000,       // 3 seconds to complete input
        MAX_DIGITS: 4,          // Maximum 4 digit channel numbers
        OVERLAY_FADE_MS: 300    // Overlay hide delay
    };

    // ===== STATE =====
    var state = {
        digits: '',
        timeout: null,
        visible: false,
        enabled: true
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        numberDisplay: null,
        statusText: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createOverlay();
        cacheElements();
    }

    function createOverlay() {
        // Check if already exists
        if (document.getElementById('channel-number-overlay')) {
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'channel-number-overlay';
        overlay.className = 'channel-number-overlay';
        overlay.innerHTML = '<div class="channel-number-content">' +
            '<div class="channel-number-display" id="channel-number-display">---</div>' +
            '<div class="channel-number-status" id="channel-number-status">Kanalnummer eingeben</div>' +
            '</div>';

        document.body.appendChild(overlay);
    }

    function cacheElements() {
        cache.overlay = document.getElementById('channel-number-overlay');
        cache.numberDisplay = document.getElementById('channel-number-display');
        cache.statusText = document.getElementById('channel-number-status');
    }

    // ===== INPUT HANDLING =====

    /**
     * Handle a digit key press
     * @param {number} digit - The digit (0-9)
     * @returns {boolean} - True if handled
     */
    function handleDigit(digit) {
        if (!state.enabled) return false;

        // Don't handle if player is active (let player handle navigation)
        if (window.PlayerComponent && window.PlayerComponent.isActive()) {
            return false;
        }

        // Only works on Live TV screen
        if (window.NavigationStack) {
            var screen = window.NavigationStack.getCurrentScreen();
            if (screen !== 'livetv') {
                return false;
            }
        }

        // Add digit
        if (state.digits.length < CONFIG.MAX_DIGITS) {
            state.digits = state.digits + digit;
        }

        // Show overlay
        showOverlay();

        // Reset timeout
        resetTimeout();

        return true;
    }

    /**
     * Get digit from keyCode
     * @param {number} keyCode
     * @returns {number|null} - Digit or null if not a digit key
     */
    function getDigitFromKeyCode(keyCode) {
        // Number row keys (48-57 = 0-9)
        if (keyCode >= 48 && keyCode <= 57) {
            return keyCode - 48;
        }
        // Numpad keys (96-105 = 0-9)
        if (keyCode >= 96 && keyCode <= 105) {
            return keyCode - 96;
        }
        return null;
    }

    // ===== OVERLAY =====

    function showOverlay() {
        if (!cache.overlay) {
            cacheElements();
        }
        if (!cache.overlay) return;

        state.visible = true;
        cache.overlay.style.display = 'flex';

        updateDisplay();
    }

    function hideOverlay() {
        if (!cache.overlay) return;

        state.visible = false;
        cache.overlay.style.display = 'none';
        state.digits = '';

        if (cache.numberDisplay) {
            cache.numberDisplay.textContent = '---';
        }
        if (cache.statusText) {
            cache.statusText.textContent = 'Kanalnummer eingeben';
        }
    }

    function updateDisplay() {
        if (!cache.numberDisplay) return;

        var display = state.digits || '---';
        // Pad with dashes if needed
        while (display.length < 3) {
            display = '-' + display;
        }
        cache.numberDisplay.textContent = display;
    }

    function showStatus(text) {
        if (cache.statusText) {
            cache.statusText.textContent = text;
        }
    }

    // ===== TIMEOUT =====

    function resetTimeout() {
        // Clear existing timeout
        if (state.timeout) {
            clearTimeout(state.timeout);
            state.timeout = null;
        }

        // Set new timeout
        state.timeout = setTimeout(function() {
            tuneToChannel();
        }, CONFIG.TIMEOUT_MS);
    }

    function cancelTimeout() {
        if (state.timeout) {
            clearTimeout(state.timeout);
            state.timeout = null;
        }
    }

    // ===== CHANNEL TUNING =====

    function tuneToChannel() {
        cancelTimeout();

        if (!state.digits || state.digits.length === 0) {
            hideOverlay();
            return;
        }

        var channelNum = parseInt(state.digits, 10);

        // Find channel by num field
        var channel = findChannelByNumber(channelNum);

        if (channel) {
            showStatus('Wechsle zu ' + channel.name);

            // Play the channel
            setTimeout(function() {
                hideOverlay();

                if (window.PlayerComponent) {
                    window.PlayerComponent.play(
                        channel.stream_id,
                        channel.name,
                        'live',
                        channel.stream_icon || ''
                    );
                }
            }, CONFIG.OVERLAY_FADE_MS);
        } else {
            showStatus('Kanal ' + channelNum + ' nicht gefunden');

            // Hide after showing error
            setTimeout(function() {
                hideOverlay();
            }, 1500);
        }
    }

    /**
     * Find channel by its num field
     * @param {number} num - Channel number
     * @returns {object|null} - Channel object or null
     */
    function findChannelByNumber(num) {
        // Try to get channels from ScreenManager or API
        var channels = null;

        // Method 1: Get from ScreenManager's cached data
        if (window.ScreenManager && window.ScreenManager.getLiveTVChannels) {
            channels = window.ScreenManager.getLiveTVChannels();
        }

        // Method 2: Get from SlotRenderer's data
        if (!channels && window.SlotRenderer && window.SlotRenderer.getAllItems) {
            channels = window.SlotRenderer.getAllItems();
        }

        if (!channels || channels.length === 0) {
            return null;
        }

        // Search for channel with matching num field
        for (var i = 0; i < channels.length; i++) {
            var ch = channels[i];
            // Check num field (Xtream API provides this)
            if (ch.num && parseInt(ch.num, 10) === num) {
                return ch;
            }
            // Fallback: check stream_id
            if (ch.stream_id && parseInt(ch.stream_id, 10) === num) {
                return ch;
            }
        }

        return null;
    }

    // ===== CONTROLS =====

    function enable() {
        state.enabled = true;
    }

    function disable() {
        state.enabled = false;
        hideOverlay();
        cancelTimeout();
    }

    function isVisible() {
        return state.visible;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        handleDigit: handleDigit,
        getDigitFromKeyCode: getDigitFromKeyCode,
        enable: enable,
        disable: disable,
        isVisible: isVisible,
        hide: hideOverlay
    };
})();
