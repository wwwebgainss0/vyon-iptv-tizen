/**
 * Watchlist - "Watch Later" Feature
 * Save movies/series to watch later (separate from favorites)
 * ES3 Compatible - WebOS 3.x optimized
 */

window.Watchlist = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_watchlist',
        MAX_ITEMS: 100
    };

    // ===== STATE =====
    var state = {
        items: []  // Array of watchlist items
    };

    // ===== INITIALIZATION =====
    function init() {
        loadWatchlist();
    }

    // ===== STORAGE =====
    function loadWatchlist() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                state.items = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[Watchlist] Failed to load:', e);
            state.items = [];
        }
    }

    function saveWatchlist() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.items));
        } catch (e) {
            console.error('[Watchlist] Failed to save:', e);
        }
    }

    // ===== WATCHLIST MANAGEMENT =====

    /**
     * Add item to watchlist
     * @param {object} item - Movie or series data
     * @param {string} type - 'movie' or 'series'
     */
    function addItem(item, type) {
        if (!item) return false;

        var id = item.stream_id || item.series_id || item.id;
        if (!id) return false;

        // Check if already exists
        if (hasItem(id, type)) {
            console.log('[Watchlist] Item already in watchlist');
            return false;
        }

        // Check max limit
        if (state.items.length >= CONFIG.MAX_ITEMS) {
            // Remove oldest item
            state.items.shift();
        }

        var watchlistItem = {
            id: id,
            type: type,
            name: item.name || item.title || 'Unknown',
            cover: item.stream_icon || item.cover || '',
            containerExtension: item.container_extension || '',
            categoryId: item.category_id || '',
            rating: item.rating || '',
            year: item.year || item.releaseDate || '',
            addedAt: Date.now()
        };

        state.items.push(watchlistItem);
        saveWatchlist();

        console.log('[Watchlist] Added:', watchlistItem.name);
        return true;
    }

    /**
     * Remove item from watchlist
     * @param {string} id - Item ID
     * @param {string} type - 'movie' or 'series'
     */
    function removeItem(id, type) {
        for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].id === id && state.items[i].type === type) {
                var removed = state.items.splice(i, 1)[0];
                saveWatchlist();
                console.log('[Watchlist] Removed:', removed.name);
                return true;
            }
        }
        return false;
    }

    /**
     * Toggle item in watchlist
     * @param {object} item - Movie or series data
     * @param {string} type - 'movie' or 'series'
     * @returns {boolean} - true if added, false if removed
     */
    function toggleItem(item, type) {
        var id = item.stream_id || item.series_id || item.id;
        if (hasItem(id, type)) {
            removeItem(id, type);
            return false; // Removed
        } else {
            addItem(item, type);
            return true; // Added
        }
    }

    /**
     * Check if item is in watchlist
     * @param {string} id - Item ID
     * @param {string} type - 'movie' or 'series'
     */
    function hasItem(id, type) {
        for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].id === id && state.items[i].type === type) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all watchlist items
     * @param {string} type - Optional filter by type ('movie' or 'series')
     */
    function getItems(type) {
        if (!type) {
            return state.items.slice();
        }

        var filtered = [];
        for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].type === type) {
                filtered.push(state.items[i]);
            }
        }
        return filtered;
    }

    /**
     * Get watchlist items formatted for SlotRenderer
     * Returns items grouped for display
     */
    function getWatchlistRow() {
        if (state.items.length === 0) return null;

        // Sort by addedAt (newest first)
        var sorted = state.items.slice().sort(function(a, b) {
            return b.addedAt - a.addedAt;
        });

        return {
            title: 'Meine Liste',
            items: sorted.map(function(item) {
                return {
                    stream_id: item.id,
                    series_id: item.type === 'series' ? item.id : null,
                    name: item.name,
                    stream_icon: item.cover,
                    cover: item.cover,
                    container_extension: item.containerExtension,
                    category_id: item.categoryId,
                    rating: item.rating,
                    _type: item.type,  // Custom field to identify type
                    _watchlist: true   // Custom field to identify watchlist items
                };
            })
        };
    }

    /**
     * Get count of watchlist items
     */
    function getCount() {
        return state.items.length;
    }

    /**
     * Get count by type
     */
    function getCountByType(type) {
        var count = 0;
        for (var i = 0; i < state.items.length; i++) {
            if (state.items[i].type === type) {
                count++;
            }
        }
        return count;
    }

    /**
     * Clear entire watchlist
     */
    function clear() {
        state.items = [];
        saveWatchlist();
    }

    /**
     * Set storage key (for Profile System)
     */
    function setStorageKey(newKey) {
        CONFIG.STORAGE_KEY = newKey;
        loadWatchlist(); // Reload with new key
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        addItem: addItem,
        removeItem: removeItem,
        toggleItem: toggleItem,
        hasItem: hasItem,
        getItems: getItems,
        getWatchlistRow: getWatchlistRow,
        getCount: getCount,
        getCountByType: getCountByType,
        clear: clear,
        setStorageKey: setStorageKey
    };
})();
