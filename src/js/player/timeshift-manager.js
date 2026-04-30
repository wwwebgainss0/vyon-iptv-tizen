/**
 * Timeshift Manager - Live Pause
 * Live TV pausieren und zurückspulen
 * Nutzt Server-seitigen Timeshift via Xtream API
 * ES3 Compatible - WebOS 3.x optimized
 */

window.TimeshiftManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        MAX_BUFFER_MINUTES: 60,     // Maximum timeshift buffer
        SEEK_STEP_SECONDS: 30,      // Skip 30 seconds per seek
        UPDATE_INTERVAL: 1000       // Update UI every second
    };

    // ===== STATE =====
    var state = {
        enabled: false,             // Timeshift available for current channel
        active: false,              // Currently timeshifting (not live)
        paused: false,              // Playback paused
        currentChannel: null,
        streamStartTime: 0,         // When live stream started
        pauseTime: 0,               // When user paused
        timeshiftOffset: 0,         // Seconds behind live
        updateTimer: null
    };

    // ===== CACHED DOM =====
    var cache = {
        indicator: null,
        progressBar: null,
        timeDisplay: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createUI();
        console.log('[TimeshiftManager] Initialized');
    }

    // ===== UI CREATION =====
    function createUI() {
        if (document.getElementById('timeshift-indicator')) return;

        var indicator = document.createElement('div');
        indicator.id = 'timeshift-indicator';
        indicator.className = 'timeshift-indicator';
        indicator.style.display = 'none';

        indicator.innerHTML =
            '<div class="timeshift-controls">' +
                '<button class="ts-btn" id="ts-rewind">◀◀</button>' +
                '<button class="ts-btn ts-live" id="ts-live">LIVE</button>' +
                '<button class="ts-btn" id="ts-forward">▶▶</button>' +
            '</div>' +
            '<div class="timeshift-progress">' +
                '<div class="ts-bar-bg">' +
                    '<div class="ts-bar-fill" id="ts-bar-fill"></div>' +
                    '<div class="ts-bar-position" id="ts-bar-position"></div>' +
                '</div>' +
                '<span class="ts-time" id="ts-time">LIVE</span>' +
            '</div>';

        document.body.appendChild(indicator);

        cache.indicator = indicator;
        cache.progressBar = document.getElementById('ts-bar-position');
        cache.timeDisplay = document.getElementById('ts-time');
    }

    // ===== TIMESHIFT AVAILABILITY =====
    /**
     * Check if channel supports timeshift
     * Same as catch-up - uses tv_archive flag
     */
    function isAvailable(channel) {
        if (!channel) return false;
        return (channel.tv_archive === 1 || channel.tv_archive === '1');
    }

    /**
     * Enable timeshift for current channel
     * Called when starting playback
     */
    function enable(channel) {
        if (!isAvailable(channel)) {
            state.enabled = false;
            hide();
            return false;
        }

        state.enabled = true;
        state.currentChannel = channel;
        state.streamStartTime = Math.floor(Date.now() / 1000);
        state.timeshiftOffset = 0;
        state.active = false;
        state.paused = false;

        console.log('[TimeshiftManager] Enabled for:', channel.name);
        return true;
    }

    function disable() {
        state.enabled = false;
        state.active = false;
        state.paused = false;
        state.currentChannel = null;
        stopUpdateTimer();
        hide();
    }

    // ===== PAUSE / RESUME =====
    /**
     * Pause live playback (start timeshift)
     */
    function pause() {
        if (!state.enabled || !state.currentChannel) {
            console.log('[TimeshiftManager] Cannot pause - not enabled');
            return false;
        }

        state.paused = true;
        state.pauseTime = Math.floor(Date.now() / 1000);

        if (!state.active) {
            // First pause - start timeshift mode
            state.active = true;
            state.timeshiftOffset = 0;
        }

        // Pause video element
        if (window.PlayerComponent && window.PlayerComponent.pauseVideo) {
            window.PlayerComponent.pauseVideo();
        }

        show();
        startUpdateTimer();

        console.log('[TimeshiftManager] Paused');
        return true;
    }

    /**
     * Resume playback (continue from current position)
     */
    function resume() {
        if (!state.enabled) return false;

        if (state.paused) {
            // Calculate new offset based on pause duration
            var pauseDuration = Math.floor(Date.now() / 1000) - state.pauseTime;
            state.timeshiftOffset += pauseDuration;
            state.paused = false;

            // Load timeshift stream with offset
            playTimeshiftStream();
        }

        console.log('[TimeshiftManager] Resumed, offset:', state.timeshiftOffset, 's');
        return true;
    }

    // ===== SEEKING =====
    /**
     * Seek backward by SEEK_STEP_SECONDS
     */
    function seekBack() {
        if (!state.enabled) return false;

        var maxOffset = CONFIG.MAX_BUFFER_MINUTES * 60;
        state.timeshiftOffset = Math.min(state.timeshiftOffset + CONFIG.SEEK_STEP_SECONDS, maxOffset);
        state.active = true;
        state.paused = false;

        playTimeshiftStream();
        show();

        console.log('[TimeshiftManager] Seek back, offset:', state.timeshiftOffset, 's');
        return true;
    }

    /**
     * Seek forward by SEEK_STEP_SECONDS
     */
    function seekForward() {
        if (!state.enabled || !state.active) return false;

        state.timeshiftOffset = Math.max(0, state.timeshiftOffset - CONFIG.SEEK_STEP_SECONDS);

        if (state.timeshiftOffset === 0) {
            // Return to live
            goLive();
        } else {
            playTimeshiftStream();
        }

        console.log('[TimeshiftManager] Seek forward, offset:', state.timeshiftOffset, 's');
        return true;
    }

    /**
     * Return to live stream
     */
    function goLive() {
        if (!state.enabled) return false;

        state.active = false;
        state.paused = false;
        state.timeshiftOffset = 0;

        // Play live stream again
        if (window.PlayerComponent && state.currentChannel) {
            window.PlayerComponent.play(
                state.currentChannel.stream_id,
                state.currentChannel.name,
                'live'
            );
        }

        stopUpdateTimer();
        hide();

        console.log('[TimeshiftManager] Returned to live');
        return true;
    }

    // ===== TIMESHIFT STREAM =====
    function playTimeshiftStream() {
        if (!state.currentChannel) return;

        var url = buildTimeshiftUrl();
        if (!url) {
            console.error('[TimeshiftManager] Failed to build timeshift URL');
            return;
        }

        var title = state.currentChannel.name + ' (-' + formatTime(state.timeshiftOffset) + ')';

        if (window.PlayerComponent) {
            window.PlayerComponent.play(url, title, 'timeshift');
        }

        startUpdateTimer();
        updateUI();
    }

    /**
     * Build timeshift URL
     * Format: /timeshift/{user}/{pass}/{duration}/{start}/{stream_id}
     */
    function buildTimeshiftUrl() {
        if (!window.XtreamAPI || !window.XtreamAPI.getConfig) return null;

        var config = window.XtreamAPI.getConfig();
        if (!config) return null;

        var streamId = state.currentChannel.stream_id;
        var now = Math.floor(Date.now() / 1000);
        var startTime = now - state.timeshiftOffset;
        var duration = Math.ceil(state.timeshiftOffset / 60) + 5;  // Buffer + 5 min

        var url = config.server + '/timeshift/' +
                  config.username + '/' +
                  config.password + '/' +
                  duration + '/' +
                  startTime + '/' +
                  streamId + '.m3u8';

        return url;
    }

    // ===== UI UPDATES =====
    function show() {
        if (cache.indicator) {
            cache.indicator.style.display = 'flex';
        }
    }

    function hide() {
        if (cache.indicator) {
            cache.indicator.style.display = 'none';
        }
    }

    function updateUI() {
        if (!cache.timeDisplay) return;

        if (state.active && state.timeshiftOffset > 0) {
            cache.timeDisplay.textContent = '-' + formatTime(state.timeshiftOffset);
            cache.timeDisplay.className = 'ts-time delayed';

            // Update progress bar position
            if (cache.progressBar) {
                var maxOffset = CONFIG.MAX_BUFFER_MINUTES * 60;
                var percent = 100 - ((state.timeshiftOffset / maxOffset) * 100);
                cache.progressBar.style.left = percent + '%';
            }
        } else {
            cache.timeDisplay.textContent = 'LIVE';
            cache.timeDisplay.className = 'ts-time live';

            if (cache.progressBar) {
                cache.progressBar.style.left = '100%';
            }
        }
    }

    function formatTime(seconds) {
        var mins = Math.floor(seconds / 60);
        var secs = seconds % 60;
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // ===== UPDATE TIMER =====
    function startUpdateTimer() {
        stopUpdateTimer();
        state.updateTimer = setInterval(function() {
            if (state.paused) {
                // Increase offset while paused
                state.timeshiftOffset++;
            }
            updateUI();
        }, CONFIG.UPDATE_INTERVAL);
    }

    function stopUpdateTimer() {
        if (state.updateTimer) {
            clearInterval(state.updateTimer);
            state.updateTimer = null;
        }
    }

    // ===== KEY HANDLER =====
    /**
     * Handle timeshift-related keys
     * Returns true if handled
     */
    function handleKey(keyCode) {
        if (!state.enabled) return false;

        switch (keyCode) {
            case 412: // REWIND (WebOS)
            case 227: // REWIND (alt)
                return seekBack();

            case 417: // FAST_FORWARD (WebOS)
            case 228: // FAST_FORWARD (alt)
                return seekForward();

            case 19: // PAUSE
            case 415: // PLAY (toggle)
                if (state.paused) {
                    return resume();
                } else {
                    return pause();
                }

            case 413: // STOP
                if (state.active) {
                    return goLive();
                }
                break;
        }

        return false;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        isAvailable: isAvailable,
        enable: enable,
        disable: disable,
        pause: pause,
        resume: resume,
        seekBack: seekBack,
        seekForward: seekForward,
        goLive: goLive,
        handleKey: handleKey,
        show: show,
        hide: hide,
        isActive: function() { return state.active; },
        isPaused: function() { return state.paused; },
        isEnabled: function() { return state.enabled; },
        getOffset: function() { return state.timeshiftOffset; },
        // Debug
        getState: function() { return state; }
    };
})();
