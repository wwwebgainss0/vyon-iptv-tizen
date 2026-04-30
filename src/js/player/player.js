/**
 * Video Player Component v3.0 - WebOS 3.x Fast-Zap Optimized
 * Hardware-accelerated video playback with Shaka/LG Best Practices
 * CODE_STANDARDS: ES3, Zero allocations, Object pooling
 *
 * Fast-Zap Pattern (Shaka/LG):
 * - ONE persistent <video> element (never destroyed)
 * - Attributes set ONCE at init (not on every channel change)
 * - Zap sequence: pause() → src='' → src=new → load() → play()
 * - No removeAttribute('src'), no currentTime reset during zap
 */

window.PlayerComponent = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        isActive: false,
        currentStreamId: '',
        currentChannelName: '',
        currentStreamType: 'live',
        isHLS: false,
        hls: null,
        isLive: true,
        isSeeking: false,
        seekPosition: 0,
        containerExtension: '',
        iconUrl: '',
        movieInfo: null,           // Full movie info from API
        showingInfoOverlay: false, // Movie info overlay visible
        infoOverlayFocus: 0,       // 0 = none, 1 = audio btn, 2 = subtitle btn
        showingTrackSelector: false, // Track selector visible
        audioTracks: [],
        subtitleTracks: [],
        selectedAudioTrack: 0,
        selectedSubtitleTrack: -1,  // -1 = off
        trackSelectorFocus: 'audio', // 'audio' or 'subtitle'
        trackSelectorIndex: 0,
        // Playback speed
        speedIndex: 2,  // Default 1x (index 2 in SPEEDS array)
        // Series episode data (for binge-watch)
        currentEpisode: null,
        seriesData: null,
        // Open track selector after video loads (from MovieOverlay)
        openTrackSelectorOnLoad: null  // 'audio' or 'subtitles'
    };

    // ===== PLAYBACK SPEED OPTIONS =====
    var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
    var SPEED_LABELS = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];

    // ===== CACHED DOM ELEMENTS =====
    var cache = {
        player: null,
        video: null,
        overlay: null,
        title: null,
        info: null,
        progress: null,
        progressBar: null,
        timeDisplay: null,
        loading: null,
        // Track display (Netflix style)
        playerTracks: null,
        trackAudioLabel: null,
        trackSubtitleLabel: null,
        // Movie info overlay
        infoOverlay: null,
        infoPosterImg: null,
        infoTitle: null,
        infoYear: null,
        infoRating: null,
        infoDuration: null,
        infoGenre: null,
        infoDescription: null,
        infoCast: null,
        // Track selector
        trackSelector: null,
        audioTrackList: null,
        subtitleTrackList: null,
        // Speed badge
        speedBadge: null
    };

    // ===== TIMEOUTS (Pooled) =====
    var timers = {
        controlsHide: null,
        progressUpdate: null,
        longPress: null,
        historySave: null
    };

    // ===== OBJECT POOL (Zero allocations) =====
    var pool = {
        timeFormat: {hours: 0, minutes: 0, seconds: 0},
        streamUrl: ''
    };

    // ===== INITIALIZATION =====
    function initialize() {
        cacheElements();
        setupEventHandlers();
        return true;
    }

    function cacheElements() {
        cache.player = document.getElementById('player');
        cache.video = document.getElementById('video');
        cache.overlay = document.getElementById('player-overlay');
        cache.title = document.getElementById('player-title');
        cache.info = document.getElementById('player-info');
        cache.progress = document.getElementById('progress');
        cache.progressBar = document.getElementById('progress-bar');
        cache.timeDisplay = document.getElementById('player-time');
        cache.loading = document.getElementById('player-loading');

        // Track display (Netflix style)
        cache.playerTracks = document.getElementById('player-tracks');
        cache.trackAudioLabel = document.getElementById('track-audio-label');
        cache.trackSubtitleLabel = document.getElementById('track-subtitle-label');

        // Movie info overlay
        cache.infoOverlay = document.getElementById('player-info-overlay');
        cache.infoPosterImg = document.getElementById('info-poster-img');
        cache.infoTitle = document.getElementById('info-title');
        cache.infoYear = document.getElementById('info-year');
        cache.infoRating = document.getElementById('info-rating');
        cache.infoDuration = document.getElementById('info-duration');
        cache.infoGenre = document.getElementById('info-genre');
        cache.infoDescription = document.getElementById('info-description');
        cache.infoCast = document.getElementById('info-cast');

        // Track selector
        cache.trackSelector = document.getElementById('track-selector');
        cache.audioTrackList = document.getElementById('audio-track-list');
        cache.subtitleTrackList = document.getElementById('subtitle-track-list');

        // Info overlay action buttons
        cache.btnAudio = document.getElementById('btn-audio');
        cache.btnSubtitle = document.getElementById('btn-subtitle');
        cache.btnAudioLabel = document.getElementById('btn-audio-label');
        cache.btnSubtitleLabel = document.getElementById('btn-subtitle-label');

        // Speed badge
        cache.speedBadge = document.getElementById('player-speed');

        if (cache.video) {
            cache.video.preload = 'auto';
            cache.video.setAttribute('webkit-playsinline', '');
            cache.video.setAttribute('playsinline', '');
            cache.video.setAttribute('x-webkit-airplay', 'allow');

            if (cache.video.webkitPreservesPitch !== undefined) {
                cache.video.webkitPreservesPitch = false;
            }
            if (cache.video.mozPreservesPitch !== undefined) {
                cache.video.mozPreservesPitch = false;
            }
        }
    }

    // ===== REDIRECT RESOLVER =====
    function resolveRedirectAndPlay(initialUrl, channelName) {
        showLoading();

        var xhr = new XMLHttpRequest();
        xhr.open('HEAD', initialUrl, true);
        xhr.timeout = 10000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 302 || xhr.status === 301) {
                    var finalUrl = xhr.getResponseHeader('Location');
                    if (finalUrl) {
                        playDirectUrl(finalUrl, channelName);
                    } else {
                        console.error('[Player] Redirect but no Location header');
                        playDirectUrl(initialUrl, channelName);
                    }
                } else if (xhr.status === 200) {
                    playDirectUrl(initialUrl, channelName);
                } else {
                    console.error('[Player] Redirect resolve failed:', xhr.status);
                    playDirectUrl(initialUrl, channelName);
                }
            }
        };

        xhr.onerror = function() {
            console.error('[Player] XHR error resolving redirect');
            playDirectUrl(initialUrl, channelName);
        };

        xhr.ontimeout = function() {
            console.error('[Player] Timeout resolving redirect');
            playDirectUrl(initialUrl, channelName);
        };

        try {
            xhr.send();
        } catch (e) {
            console.error('[Player] Exception resolving redirect:', e);
            playDirectUrl(initialUrl, channelName);
        }
    }

    // Play the final resolved URL
    function playDirectUrl(streamUrl, channelName) {
        // FAST-ZAP PATTERN
        cache.video.pause();
        cache.video.src = '';

        cache.video.src = streamUrl;
        cache.video.load();

        if (cache.title) {
            cache.title.textContent = channelName;
        }
        if (cache.info) {
            var infoText = 'Video';
            if (state.currentStreamType === 'series') {
                infoText = 'Episode';
            } else if (state.currentStreamType === 'movie' || state.currentStreamType === 'vod') {
                infoText = 'Movie';
            }
            cache.info.textContent = infoText;
        }

        if (cache.progressBar) {
            cache.progressBar.style.display = 'block';
        }
        if (cache.timeDisplay) {
            cache.timeDisplay.style.display = 'block';
        }

        cache.player.style.display = 'block';
        cache.player.className = 'player active';

        showLoading();

        try {
            cache.video.play();
        } catch (e) {
            console.error('[Player] Play failed:', e);
        }

        showControls();

        if (window.NavigationHandler) {
            window.NavigationHandler.setPlayerActive(true);
        }

        // ===== WATCH HISTORY: Initialize tracking for VOD (Movies) =====
        if (!state.isLive && window.WatchHistory) {
            var resumePos = window.WatchHistory.getResumePosition(state.currentStreamId);
            if (resumePos > 0) {
                state.resumePosition = resumePos;
            }

            window.WatchHistory.startTracking(
                state.currentStreamId,
                channelName,
                0,
                state.containerExtension,
                state.iconUrl
            );

            if (timers.historySave) {
                clearInterval(timers.historySave);
            }
            timers.historySave = setInterval(function() {
                saveWatchProgress();
            }, 10000);
        }
    }

    // ===== HLS DETECTION =====
    function isHLSStream(url) {
        return url && (url.indexOf('.m3u8') > -1 || url.indexOf('application/x-mpegURL') > -1);
    }

    function shouldUseHLSjs(url, streamType) {
        return false; // NEVER use HLS.js on WebOS
    }

    // ===== ROBUST LIVE STREAM PLAYBACK =====
    // Tries multiple formats: .ts, .m3u8, and direct URL
    function playLiveStream(streamId, channelName) {
        if (!window.XtreamAPI) {
            console.error('[Player] XtreamAPI not available');
            return;
        }

        // Save last channel for resume on next app start
        if (window.LastChannel) {
            window.LastChannel.save(streamId, channelName);
        }

        // Track view for "Most Watched" feature
        if (window.ChannelViewTracker) {
            window.ChannelViewTracker.trackView({
                stream_id: streamId,
                name: channelName
            });
        }

        var apiConfig = window.XtreamAPI.getConfig();
        var baseUrl = apiConfig.server + '/live/' + apiConfig.username + '/' + apiConfig.password + '/' + streamId;

        // Formats to try in order (most compatible first for WebOS)
        var formats = [
            baseUrl + '.ts',      // MPEG-TS (best for WebOS native player)
            baseUrl + '.m3u8',    // HLS
            apiConfig.server + '/' + apiConfig.username + '/' + apiConfig.password + '/' + streamId  // Simple format (may redirect)
        ];

        var currentFormatIndex = 0;

        function tryNextFormat() {
            if (currentFormatIndex >= formats.length) {
                console.error('[Player] All live stream formats failed');
                if (cache.info) {
                    cache.info.textContent = 'Stream nicht verfügbar';
                }
                hideLoading();
                return;
            }

            var streamUrl = formats[currentFormatIndex];
            console.log('[Player] Trying live format ' + (currentFormatIndex + 1) + '/' + formats.length + ': ' + streamUrl);

            // Clean up previous HLS instance
            if (state.hls) {
                state.hls.destroy();
                state.hls = null;
            }

            cache.video.pause();
            cache.video.src = '';

            // Set up error handler for this attempt
            var errorHandler = function() {
                console.log('[Player] Format ' + (currentFormatIndex + 1) + ' failed, trying next...');
                cache.video.removeEventListener('error', errorHandler);
                currentFormatIndex++;
                setTimeout(tryNextFormat, 100);
            };

            var canPlayHandler = function() {
                console.log('[Player] Live stream playing successfully');
                cache.video.removeEventListener('error', errorHandler);
                cache.video.removeEventListener('canplay', canPlayHandler);
            };

            cache.video.addEventListener('error', errorHandler);
            cache.video.addEventListener('canplay', canPlayHandler);

            // Set source and play
            cache.video.src = streamUrl;
            cache.video.load();

            try {
                cache.video.play();
            } catch (e) {
                console.error('[Player] Play exception:', e);
                currentFormatIndex++;
                setTimeout(tryNextFormat, 100);
            }
        }

        // Setup UI for live stream
        if (cache.title) {
            cache.title.textContent = channelName;
        }
        if (cache.info) {
            cache.info.textContent = 'Loading...';
            loadLiveEPG(streamId);
        }

        cache.player.style.display = 'block';
        cache.player.className = 'player active';

        if (cache.progressBar) {
            cache.progressBar.style.display = 'none';
        }
        if (cache.timeDisplay) {
            cache.timeDisplay.style.display = 'none';
        }

        showLoading();
        showControls();

        if (window.NavigationHandler) {
            window.NavigationHandler.setPlayerActive(true);
        }

        if (window.ChannelManager) {
            window.ChannelManager.setCurrentChannel(streamId, channelName);
        }

        // Start trying formats
        tryNextFormat();
    }

    // ===== VIDEO CONTROL =====
    function play(streamId, channelName, streamType, containerExtension, iconUrl) {
        if (!cache.player || !cache.video) {
            console.error('[Player] Elements not found');
            return false;
        }

        state.isActive = true;
        state.currentStreamId = streamId;
        state.currentChannelName = channelName;
        state.currentStreamType = streamType || 'live';
        state.isLive = (streamType !== 'movie' && streamType !== 'vod' && streamType !== 'series');
        state.isSeeking = false;
        state.seekPosition = 0;
        state.containerExtension = containerExtension || '';
        state.iconUrl = iconUrl || '';

        // Register with NavigationStack if not already registered (series does this before calling play)
        if (window.NavigationStack && !window.NavigationStack.has('player')) {
            var returnContext = {
                streamType: streamType || 'live',
                returnTo: null,  // Default: return to grid
                // onBack handler - return true if we handled it internally (don't close player)
                onBack: function() {
                    // Check if track selector is showing
                    if (state.showingTrackSelector) {
                        hideTrackSelector();
                        return true; // Handled - don't close player
                    }
                    // Check if info overlay is showing
                    if (state.showingInfoOverlay) {
                        hideInfoOverlay();
                        resume();
                        return true; // Handled - don't close player
                    }
                    // No overlays - allow normal player close
                    return false;
                }
            };
            window.NavigationStack.push('player', window.NavigationStack.LAYERS.PLAYER, returnContext);
        }

        var streamUrl;
        if (streamType === 'movie' || streamType === 'vod') {
            streamUrl = window.XtreamAPI ? window.XtreamAPI.getStreamUrl(streamId, 'movie', containerExtension) : '';
        } else if (streamType === 'series') {
            streamUrl = window.XtreamAPI ? window.XtreamAPI.getStreamUrl(streamId, 'series', containerExtension) : '';
        } else {
            streamUrl = window.XtreamAPI ? window.XtreamAPI.getStreamUrl(streamId, 'live') : '';
        }

        // VOD (movies/series) - use redirect resolver
        if (streamType === 'movie' || streamType === 'vod' || streamType === 'series') {
            resolveRedirectAndPlay(streamUrl, channelName);
            return true;
        }

        // LIVE STREAMS - robust playback with fallback formats
        playLiveStream(streamId, channelName);

        // Enable timeshift for channels that support it
        if (window.TimeshiftManager) {
            var channelObj = null;
            if (window.ChannelManager && window.ChannelManager.getCurrentChannel) {
                channelObj = window.ChannelManager.getCurrentChannel();
            }
            if (!channelObj) {
                channelObj = { stream_id: streamId, name: channelName };
            }
            window.TimeshiftManager.enable(channelObj);
        }

        return true;
    }

    function close() {
        if (!cache.player || !cache.video) return;

        // Save watch progress BEFORE clearing video
        if (!state.isLive && window.WatchHistory) {
            saveWatchProgress();
        }

        // Disable timeshift on close
        if (window.TimeshiftManager) {
            window.TimeshiftManager.disable();
        }

        if (state.hls) {
            state.hls.destroy();
            state.hls = null;
        }

        cache.video.pause();
        cache.video.src = '';

        cache.player.style.display = 'none';
        cache.player.className = 'player';

        hideLoading();

        if (timers.controlsHide) {
            clearTimeout(timers.controlsHide);
            timers.controlsHide = null;
        }
        if (timers.progressUpdate) {
            clearTimeout(timers.progressUpdate);
            timers.progressUpdate = null;
        }
        if (timers.longPress) {
            clearTimeout(timers.longPress);
            timers.longPress = null;
        }
        if (timers.historySave) {
            clearInterval(timers.historySave);
            timers.historySave = null;
        }

        state.isActive = false;
        state.currentStreamId = '';
        state.currentChannelName = '';
        state.currentStreamType = 'live';
        state.isHLS = false;
        state.isLive = true;
        state.isSeeking = false;
        state.seekPosition = 0;
        state.movieInfo = null;
        state.showingInfoOverlay = false;
        state.showingTrackSelector = false;
        state.audioTracks = [];
        state.subtitleTracks = [];

        // Hide overlays
        hideInfoOverlay();
        hideTrackSelector();

        // Reset playback speed
        resetSpeed();

        if (window.NavigationHandler) {
            window.NavigationHandler.setPlayerActive(false);
        }

        // Refresh Movies screen for Continue Watching
        if (window.ScreenManager && window.ScreenManager.refreshMoviesScreen) {
            window.ScreenManager.refreshMoviesScreen();
        }
    }

    function pause() {
        if (cache.video) {
            cache.video.pause();
            showControls();
        }
    }

    // Toggle pause with info overlay for VOD
    function togglePauseWithInfo() {
        if (!cache.video) return;

        if (state.showingInfoOverlay) {
            // Overlay visible - resume
            resume();
        } else if (cache.video.paused) {
            // Video paused but no overlay - show overlay
            showInfoOverlay();
        } else {
            // Video playing - pause and show overlay for VOD
            cache.video.pause();
            if (!state.isLive) {
                showInfoOverlay();
            } else {
                showControls();
            }
        }
    }

    function resume() {
        if (cache.video) {
            hideInfoOverlay();
            // Only call play if video is paused (don't restart)
            if (cache.video.paused) {
                try {
                    cache.video.play();
                } catch (e) {
                    console.error('[Player] Resume failed:', e);
                }
            }
            showControls();
        }
    }

    // ===== DATE FORMATTING =====
    function padZero(num) {
        var s = String(num);
        return s.length < 2 ? '0' + s : s;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';

        // Check if it's just a year (e.g., "2023")
        if (/^\d{4}$/.test(dateStr)) {
            return dateStr; // Return year as-is
        }

        // Try parsing ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            var parts = dateStr.split('-');
            return parts[2] + '.' + parts[1] + '.' + parts[0]; // DD.MM.YYYY
        }

        // Try parsing slash format (MM/DD/YYYY or DD/MM/YYYY)
        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
            var parts = dateStr.split('/');
            // Assume DD/MM/YYYY European format
            return padZero(parts[0]) + '.' + padZero(parts[1]) + '.' + parts[2];
        }

        // Return original if no format matched
        return dateStr;
    }

    // ===== MOVIE INFO OVERLAY =====
    function showInfoOverlay() {
        if (!cache.infoOverlay || state.isLive) return;

        state.showingInfoOverlay = true;

        // Pause video when showing overlay
        if (cache.video && !cache.video.paused) {
            cache.video.pause();
        }

        // Detect tracks if not already done
        if (state.audioTracks.length === 0) {
            detectTracks();
        }

        // Populate with movie info if available
        if (state.movieInfo) {
            var info = state.movieInfo;
            if (cache.infoPosterImg) {
                cache.infoPosterImg.src = info.cover || info.stream_icon || state.iconUrl || '';
            }
            if (cache.infoTitle) {
                cache.infoTitle.textContent = info.name || info.title || state.currentChannelName;
            }
            if (cache.infoYear) {
                var dateStr = info.releasedate || info.release_date || info.year || '';
                cache.infoYear.textContent = formatDate(dateStr);
            }
            if (cache.infoRating) {
                var rating = info.rating || info.rating_5based || '';
                if (rating) {
                    // Gold star with rating
                    cache.infoRating.innerHTML = '<span style="color:#FFD700;">★</span> <span style="color:#FFD700;">' + rating + '</span>';
                } else {
                    cache.infoRating.textContent = '';
                }
            }
            if (cache.infoDuration) {
                cache.infoDuration.textContent = info.duration || '';
            }
            if (cache.infoGenre) {
                cache.infoGenre.textContent = info.genre || '';
            }
            if (cache.infoDescription) {
                cache.infoDescription.textContent = info.plot || info.description || '';
            }
            if (cache.infoCast) {
                cache.infoCast.textContent = info.cast ? 'Cast: ' + info.cast : '';
            }
        } else {
            // Use basic info from state
            if (cache.infoPosterImg) {
                cache.infoPosterImg.src = state.iconUrl || '';
            }
            if (cache.infoTitle) {
                cache.infoTitle.textContent = state.currentChannelName;
            }
            if (cache.infoYear) cache.infoYear.textContent = '';
            if (cache.infoRating) cache.infoRating.textContent = '';
            if (cache.infoDuration) cache.infoDuration.textContent = '';
            if (cache.infoGenre) cache.infoGenre.textContent = '';
            if (cache.infoDescription) cache.infoDescription.textContent = '';
            if (cache.infoCast) cache.infoCast.textContent = '';
        }

        // Update audio/subtitle button labels
        updateInfoOverlayButtons();
        // Set focus on audio button by default
        state.infoOverlayFocus = 1;
        updateInfoOverlayFocus();

        cache.infoOverlay.className = 'player-info-overlay visible';
    }

    function hideInfoOverlay() {
        if (cache.infoOverlay) {
            cache.infoOverlay.className = 'player-info-overlay';
        }
        state.showingInfoOverlay = false;
        state.infoOverlayFocus = 0;
        updateInfoOverlayFocus();
    }

    function updateInfoOverlayFocus() {
        // Update button visual state
        if (cache.btnAudio) {
            if (state.infoOverlayFocus === 1) {
                cache.btnAudio.className = 'info-action-btn focused';
            } else {
                cache.btnAudio.className = 'info-action-btn';
            }
        }
        if (cache.btnSubtitle) {
            if (state.infoOverlayFocus === 2) {
                cache.btnSubtitle.className = 'info-action-btn focused';
            } else {
                cache.btnSubtitle.className = 'info-action-btn';
            }
        }
    }

    function updateInfoOverlayButtons() {
        // Update audio button label
        if (cache.btnAudioLabel) {
            if (state.audioTracks.length > 0) {
                var audioTrack = state.audioTracks[state.selectedAudioTrack];
                if (audioTrack) {
                    cache.btnAudioLabel.textContent = audioTrack.label || 'Audio';
                } else {
                    cache.btnAudioLabel.textContent = 'Audio';
                }
            } else {
                cache.btnAudioLabel.textContent = 'Audio';
            }
        }
        // Update subtitle button label
        if (cache.btnSubtitleLabel) {
            if (state.subtitleTracks.length === 0) {
                cache.btnSubtitleLabel.textContent = 'Aus';
            } else if (state.selectedSubtitleTrack < 0) {
                cache.btnSubtitleLabel.textContent = 'Aus';
            } else {
                var subIdx = state.selectedSubtitleTrack + 1;
                if (state.subtitleTracks[subIdx]) {
                    cache.btnSubtitleLabel.textContent = state.subtitleTracks[subIdx].label;
                } else {
                    cache.btnSubtitleLabel.textContent = 'Aus';
                }
            }
        }
    }

    // ===== AUDIO/SUBTITLE TRACK DETECTION =====
    function detectTracks() {
        if (!cache.video) return;

        state.audioTracks = [];
        state.subtitleTracks = [];

        // Detect audio tracks (WebOS uses audioTracks API)
        if (cache.video.audioTracks && cache.video.audioTracks.length > 0) {
            for (var i = 0; i < cache.video.audioTracks.length; i++) {
                var track = cache.video.audioTracks[i];
                state.audioTracks.push({
                    index: i,
                    label: track.label || track.language || ('Audio ' + (i + 1)),
                    language: track.language || 'und',
                    enabled: track.enabled
                });
                if (track.enabled) {
                    state.selectedAudioTrack = i;
                }
            }
        } else {
            // Default audio track
            state.audioTracks.push({
                index: 0,
                label: 'Default',
                language: 'und',
                enabled: true
            });
        }

        // Detect subtitle tracks
        if (cache.video.textTracks && cache.video.textTracks.length > 0) {
            for (var j = 0; j < cache.video.textTracks.length; j++) {
                var subTrack = cache.video.textTracks[j];
                if (subTrack.kind === 'subtitles' || subTrack.kind === 'captions') {
                    state.subtitleTracks.push({
                        index: j,
                        label: subTrack.label || subTrack.language || ('Subtitle ' + (j + 1)),
                        language: subTrack.language || 'und',
                        mode: subTrack.mode
                    });
                    if (subTrack.mode === 'showing') {
                        state.selectedSubtitleTrack = j;
                    }
                }
            }
        }

        // Always add "Off" option for subtitles
        state.subtitleTracks.unshift({
            index: -1,
            label: 'Off',
            language: '',
            mode: 'disabled'
        });

        updateTrackLabels();
    }

    function updateTrackLabels() {
        // Update audio label
        if (cache.trackAudioLabel && state.audioTracks.length > 0) {
            var audioTrack = state.audioTracks[state.selectedAudioTrack];
            if (audioTrack) {
                cache.trackAudioLabel.textContent = audioTrack.label;
            }
        }

        // Update subtitle label
        if (cache.trackSubtitleLabel) {
            if (state.selectedSubtitleTrack < 0) {
                cache.trackSubtitleLabel.textContent = 'Off';
            } else {
                var subIdx = state.selectedSubtitleTrack + 1; // +1 because "Off" is at index 0
                if (state.subtitleTracks[subIdx]) {
                    cache.trackSubtitleLabel.textContent = state.subtitleTracks[subIdx].label;
                }
            }
        }

        // Show/hide track display for VOD only
        if (cache.playerTracks) {
            cache.playerTracks.style.display = state.isLive ? 'none' : 'flex';
        }
    }

    // ===== TRACK SELECTOR OVERLAY =====
    function showTrackSelector(focusType) {
        if (!cache.trackSelector || state.isLive) return;

        state.showingTrackSelector = true;

        // Only set default focus if not already set or explicitly provided
        if (focusType) {
            state.trackSelectorFocus = focusType;
            if (focusType === 'audio') {
                state.trackSelectorIndex = state.selectedAudioTrack;
            } else {
                state.trackSelectorIndex = state.selectedSubtitleTrack + 1;
            }
        } else if (!state.trackSelectorFocus) {
            state.trackSelectorFocus = 'audio';
            state.trackSelectorIndex = state.selectedAudioTrack;
        }

        renderTrackSelector();
        cache.trackSelector.className = 'track-selector visible';
    }

    function hideTrackSelector() {
        if (cache.trackSelector) {
            cache.trackSelector.className = 'track-selector';
        }
        state.showingTrackSelector = false;
    }

    function renderTrackSelector() {
        // Render audio tracks
        if (cache.audioTrackList) {
            var audioHtml = '';
            for (var i = 0; i < state.audioTracks.length; i++) {
                var track = state.audioTracks[i];
                var focused = (state.trackSelectorFocus === 'audio' && state.trackSelectorIndex === i);
                var selected = (i === state.selectedAudioTrack);
                var classes = 'track-option';
                if (focused) classes += ' focused';
                if (selected) classes += ' selected';

                audioHtml += '<div class="' + classes + '" data-index="' + i + '">';
                audioHtml += '<span>' + track.label + '</span>';
                audioHtml += '<span class="track-check">' + (selected ? '✓' : '') + '</span>';
                audioHtml += '</div>';
            }
            cache.audioTrackList.innerHTML = audioHtml;
        }

        // Render subtitle tracks
        if (cache.subtitleTrackList) {
            var subHtml = '';
            for (var j = 0; j < state.subtitleTracks.length; j++) {
                var subTrack = state.subtitleTracks[j];
                var subFocused = (state.trackSelectorFocus === 'subtitle' && state.trackSelectorIndex === j);
                var subSelected = (subTrack.index === state.selectedSubtitleTrack);
                var subClasses = 'track-option';
                if (subFocused) subClasses += ' focused';
                if (subSelected) subClasses += ' selected';

                subHtml += '<div class="' + subClasses + '" data-index="' + j + '">';
                subHtml += '<span>' + subTrack.label + '</span>';
                subHtml += '<span class="track-check">' + (subSelected ? '✓' : '') + '</span>';
                subHtml += '</div>';
            }
            cache.subtitleTrackList.innerHTML = subHtml;
        }
    }

    function navigateTrackSelector(direction) {
        var list = (state.trackSelectorFocus === 'audio') ? state.audioTracks : state.subtitleTracks;
        var maxIndex = list.length - 1;

        if (direction === 'up') {
            state.trackSelectorIndex = Math.max(0, state.trackSelectorIndex - 1);
        } else if (direction === 'down') {
            state.trackSelectorIndex = Math.min(maxIndex, state.trackSelectorIndex + 1);
        } else if (direction === 'left') {
            if (state.trackSelectorFocus === 'subtitle') {
                state.trackSelectorFocus = 'audio';
                state.trackSelectorIndex = Math.min(state.selectedAudioTrack, state.audioTracks.length - 1);
            }
        } else if (direction === 'right') {
            if (state.trackSelectorFocus === 'audio') {
                state.trackSelectorFocus = 'subtitle';
                state.trackSelectorIndex = 0;
            }
        }

        renderTrackSelector();
    }

    function selectTrack() {
        if (state.trackSelectorFocus === 'audio') {
            selectAudioTrack(state.trackSelectorIndex);
        } else {
            var subTrack = state.subtitleTracks[state.trackSelectorIndex];
            if (subTrack) {
                selectSubtitleTrack(subTrack.index);
            }
        }
        // Close selector and resume playback
        hideTrackSelector();
        if (cache.video && cache.video.paused) {
            try {
                cache.video.play();
            } catch (e) {}
        }
    }

    function selectAudioTrack(index) {
        if (!cache.video || !cache.video.audioTracks) return;

        // Disable all tracks first
        for (var i = 0; i < cache.video.audioTracks.length; i++) {
            cache.video.audioTracks[i].enabled = false;
        }

        // Enable selected track
        if (cache.video.audioTracks[index]) {
            cache.video.audioTracks[index].enabled = true;
            state.selectedAudioTrack = index;
        }

        updateTrackLabels();
    }

    function selectSubtitleTrack(index) {
        if (!cache.video || !cache.video.textTracks) return;

        // Disable all subtitle tracks first
        for (var i = 0; i < cache.video.textTracks.length; i++) {
            if (cache.video.textTracks[i].kind === 'subtitles' || cache.video.textTracks[i].kind === 'captions') {
                cache.video.textTracks[i].mode = 'disabled';
            }
        }

        // Enable selected track (index -1 means "Off")
        if (index >= 0 && cache.video.textTracks[index]) {
            cache.video.textTracks[index].mode = 'showing';
        }

        state.selectedSubtitleTrack = index;
        updateTrackLabels();
    }

    // ===== PLAYBACK SPEED CONTROL =====
    function cycleSpeed() {
        // Only for VOD, not live TV
        if (state.isLive) return;
        if (!cache.video) return;

        // Cycle to next speed
        state.speedIndex = (state.speedIndex + 1) % SPEEDS.length;
        var newSpeed = SPEEDS[state.speedIndex];

        // Apply to video
        cache.video.playbackRate = newSpeed;

        // Show speed badge
        showSpeedBadge();
        showControls();
    }

    function setSpeed(speedIndex) {
        if (state.isLive) return;
        if (!cache.video) return;
        if (speedIndex < 0 || speedIndex >= SPEEDS.length) return;

        state.speedIndex = speedIndex;
        cache.video.playbackRate = SPEEDS[speedIndex];
        showSpeedBadge();
    }

    function resetSpeed() {
        state.speedIndex = 2; // 1x
        if (cache.video) {
            cache.video.playbackRate = 1;
        }
        hideSpeedBadge();
    }

    function showSpeedBadge() {
        if (!cache.speedBadge) return;

        var label = SPEED_LABELS[state.speedIndex];
        cache.speedBadge.textContent = label;

        // Only show if not 1x
        if (state.speedIndex === 2) {
            cache.speedBadge.style.display = 'none';
        } else {
            cache.speedBadge.style.display = 'block';
        }
    }

    function hideSpeedBadge() {
        if (cache.speedBadge) {
            cache.speedBadge.style.display = 'none';
        }
    }

    // ===== BINGE-WATCH HANDLING =====
    function handleSeriesEnded() {
        // Try to get next episode from SeriesOverlay
        if (!window.SeriesOverlay || !window.BingeOverlay) {
            return;
        }

        var nextEpisode = window.SeriesOverlay.getNextEpisode(state.currentEpisode);
        if (nextEpisode) {
            // Close player first
            close();

            // Show binge overlay
            setTimeout(function() {
                window.BingeOverlay.show(
                    state.currentEpisode,
                    nextEpisode,
                    state.seriesData
                );
            }, 300);
        }
    }

    /**
     * Set current episode data (for binge-watch)
     * @param {object} episode - Current episode data
     * @param {object} seriesData - Full series data
     */
    function setEpisodeData(episode, seriesData) {
        state.currentEpisode = episode;
        state.seriesData = seriesData;
    }

    // ===== SET MOVIE INFO (called from screen-manager when selecting a movie) =====
    function setMovieInfo(info) {
        state.movieInfo = info;
    }

    // ===== LOAD LIVE EPG =====
    function loadLiveEPG(streamId) {
        if (!window.EPGManager || !cache.info) return;

        window.EPGManager.getShortEPG(streamId, function(err, epgData) {
            if (!cache.info) return;

            if (err || !epgData || !epgData.hasEPG) {
                cache.info.textContent = 'Live';
                return;
            }

            if (epgData.current) {
                var startTime = window.EPGManager.formatTime(epgData.current.start);
                var endTime = window.EPGManager.formatTime(epgData.current.end);
                cache.info.textContent = startTime + ' - ' + endTime + ': ' + epgData.current.title;
            } else {
                cache.info.textContent = 'Live';
            }
        });
    }

    // ===== SEEKING (VOD Only) =====
    function seekTo(position) {
        if (!cache.video || state.isLive) return;

        var duration = cache.video.duration || 0;
        if (duration <= 0) return;

        position = Math.max(0, Math.min(position, duration));

        try {
            cache.video.currentTime = position;
        } catch (e) {
            console.error('[Player] Seek failed:', e);
        }

        if (cache.progress) {
            var percentage = (position / duration) * 100;
            cache.progress.style.width = percentage + '%';
        }

        if (cache.timeDisplay) {
            var current = formatTime(position);
            var total = formatTime(duration);
            cache.timeDisplay.textContent = current + ' / ' + total;
        }
    }

    function seekRelative(deltaSeconds) {
        if (!cache.video || state.isLive) return;

        var currentTime = cache.video.currentTime || 0;
        var newPosition = currentTime + deltaSeconds;

        seekTo(newPosition);
    }

    function enterSeekMode() {
        if (state.isLive) return;

        state.isSeeking = true;
        state.seekPosition = cache.video.currentTime || 0;
        showControls();
    }

    function exitSeekMode() {
        if (!state.isSeeking) return;

        seekTo(state.seekPosition);
        state.isSeeking = false;
        state.seekPosition = 0;
    }

    function seekInMode(deltaSeconds) {
        if (!state.isSeeking || state.isLive) return;

        state.seekPosition += deltaSeconds;

        var duration = cache.video.duration || 0;
        if (state.seekPosition < 0) {
            state.seekPosition = 0;
            exitSeekMode();
            return;
        }
        if (state.seekPosition > duration) {
            state.seekPosition = duration;
            exitSeekMode();
            return;
        }

        if (cache.progress && duration > 0) {
            var percentage = (state.seekPosition / duration) * 100;
            cache.progress.style.width = percentage + '%';
        }

        if (cache.timeDisplay) {
            var current = formatTime(state.seekPosition);
            var total = formatTime(duration);
            cache.timeDisplay.textContent = current + ' / ' + total;
        }

        showControls();
    }

    // ===== WATCH HISTORY =====
    function saveWatchProgress() {
        if (!cache.video || state.isLive || !window.WatchHistory) return;

        var currentTime = cache.video.currentTime || 0;
        var duration = cache.video.duration || 0;

        if (duration > 0 && currentTime > 0) {
            window.WatchHistory.updateProgress(
                state.currentStreamId,
                state.currentChannelName,
                currentTime,
                duration,
                state.containerExtension
            );
        }
    }

    // ===== LOADING INDICATOR =====
    var spinnerInterval = null;
    var spinnerRotation = 0;

    function showLoading() {
        // Always clear any existing spinner interval first to prevent leaks
        // from rapid channel switching (early-return below would skip cleanup otherwise)
        if (spinnerInterval) {
            clearInterval(spinnerInterval);
            spinnerInterval = null;
        }

        // Don't show loading spinner if video is already playing
        // This prevents flickering during brief buffer hiccups on live streams
        if (cache.video && !cache.video.paused && cache.video.currentTime > 0) {
            return;
        }

        if (cache.loading) {
            cache.loading.className = 'player-loading active';

            var spinner = cache.loading.querySelector('.loading-spinner');
            if (spinner) {
                spinnerRotation = 0;
                spinnerInterval = setInterval(function() {
                    spinnerRotation = (spinnerRotation + 6) % 360;
                    spinner.style.transform = 'rotate(' + spinnerRotation + 'deg)';
                    spinner.style.webkitTransform = 'rotate(' + spinnerRotation + 'deg)';
                }, 16);
            }
        }
    }

    function hideLoading() {
        if (cache.loading) {
            cache.loading.className = 'player-loading';

            if (spinnerInterval) {
                clearInterval(spinnerInterval);
                spinnerInterval = null;
            }
        }
    }

    // ===== CONTROLS =====
    function showControls() {
        if (cache.overlay) {
            cache.overlay.className = 'player-overlay visible';
        }

        if (timers.controlsHide) {
            clearTimeout(timers.controlsHide);
        }
        timers.controlsHide = setTimeout(hideControls, 5000);
    }

    function hideControls() {
        if (cache.overlay) {
            cache.overlay.className = 'player-overlay';
        }
    }

    // ===== PROGRESS BAR =====
    function updateProgress() {
        if (!cache.video || !cache.progress) return;
        if (state.isSeeking) return;

        var duration = cache.video.duration || 0;
        var currentTime = cache.video.currentTime || 0;

        if (duration > 0) {
            var percentage = (currentTime / duration) * 100;
            cache.progress.style.width = percentage + '%';
        }

        if (cache.timeDisplay) {
            var current = formatTime(currentTime);
            var total = formatTime(duration);
            cache.timeDisplay.textContent = current + ' / ' + total;
        }
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';

        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
        }
        return minutes + ':' + (secs < 10 ? '0' : '') + secs;
    }

    function startProgressUpdates() {
        function update() {
            if (state.isActive && cache.video && !cache.video.paused) {
                updateProgress();
                timers.progressUpdate = setTimeout(update, 1000);
            }
        }
        update();
    }

    // ===== KEY HANDLING (Player-specific) =====
    function setupKeyHandler() {
        document.addEventListener('keydown', handlePlayerKeys);
        document.addEventListener('keyup', handlePlayerKeysUp);
    }

    function handlePlayerKeys(event) {
        if (!state.isActive) return;

        var keyCode = event.keyCode;
        var handled = false;

        // Handle track selector keys
        if (state.showingTrackSelector) {
            switch (keyCode) {
                case 38: // UP
                    navigateTrackSelector('up');
                    handled = true;
                    break;
                case 40: // DOWN
                    navigateTrackSelector('down');
                    handled = true;
                    break;
                case 37: // LEFT
                    navigateTrackSelector('left');
                    handled = true;
                    break;
                case 39: // RIGHT
                    navigateTrackSelector('right');
                    handled = true;
                    break;
                case 13: // OK/ENTER
                    selectTrack();
                    handled = true;
                    break;
                case 461: // BACK (WebOS)
                case 10009: // BACK (Tizen)
                case 8: // Backspace
                case 27: // ESC
                    hideTrackSelector();
                    handled = true;
                    break;
            }
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }

        // Handle info overlay keys
        if (state.showingInfoOverlay) {
            switch (keyCode) {
                case 13: // OK/ENTER
                    if (state.infoOverlayFocus === 1) {
                        // Audio button focused - open track selector at audio
                        hideInfoOverlay();
                        state.trackSelectorFocus = 'audio';
                        showTrackSelector();
                    } else if (state.infoOverlayFocus === 2) {
                        // Subtitle button focused - open track selector at subtitles
                        hideInfoOverlay();
                        state.trackSelectorFocus = 'subtitle';
                        showTrackSelector();
                    } else {
                        // No button focused - resume playback
                        resume();
                    }
                    handled = true;
                    break;
                case 37: // LEFT - navigate to audio button
                    state.infoOverlayFocus = 1;
                    updateInfoOverlayFocus();
                    handled = true;
                    break;
                case 39: // RIGHT - navigate to subtitle button
                    state.infoOverlayFocus = 2;
                    updateInfoOverlayFocus();
                    handled = true;
                    break;
                case 38: // UP - deselect buttons
                case 40: // DOWN - deselect buttons
                    state.infoOverlayFocus = 0;
                    updateInfoOverlayFocus();
                    handled = true;
                    break;
                case 461: // BACK
                case 10009:
                case 8:
                case 27:
                    hideInfoOverlay();
                    resume(); // Resume on back
                    handled = true;
                    break;
                case 403: // RED button - open track selector
                case 406: // BLUE button - open track selector
                    hideInfoOverlay();
                    showTrackSelector();
                    handled = true;
                    break;
            }
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }

        // RED/BLUE button to open track selector for VOD
        if (!state.isLive && (keyCode === 403 || keyCode === 406)) {
            showTrackSelector();
            handled = true;
        }
        // YELLOW button to open quality selector for VOD
        else if (!state.isLive && keyCode === 405) {
            if (window.QualitySelector) {
                window.QualitySelector.show(state.hls);
            }
            handled = true;
        }
        else if (!state.isLive && (keyCode === 37 || keyCode === 39)) {
            if (state.isSeeking) {
                var delta = (keyCode === 37) ? -20 : 20;
                seekInMode(delta);
                handled = true;
            } else {
                if (!timers.longPress) {
                    timers.longPress = setTimeout(function() {
                        enterSeekMode();
                        clearTimeout(timers.longPress);
                        timers.longPress = null;
                    }, 1000);
                    handled = true;
                }
            }
        }
        else if (state.isLive && keyCode === 37) {
            if (window.ChannelOverlay) {
                window.ChannelOverlay.show();
                handled = true;
            }
        }
        else if (state.isLive && keyCode === 39) {
            showControls();
            handled = true;
        }
        else {
            switch (keyCode) {
                case 38:
                case 33:
                case 427:
                    if (state.isLive && window.ChannelManager) {
                        window.ChannelManager.previousChannel();
                        handled = true;
                    }
                    break;

                case 40:
                case 34:
                case 428:
                    if (state.isLive && window.ChannelManager) {
                        window.ChannelManager.nextChannel();
                        handled = true;
                    } else if (!state.isLive) {
                        showControls();
                        handled = true;
                    }
                    break;

                case 415:
                case 10252:
                    resume();
                    handled = true;
                    break;

                case 19:
                case 463:
                    pause();
                    handled = true;
                    break;

                case 13:
                    // OK button - toggle pause with info overlay for VOD
                    togglePauseWithInfo();
                    handled = true;
                    break;

                case 417: // Fast Forward button - cycle playback speed
                case 418: // Rewind button - also cycle speed (alternative)
                    if (!state.isLive) {
                        cycleSpeed();
                        handled = true;
                    }
                    break;

                case 80:  // 'P' key - Picture-in-Picture toggle
                case 433: // PIP button on some remotes
                    if (window.PiPManager) {
                        window.PiPManager.enterFromPlayer();
                        handled = true;
                    }
                    break;
            }
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function handlePlayerKeysUp(event) {
        if (!state.isActive) return;

        var keyCode = event.keyCode;

        if (keyCode === 37 || keyCode === 39) {
            if (timers.longPress) {
                clearTimeout(timers.longPress);
                timers.longPress = null;
            }

            if (state.isSeeking) {
                exitSeekMode();
            }
        }
    }

    // ===== EVENT HANDLERS =====
    function setupEventHandlers() {
        if (!cache.video) return;

        setupKeyHandler();

        cache.video.addEventListener('loadstart', function() {
            showLoading();
        });

        cache.video.addEventListener('waiting', function() {
            showLoading();
        });

        cache.video.addEventListener('canplay', function() {
            hideLoading();

            // Detect audio/subtitle tracks for VOD
            if (!state.isLive) {
                detectTracks();
            }

            if (state.resumePosition && state.resumePosition > 0 && !state.isLive) {
                var targetPos = state.resumePosition;
                state.resumePosition = 0; // Clear before seek to prevent double-seek
                try {
                    cache.video.currentTime = targetPos;
                    console.log('[Player] Resumed at position:', targetPos);
                } catch (e) {
                    console.error('[Player] Resume failed:', e);
                    // Retry once after short delay
                    setTimeout(function() {
                        try {
                            if (cache.video) {
                                cache.video.currentTime = targetPos;
                            }
                        } catch (e2) {
                            console.error('[Player] Resume retry failed:', e2);
                        }
                    }, 500);
                }
            }

            // Open track selector if requested from MovieOverlay
            if (state.openTrackSelectorOnLoad) {
                var trackType = state.openTrackSelectorOnLoad;
                state.openTrackSelectorOnLoad = null; // Reset flag
                console.log('[Player] Opening track selector for:', trackType);

                // Delay to allow UI to settle and tracks to be detected
                setTimeout(function() {
                    var focusType = (trackType === 'subtitles') ? 'subtitle' : 'audio';
                    console.log('[Player] Calling showTrackSelector, focus:', focusType);
                    showTrackSelector(focusType);
                }, 800);
            }
        });

        cache.video.addEventListener('playing', function() {
            hideLoading();
            startProgressUpdates();
        });

        cache.video.addEventListener('pause', function() {
            showControls();
        });

        cache.video.addEventListener('error', function() {
            hideLoading();
            console.error('[Player] Video error:', cache.video.error);
            if (cache.info) {
                cache.info.textContent = 'Fehler beim Laden des Streams';
            }
            showControls();
        });

        cache.video.addEventListener('timeupdate', function() {
            updateProgress();
        });

        cache.video.addEventListener('stalled', function() {
            showLoading();
        });

        cache.video.addEventListener('ended', function() {
            if (cache.info) {
                cache.info.textContent = 'Stream beendet';
            }
            showControls();

            // Check for binge-watch (series)
            if (state.currentStreamType === 'series' && state.currentEpisode) {
                handleSeriesEnded();
            }
        });
    }

    // ===== TRACK SELECTOR ON LOAD =====
    function setOpenTrackSelectorOnLoad(trackType) {
        state.openTrackSelectorOnLoad = trackType;
    }

    // ===== BADGE DISPLAY =====
    function showBadge(text) {
        if (!cache.speedBadge) return;
        cache.speedBadge.textContent = text || '';
        cache.speedBadge.style.display = text ? 'block' : 'none';
    }

    function hideBadge() {
        if (cache.speedBadge) {
            cache.speedBadge.style.display = 'none';
        }
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        play: play,
        close: close,
        pause: pause,
        pauseVideo: pause,  // Alias for TimeshiftManager/VoiceControl compatibility
        resume: resume,
        showControls: showControls,
        seekTo: seekTo,
        seekRelative: seekRelative,
        saveWatchProgress: saveWatchProgress,
        setMovieInfo: setMovieInfo,
        setEpisodeData: setEpisodeData,
        showTrackSelector: showTrackSelector,
        hideTrackSelector: hideTrackSelector,
        setOpenTrackSelectorOnLoad: setOpenTrackSelectorOnLoad,
        showBadge: showBadge,
        hideBadge: hideBadge,
        isActive: function() { return state.isActive; },
        getState: function() { return state; }
    };
})();
