/**
 * PIN Input Module - Number Pad (Ziffernfeld)
 * TV-friendly PIN entry with remote control navigation
 * ES3 Compatible for WebOS 3.x
 */

window.PINInput = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        PIN_LENGTH: 4,
        MASK_CHAR: '●',
        SHOW_DELAY: 500,
        ANIMATION_DELAY: 150
    };

    // ===== STATE =====
    var state = {
        isVisible: false,
        currentPIN: '',
        focusRow: 0,
        focusCol: 1,
        callback: null,
        title: 'PIN eingeben',
        showPIN: false
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        display: null,
        dots: [],
        keys: [],
        title: null
    };

    // ===== KEYPAD LAYOUT =====
    var KEYPAD = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['⌫', '0', '✓']
    ];

    // ===== INITIALIZATION =====
    function init() {
        createOverlay();
        setupKeyHandler();
        return true;
    }

    function createOverlay() {
        // Create overlay container
        var overlay = document.createElement('div');
        overlay.id = 'pin-overlay';
        overlay.className = 'pin-overlay';
        overlay.style.display = 'none';

        // Build HTML
        var html = '';
        html += '<div class="pin-modal">';
        html += '<div class="pin-title" id="pin-title">PIN eingeben</div>';
        html += '<div class="pin-display" id="pin-display">';
        for (var i = 0; i < CONFIG.PIN_LENGTH; i++) {
            html += '<div class="pin-dot" id="pin-dot-' + i + '"></div>';
        }
        html += '</div>';
        html += '<div class="pin-keypad" id="pin-keypad">';

        for (var row = 0; row < KEYPAD.length; row++) {
            html += '<div class="pin-keypad-row">';
            for (var col = 0; col < KEYPAD[row].length; col++) {
                var key = KEYPAD[row][col];
                var keyClass = 'pin-key';
                if (key === '⌫') keyClass += ' pin-key-delete';
                if (key === '✓') keyClass += ' pin-key-confirm';
                html += '<div class="' + keyClass + '" data-key="' + key + '" data-row="' + row + '" data-col="' + col + '">' + key + '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        html += '<div class="pin-hint">Navigiere mit Pfeiltasten, bestätige mit OK</div>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        // Cache references
        cache.overlay = overlay;
        cache.title = document.getElementById('pin-title');
        cache.display = document.getElementById('pin-display');

        // Cache dots
        cache.dots = [];
        for (var d = 0; d < CONFIG.PIN_LENGTH; d++) {
            cache.dots.push(document.getElementById('pin-dot-' + d));
        }

        // Cache keys
        cache.keys = [];
        var keyElements = overlay.querySelectorAll('.pin-key');
        for (var k = 0; k < keyElements.length; k++) {
            cache.keys.push(keyElements[k]);
        }
    }

    function setupKeyHandler() {
        // Use capture phase (true) to intercept before other handlers
        document.addEventListener('keydown', function(event) {
            if (!state.isVisible) return;

            var keyCode = event.keyCode;

            // Handle BACK button immediately with high priority
            if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                hide(false);
                return false;
            }

            var handled = false;

            switch (keyCode) {
                case 38: // UP
                    handled = moveFocus(-1, 0);
                    break;
                case 40: // DOWN
                    handled = moveFocus(1, 0);
                    break;
                case 37: // LEFT
                    handled = moveFocus(0, -1);
                    break;
                case 39: // RIGHT
                    handled = moveFocus(0, 1);
                    break;
                case 13: // ENTER/OK
                    handled = activateKey();
                    break;
                default:
                    // Handle number keys directly (0-9)
                    var digit = getDigitFromKeyCode(keyCode);
                    if (digit !== null) {
                        handled = true;
                        addDigit(digit);
                    }
            }

            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);  // true = capture phase
    }

    function getDigitFromKeyCode(keyCode) {
        // Number row (48-57)
        if (keyCode >= 48 && keyCode <= 57) {
            return String(keyCode - 48);
        }
        // Numpad (96-105)
        if (keyCode >= 96 && keyCode <= 105) {
            return String(keyCode - 96);
        }
        return null;
    }

    // ===== FOCUS MANAGEMENT =====
    function moveFocus(rowDelta, colDelta) {
        var newRow = state.focusRow + rowDelta;
        var newCol = state.focusCol + colDelta;

        // Wrap around
        if (newRow < 0) newRow = KEYPAD.length - 1;
        if (newRow >= KEYPAD.length) newRow = 0;
        if (newCol < 0) newCol = KEYPAD[0].length - 1;
        if (newCol >= KEYPAD[0].length) newCol = 0;

        state.focusRow = newRow;
        state.focusCol = newCol;

        updateFocusVisual();
        return true;
    }

    function updateFocusVisual() {
        // Remove focus from all keys
        for (var i = 0; i < cache.keys.length; i++) {
            cache.keys[i].classList.remove('focused');
        }

        // Add focus to current key
        var keyIndex = state.focusRow * 3 + state.focusCol;
        if (cache.keys[keyIndex]) {
            cache.keys[keyIndex].classList.add('focused');
        }
    }

    // ===== KEY ACTIONS =====
    function activateKey() {
        var key = KEYPAD[state.focusRow][state.focusCol];

        if (key === '⌫') {
            deleteDigit();
        } else if (key === '✓') {
            confirmPIN();
        } else {
            addDigit(key);
        }

        return true;
    }

    function addDigit(digit) {
        if (state.currentPIN.length >= CONFIG.PIN_LENGTH) return;

        state.currentPIN += digit;
        updateDisplay();

        // Visual feedback
        var dotIndex = state.currentPIN.length - 1;
        if (cache.dots[dotIndex]) {
            cache.dots[dotIndex].classList.add('filled');
            cache.dots[dotIndex].classList.add('pulse');
            setTimeout(function() {
                if (cache.dots[dotIndex]) {
                    cache.dots[dotIndex].classList.remove('pulse');
                }
            }, CONFIG.ANIMATION_DELAY);
        }

        // Auto-confirm when PIN is complete
        if (state.currentPIN.length === CONFIG.PIN_LENGTH) {
            setTimeout(function() {
                confirmPIN();
            }, CONFIG.SHOW_DELAY);
        }
    }

    function deleteDigit() {
        if (state.currentPIN.length === 0) return;

        var dotIndex = state.currentPIN.length - 1;
        state.currentPIN = state.currentPIN.substring(0, state.currentPIN.length - 1);

        if (cache.dots[dotIndex]) {
            cache.dots[dotIndex].classList.remove('filled');
        }

        updateDisplay();
    }

    function confirmPIN() {
        if (state.currentPIN.length === 0) return;

        var pin = state.currentPIN;
        var callback = state.callback;

        hide(true);

        if (callback) {
            callback(pin);
        }
    }

    function updateDisplay() {
        // Update dots
        for (var i = 0; i < CONFIG.PIN_LENGTH; i++) {
            if (cache.dots[i]) {
                if (i < state.currentPIN.length) {
                    cache.dots[i].classList.add('filled');
                    if (state.showPIN) {
                        cache.dots[i].textContent = state.currentPIN.charAt(i);
                    } else {
                        cache.dots[i].textContent = '';
                    }
                } else {
                    cache.dots[i].classList.remove('filled');
                    cache.dots[i].textContent = '';
                }
            }
        }
    }

    // ===== PUBLIC API =====
    function show(options) {
        options = options || {};

        state.title = options.title || 'PIN eingeben';
        state.showPIN = options.showPIN || false;
        state.callback = options.onComplete || null;
        state.currentPIN = '';
        state.focusRow = 0;
        state.focusCol = 1; // Start at '2' for better UX

        // Update title
        if (cache.title) {
            cache.title.textContent = state.title;
        }

        // Reset display
        for (var i = 0; i < cache.dots.length; i++) {
            cache.dots[i].classList.remove('filled');
            cache.dots[i].textContent = '';
        }

        // Show overlay
        if (cache.overlay) {
            cache.overlay.style.display = 'flex';
        }

        state.isVisible = true;
        updateFocusVisual();

        // Push to navigation stack
        if (window.NavigationStack) {
            window.NavigationStack.push('pin-input', window.NavigationStack.LAYERS.MODAL, {
                onBack: function() {
                    hide(false);
                    return true;
                }
            });
        }
    }

    function hide(confirmed) {
        state.isVisible = false;

        if (cache.overlay) {
            cache.overlay.style.display = 'none';
        }

        // Pop from navigation stack
        if (window.NavigationStack && window.NavigationStack.has('pin-input')) {
            window.NavigationStack.remove('pin-input');
        }

        // Call cancel callback if not confirmed
        if (!confirmed && state.callback) {
            // Pass null to indicate cancellation
            state.callback(null);
        }
    }

    function isVisible() {
        return state.isVisible;
    }

    // ===== RETURN PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        isVisible: isVisible
    };
})();
