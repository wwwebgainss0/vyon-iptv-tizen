/**
 * Binge-Watch Overlay - Auto-play Next Episode
 * Shows countdown before automatically playing next episode
 * ES3 Compatible - WebOS 3.x optimized
 */

window.BingeOverlay = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        COUNTDOWN_SECONDS: 10,
        UPDATE_INTERVAL: 1000
    };

    // ===== STATE =====
    var state = {
        visible: false,
        countdown: CONFIG.COUNTDOWN_SECONDS,
        nextEpisode: null,
        currentEpisode: null,
        seriesData: null,
        interval: null,
        focusedButton: 0  // 0 = Play Now, 1 = Cancel
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        thumbnail: null,
        title: null,
        countdownDisplay: null,
        playBtn: null,
        cancelBtn: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createOverlay();
        cacheElements();
        setupKeyHandler();
    }

    function createOverlay() {
        // Check if already exists
        if (document.getElementById('binge-overlay')) {
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'binge-overlay';
        overlay.className = 'binge-overlay';
        overlay.innerHTML =
            '<div class="binge-content">' +
                '<div class="binge-next-thumb" id="binge-thumb"></div>' +
                '<div class="binge-next-info">' +
                    '<div class="binge-label">Nächste Episode</div>' +
                    '<div class="binge-title" id="binge-title">S1 E2 - Episode Title</div>' +
                '</div>' +
                '<div class="binge-countdown" id="binge-countdown">' + CONFIG.COUNTDOWN_SECONDS + '</div>' +
            '</div>' +
            '<div class="binge-actions">' +
                '<button class="binge-btn play focused" id="binge-play">Jetzt abspielen</button>' +
                '<button class="binge-btn cancel" id="binge-cancel">Abbrechen</button>' +
            '</div>';

        document.body.appendChild(overlay);
    }

    function cacheElements() {
        cache.overlay = document.getElementById('binge-overlay');
        cache.thumbnail = document.getElementById('binge-thumb');
        cache.title = document.getElementById('binge-title');
        cache.countdownDisplay = document.getElementById('binge-countdown');
        cache.playBtn = document.getElementById('binge-play');
        cache.cancelBtn = document.getElementById('binge-cancel');
    }

    function setupKeyHandler() {
        document.addEventListener('keydown', handleKeyDown, false);
    }

    // ===== KEY HANDLING =====
    function handleKeyDown(event) {
        if (!state.visible) return;

        var keyCode = event.keyCode;
        var handled = false;

        switch (keyCode) {
            case 37: // LEFT
                moveFocus(-1);
                handled = true;
                break;
            case 39: // RIGHT
                moveFocus(1);
                handled = true;
                break;
            case 13: // ENTER / OK
                activateButton();
                handled = true;
                break;
            case 461: // BACK (WebOS)
            case 10009: // BACK (WebOS alt)
            case 8: // Backspace
            case 27: // ESC
                cancel();
                handled = true;
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function moveFocus(direction) {
        state.focusedButton = state.focusedButton + direction;
        if (state.focusedButton < 0) state.focusedButton = 1;
        if (state.focusedButton > 1) state.focusedButton = 0;
        updateFocus();
    }

    function updateFocus() {
        if (!cache.playBtn || !cache.cancelBtn) return;

        if (state.focusedButton === 0) {
            cache.playBtn.className = 'binge-btn play focused';
            cache.cancelBtn.className = 'binge-btn cancel';
        } else {
            cache.playBtn.className = 'binge-btn play';
            cache.cancelBtn.className = 'binge-btn cancel focused';
        }
    }

    function activateButton() {
        if (state.focusedButton === 0) {
            playNext();
        } else {
            cancel();
        }
    }

    // ===== SHOW / HIDE =====

    /**
     * Show binge overlay with next episode info
     * @param {object} currentEpisode - Current episode data
     * @param {object} nextEpisode - Next episode data
     * @param {object} seriesData - Full series data (for context)
     */
    function show(currentEpisode, nextEpisode, seriesData) {
        if (!nextEpisode) {
            return false;
        }

        // Check if autoplay is enabled
        if (!isAutoplayEnabled()) {
            return false;
        }

        state.currentEpisode = currentEpisode;
        state.nextEpisode = nextEpisode;
        state.seriesData = seriesData;
        state.countdown = CONFIG.COUNTDOWN_SECONDS;
        state.focusedButton = 0;
        state.visible = true;

        if (!cache.overlay) {
            cacheElements();
        }

        // Update UI
        updateUI();

        // Show overlay
        cache.overlay.style.display = 'flex';

        // Start countdown
        startCountdown();

        return true;
    }

    function hide() {
        state.visible = false;

        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }

        if (cache.overlay) {
            cache.overlay.style.display = 'none';
        }

        state.nextEpisode = null;
        state.currentEpisode = null;
        state.seriesData = null;
    }

    function updateUI() {
        if (!state.nextEpisode) return;

        var ep = state.nextEpisode;
        var seasonNum = ep.season || 1;
        var episodeNum = ep.episode_num || ep.id || '?';
        var title = ep.title || ep.name || 'Episode ' + episodeNum;

        // Build title string
        var titleText = 'S' + seasonNum + ' E' + episodeNum + ' - ' + title;
        if (cache.title) {
            cache.title.textContent = titleText;
        }

        // Set thumbnail if available
        if (cache.thumbnail && ep.info && ep.info.movie_image) {
            cache.thumbnail.style.backgroundImage = 'url(' + ep.info.movie_image + ')';
        } else if (cache.thumbnail) {
            cache.thumbnail.style.backgroundImage = '';
            cache.thumbnail.style.background = '#333';
        }

        // Reset focus
        updateFocus();
    }

    // ===== COUNTDOWN =====

    function startCountdown() {
        if (state.interval) {
            clearInterval(state.interval);
        }

        state.interval = setInterval(tick, CONFIG.UPDATE_INTERVAL);
        updateCountdownDisplay();
    }

    function tick() {
        state.countdown--;

        if (state.countdown <= 0) {
            playNext();
        } else {
            updateCountdownDisplay();
        }
    }

    function updateCountdownDisplay() {
        if (cache.countdownDisplay) {
            cache.countdownDisplay.textContent = state.countdown;
        }
    }

    // ===== ACTIONS =====

    function playNext() {
        if (!state.nextEpisode) {
            hide();
            return;
        }

        var nextEp = state.nextEpisode;
        var series = state.seriesData;

        hide();

        // Play the next episode via SeriesOverlay or directly
        if (window.SeriesOverlay && window.SeriesOverlay.playEpisode) {
            window.SeriesOverlay.playEpisode(nextEp, series);
        } else if (window.PlayerComponent) {
            // Fallback - play directly
            var streamUrl = nextEp.direct_source || buildEpisodeUrl(nextEp);
            var title = nextEp.title || nextEp.name || 'Episode';
            window.PlayerComponent.play(nextEp.id, title, 'series', '', nextEp);
        }
    }

    function cancel() {
        hide();
    }

    function buildEpisodeUrl(episode) {
        // Build episode URL if needed
        // This depends on how your API works
        return episode.direct_source || '';
    }

    // ===== HELPERS =====

    function isAutoplayEnabled() {
        // Check settings for autoplay preference
        try {
            var settings = localStorage.getItem('ultra_iptv_settings');
            if (settings) {
                var parsed = JSON.parse(settings);
                if (parsed.hasOwnProperty('autoplayNext')) {
                    return parsed.autoplayNext;
                }
            }
        } catch (e) {
            // Ignore errors
        }
        return true; // Default to enabled
    }

    function isVisible() {
        return state.visible;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        isVisible: isVisible,
        playNext: playNext,
        cancel: cancel
    };
})();
