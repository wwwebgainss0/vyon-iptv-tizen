/**
 * Sleep Timer - Auto Turn Off TV
 * Set a timer to turn off the TV after X minutes
 * ES3 Compatible - WebOS 3.x optimized
 */

window.SleepTimer = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        WARNING_BEFORE_MS: 60000,   // Show warning 1 minute before
        PRESETS: [0, 30, 60, 90, 120, 180]  // Off, 30min, 1h, 1.5h, 2h, 3h
    };

    var PRESET_LABELS = ['Aus', '30 Min', '1 Std', '1.5 Std', '2 Std', '3 Std'];

    // ===== STATE =====
    var state = {
        enabled: false,
        endTime: null,
        warningShown: false,
        currentPreset: 0,  // Index in PRESETS
        tickInterval: null
    };

    // ===== DOM CACHE =====
    var cache = {
        warningOverlay: null,
        countdownDisplay: null,
        messageDisplay: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createWarningOverlay();
        cacheElements();
    }

    function createWarningOverlay() {
        // Check if already exists
        if (document.getElementById('sleep-timer-warning')) {
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'sleep-timer-warning';
        overlay.className = 'sleep-timer-warning';
        overlay.innerHTML = '<div class="sleep-timer-countdown" id="sleep-countdown">60</div>' +
            '<div class="sleep-timer-message" id="sleep-message">TV schaltet sich gleich aus</div>' +
            '<div class="sleep-timer-hint">Beliebige Taste drücken zum Abbrechen</div>';

        document.body.appendChild(overlay);

        // Add key listener to cancel
        document.addEventListener('keydown', handleKeyDuringWarning, false);
    }

    function cacheElements() {
        cache.warningOverlay = document.getElementById('sleep-timer-warning');
        cache.countdownDisplay = document.getElementById('sleep-countdown');
        cache.messageDisplay = document.getElementById('sleep-message');
    }

    // ===== TIMER CONTROL =====

    /**
     * Set timer with preset index
     * @param {number} presetIndex - Index in PRESETS array
     */
    function setTimerByPreset(presetIndex) {
        if (presetIndex < 0 || presetIndex >= CONFIG.PRESETS.length) {
            presetIndex = 0;
        }

        state.currentPreset = presetIndex;
        var minutes = CONFIG.PRESETS[presetIndex];

        if (minutes === 0) {
            cancel();
            return;
        }

        setTimer(minutes);
    }

    /**
     * Set timer in minutes
     * @param {number} minutes - Minutes until shutdown
     */
    function setTimer(minutes) {
        cancel(); // Clear any existing timer

        state.enabled = true;
        state.endTime = Date.now() + (minutes * 60 * 1000);
        state.warningShown = false;

        // Start tick interval
        state.tickInterval = setInterval(tick, 1000);

        showToast('Sleep Timer: ' + formatMinutes(minutes));
    }

    /**
     * Cancel the timer
     */
    function cancel() {
        state.enabled = false;
        state.endTime = null;
        state.warningShown = false;

        if (state.tickInterval) {
            clearInterval(state.tickInterval);
            state.tickInterval = null;
        }

        hideWarning();
    }

    /**
     * Cycle to next preset (for quick toggle)
     */
    function cyclePreset() {
        var nextIndex = (state.currentPreset + 1) % CONFIG.PRESETS.length;
        setTimerByPreset(nextIndex);
        return nextIndex;
    }

    // ===== TICK =====

    function tick() {
        if (!state.enabled || !state.endTime) {
            return;
        }

        var remaining = state.endTime - Date.now();

        // Show warning 1 minute before
        if (remaining <= CONFIG.WARNING_BEFORE_MS && !state.warningShown) {
            showWarning();
            state.warningShown = true;
        }

        // Update countdown if warning is visible
        if (state.warningShown && cache.countdownDisplay) {
            var seconds = Math.max(0, Math.ceil(remaining / 1000));
            cache.countdownDisplay.textContent = seconds;
        }

        // Time's up - turn off TV
        if (remaining <= 0) {
            turnOffTV();
        }
    }

    // ===== WARNING OVERLAY =====

    function showWarning() {
        if (!cache.warningOverlay) {
            cacheElements();
        }
        if (!cache.warningOverlay) return;

        cache.warningOverlay.style.display = 'block';
    }

    function hideWarning() {
        if (cache.warningOverlay) {
            cache.warningOverlay.style.display = 'none';
        }
    }

    function handleKeyDuringWarning(event) {
        // Only handle if warning is visible
        if (!state.warningShown) return;

        // Any key cancels the timer
        event.preventDefault();
        event.stopPropagation();

        cancel();
        showToast('Sleep Timer abgebrochen');
    }

    // ===== TV CONTROL =====

    function turnOffTV() {
        cancel();

        // Try WebOS Luna API first
        if (typeof webOS !== 'undefined' && webOS.service && webOS.service.request) {
            webOS.service.request('luna://com.webos.service.tvpower', {
                method: 'turnOff',
                onSuccess: function(res) {
                    // TV turning off...
                },
                onFailure: function(err) {
                    // Fallback - just close the app
                    fallbackClose();
                }
            });
        } else {
            // No WebOS API - try fallback
            fallbackClose();
        }
    }

    function fallbackClose() {
        // Try to close the app (WebOS specific)
        if (typeof webOS !== 'undefined' && webOS.platformBack) {
            webOS.platformBack();
        } else if (window.close) {
            window.close();
        }
    }

    // ===== HELPERS =====

    function formatMinutes(minutes) {
        if (minutes < 60) {
            return minutes + ' Min';
        }
        var hours = Math.floor(minutes / 60);
        var mins = minutes % 60;
        if (mins === 0) {
            return hours + ' Std';
        }
        return hours + '.' + (mins < 10 ? '0' : '') + mins + ' Std';
    }

    function showToast(message) {
        // Create toast element
        var toast = document.createElement('div');
        toast.className = 'sleep-timer-toast';
        toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);' +
            'background:rgba(0,0,0,0.8);color:#fff;padding:15px 30px;border-radius:8px;' +
            'font-size:18px;z-index:9999;';
        toast.textContent = message;

        document.body.appendChild(toast);

        // Remove after 2 seconds
        setTimeout(function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 2000);
    }

    // ===== GETTERS =====

    function isEnabled() {
        return state.enabled;
    }

    function getCurrentPreset() {
        return state.currentPreset;
    }

    function getPresetLabel(index) {
        if (index === undefined) {
            index = state.currentPreset;
        }
        return PRESET_LABELS[index] || 'Aus';
    }

    function getRemainingTime() {
        if (!state.enabled || !state.endTime) {
            return null;
        }
        return Math.max(0, state.endTime - Date.now());
    }

    function getRemainingMinutes() {
        var remaining = getRemainingTime();
        if (remaining === null) return 0;
        return Math.ceil(remaining / 60000);
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        setTimer: setTimer,
        setTimerByPreset: setTimerByPreset,
        cancel: cancel,
        cyclePreset: cyclePreset,
        isEnabled: isEnabled,
        getCurrentPreset: getCurrentPreset,
        getPresetLabel: getPresetLabel,
        getRemainingTime: getRemainingTime,
        getRemainingMinutes: getRemainingMinutes,
        PRESETS: CONFIG.PRESETS,
        PRESET_LABELS: PRESET_LABELS
    };
})();
