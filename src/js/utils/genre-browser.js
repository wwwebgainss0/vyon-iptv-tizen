/**
 * Genre Browser - Filter Movies/Series by Genre
 * Horizontal genre selection bar
 * ES3 Compatible - WebOS 3.x optimized
 */

window.GenreBrowser = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        VISIBLE_GENRES: 8,
        GENRE_ITEM_WIDTH: 150
    };

    // ===== STATE =====
    var state = {
        visible: false,
        genres: [],
        selectedGenreIndex: 0,
        scrollOffset: 0,
        currentScreen: 'movies', // 'movies' or 'series'
        allMovies: [],
        filteredMovies: []
    };

    // ===== DOM CACHE =====
    var cache = {
        container: null,
        genreList: null,
        activeIndicator: null
    };

    // ===== INITIALIZATION =====
    function init() {
        // Genre browser is initialized when movies screen loads
    }

    /**
     * Show genre browser for a screen
     * @param {string} screenType - 'movies' or 'series'
     */
    function show(screenType) {
        state.currentScreen = screenType || 'movies';
        state.visible = true;
        state.selectedGenreIndex = 0;
        state.scrollOffset = 0;

        loadGenres();
        createDOM();
        render();
    }

    function hide() {
        state.visible = false;

        if (cache.container) {
            cache.container.style.display = 'none';
        }
    }

    // ===== GENRE LOADING =====
    function loadGenres() {
        state.genres = [];

        // Get movies data from ScreenManager
        var data = null;
        if (window.ScreenManager) {
            if (state.currentScreen === 'movies') {
                data = window.ScreenManager.getMoviesData();
            } else if (state.currentScreen === 'series') {
                data = window.ScreenManager.getSeriesData();
            }
        }

        if (!data) return;

        // Extract unique genres
        var genreMap = {};

        // Get all items (movies or series)
        var items = data.movies || data.series || [];
        state.allMovies = items;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var genre = item.genre || item.category_name || '';

            // Split multiple genres
            var genres = genre.split(/[,\/]/);
            for (var j = 0; j < genres.length; j++) {
                var g = genres[j].trim();
                if (g && !genreMap[g]) {
                    genreMap[g] = true;
                }
            }
        }

        // Convert to array
        for (var key in genreMap) {
            if (genreMap.hasOwnProperty(key)) {
                state.genres.push(key);
            }
        }

        // Sort alphabetically
        state.genres.sort();

        // Add "All" at the beginning
        state.genres.unshift('Alle');
    }

    // ===== DOM CREATION =====
    function createDOM() {
        if (!cache.container) {
            var container = document.getElementById('genre-browser');
            if (!container) {
                container = document.createElement('div');
                container.id = 'genre-browser';
                container.className = 'genre-browser';

                var html = '<div class="genre-browser-content">';
                html += '  <div class="genre-browser-label">Genre:</div>';
                html += '  <div class="genre-list" id="genre-list"></div>';
                html += '</div>';

                container.innerHTML = html;

                // Insert after header
                var header = document.querySelector('.header');
                if (header && header.parentNode) {
                    header.parentNode.insertBefore(container, header.nextSibling);
                } else {
                    document.body.appendChild(container);
                }
            }

            cache.container = container;
            cache.genreList = document.getElementById('genre-list');
        }

        cache.container.style.display = 'flex';
    }

    // ===== RENDERING =====
    function render() {
        if (!cache.genreList) return;

        var html = '';
        var startIdx = state.scrollOffset;
        var endIdx = Math.min(startIdx + CONFIG.VISIBLE_GENRES, state.genres.length);

        // Left arrow indicator
        if (startIdx > 0) {
            html += '<div class="genre-arrow left">&lt;</div>';
        }

        for (var i = startIdx; i < endIdx; i++) {
            var genre = state.genres[i];
            var selected = i === state.selectedGenreIndex ? ' selected' : '';

            html += '<div class="genre-item' + selected + '" data-index="' + i + '">';
            html += escapeHtml(genre);
            html += '</div>';
        }

        // Right arrow indicator
        if (endIdx < state.genres.length) {
            html += '<div class="genre-arrow right">&gt;</div>';
        }

        cache.genreList.innerHTML = html;
    }

    // ===== NAVIGATION =====
    function moveLeft() {
        if (!state.visible) return false;

        if (state.selectedGenreIndex > 0) {
            state.selectedGenreIndex--;

            // Scroll if needed
            if (state.selectedGenreIndex < state.scrollOffset) {
                state.scrollOffset = state.selectedGenreIndex;
            }

            render();
            applyFilter();
            return true;
        }

        return false;
    }

    function moveRight() {
        if (!state.visible) return false;

        if (state.selectedGenreIndex < state.genres.length - 1) {
            state.selectedGenreIndex++;

            // Scroll if needed
            if (state.selectedGenreIndex >= state.scrollOffset + CONFIG.VISIBLE_GENRES) {
                state.scrollOffset = state.selectedGenreIndex - CONFIG.VISIBLE_GENRES + 1;
            }

            render();
            applyFilter();
            return true;
        }

        return false;
    }

    // ===== FILTERING =====
    function applyFilter() {
        var selectedGenre = state.genres[state.selectedGenreIndex];

        if (!selectedGenre || selectedGenre === 'Alle') {
            state.filteredMovies = state.allMovies;
        } else {
            state.filteredMovies = [];

            for (var i = 0; i < state.allMovies.length; i++) {
                var item = state.allMovies[i];
                var genre = item.genre || item.category_name || '';

                if (genre.indexOf(selectedGenre) !== -1) {
                    state.filteredMovies.push(item);
                }
            }
        }

        // Update the screen with filtered data
        updateScreen();
    }

    function updateScreen() {
        // Notify ScreenManager to update with filtered data
        if (window.ScreenManager && window.ScreenManager.setFilteredData) {
            window.ScreenManager.setFilteredData(state.currentScreen, state.filteredMovies);
        }
    }

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isVisible() {
        return state.visible;
    }

    function getSelectedGenre() {
        return state.genres[state.selectedGenreIndex] || 'Alle';
    }

    function getFilteredItems() {
        return state.filteredMovies;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        moveLeft: moveLeft,
        moveRight: moveRight,
        isVisible: isVisible,
        getSelectedGenre: getSelectedGenre,
        getFilteredItems: getFilteredItems,
        applyFilter: applyFilter
    };
})();
