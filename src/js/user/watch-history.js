/**
 * Watch History Manager v1.0
 * LocalStorage-based Continue Watching functionality
 * ES3 Compatible - WebOS 3.x
 */

window.WatchHistory = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'jam_iptv_watch_history',
        MAX_HISTORY_ITEMS: 20,
        MIN_WATCH_PERCENT: 5,
        MAX_WATCH_PERCENT: 95,
        SAVE_INTERVAL: 10000,
        CONTINUE_WATCHING_ROW_ID: 'continue_watching_row'
    };

    // ===== STATE =====
    var state = {
        history: {},
        saveTimer: null,
        isEnabled: true
    };

    // ===== INITIALIZATION =====
    function initialize() {
        loadFromStorage();
        return true;
    }

    // ===== LOCALSTORAGE OPERATIONS =====
    function loadFromStorage() {
        try {
            var data = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (data) {
                state.history = JSON.parse(data);
            } else {
                state.history = {};
            }
        } catch (e) {
            console.error('[WatchHistory] Error loading from storage:', e);
            state.history = {};
        }
    }

    function saveToStorage() {
        try {
            var data = JSON.stringify(state.history);
            localStorage.setItem(CONFIG.STORAGE_KEY, data);
        } catch (e) {
            console.error('[WatchHistory] Error saving to storage:', e);
        }
    }

    // ===== WATCH PROGRESS TRACKING =====
    function updateProgress(streamId, movieName, currentPosition, duration, containerExtension) {
        if (!state.isEnabled || !streamId || !duration) {
            return;
        }

        var watchPercent = (currentPosition / duration) * 100;

        if (watchPercent < CONFIG.MIN_WATCH_PERCENT) {
            return;
        }

        if (watchPercent > CONFIG.MAX_WATCH_PERCENT) {
            removeFromHistory(streamId);
            return;
        }

        state.history[streamId] = {
            stream_id: streamId,
            name: movieName || 'Unknown Movie',
            position: currentPosition,
            duration: duration,
            watchPercent: Math.floor(watchPercent),
            timestamp: Date.now(),
            container_extension: containerExtension || 'mp4',
            stream_icon: state.history[streamId] ? state.history[streamId].stream_icon : ''
        };

        cleanupOldEntries();
        saveToStorage();
    }

    // ===== START/STOP TRACKING =====
    function startTracking(streamId, movieName, duration, containerExtension, iconUrl) {
        if (state.history[streamId]) {
            state.history[streamId].stream_icon = iconUrl || '';
        } else {
            state.history[streamId] = {
                stream_id: streamId,
                name: movieName,
                position: 0,
                duration: duration,
                watchPercent: 0,
                timestamp: Date.now(),
                container_extension: containerExtension,
                stream_icon: iconUrl || ''
            };
        }
    }

    function stopTracking() {
        if (state.saveTimer) {
            clearInterval(state.saveTimer);
            state.saveTimer = null;
        }
    }

    // ===== CLEANUP =====
    function cleanupOldEntries() {
        var entries = [];
        for (var streamId in state.history) {
            if (state.history.hasOwnProperty(streamId)) {
                entries.push(state.history[streamId]);
            }
        }

        entries.sort(function(a, b) {
            return b.timestamp - a.timestamp;
        });

        if (entries.length > CONFIG.MAX_HISTORY_ITEMS) {
            var newHistory = {};
            for (var i = 0; i < CONFIG.MAX_HISTORY_ITEMS; i++) {
                var entry = entries[i];
                newHistory[entry.stream_id] = entry;
            }
            state.history = newHistory;
        }
    }

    function removeFromHistory(streamId) {
        if (state.history[streamId]) {
            delete state.history[streamId];
            saveToStorage();
        }
    }

    // ===== GET CONTINUE WATCHING ROW =====
    function getContinueWatchingRow() {
        var entries = [];
        for (var streamId in state.history) {
            if (state.history.hasOwnProperty(streamId)) {
                entries.push(state.history[streamId]);
            }
        }

        entries.sort(function(a, b) {
            return b.timestamp - a.timestamp;
        });

        var topEntries = entries.slice(0, 30);

        if (topEntries.length === 0) {
            return null;
        }

        return {
            id: CONFIG.CONTINUE_WATCHING_ROW_ID,
            title: 'Weiter schauen (' + topEntries.length + ')',
            channels: topEntries,
            isPaginatedRow: false,
            isContinueWatching: true
        };
    }

    // ===== GET RESUME POSITION =====
    function getResumePosition(streamId) {
        var entry = state.history[streamId];
        if (entry && entry.position) {
            return entry.position;
        }
        return 0;
    }

    // ===== UTILITIES =====
    function getHistoryCount() {
        var count = 0;
        for (var streamId in state.history) {
            if (state.history.hasOwnProperty(streamId)) {
                count++;
            }
        }
        return count;
    }

    function clearAll() {
        state.history = {};
        saveToStorage();
    }

    function enable() {
        state.isEnabled = true;
    }

    function disable() {
        state.isEnabled = false;
        stopTracking();
    }

    function getStats() {
        return {
            enabled: state.isEnabled,
            totalItems: getHistoryCount(),
            storageKey: CONFIG.STORAGE_KEY
        };
    }

    function debugPrintHistory() {
        for (var streamId in state.history) {
            if (state.history.hasOwnProperty(streamId)) {
                var entry = state.history[streamId];
                console.log('[WatchHistory]', entry.name, ':', entry.watchPercent + '%');
            }
        }
    }

    // ===== SET STORAGE KEY (for Profile System) =====
    function setStorageKey(newKey) {
        CONFIG.STORAGE_KEY = newKey;
        loadFromStorage(); // Reload with new key
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        updateProgress: updateProgress,
        startTracking: startTracking,
        stopTracking: stopTracking,
        getContinueWatchingRow: getContinueWatchingRow,
        getResumePosition: getResumePosition,
        removeFromHistory: removeFromHistory,
        clearAll: clearAll,
        enable: enable,
        disable: disable,
        getStats: getStats,
        debugPrintHistory: debugPrintHistory,
        setStorageKey: setStorageKey,
        CONFIG: CONFIG
    };
})();
