/**
 * Series Overlay - Season/Episode Selection
 * Horizontal season slider + vertical episode list
 * ES3 Compatible - WebOS 3.x optimized
 */

window.SeriesOverlay = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        VISIBLE_SEASONS: 6,
        VISIBLE_EPISODES: 5,
        SEASON_WIDTH: 120,
        EPISODE_HEIGHT: 90
    };

    // ===== STATE =====
    var state = {
        visible: false,
        series: null,
        seriesInfo: null,
        seasonsData: [],
        episodesData: [],
        currentSeasonIndex: 0,
        currentEpisodeIndex: 0,
        seasonScrollOffset: 0,
        focusArea: 'seasons'
    };

    // ===== CACHED DOM =====
    var cache = {
        overlay: null,
        backdrop: null,
        content: null,
        poster: null,
        title: null,
        description: null,
        seasonsRow: null,
        seasonsInner: null,
        episodesList: null,
        episodesInner: null,
        loadingIndicator: null
    };

    // ===== INITIALIZATION =====
    var isInitialized = false;

    function initialize() {
        // Prevent double initialization
        if (isInitialized) {
            return;
        }
        isInitialized = true;

        createOverlayDOM();
        setupKeyHandler();
    }

    function createOverlayDOM() {
        var overlay = document.createElement('div');
        overlay.id = 'series-overlay';
        overlay.className = 'series-overlay';

        var html = '';
        html += '<div class="series-backdrop"></div>';
        html += '<div class="series-content">';

        // Left side - Poster
        html += '  <div class="series-left">';
        html += '    <div class="series-poster-box">';
        html += '      <img id="series-poster" class="series-poster" src="" alt="">';
        html += '    </div>';
        html += '    <div id="series-title" class="series-title-text"></div>';
        html += '    <div id="series-desc" class="series-desc-text"></div>';
        html += '  </div>';

        // Right side - Seasons + Episodes
        html += '  <div class="series-right">';

        // Seasons row (horizontal slider)
        html += '    <div class="series-section-title">Seasons</div>';
        html += '    <div id="series-seasons-row" class="series-seasons-row">';
        html += '      <div id="series-seasons-inner" class="series-seasons-inner"></div>';
        html += '    </div>';

        // Episodes list (vertical)
        html += '    <div class="series-section-title">Episodes</div>';
        html += '    <div id="series-episodes-list" class="series-episodes-list">';
        html += '      <div id="series-episodes-inner" class="series-episodes-inner"></div>';
        html += '    </div>';

        // Loading
        html += '    <div id="series-loading" class="series-loading">Loading...</div>';

        html += '  </div>';
        html += '</div>';

        // Hints
        html += '<div class="series-hints">';
        html += '  <span>◀▶ Seasons</span>';
        html += '  <span>▲▼ Episodes</span>';
        html += '  <span>OK Play</span>';
        html += '  <span>BACK Close</span>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        // Cache references
        cache.overlay = overlay;
        cache.backdrop = overlay.querySelector('.series-backdrop');
        cache.content = overlay.querySelector('.series-content');
        cache.poster = document.getElementById('series-poster');
        cache.title = document.getElementById('series-title');
        cache.description = document.getElementById('series-desc');
        cache.seasonsRow = document.getElementById('series-seasons-row');
        cache.seasonsInner = document.getElementById('series-seasons-inner');
        cache.episodesList = document.getElementById('series-episodes-list');
        cache.episodesInner = document.getElementById('series-episodes-inner');
        cache.loadingIndicator = document.getElementById('series-loading');
    }

    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!state.visible) return;

            var keyCode = e.keyCode;

            // Let NavigationHandler handle back button via NavigationStack
            if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
                // Don't handle here - NavigationHandler will call NavigationStack.handleBack()
                return;
            }

            var handled = false;

            switch (keyCode) {
                case 37: // Left
                    handled = handleLeft();
                    break;
                case 39: // Right
                    handled = handleRight();
                    break;
                case 38: // Up
                    handled = handleUp();
                    break;
                case 40: // Down
                    handled = handleDown();
                    break;
                case 13: // OK/Enter
                    handled = handleOK();
                    break;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    // ===== SHOW/HIDE =====
    function show(series) {
        if (!series) return;

        state.series = series;
        state.visible = true;
        state.currentSeasonIndex = 0;
        state.currentEpisodeIndex = 0;
        state.seasonScrollOffset = 0;
        state.focusArea = 'seasons';
        state.seriesInfo = null;
        state.seasonsData = [];
        state.episodesData = [];

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('series-overlay', window.NavigationStack.LAYERS.SERIES_OVERLAY, {
                seriesData: series
            });
        }

        cache.overlay.className = 'series-overlay visible';

        // Set basic info
        cache.title.textContent = series.name || series.title || 'Unknown Series';
        cache.description.textContent = series.plot || '';

        // Set poster
        var posterUrl = series.cover || series.stream_icon || '';
        if (posterUrl) {
            cache.poster.src = posterUrl;
            cache.poster.style.display = 'block';
        } else {
            cache.poster.style.display = 'none';
        }

        // Show loading, hide content
        cache.loadingIndicator.style.display = 'block';
        cache.seasonsRow.style.display = 'none';
        cache.episodesList.style.display = 'none';

        // Load series info
        loadSeriesInfo(series.series_id);
    }

    function hide() {
        state.visible = false;
        cache.overlay.className = 'series-overlay';

        // Note: Stack management is done by NavigationStack.handleBack() or playEpisode()
        // This function only handles DOM visibility

        if (window.FocusManager) {
            setTimeout(function() {
                window.FocusManager.restoreFocus();
            }, 100);
        }
    }

    function loadSeriesInfo(seriesId) {
        if (!window.XtreamAPI || !window.XtreamAPI.getSeriesInfo) {
            showError('API not available');
            return;
        }

        window.XtreamAPI.getSeriesInfo(seriesId, function(err, info) {
            if (err) {
                showError('Failed to load: ' + err);
                return;
            }

            if (!info) {
                showError('No data received');
                return;
            }

            state.seriesInfo = info;
            processSeriesInfo(info);
        });
    }

    function processSeriesInfo(info) {
        var seasonsData = [];
        var episodesObj = info.episodes || {};
        var seasonsArr = info.seasons || [];

        // Build seasons from episodes keys
        var seasonKeys = [];
        for (var key in episodesObj) {
            if (episodesObj.hasOwnProperty(key)) {
                seasonKeys.push(key);
            }
        }

        // Sort season keys numerically
        seasonKeys.sort(function(a, b) {
            return parseInt(a, 10) - parseInt(b, 10);
        });

        // Create season data
        for (var i = 0; i < seasonKeys.length; i++) {
            var sKey = seasonKeys[i];
            var sNum = parseInt(sKey, 10);
            var eps = episodesObj[sKey] || [];

            // Find season name from seasons array
            var seasonName = 'Season ' + sNum;
            for (var j = 0; j < seasonsArr.length; j++) {
                if (seasonsArr[j].season_number === sNum) {
                    seasonName = seasonsArr[j].name || seasonName;
                    break;
                }
            }

            seasonsData.push({
                key: sKey,
                number: sNum,
                name: seasonName,
                episodes: eps,
                episodeCount: eps.length
            });
        }

        state.seasonsData = seasonsData;

        if (seasonsData.length === 0) {
            showError('No seasons available');
            return;
        }

        // Update description if info has plot
        if (info.info && info.info.plot) {
            cache.description.textContent = info.info.plot;
        }

        // Hide loading, show content
        cache.loadingIndicator.style.display = 'none';
        cache.seasonsRow.style.display = 'block';
        cache.episodesList.style.display = 'block';

        // Find continue watching episode (most recently watched, not completed)
        var continueEpisode = findContinueWatchingEpisode();

        if (continueEpisode) {
            // Auto-focus on continue watching episode
            state.currentSeasonIndex = continueEpisode.seasonIndex;
            state.currentEpisodeIndex = continueEpisode.episodeIndex;
            state.focusArea = 'episodes'; // Focus directly on episodes
            renderSeasons();
            state.episodesData = state.seasonsData[continueEpisode.seasonIndex].episodes || [];
            renderEpisodes();
        } else {
            // Default: render first season
            renderSeasons();
            selectSeason(0);
        }
    }

    /**
     * Find the episode to continue watching
     * Returns the first episode with progress < 95% (not completed)
     * Or the first unwatched episode after all completed ones
     */
    function findContinueWatchingEpisode() {
        if (!window.WatchHistory || !state.seasonsData || state.seasonsData.length === 0) {
            return null;
        }

        var lastWatchedSeason = -1;
        var lastWatchedEpisode = -1;
        var lastWatchedTime = 0;

        // Find the most recently watched episode that's not completed
        for (var s = 0; s < state.seasonsData.length; s++) {
            var season = state.seasonsData[s];
            if (!season.episodes) continue;

            for (var e = 0; e < season.episodes.length; e++) {
                var ep = season.episodes[e];
                if (!ep.id) continue;

                var resumePos = window.WatchHistory.getResumePosition(ep.id);
                if (resumePos > 0) {
                    // Get duration to calculate progress
                    var epDuration = 45 * 60; // Default
                    if (ep.info && ep.info.duration_secs) {
                        epDuration = ep.info.duration_secs;
                    } else if (ep.info && ep.info.duration) {
                        var parts = String(ep.info.duration).split(':');
                        if (parts.length === 2) {
                            epDuration = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                        } else if (parts.length === 3) {
                            epDuration = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
                        }
                    }

                    var progress = (resumePos / epDuration) * 100;

                    // If not completed (< 95%), this is a candidate
                    if (progress < 95) {
                        // Return immediately - this is the episode to continue
                        return {
                            seasonIndex: s,
                            episodeIndex: e,
                            progress: progress
                        };
                    } else {
                        // Episode completed, track it to find next unwatched
                        if (s > lastWatchedSeason || (s === lastWatchedSeason && e > lastWatchedEpisode)) {
                            lastWatchedSeason = s;
                            lastWatchedEpisode = e;
                        }
                    }
                }
            }
        }

        // If we have watched episodes but all are completed, suggest next episode
        if (lastWatchedSeason >= 0 && lastWatchedEpisode >= 0) {
            var nextSeason = lastWatchedSeason;
            var nextEpisode = lastWatchedEpisode + 1;

            // Check if there's a next episode in same season
            if (state.seasonsData[nextSeason] &&
                state.seasonsData[nextSeason].episodes &&
                nextEpisode < state.seasonsData[nextSeason].episodes.length) {
                return {
                    seasonIndex: nextSeason,
                    episodeIndex: nextEpisode,
                    progress: 0
                };
            }

            // Try next season's first episode
            nextSeason++;
            if (state.seasonsData[nextSeason] &&
                state.seasonsData[nextSeason].episodes &&
                state.seasonsData[nextSeason].episodes.length > 0) {
                return {
                    seasonIndex: nextSeason,
                    episodeIndex: 0,
                    progress: 0
                };
            }
        }

        return null;
    }

    function showError(message) {
        cache.loadingIndicator.textContent = message;
        cache.loadingIndicator.style.display = 'block';
        cache.seasonsRow.style.display = 'none';
        cache.episodesList.style.display = 'none';
    }

    // ===== RENDERING =====
    function renderSeasons() {
        var html = '';
        var seasons = state.seasonsData;

        for (var i = 0; i < seasons.length; i++) {
            var s = seasons[i];
            var isFocused = (i === state.currentSeasonIndex && state.focusArea === 'seasons');
            var isSelected = (i === state.currentSeasonIndex);

            var classes = 'season-box';
            if (isFocused) classes += ' focused';
            if (isSelected) classes += ' selected';

            html += '<div class="' + classes + '" data-index="' + i + '">';
            html += '  <div class="season-number">S' + s.number + '</div>';
            html += '  <div class="season-count">' + s.episodeCount + ' Ep</div>';
            html += '</div>';
        }

        cache.seasonsInner.innerHTML = html;
        scrollSeasonsToView();
    }

    function scrollSeasonsToView() {
        var idx = state.currentSeasonIndex;
        var maxVisible = CONFIG.VISIBLE_SEASONS;

        // Calculate scroll offset
        if (idx < state.seasonScrollOffset) {
            state.seasonScrollOffset = idx;
        } else if (idx >= state.seasonScrollOffset + maxVisible) {
            state.seasonScrollOffset = idx - maxVisible + 1;
        }

        var scrollX = state.seasonScrollOffset * (CONFIG.SEASON_WIDTH + 10);
        cache.seasonsInner.style.transform = 'translateX(-' + scrollX + 'px)';
    }

    function selectSeason(index) {
        if (index < 0 || index >= state.seasonsData.length) return;

        state.currentSeasonIndex = index;
        state.currentEpisodeIndex = 0;
        state.episodesData = state.seasonsData[index].episodes || [];

        renderSeasons();
        renderEpisodes();
    }

    function renderEpisodes() {
        var html = '';
        var episodes = state.episodesData;

        for (var i = 0; i < episodes.length; i++) {
            var ep = episodes[i];
            var isFocused = (i === state.currentEpisodeIndex && state.focusArea === 'episodes');

            var classes = 'episode-row';
            if (isFocused) classes += ' focused';

            var epNum = ep.episode_num || (i + 1);
            var epTitle = ep.title || ('Episode ' + epNum);
            var duration = '';
            if (ep.info && ep.info.duration) {
                duration = ep.info.duration;
            }

            // Get watch progress from WatchHistory
            var progressPercent = 0;
            var isCompleted = false;
            if (window.WatchHistory && ep.id) {
                var resumePos = window.WatchHistory.getResumePosition(ep.id);
                if (resumePos > 0) {
                    // Estimate duration from info or use default 45 min
                    var epDuration = 45 * 60; // Default 45 minutes
                    if (ep.info && ep.info.duration_secs) {
                        epDuration = ep.info.duration_secs;
                    } else if (ep.info && ep.info.duration) {
                        // Parse duration string like "45:30" or "1:23:45"
                        var parts = String(ep.info.duration).split(':');
                        if (parts.length === 2) {
                            epDuration = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                        } else if (parts.length === 3) {
                            epDuration = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
                        }
                    }
                    progressPercent = Math.min(100, Math.floor((resumePos / epDuration) * 100));
                    isCompleted = progressPercent >= 95;
                }
            }

            // Check if marked as completed in history (watched > 95%)
            if (isCompleted) {
                progressPercent = 100;
                classes += ' completed';
            } else if (progressPercent > 0) {
                classes += ' in-progress';
            }

            html += '<div class="' + classes + '" data-index="' + i + '">';
            html += '  <div class="episode-num">E' + epNum + '</div>';
            html += '  <div class="episode-info">';
            html += '    <div class="episode-title">' + epTitle + '</div>';
            // Progress bar
            if (progressPercent > 0) {
                html += '    <div class="episode-progress-bar">';
                html += '      <div class="episode-progress-fill" style="width:' + progressPercent + '%"></div>';
                html += '    </div>';
            }
            html += '  </div>';
            if (duration) {
                html += '  <div class="episode-dur">' + duration + '</div>';
            }
            // Completed checkmark
            if (isCompleted) {
                html += '  <div class="episode-completed">✓</div>';
            }
            html += '</div>';
        }

        cache.episodesInner.innerHTML = html;
        scrollEpisodesToView();
    }

    function scrollEpisodesToView() {
        var idx = state.currentEpisodeIndex;
        var scrollY = Math.max(0, (idx - 2)) * CONFIG.EPISODE_HEIGHT;
        cache.episodesInner.style.transform = 'translateY(-' + scrollY + 'px)';
    }

    // ===== NAVIGATION =====
    function handleLeft() {
        if (state.focusArea === 'seasons') {
            if (state.currentSeasonIndex > 0) {
                selectSeason(state.currentSeasonIndex - 1);
                return true;
            }
        } else if (state.focusArea === 'episodes') {
            // Switch to seasons
            state.focusArea = 'seasons';
            renderSeasons();
            renderEpisodes();
            return true;
        }
        return false;
    }

    function handleRight() {
        if (state.focusArea === 'seasons') {
            if (state.currentSeasonIndex < state.seasonsData.length - 1) {
                selectSeason(state.currentSeasonIndex + 1);
                return true;
            }
        }
        return false;
    }

    function handleUp() {
        if (state.focusArea === 'episodes') {
            if (state.currentEpisodeIndex > 0) {
                state.currentEpisodeIndex--;
                renderEpisodes();
                return true;
            } else {
                // Switch to seasons
                state.focusArea = 'seasons';
                renderSeasons();
                renderEpisodes();
                return true;
            }
        }
        return false;
    }

    function handleDown() {
        if (state.focusArea === 'seasons') {
            // Switch to episodes
            if (state.episodesData.length > 0) {
                state.focusArea = 'episodes';
                renderSeasons();
                renderEpisodes();
                return true;
            }
        } else if (state.focusArea === 'episodes') {
            if (state.currentEpisodeIndex < state.episodesData.length - 1) {
                state.currentEpisodeIndex++;
                renderEpisodes();
                return true;
            }
        }
        return false;
    }

    function handleOK() {
        if (state.focusArea === 'seasons') {
            // Switch to episodes
            if (state.episodesData.length > 0) {
                state.focusArea = 'episodes';
                renderSeasons();
                renderEpisodes();
                return true;
            }
        } else if (state.focusArea === 'episodes') {
            var episode = state.episodesData[state.currentEpisodeIndex];
            if (episode) {
                playEpisode(episode);
                return true;
            }
        }
        return false;
    }

    function playEpisode(episode) {
        if (!episode) return;

        var streamId = episode.id;
        var extension = episode.container_extension || 'mp4';

        if (!streamId) return;

        // Build title
        var seriesName = state.series ? (state.series.name || 'Series') : 'Series';
        var season = state.seasonsData[state.currentSeasonIndex];
        var epNum = episode.episode_num || (state.currentEpisodeIndex + 1);
        var fullTitle = seriesName + ' - S' + season.number + 'E' + epNum;

        // Get poster for icon
        var iconUrl = state.series ? (state.series.cover || state.series.stream_icon || '') : '';

        // Store series data for return navigation
        var seriesData = state.series;

        // Close overlay (but keep series data for return)
        state.visible = false;
        cache.overlay.className = 'series-overlay';

        // Pop series-overlay from stack (player will add itself with return context)
        if (window.NavigationStack) {
            window.NavigationStack.pop('series-overlay');
        }

        // PlayerComponent.play expects: (streamId, channelName, streamType, containerExtension, iconUrl)
        // Also pass seriesData for return navigation
        if (window.PlayerComponent) {
            setTimeout(function() {
                // Register player with series return context
                if (window.NavigationStack) {
                    window.NavigationStack.push('player', window.NavigationStack.LAYERS.PLAYER, {
                        returnTo: 'series-overlay',
                        seriesData: seriesData,
                        streamType: 'series'
                    });
                }
                // Set episode data for binge-watch
                window.PlayerComponent.setEpisodeData(episode, seriesData);
                window.PlayerComponent.play(streamId, fullTitle, 'series', extension, iconUrl);
            }, 100);
        }
    }

    /**
     * Get the next episode after the current one
     * @param {object} currentEpisode - Current episode object
     * @returns {object|null} - Next episode or null
     */
    function getNextEpisode(currentEpisode) {
        if (!currentEpisode || !state.seasonsData || state.seasonsData.length === 0) {
            return null;
        }

        // Find current episode in episodes data
        var currentSeasonIdx = state.currentSeasonIndex;
        var currentEpIdx = -1;

        // Find episode index
        for (var i = 0; i < state.episodesData.length; i++) {
            if (state.episodesData[i].id === currentEpisode.id) {
                currentEpIdx = i;
                break;
            }
        }

        // Try next episode in same season
        if (currentEpIdx >= 0 && currentEpIdx < state.episodesData.length - 1) {
            return state.episodesData[currentEpIdx + 1];
        }

        // Try first episode of next season
        if (currentSeasonIdx < state.seasonsData.length - 1) {
            var nextSeason = state.seasonsData[currentSeasonIdx + 1];
            if (nextSeason && nextSeason.episodes && nextSeason.episodes.length > 0) {
                return nextSeason.episodes[0];
            }
        }

        return null;
    }

    /**
     * Play a specific episode (used by BingeOverlay)
     * @param {object} episode - Episode to play
     * @param {object} seriesData - Series data
     */
    function playEpisodeExternal(episode, seriesData) {
        // If seriesData provided, update state
        if (seriesData) {
            state.series = seriesData;
        }

        // Find the right season/episode indices
        if (state.seasonsData) {
            for (var s = 0; s < state.seasonsData.length; s++) {
                var season = state.seasonsData[s];
                if (season && season.episodes) {
                    for (var e = 0; e < season.episodes.length; e++) {
                        if (season.episodes[e].id === episode.id) {
                            state.currentSeasonIndex = s;
                            state.currentEpisodeIndex = e;
                            state.episodesData = season.episodes;
                            break;
                        }
                    }
                }
            }
        }

        playEpisode(episode);
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: function() { return state.visible; },
        getNextEpisode: getNextEpisode,
        playEpisode: playEpisodeExternal
    };
})();
