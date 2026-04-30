/**
 * Xtream API - Proxy Version (Secure)
 * ES3 Compatible - WebOS 3.x optimized
 *
 * All API calls go through your server.
 * Xtream credentials are NEVER on the client.
 */

window.XtreamAPI = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        // Your proxy server URL (set via setProxyUrl)
        PROXY_URL: null,
        TIMEOUT: 30000,
        CACHE_TTL: 300000  // 5 minutes
    };

    // ===== STATE =====
    var state = {
        deviceId: null,
        cache: {},
        initialized: false
    };

    // ===== INITIALIZATION =====
    function initialize() {
        // Get device ID
        if (window.LicenseManager && window.LicenseManager.getDeviceId) {
            state.deviceId = window.LicenseManager.getDeviceId();
        } else if (window.ActivationScreen && window.ActivationScreen.getDeviceId) {
            state.deviceId = window.ActivationScreen.getDeviceId();
        } else {
            state.deviceId = localStorage.getItem('ultra_device_id') || 'UNKNOWN';
        }

        state.initialized = true;
        console.log('[XtreamAPI] Initialized with proxy mode, device:', state.deviceId);
    }

    // ===== CACHE HELPERS =====
    function getCached(key) {
        var entry = state.cache[key];
        if (entry && entry.expires > Date.now()) {
            return entry.data;
        }
        return null;
    }

    function setCache(key, data, ttl) {
        state.cache[key] = {
            data: data,
            expires: Date.now() + (ttl || CONFIG.CACHE_TTL)
        };
    }

    // ===== PROXY REQUEST =====
    function proxyRequest(action, params, callback) {
        if (!CONFIG.PROXY_URL) {
            console.error('[XtreamAPI] Proxy URL not configured');
            callback('Proxy not configured', null);
            return;
        }

        if (!state.deviceId) {
            initialize();
        }

        // Build URL
        var url = CONFIG.PROXY_URL + '/proxy/xtream/' + action;

        // Add device ID to params
        params = params || {};
        params.device_id = state.deviceId;

        // Check cache
        var cacheKey = action + '_' + JSON.stringify(params);
        var cached = getCached(cacheKey);
        if (cached) {
            callback(null, cached);
            return;
        }

        // Build query string
        var queryParts = [];
        for (var key in params) {
            if (params.hasOwnProperty(key)) {
                queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
        }
        if (queryParts.length > 0) {
            url += '?' + queryParts.join('&');
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('X-Device-ID', state.deviceId);
        xhr.setRequestHeader('X-App-Version', '11.2.0');
        xhr.timeout = CONFIG.TIMEOUT;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        setCache(cacheKey, data);
                        callback(null, data);
                    } catch (e) {
                        callback('Parse error', null);
                    }
                } else if (xhr.status === 403) {
                    callback('Access denied - check license', null);
                } else {
                    callback('Request failed: ' + xhr.status, null);
                }
            }
        };

        xhr.onerror = function() {
            callback('Network error', null);
        };

        xhr.ontimeout = function() {
            callback('Timeout', null);
        };

        xhr.send();
    }

    // ===== API METHODS =====

    function getLiveCategories(callback) {
        proxyRequest('live_categories', {}, callback);
    }

    function getLiveStreams(callback, categoryId) {
        var params = {};
        if (categoryId) {
            params.category_id = categoryId;
        }
        proxyRequest('live_streams', params, callback);
    }

    function getVodCategories(callback) {
        proxyRequest('vod_categories', {}, callback);
    }

    function getVodStreams(callback, categoryId) {
        var params = {};
        if (categoryId) {
            params.category_id = categoryId;
        }
        proxyRequest('vod_streams', params, callback);
    }

    function getSeriesCategories(callback) {
        proxyRequest('series_categories', {}, callback);
    }

    function getSeries(callback, categoryId) {
        var params = {};
        if (categoryId) {
            params.category_id = categoryId;
        }
        proxyRequest('series', params, callback);
    }

    function getSeriesInfo(seriesId, callback) {
        proxyRequest('series_info', { series_id: seriesId }, callback);
    }

    function getVodInfo(vodId, callback) {
        proxyRequest('vod_info', { vod_id: vodId }, callback);
    }

    function getShortEPG(streamId, callback) {
        proxyRequest('epg', { stream_id: streamId }, callback);
    }

    // ===== STREAM URL (via proxy) =====
    function getStreamUrl(type, streamId, callback) {
        if (!CONFIG.PROXY_URL) {
            callback('Proxy not configured', null);
            return;
        }

        var url = CONFIG.PROXY_URL + '/proxy/stream/' + type + '/' + streamId;
        url += '?device_id=' + encodeURIComponent(state.deviceId);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('X-Device-ID', state.deviceId);
        xhr.timeout = 10000;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        callback(null, data.url);
                    } catch (e) {
                        callback('Parse error', null);
                    }
                } else {
                    callback('Failed: ' + xhr.status, null);
                }
            }
        };

        xhr.onerror = function() {
            callback('Network error', null);
        };

        xhr.send();
    }

    function getLiveStreamUrl(streamId, callback) {
        getStreamUrl('live', streamId, callback);
    }

    function getMovieStreamUrl(vodId, callback) {
        getStreamUrl('movie', vodId, callback);
    }

    function getSeriesStreamUrl(episodeId, callback) {
        getStreamUrl('series', episodeId, callback);
    }

    // ===== DIRECT URL BUILDERS (for player) =====
    // These return the URL directly without async call
    // Use only after getStreamUrl has been called once

    function buildLiveUrl(streamId) {
        // If proxy is configured, we need to get URL from server
        // Return placeholder that will be replaced
        return CONFIG.PROXY_URL + '/proxy/stream/live/' + streamId + '?device_id=' + state.deviceId;
    }

    function buildVodUrl(vodId, extension) {
        return CONFIG.PROXY_URL + '/proxy/stream/movie/' + vodId + '?device_id=' + state.deviceId;
    }

    function buildSeriesUrl(episodeId, extension) {
        return CONFIG.PROXY_URL + '/proxy/stream/series/' + episodeId + '?device_id=' + state.deviceId;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,

        // Configuration
        setProxyUrl: function(url) {
            CONFIG.PROXY_URL = url;
            console.log('[XtreamAPI] Proxy URL set:', url);
        },

        // Categories
        getLiveCategories: getLiveCategories,
        getVodCategories: getVodCategories,
        getSeriesCategories: getSeriesCategories,

        // Streams/Content
        getLiveStreams: getLiveStreams,
        getVodStreams: getVodStreams,
        getSeries: getSeries,

        // Details
        getSeriesInfo: getSeriesInfo,
        getVodInfo: getVodInfo,

        // EPG
        getShortEPG: getShortEPG,
        getStreamEPG: getShortEPG,

        // Stream URLs (async)
        getLiveStreamUrl: getLiveStreamUrl,
        getMovieStreamUrl: getMovieStreamUrl,
        getSeriesStreamUrl: getSeriesStreamUrl,

        // URL Builders (for compatibility)
        buildLiveUrl: buildLiveUrl,
        buildVodUrl: buildVodUrl,
        buildSeriesUrl: buildSeriesUrl,

        // Cache management
        clearCache: function() {
            state.cache = {};
        },

        // Status
        isInitialized: function() {
            return state.initialized;
        }
    };
})();
