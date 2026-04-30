/**
 * Favorites Manager - Handle favorites for Channels, Movies, Series
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Usage:
 * - YELLOW button to toggle favorite on focused item
 * - Favorites row shown at top of each screen
 * - Stored in localStorage
 */

window.FavoritesManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_favorites',
        MAX_FAVORITES: 100  // Per category
    };

    // ===== STATE =====
    var state = {
        channels: [],   // Array of channel objects
        movies: [],     // Array of movie objects
        series: []      // Array of series objects
    };

    // ===== INITIALIZATION =====
    function initialize() {
        loadFavorites();
        return true;
    }

    function loadFavorites() {
        var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
            try {
                var parsed = JSON.parse(stored);
                state.channels = parsed.channels || [];
                state.movies = parsed.movies || [];
                state.series = parsed.series || [];
            } catch (e) {
                state.channels = [];
                state.movies = [];
                state.series = [];
            }
        }
    }

    function saveFavorites() {
        var data = {
            channels: state.channels,
            movies: state.movies,
            series: state.series
        };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    }

    // ===== GET UNIQUE ID =====
    function getItemId(item, type) {
        if (type === 'channels' || type === 'livetv') {
            return item.stream_id || item.id || item.num;
        } else if (type === 'movies') {
            return item.stream_id || item.id;
        } else if (type === 'series') {
            return item.series_id || item.id;
        }
        return null;
    }

    // ===== CHECK IF FAVORITE =====
    function isFavorite(item, type) {
        var normalizedType = normalizeType(type);
        var list = state[normalizedType];
        if (!list) return false;

        var itemId = getItemId(item, type);
        if (!itemId) return false;

        for (var i = 0; i < list.length; i++) {
            var favId = getItemId(list[i], type);
            if (favId === itemId) {
                return true;
            }
        }
        return false;
    }

    // ===== ADD FAVORITE =====
    function addFavorite(item, type) {
        var normalizedType = normalizeType(type);
        var list = state[normalizedType];
        if (!list) return false;

        // Check if already favorite
        if (isFavorite(item, type)) {
            return false;
        }

        // Check max limit
        if (list.length >= CONFIG.MAX_FAVORITES) {
            // Remove oldest
            list.shift();
        }

        // Add to beginning (newest first)
        list.unshift(item);
        saveFavorites();
        return true;
    }

    // ===== REMOVE FAVORITE =====
    function removeFavorite(item, type) {
        var normalizedType = normalizeType(type);
        var list = state[normalizedType];
        if (!list) return false;

        var itemId = getItemId(item, type);
        if (!itemId) return false;

        for (var i = 0; i < list.length; i++) {
            var favId = getItemId(list[i], type);
            if (favId === itemId) {
                list.splice(i, 1);
                saveFavorites();
                return true;
            }
        }
        return false;
    }

    // ===== TOGGLE FAVORITE =====
    function toggleFavorite(item, type) {
        if (isFavorite(item, type)) {
            removeFavorite(item, type);
            return false;  // Now NOT a favorite
        } else {
            addFavorite(item, type);
            return true;   // Now IS a favorite
        }
    }

    // ===== GET FAVORITES =====
    function getFavorites(type) {
        var normalizedType = normalizeType(type);
        return state[normalizedType] || [];
    }

    // ===== GET FAVORITES ROW =====
    function getFavoritesRow(type) {
        var normalizedType = normalizeType(type);
        var favorites = state[normalizedType];

        if (!favorites || favorites.length === 0) {
            return null;
        }

        return {
            id: 'favorites-' + normalizedType,
            title: '★ Favorites (' + favorites.length + ')',
            channels: favorites,
            isFavoritesRow: true,
            isPaginatedRow: false
        };
    }

    // ===== CLEAR FAVORITES =====
    function clearFavorites(type) {
        if (type) {
            var normalizedType = normalizeType(type);
            state[normalizedType] = [];
        } else {
            // Clear all
            state.channels = [];
            state.movies = [];
            state.series = [];
        }
        saveFavorites();
    }

    // ===== HELPER =====
    function normalizeType(type) {
        if (type === 'livetv') return 'channels';
        if (type === 'channel') return 'channels';
        if (type === 'movie') return 'movies';
        if (type === 'serie') return 'series';
        return type;
    }

    // ===== GET COUNT =====
    function getCount(type) {
        if (type) {
            var normalizedType = normalizeType(type);
            return state[normalizedType] ? state[normalizedType].length : 0;
        }
        return state.channels.length + state.movies.length + state.series.length;
    }

    // ===== SET STORAGE KEY (for Profile System) =====
    function setStorageKey(newKey) {
        CONFIG.STORAGE_KEY = newKey;
        loadFavorites(); // Reload with new key
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        isFavorite: isFavorite,
        addFavorite: addFavorite,
        removeFavorite: removeFavorite,
        toggleFavorite: toggleFavorite,
        getFavorites: getFavorites,
        getFavoritesRow: getFavoritesRow,
        clearFavorites: clearFavorites,
        getCount: getCount,
        setStorageKey: setStorageKey
    };
})();
