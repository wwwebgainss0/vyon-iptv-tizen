/**
 * Picture-in-Picture Manager
 * Small video window while browsing
 * ES3 Compatible - WebOS 3.x optimized
 */

window.PiPManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        PIP_WIDTH: 320,
        PIP_HEIGHT: 180,
        MARGIN: 20,
        POSITIONS: ['bottom-right', 'bottom-left', 'top-right', 'top-left']
    };

    // ===== STATE =====
    var state = {
        active: false,
        position: 'bottom-right', // Default position
        positionIndex: 0,
        streamId: '',
        channelName: '',
        streamType: 'live',
        isLive: true,
        originalVideoSrc: ''
    };

    // ===== CACHED DOM ELEMENTS =====
    var cache = {
        pipContainer: null,
        pipVideo: null,
        pipOverlay: null,
        pipTitle: null,
        pipClose: null,
        pipExpand: null,
        mainVideo: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createPiPElements();
        cacheElements();
        setupEventHandlers();
    }

    function createPiPElements() {
        // Check if already exists
        if (document.getElementById('pip-container')) return;

        var container = document.createElement('div');
        container.id = 'pip-container';
        container.className = 'pip-container';

        container.innerHTML =
            '<video id="pip-video" class="pip-video" muted></video>' +
            '<div class="pip-overlay">' +
                '<div class="pip-title" id="pip-title"></div>' +
                '<div class="pip-controls">' +
                    '<div class="pip-btn pip-expand" id="pip-expand" title="Expand">⛶</div>' +
                    '<div class="pip-btn pip-close" id="pip-close" title="Close">✕</div>' +
                '</div>' +
            '</div>' +
            '<div class="pip-badge">PiP</div>';

        document.body.appendChild(container);
    }

    function cacheElements() {
        cache.pipContainer = document.getElementById('pip-container');
        cache.pipVideo = document.getElementById('pip-video');
        cache.pipTitle = document.getElementById('pip-title');
        cache.pipClose = document.getElementById('pip-close');
        cache.pipExpand = document.getElementById('pip-expand');
        cache.mainVideo = document.getElementById('video');
    }

    function setupEventHandlers() {
        // PiP video events
        if (cache.pipVideo) {
            cache.pipVideo.addEventListener('error', function() {
                console.error('[PiP] Video error');
            });

            cache.pipVideo.addEventListener('ended', function() {
                if (state.isLive) {
                    // Try to reload live stream
                    try {
                        cache.pipVideo.load();
                        cache.pipVideo.play();
                    } catch (e) {}
                }
            });
        }

        // Click handlers for controls
        if (cache.pipClose) {
            cache.pipClose.onclick = function() {
                close();
            };
        }

        if (cache.pipExpand) {
            cache.pipExpand.onclick = function() {
                expandToFullscreen();
            };
        }

        // Click on PiP container to expand
        if (cache.pipContainer) {
            cache.pipContainer.onclick = function(e) {
                // Don't expand if clicking on close button
                if (e.target === cache.pipClose) return;
                if (e.target === cache.pipExpand) return;
                expandToFullscreen();
            };
        }
    }

    // ===== PIP CONTROL =====

    /**
     * Enter PiP mode with current playback
     * @param {string} streamId - Stream ID
     * @param {string} channelName - Channel/Movie name
     * @param {string} streamType - 'live', 'movie', 'series'
     */
    function enter(streamId, channelName, streamType) {
        if (!cache.pipContainer || !cache.pipVideo) {
            init();
            cacheElements();
        }

        state.active = true;
        state.streamId = streamId;
        state.channelName = channelName;
        state.streamType = streamType || 'live';
        state.isLive = (streamType !== 'movie' && streamType !== 'vod' && streamType !== 'series');

        // Get stream URL
        var streamUrl = '';
        if (window.XtreamAPI) {
            if (state.isLive) {
                var apiConfig = window.XtreamAPI.getConfig();
                streamUrl = apiConfig.server + '/live/' + apiConfig.username + '/' + apiConfig.password + '/' + streamId + '.ts';
            } else {
                // For VOD, we need the container extension
                var playerState = window.PlayerComponent ? window.PlayerComponent.getState() : null;
                var ext = playerState ? playerState.containerExtension : 'mp4';
                streamUrl = window.XtreamAPI.getStreamUrl(streamId, streamType === 'series' ? 'series' : 'movie', ext);
            }
        }

        // Copy current position from main video if available
        var currentTime = 0;
        if (cache.mainVideo && !state.isLive) {
            currentTime = cache.mainVideo.currentTime || 0;
        }

        // Set up PiP video
        cache.pipVideo.src = streamUrl;
        state.originalVideoSrc = streamUrl;
        cache.pipVideo.muted = false; // Enable audio in PiP

        // Load and play
        cache.pipVideo.load();

        // Seek to position for VOD
        if (!state.isLive && currentTime > 0) {
            cache.pipVideo.addEventListener('canplay', function onCanPlay() {
                try {
                    cache.pipVideo.currentTime = currentTime;
                } catch (e) {}
                cache.pipVideo.removeEventListener('canplay', onCanPlay);
            });
        }

        try {
            cache.pipVideo.play();
        } catch (e) {
            console.error('[PiP] Play failed:', e);
        }

        // Update title
        if (cache.pipTitle) {
            cache.pipTitle.textContent = channelName;
        }

        // Apply position
        updatePosition();

        // Show PiP container
        cache.pipContainer.className = 'pip-container active';

        // Close main player if open
        if (window.PlayerComponent && window.PlayerComponent.isActive()) {
            // Remove from navigation stack without triggering overlay returns
            if (window.NavigationStack) {
                window.NavigationStack.pop('player');
            }
            // Silently close main player
            closeMainPlayerSilently();
        }

        console.log('[PiP] Entered PiP mode:', channelName);
    }

    /**
     * Enter PiP from currently playing content
     */
    function enterFromPlayer() {
        if (!window.PlayerComponent) return;

        var playerState = window.PlayerComponent.getState();
        if (!playerState.isActive) return;

        enter(
            playerState.currentStreamId,
            playerState.currentChannelName,
            playerState.currentStreamType
        );
    }

    /**
     * Close main player without triggering overlay restore
     */
    function closeMainPlayerSilently() {
        var video = document.getElementById('video');
        var player = document.getElementById('player');

        if (video) {
            video.pause();
            video.src = '';
        }

        if (player) {
            player.style.display = 'none';
            player.className = 'player';
        }

        if (window.NavigationHandler) {
            window.NavigationHandler.setPlayerActive(false);
        }
    }

    /**
     * Close PiP mode
     */
    function close() {
        if (!state.active) return;

        state.active = false;

        // Stop video
        if (cache.pipVideo) {
            cache.pipVideo.pause();
            cache.pipVideo.src = '';
        }

        // Hide container
        if (cache.pipContainer) {
            cache.pipContainer.className = 'pip-container';
        }

        // Reset state
        state.streamId = '';
        state.channelName = '';
        state.originalVideoSrc = '';

        console.log('[PiP] Closed');
    }

    /**
     * Expand PiP to fullscreen player
     */
    function expandToFullscreen() {
        if (!state.active) return;

        // Get current position
        var currentTime = 0;
        if (cache.pipVideo && !state.isLive) {
            currentTime = cache.pipVideo.currentTime || 0;
        }

        // Store current state
        var streamId = state.streamId;
        var channelName = state.channelName;
        var streamType = state.streamType;

        // Close PiP first
        close();

        // Open in full player
        if (window.PlayerComponent) {
            // Get container extension from API if available
            var ext = '';
            if (!state.isLive && window.XtreamAPI) {
                // Use common extension
                ext = 'mp4';
            }

            window.PlayerComponent.play(streamId, channelName, streamType, ext);

            // Seek to position after player starts
            if (!state.isLive && currentTime > 0) {
                setTimeout(function() {
                    window.PlayerComponent.seekTo(currentTime);
                }, 500);
            }
        }

        console.log('[PiP] Expanded to fullscreen');
    }

    /**
     * Toggle PiP mode
     */
    function toggle() {
        if (state.active) {
            expandToFullscreen();
        } else {
            enterFromPlayer();
        }
    }

    /**
     * Cycle PiP position (corner to corner)
     */
    function cyclePosition() {
        if (!state.active) return;

        state.positionIndex = (state.positionIndex + 1) % CONFIG.POSITIONS.length;
        state.position = CONFIG.POSITIONS[state.positionIndex];
        updatePosition();
    }

    /**
     * Set PiP position
     * @param {string} position - 'bottom-right', 'bottom-left', 'top-right', 'top-left'
     */
    function setPosition(position) {
        for (var i = 0; i < CONFIG.POSITIONS.length; i++) {
            if (CONFIG.POSITIONS[i] === position) {
                state.positionIndex = i;
                state.position = position;
                updatePosition();
                return;
            }
        }
    }

    function updatePosition() {
        if (!cache.pipContainer) return;

        // Reset all positions
        cache.pipContainer.style.top = 'auto';
        cache.pipContainer.style.bottom = 'auto';
        cache.pipContainer.style.left = 'auto';
        cache.pipContainer.style.right = 'auto';

        switch (state.position) {
            case 'bottom-right':
                cache.pipContainer.style.bottom = CONFIG.MARGIN + 'px';
                cache.pipContainer.style.right = CONFIG.MARGIN + 'px';
                break;
            case 'bottom-left':
                cache.pipContainer.style.bottom = CONFIG.MARGIN + 'px';
                cache.pipContainer.style.left = CONFIG.MARGIN + 'px';
                break;
            case 'top-right':
                cache.pipContainer.style.top = (CONFIG.MARGIN + 60) + 'px'; // Account for header
                cache.pipContainer.style.right = CONFIG.MARGIN + 'px';
                break;
            case 'top-left':
                cache.pipContainer.style.top = (CONFIG.MARGIN + 60) + 'px';
                cache.pipContainer.style.left = CONFIG.MARGIN + 'px';
                break;
        }
    }

    /**
     * Mute/unmute PiP audio
     */
    function toggleMute() {
        if (!cache.pipVideo) return;
        cache.pipVideo.muted = !cache.pipVideo.muted;
        return cache.pipVideo.muted;
    }

    /**
     * Check if PiP is active
     * @returns {boolean}
     */
    function isActive() {
        return state.active;
    }

    /**
     * Get PiP state
     * @returns {object}
     */
    function getState() {
        return {
            active: state.active,
            position: state.position,
            streamId: state.streamId,
            channelName: state.channelName,
            streamType: state.streamType,
            isLive: state.isLive
        };
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        enter: enter,
        enterFromPlayer: enterFromPlayer,
        close: close,
        expandToFullscreen: expandToFullscreen,
        toggle: toggle,
        cyclePosition: cyclePosition,
        setPosition: setPosition,
        toggleMute: toggleMute,
        isActive: isActive,
        getState: getState
    };
})();
