/**
 * Channel Health Monitor
 * Zeigt Grün/Gelb/Rot Badge an Kanälen basierend auf Stream-Status
 * ES3 Compatible - WebOS 3.x optimized
 */

window.ChannelHealth = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        CHECK_INTERVAL: 60000,      // Check every 60s
        TIMEOUT: 5000,              // 5s timeout for health check
        CACHE_TTL: 120000,          // Cache results for 2 minutes
        MAX_CONCURRENT: 3,          // Max concurrent checks
        BATCH_SIZE: 6,              // Check 6 channels per batch (visible)
        ENABLED_KEY: 'ultra_iptv_health_enabled'
    };

    // Status values
    var STATUS = {
        UNKNOWN: 'unknown',
        ONLINE: 'online',
        DEGRADED: 'degraded',
        OFFLINE: 'offline'
    };

    // ===== STATE =====
    var state = {
        enabled: true,
        checking: 0,                // Current concurrent checks
        queue: []                   // Queue of streamIds to check
    };

    // ===== CACHE =====
    // Object to store health status: { streamId: { status, timestamp, responseTime } }
    var cache = {};

    // ===== INITIALIZATION =====
    function init() {
        loadSettings();
        console.log('[ChannelHealth] Initialized, enabled:', state.enabled);
    }

    function loadSettings() {
        try {
            var enabled = localStorage.getItem(CONFIG.ENABLED_KEY);
            state.enabled = enabled !== 'false';  // Default true
        } catch (e) {
            state.enabled = true;
        }
    }

    // ===== HEALTH CHECK =====
    function checkHealth(streamId, streamUrl, callback) {
        if (!state.enabled || !streamId || !streamUrl) {
            if (callback) callback(STATUS.UNKNOWN);
            return;
        }

        // Check cache first
        var cached = cache[streamId];
        if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_TTL) {
            if (callback) callback(cached.status);
            return;
        }

        // Check if already checking
        if (state.checking >= CONFIG.MAX_CONCURRENT) {
            // Add to queue
            state.queue.push({
                streamId: streamId,
                streamUrl: streamUrl,
                callback: callback
            });
            return;
        }

        performCheck(streamId, streamUrl, callback);
    }

    function performCheck(streamId, streamUrl, callback) {
        state.checking++;

        var startTime = Date.now();
        var xhr = new XMLHttpRequest();
        var completed = false;

        // Timeout handler
        var timeoutId = setTimeout(function() {
            if (!completed) {
                completed = true;
                xhr.abort();
                updateCache(streamId, STATUS.OFFLINE, -1);
                if (callback) callback(STATUS.OFFLINE);
                onCheckComplete();
            }
        }, CONFIG.TIMEOUT);

        xhr.onreadystatechange = function() {
            if (completed) return;

            if (xhr.readyState === 4) {
                completed = true;
                clearTimeout(timeoutId);

                var responseTime = Date.now() - startTime;
                var status;

                if (xhr.status >= 200 && xhr.status < 400) {
                    // Good response - check response time for degraded
                    if (responseTime < 2000) {
                        status = STATUS.ONLINE;
                    } else {
                        status = STATUS.DEGRADED;
                    }
                } else if (xhr.status === 0) {
                    // Network error or CORS (might still be available)
                    status = STATUS.UNKNOWN;
                } else {
                    status = STATUS.OFFLINE;
                }

                updateCache(streamId, status, responseTime);
                if (callback) callback(status);
                onCheckComplete();
            }
        };

        xhr.onerror = function() {
            if (!completed) {
                completed = true;
                clearTimeout(timeoutId);
                // CORS errors are common - treat as unknown, not offline
                updateCache(streamId, STATUS.UNKNOWN, -1);
                if (callback) callback(STATUS.UNKNOWN);
                onCheckComplete();
            }
        };

        try {
            // Use HEAD request for minimal data transfer
            xhr.open('HEAD', streamUrl, true);
            xhr.send();
        } catch (e) {
            if (!completed) {
                completed = true;
                clearTimeout(timeoutId);
                updateCache(streamId, STATUS.UNKNOWN, -1);
                if (callback) callback(STATUS.UNKNOWN);
                onCheckComplete();
            }
        }
    }

    function onCheckComplete() {
        state.checking--;

        // Process queue
        if (state.queue.length > 0 && state.checking < CONFIG.MAX_CONCURRENT) {
            var next = state.queue.shift();
            performCheck(next.streamId, next.streamUrl, next.callback);
        }
    }

    function updateCache(streamId, status, responseTime) {
        cache[streamId] = {
            status: status,
            timestamp: Date.now(),
            responseTime: responseTime
        };
    }

    // ===== STATUS RETRIEVAL =====
    function getStatus(streamId) {
        var cached = cache[streamId];
        if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_TTL) {
            return cached.status;
        }
        return STATUS.UNKNOWN;
    }

    function getStatusClass(streamId) {
        var status = getStatus(streamId);
        switch (status) {
            case STATUS.ONLINE:
                return 'health-online';
            case STATUS.DEGRADED:
                return 'health-degraded';
            case STATUS.OFFLINE:
                return 'health-offline';
            default:
                return 'health-unknown';
        }
    }

    function getStatusIcon(streamId) {
        var status = getStatus(streamId);
        switch (status) {
            case STATUS.ONLINE:
                return '●';  // Green dot
            case STATUS.DEGRADED:
                return '●';  // Yellow dot
            case STATUS.OFFLINE:
                return '●';  // Red dot
            default:
                return '';   // No icon for unknown
        }
    }

    // ===== BATCH CHECK =====
    // Check health for visible channels (call from SlotRenderer)
    function checkVisibleChannels(channels) {
        if (!state.enabled || !channels || !channels.length) return;

        var count = Math.min(channels.length, CONFIG.BATCH_SIZE);

        for (var i = 0; i < count; i++) {
            var channel = channels[i];
            if (channel && channel.stream_id) {
                // Build stream URL
                var streamUrl = buildStreamUrl(channel.stream_id);
                if (streamUrl) {
                    checkHealth(channel.stream_id, streamUrl, function(status) {
                        // Update badge when check completes
                        updateBadge(channel.stream_id, status);
                    });
                }
            }
        }
    }

    function buildStreamUrl(streamId) {
        // Get API config from XtreamAPI if available
        if (window.XtreamAPI && window.XtreamAPI.getConfig) {
            var config = window.XtreamAPI.getConfig();
            if (config && config.server) {
                return config.server + '/live/' + config.username + '/' + config.password + '/' + streamId + '.m3u8';
            }
        }
        return null;
    }

    // ===== BADGE UPDATE =====
    function updateBadge(streamId, status) {
        // Find all cards with this stream ID and update badge
        var cards = document.querySelectorAll('[data-stream-id="' + streamId + '"]');
        for (var i = 0; i < cards.length; i++) {
            var badge = cards[i].querySelector('.health-badge');
            if (badge) {
                badge.className = 'health-badge ' + getStatusClass(streamId);
                badge.textContent = getStatusIcon(streamId);
            }
        }
    }

    // ===== CREATE BADGE HTML =====
    // Call this when rendering cards
    function createBadgeHTML() {
        if (!state.enabled) return '';
        return '<span class="health-badge health-unknown"></span>';
    }

    // ===== SETTINGS =====
    function setEnabled(enabled) {
        state.enabled = enabled;
        try {
            localStorage.setItem(CONFIG.ENABLED_KEY, enabled ? 'true' : 'false');
        } catch (e) {}

        // Hide all badges if disabled
        if (!enabled) {
            var badges = document.querySelectorAll('.health-badge');
            for (var i = 0; i < badges.length; i++) {
                badges[i].style.display = 'none';
            }
        } else {
            var badges2 = document.querySelectorAll('.health-badge');
            for (var j = 0; j < badges2.length; j++) {
                badges2[j].style.display = '';
            }
        }
    }

    function isEnabled() {
        return state.enabled;
    }

    // ===== CLEAR CACHE =====
    function clearCache() {
        cache = {};
        state.queue = [];
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        check: checkHealth,
        checkVisibleChannels: checkVisibleChannels,
        getStatus: getStatus,
        getStatusClass: getStatusClass,
        getStatusIcon: getStatusIcon,
        createBadgeHTML: createBadgeHTML,
        updateBadge: updateBadge,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        clearCache: clearCache,
        // Constants
        STATUS: STATUS,
        // Debug
        getCache: function() { return cache; },
        getState: function() { return state; }
    };
})();
