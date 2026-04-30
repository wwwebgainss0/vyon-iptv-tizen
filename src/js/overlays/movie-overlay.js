/**
 * Movie Overlay - Movie Details & Trailer
 * Shows movie info with Play and Trailer buttons
 * ES3 Compatible - WebOS 3.x optimized
 */

window.MovieOverlay = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        visible: false,
        movie: null,
        movieInfo: null,
        focusIndex: 0,  // 0 = Play, 1 = Watchlist, 2 = Trailer, 3 = Audio, 4 = Subtitles
        hasTrailer: false,
        inWatchlist: false,
        openTrackSelectorOnPlay: null  // 'audio' or 'subtitles'
    };

    // ===== CACHED DOM =====
    var cache = {
        overlay: null,
        backdrop: null,
        content: null,
        poster: null,
        title: null,
        year: null,
        rating: null,
        duration: null,
        genre: null,
        description: null,
        cast: null,
        director: null,
        btnPlay: null,
        btnWatchlist: null,
        btnWatchlistIcon: null,
        btnWatchlistLabel: null,
        btnTrailer: null,
        btnAudio: null,
        btnSubtitles: null,
        loadingIndicator: null
    };

    // ===== INITIALIZATION =====
    var isInitialized = false;

    function initialize() {
        if (isInitialized) {
            return;
        }
        isInitialized = true;

        createOverlayDOM();
        setupKeyHandler();
    }

    function createOverlayDOM() {
        var overlay = document.createElement('div');
        overlay.id = 'movie-overlay';
        overlay.className = 'movie-overlay';

        var html = '';
        html += '<div class="movie-backdrop"></div>';
        html += '<div class="movie-content">';

        // Left side - Poster
        html += '  <div class="movie-left">';
        html += '    <div class="movie-poster-box">';
        html += '      <img id="movie-poster" class="movie-poster" src="" alt="">';
        html += '    </div>';
        html += '  </div>';

        // Right side - Details
        html += '  <div class="movie-right">';
        html += '    <div id="movie-title" class="movie-title-text"></div>';
        html += '    <div id="movie-year" class="movie-year"></div>';
        html += '    <div id="movie-rating" class="movie-rating"></div>';
        html += '    <div id="movie-duration" class="movie-duration"></div>';
        html += '    <div id="movie-genre" class="movie-genre"></div>';
        html += '    <div id="movie-desc" class="movie-desc-text"></div>';
        html += '    <div id="movie-cast" class="movie-cast"></div>';
        html += '    <div id="movie-director" class="movie-director"></div>';

        // Action buttons - Row 1
        html += '    <div class="movie-actions">';
        html += '      <div id="movie-btn-play" class="movie-btn focused">';
        html += '        <span class="movie-btn-icon">▶</span>';
        html += '        <span class="movie-btn-label">Abspielen</span>';
        html += '      </div>';
        html += '      <div id="movie-btn-watchlist" class="movie-btn">';
        html += '        <span class="movie-btn-icon" id="movie-watchlist-icon">+</span>';
        html += '        <span class="movie-btn-label" id="movie-watchlist-label">Favoriten</span>';
        html += '      </div>';
        html += '      <div id="movie-btn-trailer" class="movie-btn" style="display:none;">';
        html += '        <span class="movie-btn-icon">▶</span>';
        html += '        <span class="movie-btn-label">Trailer</span>';
        html += '      </div>';
        html += '    </div>';

        // Action buttons - Row 2 (Audio & Subtitles)
        html += '    <div class="movie-actions movie-actions-row2">';
        html += '      <div id="movie-btn-audio" class="movie-btn movie-btn-small">';
        html += '        <span class="movie-btn-icon">🔊</span>';
        html += '        <span class="movie-btn-label">Audio</span>';
        html += '      </div>';
        html += '      <div id="movie-btn-subtitles" class="movie-btn movie-btn-small">';
        html += '        <span class="movie-btn-icon">CC</span>';
        html += '        <span class="movie-btn-label">Untertitel</span>';
        html += '      </div>';
        html += '    </div>';

        // Loading
        html += '    <div id="movie-loading" class="movie-loading">Loading...</div>';

        html += '  </div>';
        html += '</div>';

        // Hints
        html += '<div class="movie-hints">';
        html += '  <span>&#9664;&#9654; Auswahl</span>';
        html += '  <span>OK Abspielen</span>';
        html += '  <span style="color:#FFD700;">GELB Favoriten</span>';
        html += '  <span>BACK Schliessen</span>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        // Cache references
        cache.overlay = overlay;
        cache.backdrop = overlay.querySelector('.movie-backdrop');
        cache.content = overlay.querySelector('.movie-content');
        cache.poster = document.getElementById('movie-poster');
        cache.title = document.getElementById('movie-title');
        cache.year = document.getElementById('movie-year');
        cache.rating = document.getElementById('movie-rating');
        cache.duration = document.getElementById('movie-duration');
        cache.genre = document.getElementById('movie-genre');
        cache.description = document.getElementById('movie-desc');
        cache.cast = document.getElementById('movie-cast');
        cache.director = document.getElementById('movie-director');
        cache.btnPlay = document.getElementById('movie-btn-play');
        cache.btnWatchlist = document.getElementById('movie-btn-watchlist');
        cache.btnWatchlistIcon = document.getElementById('movie-watchlist-icon');
        cache.btnWatchlistLabel = document.getElementById('movie-watchlist-label');
        cache.btnTrailer = document.getElementById('movie-btn-trailer');
        cache.btnAudio = document.getElementById('movie-btn-audio');
        cache.btnSubtitles = document.getElementById('movie-btn-subtitles');
        cache.loadingIndicator = document.getElementById('movie-loading');
    }

    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!state.visible) return;

            var keyCode = e.keyCode;

            // Let NavigationHandler handle back button via NavigationStack
            if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
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
                case 38: // Up - Navigate between rows
                    handled = handleUp();
                    break;
                case 40: // Down - Navigate between rows
                    handled = handleDown();
                    break;
                case 13: // OK/Enter
                    handled = handleOK();
                    break;
                case 405: // YELLOW - Toggle Favorites
                case 403:
                    toggleWatchlist();
                    handled = true;
                    break;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    // ===== FORMATTING =====
    function padZero(num) {
        var s = String(num);
        return s.length < 2 ? '0' + s : s;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';

        // Check if it's just a year (e.g., "2023")
        if (/^\d{4}$/.test(dateStr)) {
            return dateStr;
        }

        // Try parsing ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            var parts = dateStr.split('-');
            return parts[0]; // Just return year for movies
        }

        return dateStr;
    }

    // ===== SHOW/HIDE =====
    function show(movie, containerExt, iconUrl) {
        if (!movie) return;

        state.movie = movie;
        state.visible = true;
        state.focusIndex = 0;
        state.hasTrailer = false;
        state.movieInfo = null;
        state.openTrackSelectorOnPlay = null;

        // Check if in favorites
        state.inWatchlist = window.FavoritesManager ? window.FavoritesManager.isFavorite(movie, 'movies') : false;

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('movie-overlay', window.NavigationStack.LAYERS.SERIES_OVERLAY, {
                movieData: movie
            });
        }

        cache.overlay.className = 'movie-overlay visible';

        // Set basic info
        cache.title.textContent = movie.name || movie.title || 'Unknown Movie';

        // Set poster
        var posterUrl = movie.stream_icon || movie.cover || iconUrl || '';
        if (posterUrl) {
            cache.poster.src = posterUrl;
            cache.poster.style.display = 'block';
        } else {
            cache.poster.style.display = 'none';
        }

        // Clear details (will be populated from API)
        cache.year.textContent = '';
        cache.rating.textContent = '';
        cache.duration.textContent = '';
        cache.genre.textContent = '';
        cache.description.textContent = '';
        cache.cast.textContent = '';
        cache.director.textContent = '';

        // Hide trailer button until we know if there's a trailer
        cache.btnTrailer.style.display = 'none';

        // Show loading
        cache.loadingIndicator.style.display = 'block';

        // Update button focus
        updateButtonFocus();

        // Load movie info from API
        var streamId = movie.stream_id || movie.id;
        loadMovieInfo(streamId, containerExt);
    }

    function hide() {
        state.visible = false;
        cache.overlay.className = 'movie-overlay';

        if (window.FocusManager) {
            setTimeout(function() {
                window.FocusManager.restoreFocus();
            }, 100);
        }
    }

    function loadMovieInfo(streamId, containerExt) {
        if (!window.XtreamAPI || !window.XtreamAPI.getVodInfo) {
            cache.loadingIndicator.style.display = 'none';
            return;
        }

        window.XtreamAPI.getVodInfo(streamId, function(err, vodInfo) {
            cache.loadingIndicator.style.display = 'none';

            if (err || !vodInfo) {
                console.log('[MovieOverlay] Failed to load movie info:', err);
                return;
            }

            var info = vodInfo.info || vodInfo;
            state.movieInfo = info;

            // Store container extension
            if (containerExt) {
                state.containerExt = containerExt;
            } else if (vodInfo.movie_data && vodInfo.movie_data.container_extension) {
                state.containerExt = vodInfo.movie_data.container_extension;
            }

            // Populate details
            if (cache.title && info.name) {
                cache.title.textContent = info.name;
            }

            if (cache.year) {
                var yearStr = info.releasedate || info.release_date || info.year || '';
                cache.year.textContent = formatDate(yearStr);
            }

            if (cache.rating) {
                var ratingHtml = '';
                // IMDB Rating
                if (info.rating) {
                    ratingHtml += 'Rating: <span style="color:#FFD700;">&#9733; ' + info.rating + '</span>';
                }
                // MPAA Rating / Age
                if (info.rating_mpaa || info.age) {
                    var ageRating = info.rating_mpaa || info.age;
                    if (ratingHtml) ratingHtml += '  ';
                    ratingHtml += '<span style="border:1px solid #666;padding:2px 8px;border-radius:4px;margin-left:10px;">' + ageRating + '</span>';
                }
                cache.rating.innerHTML = ratingHtml;
            }

            if (cache.duration && info.duration) {
                // Duration with clock icon (Unicode: \u23F1 = stopwatch)
                cache.duration.innerHTML = 'Dauer: ' + info.duration;
            }

            if (cache.genre && info.genre) {
                cache.genre.textContent = info.genre;
            }

            if (cache.description) {
                cache.description.textContent = info.plot || info.description || '';
            }

            if (cache.cast && info.cast) {
                cache.cast.textContent = 'Cast: ' + info.cast;
            }

            if (cache.director && info.director) {
                cache.director.textContent = 'Regie: ' + info.director;
            }

            // Check for trailer
            if (info.youtube_trailer && info.youtube_trailer.length > 0) {
                state.hasTrailer = true;
                cache.btnTrailer.style.display = 'flex';
            }

            // Set backdrop image (Enhanced Movie Details)
            setBackdropImage(info);

            // Set larger cover image if available
            if (info.cover_big || info.cover) {
                var coverUrl = info.cover_big || info.cover;
                cache.poster.src = coverUrl;
            }
        });
    }

    /**
     * Set backdrop image from movie info
     * Uses backdrop_path or falls back to cover image
     */
    function setBackdropImage(info) {
        if (!cache.backdrop) return;

        var backdropUrl = '';

        // Try different backdrop fields from Xtream API
        if (info.backdrop_path) {
            // TMDB style backdrop
            if (info.backdrop_path.indexOf('http') === 0) {
                backdropUrl = info.backdrop_path;
            } else {
                // Might be a TMDB path, construct full URL
                backdropUrl = 'https://image.tmdb.org/t/p/w1280' + info.backdrop_path;
            }
        } else if (info.backdrop) {
            backdropUrl = info.backdrop;
        } else if (info.cover_big) {
            // Fallback to large cover
            backdropUrl = info.cover_big;
        }

        if (backdropUrl) {
            cache.backdrop.style.backgroundImage = 'url(' + backdropUrl + ')';
            cache.backdrop.style.backgroundSize = 'cover';
            cache.backdrop.style.backgroundPosition = 'center';
        } else {
            cache.backdrop.style.backgroundImage = '';
        }
    }

    // ===== BUTTON FOCUS =====
    // Layout:
    // Row 1: Play (0), Watchlist (1), Trailer (2)
    // Row 2: Audio (3), Subtitles (4)
    function updateButtonFocus() {
        // Reset all buttons
        cache.btnPlay.className = 'movie-btn';
        cache.btnWatchlist.className = 'movie-btn';
        cache.btnTrailer.className = 'movie-btn';
        cache.btnAudio.className = 'movie-btn movie-btn-small';
        cache.btnSubtitles.className = 'movie-btn movie-btn-small';

        // Set focus based on focusIndex
        // Row 1: 0 = Play, 1 = Watchlist, 2 = Trailer
        // Row 2: 3 = Audio, 4 = Subtitles
        if (state.focusIndex === 0) {
            cache.btnPlay.className = 'movie-btn focused';
        } else if (state.focusIndex === 1) {
            cache.btnWatchlist.className = 'movie-btn focused';
        } else if (state.focusIndex === 2 && state.hasTrailer) {
            cache.btnTrailer.className = 'movie-btn focused';
        } else if (state.focusIndex === 3) {
            cache.btnAudio.className = 'movie-btn movie-btn-small focused';
        } else if (state.focusIndex === 4) {
            cache.btnSubtitles.className = 'movie-btn movie-btn-small focused';
        }

        // Update watchlist button state
        updateWatchlistButton();
    }

    function updateWatchlistButton() {
        if (!cache.btnWatchlistIcon || !cache.btnWatchlistLabel) return;

        if (state.inWatchlist) {
            cache.btnWatchlistIcon.textContent = '✓';
            cache.btnWatchlistLabel.textContent = 'In Favoriten';
        } else {
            cache.btnWatchlistIcon.textContent = '+';
            cache.btnWatchlistLabel.textContent = 'Favoriten';
        }
    }

    // ===== NAVIGATION =====
    // Row 1: Play (0), Watchlist (1), Trailer (2)
    // Row 2: Audio (3), Subtitles (4)

    function handleLeft() {
        // Row 1: can go left from Watchlist(1) to Play(0), or from Trailer(2) to Watchlist(1)
        // Row 2: can go left from Subtitles(4) to Audio(3)
        if (state.focusIndex === 1 || state.focusIndex === 2) {
            state.focusIndex--;
            updateButtonFocus();
            return true;
        } else if (state.focusIndex === 4) {
            state.focusIndex = 3;
            updateButtonFocus();
            return true;
        }
        return false;
    }

    function handleRight() {
        // Row 1: can go right from Play(0) to Watchlist(1), or from Watchlist(1) to Trailer(2) if available
        // Row 2: can go right from Audio(3) to Subtitles(4)
        if (state.focusIndex === 0) {
            state.focusIndex = 1;
            updateButtonFocus();
            return true;
        } else if (state.focusIndex === 1 && state.hasTrailer) {
            state.focusIndex = 2;
            updateButtonFocus();
            return true;
        } else if (state.focusIndex === 3) {
            state.focusIndex = 4;
            updateButtonFocus();
            return true;
        }
        return false;
    }

    function handleUp() {
        // From Row 2 to Row 1
        if (state.focusIndex === 3) {
            // Audio -> Play
            state.focusIndex = 0;
            updateButtonFocus();
            return true;
        } else if (state.focusIndex === 4) {
            // Subtitles -> Watchlist
            state.focusIndex = 1;
            updateButtonFocus();
            return true;
        }
        return false;
    }

    function handleDown() {
        // From Row 1 to Row 2
        if (state.focusIndex === 0) {
            // Play -> Audio
            state.focusIndex = 3;
            updateButtonFocus();
            return true;
        } else if (state.focusIndex === 1 || state.focusIndex === 2) {
            // Watchlist or Trailer -> Subtitles
            state.focusIndex = 4;
            updateButtonFocus();
            return true;
        }
        return false;
    }

    function handleOK() {
        if (state.focusIndex === 0) {
            // Play button
            state.openTrackSelectorOnPlay = null;
            playMovie();
            return true;
        } else if (state.focusIndex === 1) {
            // Watchlist button
            toggleWatchlist();
            return true;
        } else if (state.focusIndex === 2 && state.hasTrailer) {
            // Trailer button
            playTrailer();
            return true;
        } else if (state.focusIndex === 3) {
            // Audio button - Start movie and open audio selector
            state.openTrackSelectorOnPlay = 'audio';
            playMovie();
            return true;
        } else if (state.focusIndex === 4) {
            // Subtitles button - Start movie and open subtitle selector
            state.openTrackSelectorOnPlay = 'subtitles';
            playMovie();
            return true;
        }
        return false;
    }

    function toggleWatchlist() {
        if (!state.movie || !window.FavoritesManager) return;

        var added = window.FavoritesManager.toggleFavorite(state.movie, 'movies');
        state.inWatchlist = added;
        updateWatchlistButton();

        // Notify ScreenManager to refresh favorites row
        if (window.ScreenManager && window.ScreenManager.refreshCurrentScreen) {
            window.ScreenManager.refreshCurrentScreen();
        }

        // Show toast feedback
        if (added) {
            showToast('Zu Favoriten hinzugefuegt');
        } else {
            showToast('Aus Favoriten entfernt');
        }
    }

    // ===== ACTIONS =====
    function playMovie() {
        if (!state.movie) return;

        var streamId = state.movie.stream_id || state.movie.id;
        var movieName = state.movie.name || state.movie.title || 'Movie';
        var containerExt = state.containerExt || state.movie.container_extension || '';
        var iconUrl = state.movie.stream_icon || state.movie.cover || '';

        // Store trackSelectorType before closing overlay
        var trackSelectorType = state.openTrackSelectorOnPlay;
        state.openTrackSelectorOnPlay = null;

        // Close overlay
        state.visible = false;
        cache.overlay.className = 'movie-overlay';

        // Pop movie-overlay from stack
        if (window.NavigationStack) {
            window.NavigationStack.pop('movie-overlay');
        }

        // Pass movie info to player and play
        if (window.PlayerComponent) {
            setTimeout(function() {
                // Register player in navigation stack
                if (window.NavigationStack) {
                    window.NavigationStack.push('player', window.NavigationStack.LAYERS.PLAYER, {
                        returnTo: null,
                        streamType: 'movie'
                    });
                }

                // Set movie info for player overlay
                if (state.movieInfo) {
                    window.PlayerComponent.setMovieInfo(state.movieInfo);
                }

                // Set track selector to open after video loads (if Audio/Subtitles button was clicked)
                if (trackSelectorType && window.PlayerComponent.setOpenTrackSelectorOnLoad) {
                    window.PlayerComponent.setOpenTrackSelectorOnLoad(trackSelectorType);
                }

                window.PlayerComponent.play(streamId, movieName, 'movie', containerExt, iconUrl);
            }, 100);
        }
    }

    // ===== TRAILER PLAYER (Opens WebOS Browser) =====
    function playTrailer() {
        if (!state.movieInfo || !state.movieInfo.youtube_trailer) {
            console.log('[MovieOverlay] No trailer available');
            showToast('Kein Trailer verfuegbar');
            return;
        }

        var trailerId = state.movieInfo.youtube_trailer;

        // Clean up trailer ID (remove any URL parts if present)
        if (trailerId.indexOf('watch?v=') > -1) {
            trailerId = trailerId.split('watch?v=')[1].split('&')[0];
        } else if (trailerId.indexOf('youtu.be/') > -1) {
            trailerId = trailerId.split('youtu.be/')[1].split('?')[0];
        }

        // Full URL for browser fallback
        var youtubeUrl = 'https://www.youtube.com/watch?v=' + trailerId;

        console.log('[MovieOverlay] Opening trailer:', trailerId);
        showToast('Oeffne YouTube...');

        // Try YouTube App first, then Browser
        launchYouTubeApp(trailerId, youtubeUrl);
    }

    function launchYouTubeApp(videoId, fullUrl) {
        // YouTube app IDs to try (in order of preference)
        var youtubeApps = [
            {
                id: 'youtube.leanback.v4',
                params: { contentTarget: 'https://www.youtube.com/watch?v=' + videoId }
            },
            {
                id: 'com.webos.app.youtube',
                params: { contentTarget: 'https://www.youtube.com/watch?v=' + videoId }
            },
            {
                id: 'youtube.leanback.v4',
                params: { v: videoId }
            }
        ];

        // Browser fallbacks
        var browserApps = [
            { id: 'com.webos.app.browser', params: { target: fullUrl } },
            { id: 'com.palm.app.browser', params: { target: fullUrl } },
            { id: 'com.lge.app.browser', params: { target: fullUrl } }
        ];

        var allApps = youtubeApps.concat(browserApps);
        var currentIndex = 0;

        function tryNext() {
            if (currentIndex >= allApps.length) {
                // Final fallback: window.open
                console.log('[MovieOverlay] All apps failed, trying window.open');
                try {
                    window.open(fullUrl, '_blank');
                    showToast('Browser geoeffnet');
                } catch (e) {
                    showToast('Keine App gefunden');
                }
                return;
            }

            var app = allApps[currentIndex];
            currentIndex++;

            console.log('[MovieOverlay] Trying app: ' + app.id);

            // Use PalmServiceBridge (native WebOS 3.x API)
            if (window.PalmServiceBridge) {
                try {
                    var bridge = new PalmServiceBridge();
                    bridge.onservicecallback = function(response) {
                        try {
                            var res = JSON.parse(response);
                            if (res.returnValue === true) {
                                console.log('[MovieOverlay] App launched: ' + app.id);
                                showToast('YouTube geoeffnet');
                            } else {
                                console.log('[MovieOverlay] App failed: ' + app.id);
                                tryNext();
                            }
                        } catch (e) {
                            tryNext();
                        }
                    };

                    var params = JSON.stringify({
                        id: app.id,
                        params: app.params
                    });

                    bridge.call('luna://com.webos.applicationManager/launch', params);
                } catch (e) {
                    console.log('[MovieOverlay] PalmServiceBridge error: ' + e);
                    tryNext();
                }
            }
            // Fallback: webOS.service.request (newer WebOS)
            else if (window.webOS && window.webOS.service && window.webOS.service.request) {
                try {
                    window.webOS.service.request('luna://com.webos.applicationManager', {
                        method: 'launch',
                        parameters: {
                            id: app.id,
                            params: app.params
                        },
                        onSuccess: function(res) {
                            console.log('[MovieOverlay] App launched: ' + app.id);
                            showToast('YouTube geoeffnet');
                        },
                        onFailure: function(err) {
                            console.log('[MovieOverlay] App failed: ' + app.id);
                            tryNext();
                        }
                    });
                } catch (e) {
                    console.log('[MovieOverlay] webOS.service error: ' + e);
                    tryNext();
                }
            }
            // No Luna API available - skip to next app
            else {
                console.log('[MovieOverlay] No Luna API, skipping to window.open');
                currentIndex = allApps.length; // Skip to final fallback
                tryNext();
            }
        }

        tryNext();
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);' +
            'background:rgba(0,0,0,0.9);color:#fff;padding:15px 30px;border-radius:8px;' +
            'font-size:18px;z-index:10000;';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 2500);
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: function() { return state.visible; }
    };
})();
