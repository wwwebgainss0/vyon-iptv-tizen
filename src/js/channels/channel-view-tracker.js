/**
 * Channel View Tracker - Track how often channels are watched
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Creates a "Most Watched" row based on view counts
 */

window.ChannelViewTracker = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_channel_views',
        MAX_TRACKED: 200,
        TOP_CHANNELS_COUNT: 20
    };

    // ===== STATE =====
    var state = {
        viewCounts: {}  // { streamId: { count: N, channel: {...}, lastViewed: timestamp } }
    };

    // ===== INITIALIZATION =====
    function initialize() {
        loadFromStorage();
        return true;
    }

    function loadFromStorage() {
        try {
            var data = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (data) {
                state.viewCounts = JSON.parse(data);
            } else {
                state.viewCounts = {};
            }
        } catch (e) {
            state.viewCounts = {};
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.viewCounts));
        } catch (e) {
            // Silent fail
        }
    }

    // ===== TRACK VIEW =====
    function trackView(channel) {
        if (!channel) return;

        var streamId = channel.stream_id || channel.id || channel.num;
        if (!streamId) return;

        if (!state.viewCounts[streamId]) {
            state.viewCounts[streamId] = {
                count: 0,
                channel: channel,
                lastViewed: 0
            };
        }

        state.viewCounts[streamId].count++;
        state.viewCounts[streamId].lastViewed = Date.now();
        state.viewCounts[streamId].channel = channel;  // Update channel data

        cleanupOldEntries();
        saveToStorage();
    }

    // ===== GET VIEW COUNT =====
    function getViewCount(channel) {
        if (!channel) return 0;

        var streamId = channel.stream_id || channel.id || channel.num;
        if (!streamId) return 0;

        var entry = state.viewCounts[streamId];
        return entry ? entry.count : 0;
    }

    // ===== GET MOST WATCHED ROW =====
    function getMostWatchedRow() {
        var entries = [];

        for (var streamId in state.viewCounts) {
            if (state.viewCounts.hasOwnProperty(streamId)) {
                var entry = state.viewCounts[streamId];
                if (entry.count > 0 && entry.channel) {
                    entries.push({
                        channel: entry.channel,
                        count: entry.count,
                        lastViewed: entry.lastViewed
                    });
                }
            }
        }

        if (entries.length === 0) {
            return null;
        }

        // Sort by view count (descending), then by last viewed (descending)
        entries.sort(function(a, b) {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return b.lastViewed - a.lastViewed;
        });

        // Get top channels
        var topChannels = [];
        var limit = Math.min(entries.length, CONFIG.TOP_CHANNELS_COUNT);
        for (var i = 0; i < limit; i++) {
            var ch = entries[i].channel;
            // Add view count to channel for display
            ch._viewCount = entries[i].count;
            topChannels.push(ch);
        }

        return {
            id: 'most-watched-row',
            title: '★ Most Watched (' + topChannels.length + ')',
            channels: topChannels,
            isMostWatchedRow: true,
            isPaginatedRow: false
        };
    }

    // ===== CLEANUP =====
    function cleanupOldEntries() {
        var entries = [];

        for (var streamId in state.viewCounts) {
            if (state.viewCounts.hasOwnProperty(streamId)) {
                entries.push({
                    streamId: streamId,
                    data: state.viewCounts[streamId]
                });
            }
        }

        if (entries.length <= CONFIG.MAX_TRACKED) {
            return;
        }

        // Sort by count (keep highest)
        entries.sort(function(a, b) {
            return b.data.count - a.data.count;
        });

        // Keep only top entries
        var newViewCounts = {};
        for (var i = 0; i < CONFIG.MAX_TRACKED; i++) {
            var entry = entries[i];
            newViewCounts[entry.streamId] = entry.data;
        }

        state.viewCounts = newViewCounts;
    }

    // ===== CLEAR ALL =====
    function clearAll() {
        state.viewCounts = {};
        saveToStorage();
    }

    // ===== GET COUNT =====
    function getTotalCount() {
        var count = 0;
        for (var streamId in state.viewCounts) {
            if (state.viewCounts.hasOwnProperty(streamId)) {
                count++;
            }
        }
        return count;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        trackView: trackView,
        getViewCount: getViewCount,
        getMostWatchedRow: getMostWatchedRow,
        clearAll: clearAll,
        getTotalCount: getTotalCount
    };
})();
