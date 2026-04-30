/**
 * Search History Module
 * Tracks and displays recent searches
 * ES3 Compatible for WebOS 3.x
 */

window.SearchHistory = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        MAX_HISTORY: 10,
        STORAGE_KEY: 'ultra_iptv_search_history'
    };

    // ===== STATE =====
    var state = {
        history: [],
        isEnabled: true
    };

    // ===== INITIALIZATION =====
    function init() {
        load();
        return true;
    }

    function load() {
        try {
            var saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                var data = JSON.parse(saved);
                state.history = data.history || [];
                state.isEnabled = data.isEnabled !== false;
            }
        } catch (e) {
            console.warn('[SearchHistory] Failed to load:', e);
            state.history = [];
        }
    }

    function save() {
        try {
            var data = {
                history: state.history,
                isEnabled: state.isEnabled
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('[SearchHistory] Failed to save:', e);
        }
    }

    // ===== HISTORY MANAGEMENT =====
    function addSearch(query, screenType) {
        if (!state.isEnabled) return;
        if (!query || query.length < 2) return;

        query = query.trim();

        // Create history entry
        var entry = {
            query: query,
            screenType: screenType || 'all',
            timestamp: Date.now()
        };

        // Remove duplicate if exists
        for (var i = 0; i < state.history.length; i++) {
            if (state.history[i].query.toLowerCase() === query.toLowerCase()) {
                state.history.splice(i, 1);
                break;
            }
        }

        // Add to front
        state.history.unshift(entry);

        // Limit size
        if (state.history.length > CONFIG.MAX_HISTORY) {
            state.history = state.history.slice(0, CONFIG.MAX_HISTORY);
        }

        save();
    }

    function removeSearch(index) {
        if (index >= 0 && index < state.history.length) {
            state.history.splice(index, 1);
            save();
            return true;
        }
        return false;
    }

    function clearHistory() {
        state.history = [];
        save();
    }

    function getHistory() {
        return state.history.slice(); // Return copy
    }

    function getRecentSearches(count) {
        count = count || 5;
        return state.history.slice(0, count);
    }

    // ===== UI RENDERING =====
    function renderHistoryList(container, onSelect, onDelete) {
        if (!container) return;

        if (state.history.length === 0) {
            container.innerHTML = '<div class="search-history-empty">Keine Suchverlauf</div>';
            return;
        }

        var html = '<div class="search-history-title">Letzte Suchen</div>';
        html += '<div class="search-history-list">';

        for (var i = 0; i < state.history.length; i++) {
            var entry = state.history[i];
            var timeAgo = formatTimeAgo(entry.timestamp);

            html += '<div class="search-history-item" data-index="' + i + '">';
            html += '<span class="search-history-icon">🔍</span>';
            html += '<span class="search-history-query">' + escapeHtml(entry.query) + '</span>';
            html += '<span class="search-history-meta">' + timeAgo + '</span>';
            html += '<span class="search-history-delete" data-index="' + i + '">✕</span>';
            html += '</div>';
        }

        html += '</div>';
        html += '<div class="search-history-clear" id="search-history-clear">Verlauf löschen</div>';

        container.innerHTML = html;

        // Add click handlers
        var items = container.querySelectorAll('.search-history-item');
        for (var j = 0; j < items.length; j++) {
            (function(item) {
                item.addEventListener('click', function(e) {
                    if (e.target.classList.contains('search-history-delete')) {
                        var idx = parseInt(e.target.getAttribute('data-index'), 10);
                        removeSearch(idx);
                        renderHistoryList(container, onSelect, onDelete);
                        if (onDelete) onDelete(idx);
                    } else {
                        var idx = parseInt(item.getAttribute('data-index'), 10);
                        if (onSelect && state.history[idx]) {
                            onSelect(state.history[idx].query);
                        }
                    }
                });
            })(items[j]);
        }

        // Clear button handler
        var clearBtn = document.getElementById('search-history-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                clearHistory();
                renderHistoryList(container, onSelect, onDelete);
            });
        }
    }

    // ===== KEYBOARD NAVIGATION =====
    function createNavigableList(container, onSelect) {
        if (state.history.length === 0) return null;

        var focusIndex = 0;
        var items = container.querySelectorAll('.search-history-item');
        var clearBtn = container.querySelector('.search-history-clear');

        function updateFocus() {
            // Remove focus from all
            for (var i = 0; i < items.length; i++) {
                items[i].classList.remove('focused');
            }
            if (clearBtn) clearBtn.classList.remove('focused');

            // Add focus
            if (focusIndex < items.length) {
                items[focusIndex].classList.add('focused');
            } else if (clearBtn) {
                clearBtn.classList.add('focused');
            }
        }

        function handleKey(keyCode) {
            var maxIndex = clearBtn ? items.length : items.length - 1;

            switch (keyCode) {
                case 38: // UP
                    focusIndex = Math.max(0, focusIndex - 1);
                    updateFocus();
                    return true;

                case 40: // DOWN
                    focusIndex = Math.min(maxIndex, focusIndex + 1);
                    updateFocus();
                    return true;

                case 13: // OK
                    if (focusIndex < items.length) {
                        var query = state.history[focusIndex].query;
                        if (onSelect) onSelect(query);
                    } else if (clearBtn) {
                        clearHistory();
                    }
                    return true;

                case 406: // BLUE - Delete selected
                    if (focusIndex < items.length) {
                        removeSearch(focusIndex);
                        return true;
                    }
                    break;
            }

            return false;
        }

        updateFocus();

        return {
            handleKey: handleKey,
            getFocusIndex: function() { return focusIndex; },
            refresh: function() {
                items = container.querySelectorAll('.search-history-item');
                if (focusIndex >= items.length) {
                    focusIndex = Math.max(0, items.length - 1);
                }
                updateFocus();
            }
        };
    }

    // ===== UTILITY =====
    function formatTimeAgo(timestamp) {
        var now = Date.now();
        var diff = now - timestamp;

        var minutes = Math.floor(diff / 60000);
        var hours = Math.floor(diff / 3600000);
        var days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Gerade eben';
        if (minutes < 60) return 'vor ' + minutes + ' Min';
        if (hours < 24) return 'vor ' + hours + ' Std';
        if (days < 7) return 'vor ' + days + ' Tag' + (days > 1 ? 'en' : '');
        return 'vor ' + Math.floor(days / 7) + ' Woche' + (days >= 14 ? 'n' : '');
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== SETTINGS =====
    function enable() {
        state.isEnabled = true;
        save();
    }

    function disable() {
        state.isEnabled = false;
        save();
    }

    function isEnabled() {
        return state.isEnabled;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        add: addSearch,
        remove: removeSearch,
        clear: clearHistory,
        getHistory: getHistory,
        getRecent: getRecentSearches,
        render: renderHistoryList,
        createNavigable: createNavigableList,
        enable: enable,
        disable: disable,
        isEnabled: isEnabled
    };
})();
