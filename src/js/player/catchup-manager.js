/**
 * Catch-Up TV Manager
 * Verpasste Sendungen der letzten 7 Tage nachschauen
 * Nutzt Xtream API Timeshift-Endpunkt für Replay
 * ES3 Compatible - WebOS 3.x optimized
 */

window.CatchupManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        MAX_DAYS: 7,            // Maximum catch-up days to show
        DEFAULT_DURATION: 60    // Default duration in minutes if not provided
    };

    // ===== STATE =====
    var state = {
        currentChannel: null,
        currentProgram: null,
        isPlaying: false
    };

    // ===== INITIALIZATION =====
    function init() {
        console.log('[CatchupManager] Initialized');
    }

    // ===== CATCH-UP AVAILABILITY =====
    /**
     * Check if channel supports catch-up
     * @param {Object} channel - Channel object from API
     * @returns {boolean}
     */
    function hasCatchup(channel) {
        if (!channel) return false;

        // Xtream API: tv_archive = 1 means catch-up available
        // tv_archive_duration = number of days available
        return (channel.tv_archive === 1 || channel.tv_archive === '1') &&
               (parseInt(channel.tv_archive_duration, 10) > 0);
    }

    /**
     * Get catch-up duration in days
     * @param {Object} channel - Channel object
     * @returns {number} Days of catch-up available
     */
    function getCatchupDays(channel) {
        if (!hasCatchup(channel)) return 0;
        return Math.min(parseInt(channel.tv_archive_duration, 10) || 0, CONFIG.MAX_DAYS);
    }

    // ===== URL BUILDING =====
    /**
     * Build catch-up stream URL
     * Xtream API format: /timeshift/{user}/{pass}/{duration}/{start}/{stream_id}
     *
     * @param {string} streamId - Channel stream ID
     * @param {number} startTime - Unix timestamp of program start
     * @param {number} duration - Duration in minutes
     * @returns {string|null} Catch-up URL or null if API not available
     */
    function buildCatchupUrl(streamId, startTime, duration) {
        if (!window.XtreamAPI || !window.XtreamAPI.getConfig) {
            console.error('[CatchupManager] XtreamAPI not available');
            return null;
        }

        var config = window.XtreamAPI.getConfig();
        if (!config || !config.server || !config.username || !config.password) {
            console.error('[CatchupManager] API config incomplete');
            return null;
        }

        // Duration in minutes
        var durationMin = duration || CONFIG.DEFAULT_DURATION;

        // Build URL
        var url = config.server + '/timeshift/' +
                  config.username + '/' +
                  config.password + '/' +
                  durationMin + '/' +
                  startTime + '/' +
                  streamId + '.m3u8';

        return url;
    }

    /**
     * Alternative format for some providers
     * /streaming/timeshift.php?username=X&password=Y&stream=ID&start=TIMESTAMP&duration=MIN
     */
    function buildCatchupUrlAlt(streamId, startTime, duration) {
        if (!window.XtreamAPI || !window.XtreamAPI.getConfig) {
            return null;
        }

        var config = window.XtreamAPI.getConfig();
        if (!config) return null;

        var durationMin = duration || CONFIG.DEFAULT_DURATION;

        var url = config.server + '/streaming/timeshift.php?' +
                  'username=' + encodeURIComponent(config.username) + '&' +
                  'password=' + encodeURIComponent(config.password) + '&' +
                  'stream=' + streamId + '&' +
                  'start=' + startTime + '&' +
                  'duration=' + durationMin;

        return url;
    }

    // ===== PLAYBACK =====
    /**
     * Play a catch-up program
     * @param {Object} channel - Channel object
     * @param {Object} program - EPG program object with start, stop, title
     */
    function playCatchup(channel, program) {
        if (!channel || !program) {
            console.error('[CatchupManager] Missing channel or program');
            return false;
        }

        if (!hasCatchup(channel)) {
            console.error('[CatchupManager] Channel does not support catch-up');
            showNotAvailable();
            return false;
        }

        var streamId = channel.stream_id;
        var startTime = program.start;
        var duration = program.duration || calculateDuration(program.start, program.stop);

        // Build both URL formats for fallback
        var primaryUrl = buildCatchupUrl(streamId, startTime, duration);
        var altUrl = buildCatchupUrlAlt(streamId, startTime, duration);

        if (!primaryUrl && !altUrl) {
            console.error('[CatchupManager] Failed to build catch-up URL');
            return false;
        }

        state.currentChannel = channel;
        state.currentProgram = program;
        state.isPlaying = true;

        var title = program.title || 'Catch-Up';
        var displayTitle = title + ' (Replay)';

        console.log('[CatchupManager] Playing:', displayTitle);

        // Try primary URL first, fallback to alternative on error
        var urlToPlay = primaryUrl || altUrl;
        console.log('[CatchupManager] URL:', urlToPlay);

        if (window.PlayerComponent) {
            window.PlayerComponent.play(urlToPlay, displayTitle, 'catchup');

            // If primary URL fails, try alternative format after timeout
            if (primaryUrl && altUrl) {
                var fallbackTimer = setTimeout(function() {
                    // Check if video is playing (stream worked)
                    var playerState = window.PlayerComponent.getState ? window.PlayerComponent.getState() : null;
                    if (playerState && playerState.isActive) {
                        var video = document.getElementById('video');
                        if (video && video.readyState < 2 && video.error) {
                            console.log('[CatchupManager] Primary URL failed, trying alternative format');
                            window.PlayerComponent.play(altUrl, displayTitle, 'catchup');
                        }
                    }
                }, 8000);

                // Store timer to clear on stop
                state._fallbackTimer = fallbackTimer;
            }
        }

        // Show catch-up indicator
        showCatchupIndicator(program);

        return true;
    }

    /**
     * Calculate duration in minutes from start/stop timestamps
     */
    function calculateDuration(start, stop) {
        if (!start || !stop) return CONFIG.DEFAULT_DURATION;

        var startTs = parseInt(start, 10);
        var stopTs = parseInt(stop, 10);

        if (isNaN(startTs) || isNaN(stopTs)) return CONFIG.DEFAULT_DURATION;

        // Convert seconds to minutes
        var durationSec = stopTs - startTs;
        var durationMin = Math.ceil(durationSec / 60);

        return Math.max(1, durationMin);
    }

    // ===== UI INDICATORS =====
    function showCatchupIndicator(program) {
        // Could show a "REPLAY" badge on player
        if (window.PlayerComponent && window.PlayerComponent.showBadge) {
            window.PlayerComponent.showBadge('REPLAY');
        }
    }

    function showNotAvailable() {
        var t = window.i18n ? window.i18n.t : function(k) { return k; };
        var message = t('catchup.notAvailable');

        if (window.Toast && window.Toast.show) {
            window.Toast.show(message, 'warning');
        } else {
            console.log('[CatchupManager]', message);
        }
    }

    // ===== STOP PLAYBACK =====
    function stop() {
        state.isPlaying = false;
        state.currentChannel = null;
        state.currentProgram = null;
        if (state._fallbackTimer) {
            clearTimeout(state._fallbackTimer);
            state._fallbackTimer = null;
        }
    }

    // ===== EPG INTEGRATION =====
    /**
     * Check if a program is available for catch-up
     * (Past program within catch-up window)
     */
    function isProgramAvailable(channel, program) {
        if (!hasCatchup(channel) || !program) return false;

        var now = Math.floor(Date.now() / 1000);
        var programEnd = parseInt(program.stop || program.end, 10);
        var programStart = parseInt(program.start, 10);

        // Program must be in the past
        if (programEnd > now) return false;

        // Check if within catch-up window
        var catchupDays = getCatchupDays(channel);
        var catchupWindowStart = now - (catchupDays * 24 * 60 * 60);

        return programStart >= catchupWindowStart;
    }

    /**
     * Get list of catch-up programs for a channel
     * (Filter EPG to past programs within window)
     */
    function getAvailablePrograms(channel, epgPrograms) {
        if (!hasCatchup(channel) || !epgPrograms) return [];

        var available = [];
        for (var i = 0; i < epgPrograms.length; i++) {
            if (isProgramAvailable(channel, epgPrograms[i])) {
                available.push(epgPrograms[i]);
            }
        }

        // Sort by start time (newest first)
        available.sort(function(a, b) {
            return parseInt(b.start, 10) - parseInt(a.start, 10);
        });

        return available;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        hasCatchup: hasCatchup,
        getCatchupDays: getCatchupDays,
        play: playCatchup,
        stop: stop,
        buildUrl: buildCatchupUrl,
        isProgramAvailable: isProgramAvailable,
        getAvailablePrograms: getAvailablePrograms,
        isPlaying: function() { return state.isPlaying; },
        getCurrentProgram: function() { return state.currentProgram; },
        // Debug
        getState: function() { return state; }
    };
})();
