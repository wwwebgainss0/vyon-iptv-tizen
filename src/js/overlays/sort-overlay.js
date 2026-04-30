/**
 * Sort Overlay - UI for sorting options
 * ES3 Compatible - Minimal DOM operations
 * Trigger: BLUE button on remote
 */

window.SortOverlay = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        // WebOS BLUE button keycodes (different TV models)
        BLUE_BUTTON_KEYCODES: [406],  // 406=Blue only (YELLOW=405 is for Favorites)
        ANIMATION_DELAY: 50,
        DEBUG: false
    };

    // ===== STATE =====
    var state = {
        isVisible: false,
        focusedIndex: 0,
        options: [],
        currentScreen: '',
        onSortCallback: null
    };

    // ===== CACHED DOM =====
    var cache = {
        overlay: null,
        optionsList: null,
        title: null,
        currentSortLabel: null
    };

    // ===== INITIALIZATION =====
    function initialize() {
        createOverlayDOM();
        setupKeyboardHandler();
    }

    function createOverlayDOM() {
        // Create overlay container
        var overlay = document.createElement('div');
        overlay.id = 'sort-overlay';
        overlay.className = 'sort-overlay';
        overlay.style.display = 'none';

        var html = '';
        html += '<div class="sort-overlay-content">';
        html += '  <div class="sort-overlay-header">';
        html += '    <h2 class="sort-overlay-title">Sort By</h2>';
        html += '    <span class="sort-overlay-current"></span>';
        html += '  </div>';
        html += '  <ul class="sort-overlay-options"></ul>';
        html += '  <div class="sort-overlay-hint">';
        html += '    <span class="hint-key">OK</span> Select';
        html += '    <span class="hint-key">BACK</span> Close';
        html += '  </div>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        // Cache references
        cache.overlay = overlay;
        cache.optionsList = overlay.querySelector('.sort-overlay-options');
        cache.title = overlay.querySelector('.sort-overlay-title');
        cache.currentSortLabel = overlay.querySelector('.sort-overlay-current');
    }

    function isBlueButton(keyCode) {
        for (var i = 0; i < CONFIG.BLUE_BUTTON_KEYCODES.length; i++) {
            if (keyCode === CONFIG.BLUE_BUTTON_KEYCODES[i]) {
                return true;
            }
        }
        return false;
    }

    function setupKeyboardHandler() {
        document.addEventListener('keydown', function(e) {
            // Debug: Log all key presses
            if (CONFIG.DEBUG) {
                console.log('[SortOverlay] KeyCode: ' + e.keyCode);
            }

            // BLUE button opens sort overlay (check multiple keycodes)
            if (isBlueButton(e.keyCode)) {
                if (CONFIG.DEBUG) {
                    console.log('[SortOverlay] BLUE button detected! keyCode=' + e.keyCode);
                }
                e.preventDefault();
                e.stopPropagation();

                if (!state.isVisible) {
                    // Only show on movies/series screens
                    if (window.ScreenManager) {
                        var currentScreen = window.ScreenManager.getCurrentScreen();
                        if (CONFIG.DEBUG) {
                            console.log('[SortOverlay] Current screen: ' + currentScreen);
                        }
                        if (currentScreen === 'movies' || currentScreen === 'series' || currentScreen === 'livetv') {
                            show(currentScreen);
                        }
                    }
                } else {
                    hide();
                }
                return;
            }

            // Only handle keys when overlay is visible
            if (!state.isVisible) return;

            var keyCode = e.keyCode;

            // Navigation
            if (keyCode === 38) { // UP
                e.preventDefault();
                e.stopPropagation();
                navigateUp();
            } else if (keyCode === 40) { // DOWN
                e.preventDefault();
                e.stopPropagation();
                navigateDown();
            } else if (keyCode === 13 || keyCode === 32) { // OK / SPACE
                e.preventDefault();
                e.stopPropagation();
                selectOption();
            } else if (keyCode === 461 || keyCode === 8 || keyCode === 27) { // BACK / BACKSPACE / ESC
                e.preventDefault();
                e.stopPropagation();
                hide();
            }
        }, true); // Use capture to intercept before other handlers
    }

    // ===== NAVIGATION =====
    function navigateUp() {
        if (state.focusedIndex > 0) {
            state.focusedIndex--;
            updateFocusUI();
        }
    }

    function navigateDown() {
        if (state.focusedIndex < state.options.length - 1) {
            state.focusedIndex++;
            updateFocusUI();
        }
    }

    function updateFocusUI() {
        var items = cache.optionsList.querySelectorAll('.sort-option');
        for (var i = 0; i < items.length; i++) {
            if (i === state.focusedIndex) {
                items[i].className = 'sort-option focused';
            } else {
                items[i].className = 'sort-option';
            }
        }
    }

    function selectOption() {
        if (state.focusedIndex < 0 || state.focusedIndex >= state.options.length) {
            return;
        }

        var selectedOption = state.options[state.focusedIndex];

        // Update sort manager
        if (window.SortManager) {
            window.SortManager.setCurrentSort(state.currentScreen, selectedOption.id);
        }

        // Call callback
        if (state.onSortCallback) {
            state.onSortCallback(selectedOption.id);
        }

        hide();
    }

    // ===== SHOW/HIDE =====
    function show(screenType, callback) {
        if (state.isVisible) return;

        state.currentScreen = screenType || 'movies';
        state.onSortCallback = callback || defaultSortCallback;

        // Get options for this screen
        if (window.SortManager) {
            state.options = window.SortManager.getOptionsForScreen(state.currentScreen);
        } else {
            state.options = [];
        }

        if (state.options.length === 0) {
            return;
        }

        // Find current sort option index
        var currentSort = '';
        if (window.SortManager) {
            currentSort = window.SortManager.getCurrentSort(state.currentScreen);
        }

        state.focusedIndex = 0;
        for (var i = 0; i < state.options.length; i++) {
            if (state.options[i].id === currentSort) {
                state.focusedIndex = i;
                break;
            }
        }

        // Build options HTML
        var html = '';
        for (var j = 0; j < state.options.length; j++) {
            var option = state.options[j];
            var focusedClass = (j === state.focusedIndex) ? ' focused' : '';
            var selectedClass = (option.id === currentSort) ? ' selected' : '';
            html += '<li class="sort-option' + focusedClass + selectedClass + '" data-sort="' + option.id + '">';
            html += option.label;
            if (option.id === currentSort) {
                html += ' <span class="checkmark">&#10003;</span>';
            }
            html += '</li>';
        }
        cache.optionsList.innerHTML = html;

        // Update current sort label
        if (window.SortManager) {
            cache.currentSortLabel.textContent = 'Current: ' + window.SortManager.getSortLabel(currentSort);
        }

        // Update title based on screen
        var titleText = 'Sort ';
        if (state.currentScreen === 'movies') {
            titleText += 'Movies';
        } else if (state.currentScreen === 'series') {
            titleText += 'Series';
        } else if (state.currentScreen === 'livetv') {
            titleText += 'Channels';
        }
        cache.title.textContent = titleText;

        // Show overlay
        cache.overlay.style.display = 'flex';
        state.isVisible = true;

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('sort-overlay', window.NavigationStack.LAYERS.MODAL, {
                onBack: function() {
                    hide();
                }
            });
        }
    }

    function hide() {
        if (!state.isVisible) return;

        cache.overlay.style.display = 'none';
        state.isVisible = false;
        state.onSortCallback = null;

        // Remove from NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.pop();
        }

        // Restore focus to content
        if (window.FocusManager) {
            window.FocusManager.restoreFocus();
        }
    }

    // ===== DEFAULT SORT CALLBACK =====
    function defaultSortCallback(sortOption) {
        // Apply sort to current screen
        if (window.ScreenManager) {
            var screen = window.ScreenManager.getCurrentScreen();

            if (screen === 'movies') {
                applySortToMovies(sortOption);
            } else if (screen === 'series') {
                applySortToSeries(sortOption);
            } else if (screen === 'livetv') {
                applySortToLiveTV(sortOption);
            }
        }
    }

    function applySortToMovies(sortOption) {
        if (!window.ScreenManager || !window.ScreenManager.getMoviesData) {
            return;
        }

        var moviesData = window.ScreenManager.getMoviesData();
        if (!moviesData || !moviesData.rows) return;

        // Sort content within each category row
        if (window.SortManager) {
            window.SortManager.sortRowsContent(moviesData.rows, sortOption);
        }

        // Re-init HorizontalPageManager for paginated rows
        for (var i = 0; i < moviesData.rows.length; i++) {
            var row = moviesData.rows[i];
            if (row.isPaginatedRow && window.HorizontalPageManager) {
                window.HorizontalPageManager.init(row.id, row.channels);
            }
        }

        // Refresh display
        if (window.ScreenManager.refreshCurrentScreen) {
            window.ScreenManager.refreshCurrentScreen();
        }

        // Force SlotRenderer to re-render all slots
        if (window.SlotRenderer && window.SlotRenderer.renderAllSlots) {
            window.SlotRenderer.renderAllSlots();
        }

        // Reload images for new order
        if (window.ProgressiveImageLoader) {
            setTimeout(function() {
                window.ProgressiveImageLoader.processImages();
            }, 100);
        }
    }

    function applySortToSeries(sortOption) {
        if (!window.ScreenManager || !window.ScreenManager.getSeriesData) {
            return;
        }

        var seriesData = window.ScreenManager.getSeriesData();
        if (!seriesData || !seriesData.rows) return;

        // Sort content within each category row
        if (window.SortManager) {
            window.SortManager.sortRowsContent(seriesData.rows, sortOption);
        }

        // Re-init HorizontalPageManager for paginated rows
        for (var i = 0; i < seriesData.rows.length; i++) {
            var row = seriesData.rows[i];
            if (row.isPaginatedRow && window.HorizontalPageManager) {
                window.HorizontalPageManager.init(row.id, row.channels);
            }
        }

        // Refresh display
        if (window.ScreenManager.refreshCurrentScreen) {
            window.ScreenManager.refreshCurrentScreen();
        }

        // Force SlotRenderer to re-render
        if (window.SlotRenderer && window.SlotRenderer.renderAllSlots) {
            window.SlotRenderer.renderAllSlots();
        }

        // Reload images
        if (window.ProgressiveImageLoader) {
            setTimeout(function() {
                window.ProgressiveImageLoader.processImages();
            }, 100);
        }
    }

    function applySortToLiveTV(sortOption) {
        if (!window.ScreenManager || !window.ScreenManager.getLiveTVData) {
            return;
        }

        var livetvData = window.ScreenManager.getLiveTVData();
        if (!livetvData || !livetvData.rows) return;

        // Sort content within each category row
        if (window.SortManager) {
            window.SortManager.sortRowsContent(livetvData.rows, sortOption);
        }

        // Re-init HorizontalPageManager for paginated rows
        for (var i = 0; i < livetvData.rows.length; i++) {
            var row = livetvData.rows[i];
            if (row.isPaginatedRow && window.HorizontalPageManager) {
                window.HorizontalPageManager.init(row.id, row.channels);
            }
        }

        // Refresh display
        if (window.ScreenManager.refreshCurrentScreen) {
            window.ScreenManager.refreshCurrentScreen();
        }

        // Force SlotRenderer to re-render
        if (window.SlotRenderer && window.SlotRenderer.renderAllSlots) {
            window.SlotRenderer.renderAllSlots();
        }

        // Reload images
        if (window.ProgressiveImageLoader) {
            setTimeout(function() {
                window.ProgressiveImageLoader.processImages();
            }, 100);
        }
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: function() { return state.isVisible; }
    };
})();
