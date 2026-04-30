/**
 * Screen Manager - Manages LiveTV and Movies screens
 * ES3 Compatible - Zero allocations
 */

window.ScreenManager = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        currentScreen: 'livetv',
        navFocused: false,
        navIndex: 0
    };

    // ===== CACHED DOM =====
    var cache = {
        navLiveTV: null,
        navMovies: null,
        navSeries: null,
        navActivation: null,
        searchActive: null,
        searchBtn: null,
        slotContainer: null
    };

    // ===== DATA =====
    var data = {
        livetvChannels: [],
        livetvCategories: [],
        livetvRows: [],
        moviesData: [],
        moviesCategories: [],
        moviesRows: [],
        seriesData: [],
        seriesCategories: [],
        seriesRows: []
    };

    // ===== INITIALIZATION =====
    function initialize() {
        cache.navLiveTV = document.getElementById('nav-livetv');
        cache.navMovies = document.getElementById('nav-movies');
        cache.navSeries = document.getElementById('nav-series');
        cache.navActivation = document.getElementById('nav-activation');
        cache.searchActive = document.getElementById('header-search-active');
        cache.searchBtn = document.getElementById('search-btn');
        cache.slotContainer = document.getElementById('slot-container');

        if (cache.navLiveTV) {
            cache.navLiveTV.onclick = function() {
                switchToScreen('livetv');
            };
        }
        if (cache.navMovies) {
            cache.navMovies.onclick = function() {
                switchToScreen('movies');
            };
        }
        if (cache.navSeries) {
            cache.navSeries.onclick = function() {
                switchToScreen('series');
            };
        }
        if (cache.navActivation) {
            cache.navActivation.onclick = function() {
                showActivation();
            };
        }
        if (cache.searchBtn) {
            cache.searchBtn.onclick = function() {
                if (window.SearchOverlay) {
                    window.SearchOverlay.show();
                }
            };
        }

        // Initialize SeriesOverlay
        if (window.SeriesOverlay) {
            window.SeriesOverlay.init();
        }

        // Initialize MovieOverlay
        if (window.MovieOverlay) {
            window.MovieOverlay.init();
        }

        // Initialize ActivationScreen
        if (window.ActivationScreen) {
            window.ActivationScreen.init();
        }

        // Initialize SettingsScreen
        if (window.SettingsScreen) {
            window.SettingsScreen.init();
        }

        // Initialize FavoritesManager
        if (window.FavoritesManager) {
            window.FavoritesManager.init();
        }

        // Initialize ChannelViewTracker
        if (window.ChannelViewTracker) {
            window.ChannelViewTracker.init();
        }
    }

    // ===== SCREEN SWITCHING =====
    function switchToScreen(screenName) {
        if (screenName === state.currentScreen) {
            return;
        }

        state.currentScreen = screenName;

        if (window.FocusManager && window.FocusManager.clearRowMemory) {
            window.FocusManager.clearRowMemory();
        }

        updateNavigationUI();

        if (screenName === 'livetv') {
            showLiveTV();
        } else if (screenName === 'movies') {
            showMovies();
        } else if (screenName === 'series') {
            showSeries();
        }
    }

    function updateNavigationUI() {
        // Clear all focus and active states
        if (cache.navLiveTV) {
            cache.navLiveTV.classList.remove('nav-active', 'focused');
        }
        if (cache.navMovies) {
            cache.navMovies.classList.remove('nav-active', 'focused');
        }
        if (cache.navSeries) {
            cache.navSeries.classList.remove('nav-active', 'focused');
        }
        if (cache.navActivation) {
            cache.navActivation.classList.remove('nav-active', 'focused');
        }
        if (cache.searchActive) {
            cache.searchActive.classList.remove('focused');
        }
        if (cache.searchBtn) {
            cache.searchBtn.classList.remove('focused');
        }

        // Set nav-active class based on current screen
        if (state.currentScreen === 'livetv' && cache.navLiveTV) {
            cache.navLiveTV.classList.add('nav-active');
        } else if (state.currentScreen === 'movies' && cache.navMovies) {
            cache.navMovies.classList.add('nav-active');
        } else if (state.currentScreen === 'series' && cache.navSeries) {
            cache.navSeries.classList.add('nav-active');
        }

        // Update NavBarController
        if (window.NavBarController) {
            window.NavBarController.setActiveScreen(state.currentScreen);
        }
    }

    function isSearchTermVisible() {
        return cache.searchActive && cache.searchActive.style.display === 'flex';
    }

    function getMaxNavIndex() {
        // 0=LiveTV, 1=Movies, 2=Series, 3=Settings, 4=SearchTerm/SearchBtn, 5=SearchBtn (if term visible)
        if (isSearchTermVisible()) {
            return 5; // Can go to search term (4) and search btn (5)
        }
        return 4; // Can only go to search btn (4)
    }

    // ===== LIVE TV SCREEN =====
    function showLiveTV() {
        // Set mode BEFORE rendering
        if (window.SlotRenderer && window.SlotRenderer.setMode) {
            window.SlotRenderer.setMode('livetv');
        }

        if (data.livetvRows.length > 0) {
            renderLiveTVData();
        }
    }

    function setLiveTVData(channels, categories, rows) {
        data.livetvChannels = channels;
        data.livetvCategories = categories;
        data.livetvRows = rows;

        if (state.currentScreen === 'livetv') {
            renderLiveTVData();
        }
    }

    function renderLiveTVData() {
        var loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }

        // Build rows with special rows at top
        var rowsToRender = [];

        // 1. Add Most Watched row if exists
        if (window.ChannelViewTracker) {
            var mostWatchedRow = window.ChannelViewTracker.getMostWatchedRow();
            if (mostWatchedRow) {
                rowsToRender.push(mostWatchedRow);
            }
        }

        // 2. Add favorites row if exists
        if (window.FavoritesManager) {
            var favRow = window.FavoritesManager.getFavoritesRow('livetv');
            if (favRow) {
                rowsToRender.push(favRow);
            }
        }

        // 3. Add regular rows
        for (var i = 0; i < data.livetvRows.length; i++) {
            rowsToRender.push(data.livetvRows[i]);
        }

        if (window.SlotRenderer) {
            window.SlotRenderer.setData(rowsToRender);
        }

        setTimeout(function() {
            // Only set focus to content if NOT navigating in header
            if (window.FocusManager && !state.navFocused) {
                window.FocusManager.setFocus(0, 0);
            }

            if (window.ProgressiveImageLoader) {
                setTimeout(function() {
                    window.ProgressiveImageLoader.processImages();
                }, 300);
            }
        }, 100);

        // DON'T reset navFocused here - let user stay in header if they're navigating
    }

    // ===== MOVIES SCREEN =====
    function showMovies() {
        // Set mode BEFORE rendering
        if (window.SlotRenderer && window.SlotRenderer.setMode) {
            window.SlotRenderer.setMode('movies');
        }

        if (data.moviesRows.length > 0) {
            renderMoviesData();
        } else {
            loadMoviesData();
        }
    }

    function loadMoviesData() {
        var loading = document.getElementById('loading');
        if (loading) {
            loading.textContent = 'Loading Movies...';
            loading.style.display = 'block';
        }

        if (!window.XtreamAPI) {
            console.error('[ScreenManager] XtreamAPI not available!');
            if (cache.slotContainer) {
                cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">API not available</div>';
            }
            return;
        }

        window.XtreamAPI.getVodCategories(function(err, vodCategories) {
            if (err) {
                console.error('[ScreenManager] Failed to load VOD categories:', err);
                if (cache.slotContainer) {
                    cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">Failed to load categories: ' + err + '<br><br>This server may not support VOD/Movies.<br>Contact provider for VOD access.</div>';
                }
                return;
            }

            vodCategories = vodCategories || [];

            if (vodCategories.length === 0) {
                if (cache.slotContainer) {
                    cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">No VOD categories available.<br><br>This server may not offer Movies/VOD content.</div>';
                }
                return;
            }

            window.XtreamAPI.getVodStreams(function(err2, vodStreams) {
                if (err2) {
                    console.error('[ScreenManager] Failed to load VOD streams:', err2);
                    if (cache.slotContainer) {
                        cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">Failed to load Movies: ' + err2 + '</div>';
                    }
                    return;
                }

                vodStreams = vodStreams || [];

                if (vodStreams.length === 0) {
                    if (cache.slotContainer) {
                        cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">No movies available</div>';
                    }
                    return;
                }

                try {
                    // Auto-lock adult categories before processing
                    if (window.CategoryLock && window.CategoryLock.isAdultCategory) {
                        for (var c = 0; c < vodCategories.length; c++) {
                            var cat = vodCategories[c];
                            if (window.CategoryLock.isAdultCategory(cat.category_name)) {
                                var catId = String(cat.category_id);
                                var lockedList = window.CategoryLock.getLockedCategories('movies');
                                if (lockedList.indexOf(catId) === -1) {
                                    // Lock this category
                                    lockedList.push(catId);
                                    try { localStorage.setItem('ultra_iptv_locked_categories_movies', JSON.stringify(lockedList)); } catch (e) {}
                                    console.log('[ScreenManager] Auto-locked movie category:', cat.category_name);
                                }
                            }
                        }
                    }
                    processMoviesData(vodStreams, vodCategories);
                } catch (e) {
                    console.error('[ScreenManager] ERROR in processMoviesData:', e);
                    if (cache.slotContainer) {
                        cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">Error processing movies: ' + e + '</div>';
                    }
                }
            });
        });
    }

    function processMoviesData(movies, categories) {
        var moviesByCategory = {};
        var i, movie, catId;

        for (i = 0; i < categories.length; i++) {
            catId = categories[i].category_id;
            moviesByCategory[catId] = [];
        }

        for (i = 0; i < movies.length; i++) {
            movie = movies[i];
            catId = movie.category_id;

            if (!moviesByCategory[catId]) {
                moviesByCategory[catId] = [];
            }
            moviesByCategory[catId].push(movie);
        }

        // Apply default sort (newest first) to each category
        var defaultSort = 'date_new';
        if (window.SortManager) {
            defaultSort = window.SortManager.getCurrentSort('movies');
            for (catId in moviesByCategory) {
                if (moviesByCategory.hasOwnProperty(catId)) {
                    window.SortManager.sortItems(moviesByCategory[catId], defaultSort);
                }
            }
        }

        var rows = [];
        var categoryMap = {};

        for (i = 0; i < categories.length; i++) {
            categoryMap[categories[i].category_id] = categories[i];
        }

        var rowCount = 0;
        var PAGINATION_THRESHOLD = 5;

        for (catId in moviesByCategory) {
            if (!moviesByCategory.hasOwnProperty(catId)) continue;

            // Skip locked categories (adult content filter)
            if (window.CategoryLock && window.CategoryLock.isCategoryLocked(catId, 'movies')) {
                continue;
            }

            var categoryMovies = moviesByCategory[catId];
            var category = categoryMap[catId];

            if (!category || categoryMovies.length === 0) continue;

            if (categoryMovies.length > PAGINATION_THRESHOLD && window.HorizontalPageManager) {
                var rowId = 'movie-row-' + catId;
                var rowTitle = category.category_name + ' (' + categoryMovies.length + ' items)';

                rows.push({
                    id: rowId,
                    title: rowTitle,
                    channels: categoryMovies,
                    isPaginatedRow: true,
                    categoryId: catId,
                    totalCount: categoryMovies.length
                });

                window.HorizontalPageManager.init(rowId, categoryMovies);
                rowCount++;
            } else {
                for (var offset = 0; offset < categoryMovies.length; offset += 12) {
                    var rowMovies = [];
                    for (var j = 0; j < 12 && (offset + j) < categoryMovies.length; j++) {
                        rowMovies.push(categoryMovies[offset + j]);
                    }

                    var partNum = Math.floor(offset / 12) + 1;
                    var totalParts = Math.ceil(categoryMovies.length / 12);
                    var rowTitle = category.category_name;

                    if (totalParts > 1) {
                        rowTitle += ' (' + partNum + '/' + totalParts + ')';
                    }

                    rows.push({
                        id: 'movie-row-' + catId + '-' + offset,
                        title: rowTitle,
                        channels: rowMovies,
                        isPaginatedRow: false,
                        categoryId: catId
                    });
                    rowCount++;
                }
            }
        }

        // Add Continue Watching row at the top
        if (window.WatchHistory) {
            var continueWatchingRow = window.WatchHistory.getContinueWatchingRow();
            if (continueWatchingRow) {
                rows.unshift(continueWatchingRow);
            }
        }

        data.moviesData = movies;
        data.moviesCategories = categories;
        data.moviesRows = rows;

        renderMoviesData();
    }

    function renderMoviesData() {
        // Build rows with special rows at top
        var rowsToRender = [];

        // 1. Add Continue Watching row if exists
        if (window.WatchHistory) {
            var continueRow = window.WatchHistory.getContinueWatchingRow();
            if (continueRow) {
                rowsToRender.push(continueRow);
            }
        }

        // 2. Add Favorites row if exists
        if (window.FavoritesManager) {
            var favRow = window.FavoritesManager.getFavoritesRow('movies');
            if (favRow) {
                rowsToRender.push(favRow);
            }
        }

        // 3. Add regular rows (skip any existing continue/favorites rows)
        for (var i = 0; i < data.moviesRows.length; i++) {
            var row = data.moviesRows[i];
            if (!row.isContinueWatching && !row.isFavoritesRow) {
                rowsToRender.push(row);
            }
        }

        var loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }

        if (window.SlotRenderer) {
            window.SlotRenderer.setData(rowsToRender);
        } else {
            console.error('[ScreenManager] SlotRenderer not available!');
        }

        setTimeout(function() {
            // Only set focus to content if NOT navigating in header
            if (window.FocusManager && !state.navFocused) {
                window.FocusManager.setFocus(0, 0);
            }

            if (window.ProgressiveImageLoader) {
                setTimeout(function() {
                    window.ProgressiveImageLoader.processImages();
                }, 300);
            }
        }, 100);

        // DON'T reset navFocused here - let user stay in header if they're navigating
    }

    // ===== SERIES SCREEN =====
    function showSeries() {
        // Set mode BEFORE rendering (use movies mode for poster layout)
        if (window.SlotRenderer && window.SlotRenderer.setMode) {
            window.SlotRenderer.setMode('movies');
        }

        if (data.seriesRows.length > 0) {
            renderSeriesData();
        } else {
            loadSeriesData();
        }
    }

    function loadSeriesData() {
        var loading = document.getElementById('loading');
        if (loading) {
            loading.textContent = 'Loading Series...';
            loading.style.display = 'block';
        }

        if (!window.XtreamAPI) {
            if (cache.slotContainer) {
                cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">API not available</div>';
            }
            return;
        }

        window.XtreamAPI.getSeriesCategories(function(err, seriesCategories) {
            if (err) {
                if (cache.slotContainer) {
                    cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">Failed to load categories: ' + err + '<br><br>This server may not support Series.</div>';
                }
                return;
            }

            seriesCategories = seriesCategories || [];

            if (seriesCategories.length === 0) {
                if (cache.slotContainer) {
                    cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">No series categories available.</div>';
                }
                return;
            }

            window.XtreamAPI.getSeries(function(err2, seriesStreams) {
                if (err2) {
                    if (cache.slotContainer) {
                        cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">Failed to load Series: ' + err2 + '</div>';
                    }
                    return;
                }

                seriesStreams = seriesStreams || [];

                if (seriesStreams.length === 0) {
                    if (cache.slotContainer) {
                        cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">No series available</div>';
                    }
                    return;
                }

                try {
                    // Auto-lock adult categories before processing
                    if (window.CategoryLock && window.CategoryLock.isAdultCategory) {
                        for (var c = 0; c < seriesCategories.length; c++) {
                            var cat = seriesCategories[c];
                            if (window.CategoryLock.isAdultCategory(cat.category_name)) {
                                var catId = String(cat.category_id);
                                var lockedList = window.CategoryLock.getLockedCategories('series');
                                if (lockedList.indexOf(catId) === -1) {
                                    // Lock this category
                                    lockedList.push(catId);
                                    try { localStorage.setItem('ultra_iptv_locked_categories_series', JSON.stringify(lockedList)); } catch (e) {}
                                    console.log('[ScreenManager] Auto-locked series category:', cat.category_name);
                                }
                            }
                        }
                    }
                    processSeriesData(seriesStreams, seriesCategories);
                } catch (e) {
                    if (cache.slotContainer) {
                        cache.slotContainer.innerHTML = '<div style="color:#fff;text-align:center;padding:100px;">Error processing series: ' + e + '</div>';
                    }
                }
            });
        });
    }

    function processSeriesData(series, categories) {
        var seriesByCategory = {};
        var i, item, catId;

        for (i = 0; i < categories.length; i++) {
            catId = categories[i].category_id;
            seriesByCategory[catId] = [];
        }

        for (i = 0; i < series.length; i++) {
            item = series[i];
            catId = item.category_id;

            if (!seriesByCategory[catId]) {
                seriesByCategory[catId] = [];
            }
            seriesByCategory[catId].push(item);
        }

        // Apply default sort (newest first) to each category
        var defaultSort = 'date_new';
        if (window.SortManager) {
            defaultSort = window.SortManager.getCurrentSort('series');
            for (catId in seriesByCategory) {
                if (seriesByCategory.hasOwnProperty(catId)) {
                    window.SortManager.sortItems(seriesByCategory[catId], defaultSort);
                }
            }
        }

        var rows = [];
        var categoryMap = {};

        for (i = 0; i < categories.length; i++) {
            categoryMap[categories[i].category_id] = categories[i];
        }

        var rowCount = 0;
        var PAGINATION_THRESHOLD = 5;

        for (catId in seriesByCategory) {
            if (!seriesByCategory.hasOwnProperty(catId)) continue;

            // Skip locked categories (adult content filter)
            if (window.CategoryLock && window.CategoryLock.isCategoryLocked(catId, 'series')) {
                continue;
            }

            var categorySeries = seriesByCategory[catId];
            var category = categoryMap[catId];

            if (!category || categorySeries.length === 0) continue;

            if (categorySeries.length > PAGINATION_THRESHOLD && window.HorizontalPageManager) {
                var rowId = 'series-row-' + catId;
                var rowTitle = category.category_name + ' (' + categorySeries.length + ' items)';

                rows.push({
                    id: rowId,
                    title: rowTitle,
                    channels: categorySeries,
                    isPaginatedRow: true,
                    categoryId: catId,
                    totalCount: categorySeries.length,
                    isSeries: true
                });

                window.HorizontalPageManager.init(rowId, categorySeries);
                rowCount++;
            } else {
                for (var offset = 0; offset < categorySeries.length; offset += 12) {
                    var rowSeries = [];
                    for (var j = 0; j < 12 && (offset + j) < categorySeries.length; j++) {
                        rowSeries.push(categorySeries[offset + j]);
                    }

                    var partNum = Math.floor(offset / 12) + 1;
                    var totalParts = Math.ceil(categorySeries.length / 12);
                    var rowTitle = category.category_name;

                    if (totalParts > 1) {
                        rowTitle += ' (' + partNum + '/' + totalParts + ')';
                    }

                    rows.push({
                        id: 'series-row-' + catId + '-' + offset,
                        title: rowTitle,
                        channels: rowSeries,
                        isPaginatedRow: false,
                        categoryId: catId,
                        isSeries: true
                    });
                    rowCount++;
                }
            }
        }

        data.seriesData = series;
        data.seriesCategories = categories;
        data.seriesRows = rows;

        renderSeriesData();
    }

    function renderSeriesData() {
        // Build rows with favorites at top
        var rowsToRender = [];

        // Add Favorites row if exists
        if (window.FavoritesManager) {
            var favRow = window.FavoritesManager.getFavoritesRow('series');
            if (favRow) {
                favRow.isSeries = true;  // Mark for series handling
                rowsToRender.push(favRow);
            }
        }

        // Add regular rows (skip any existing favorites rows)
        for (var i = 0; i < data.seriesRows.length; i++) {
            var row = data.seriesRows[i];
            if (!row.isFavoritesRow) {
                rowsToRender.push(row);
            }
        }

        var loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }

        if (window.SlotRenderer) {
            window.SlotRenderer.setData(rowsToRender);
        }

        setTimeout(function() {
            // Only set focus to content if NOT navigating in header
            if (window.FocusManager && !state.navFocused) {
                window.FocusManager.setFocus(0, 0);
            }

            if (window.ProgressiveImageLoader) {
                setTimeout(function() {
                    window.ProgressiveImageLoader.processImages();
                }, 300);
            }
        }, 100);

        // DON'T reset navFocused here - let user stay in header if they're navigating
    }

    // ===== ACTIVATION / SETTINGS SCREEN =====
    function isLoggedIn() {
        // Check if API credentials are configured
        if (window.XtreamAPI && window.XtreamAPI.isConfigured) {
            return window.XtreamAPI.isConfigured();
        }
        // Fallback: check localStorage for saved credentials
        var savedCreds = localStorage.getItem('iptv_credentials');
        return !!savedCreds;
    }

    function showActivation() {
        // Hide slot container
        if (cache.slotContainer) {
            cache.slotContainer.style.display = 'none';
        }

        // Check if logged in
        if (isLoggedIn()) {
            // Show Settings Screen (full settings)
            if (window.SettingsScreen) {
                window.SettingsScreen.show();
            }
        } else {
            // Show Activation Screen (MAC address / registration)
            if (window.ActivationScreen) {
                window.ActivationScreen.show();

                // Register with NavigationStack
                if (window.NavigationStack) {
                    window.NavigationStack.push('activation-screen', window.NavigationStack.LAYERS.MODAL, {
                        onBack: function() {
                            hideActivation();
                        }
                    });
                }
            }
        }
    }

    function hideActivation() {
        // Hide activation screen
        if (window.ActivationScreen) {
            window.ActivationScreen.hide();
        }

        // Hide settings screen
        if (window.SettingsScreen && window.SettingsScreen.isVisible()) {
            window.SettingsScreen.hide();
        }

        // Show slot container
        if (cache.slotContainer) {
            cache.slotContainer.style.display = 'block';
        }

        // Restore focus
        if (window.FocusManager) {
            window.FocusManager.restoreFocus();
        }
    }

    // ===== NAVIGATION HANDLING =====
    function handleNavigationUp() {
        if (state.navFocused) {
            return false;
        }

        if (window.FocusManager && window.SlotRenderer) {
            var currentSlot = window.FocusManager.state.currentSlot;
            var rendererState = window.SlotRenderer.getState();
            var currentOffset = rendererState.currentOffset;

            if (currentSlot === 0 && currentOffset === 0) {
                state.navFocused = true;
                updateNavigationUI();
                return true;
            }
        }

        return false;
    }

    function handleNavigationLeft() {
        if (!state.navFocused) return false;

        if (state.navIndex > 0) {
            state.navIndex--;

            // Switch screens for nav items 0-2
            if (state.navIndex === 0) {
                switchToScreen('livetv');
            } else if (state.navIndex === 1) {
                switchToScreen('movies');
            } else if (state.navIndex === 2) {
                switchToScreen('series');
            } else {
                // Just update UI for search elements
                updateNavigationUI();
            }
            return true;
        }
        return false;
    }

    function handleNavigationRight() {
        if (!state.navFocused) return false;

        var maxIndex = getMaxNavIndex();
        if (state.navIndex < maxIndex) {
            state.navIndex++;

            // Switch screens for nav items 0-2
            if (state.navIndex === 1) {
                switchToScreen('movies');
            } else if (state.navIndex === 2) {
                switchToScreen('series');
            } else {
                // Just update UI for search elements (3, 4)
                updateNavigationUI();
            }
            return true;
        }
        return false;
    }

    function handleNavigationDown() {
        if (!state.navFocused) return false;

        state.navFocused = false;
        if (window.FocusManager) {
            window.FocusManager.setFocus(0, 0);
        }
        return true;
    }

    function handleNavigationOK() {
        if (!state.navFocused) return false;

        if (state.navIndex === 0) {
            switchToScreen('livetv');
        } else if (state.navIndex === 1) {
            switchToScreen('movies');
        } else if (state.navIndex === 2) {
            switchToScreen('series');
        } else if (state.navIndex === 3) {
            // Settings - show activation screen
            showActivation();
        } else if (state.navIndex === 4) {
            // Search term (clear search) or search button (open search)
            if (isSearchTermVisible()) {
                // Clear search
                if (window.SearchOverlay) {
                    window.SearchOverlay.restoreOriginalData();
                    window.SearchOverlay.hideHeaderSearch();
                }
            } else {
                // Open search
                if (window.SearchOverlay) {
                    window.SearchOverlay.show();
                }
            }
        } else if (state.navIndex === 5) {
            // Search button - open search
            if (window.SearchOverlay) {
                window.SearchOverlay.show();
            }
        }
        return true;
    }

    // ===== REFRESH MOVIES SCREEN =====
    function refreshMoviesScreen() {
        if (state.currentScreen === 'movies' && data.moviesRows.length > 0) {
            renderMoviesData();
        }
    }

    // ===== REFRESH CURRENT SCREEN =====
    function refreshCurrentScreen() {
        if (state.currentScreen === 'livetv') {
            renderLiveTVData();
        } else if (state.currentScreen === 'movies') {
            renderMoviesData();
        } else if (state.currentScreen === 'series') {
            renderSeriesData();
        }
    }

    // ===== DATA GETTERS FOR SORT =====
    function getMoviesData() {
        return {
            movies: data.moviesData,
            categories: data.moviesCategories,
            rows: data.moviesRows
        };
    }

    function getSeriesData() {
        return {
            series: data.seriesData,
            categories: data.seriesCategories,
            rows: data.seriesRows
        };
    }

    function getLiveTVData() {
        return {
            channels: data.livetvChannels,
            categories: data.livetvCategories,
            rows: data.livetvRows
        };
    }

    /**
     * Get all Live TV channels as flat array (for channel number input)
     * @returns {Array} - All channels
     */
    function getLiveTVChannels() {
        return data.livetvChannels || [];
    }

    // ===== CATEGORY GETTERS FOR PARENTAL CONTROL =====
    function getMovieCategories() {
        return data.moviesCategories || [];
    }

    function getSeriesCategories() {
        return data.seriesCategories || [];
    }

    function getLiveTVCategories() {
        return data.livetvCategories || [];
    }

    // ===== SCREEN CYCLING (Edge-Swipe) =====
    var SCREEN_ORDER = ['livetv', 'movies', 'series'];

    function cycleScreen(direction) {
        var idx = SCREEN_ORDER.indexOf(state.currentScreen);
        if (idx < 0) return false;

        var newIdx;
        if (direction === 'next') {
            newIdx = (idx + 1) % SCREEN_ORDER.length;
        } else {
            newIdx = (idx - 1 + SCREEN_ORDER.length) % SCREEN_ORDER.length;
        }

        switchToScreen(SCREEN_ORDER[newIdx]);
        return true;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        setLiveTVData: setLiveTVData,
        switchToScreen: switchToScreen,
        switchScreen: switchToScreen,
        cycleScreen: cycleScreen,
        getCurrentScreen: function() { return state.currentScreen; },
        isNavFocused: function() { return state.navFocused; },
        handleNavigationUp: handleNavigationUp,
        handleNavigationDown: handleNavigationDown,
        handleNavigationLeft: handleNavigationLeft,
        handleNavigationRight: handleNavigationRight,
        handleNavigationOK: handleNavigationOK,
        refreshMoviesScreen: refreshMoviesScreen,
        refreshCurrentScreen: refreshCurrentScreen,
        getMoviesData: getMoviesData,
        getSeriesData: getSeriesData,
        getLiveTVData: getLiveTVData,
        getLiveTVChannels: getLiveTVChannels,
        getMovieCategories: getMovieCategories,
        getSeriesCategories: getSeriesCategories,
        getLiveTVCategories: getLiveTVCategories
    };
})();
