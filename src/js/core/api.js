/**
 * Robust Xtream API Handler for WebOS TV
 * No external libraries - pure JavaScript
 */

window.XtreamAPI = (function() {
    'use strict';

    var config = {
        server: '',
        username: '',
        password: '',
        timeout: 30000,
        retryAttempts: 3,
        debug: false
    };

    function cleanResponse(response) {
        if (!response) return response;

        var ua = navigator.userAgent || '';
        var isWebOSByUA = ua.indexOf('webOS') !== -1 || ua.indexOf('Web0S') !== -1 || ua.indexOf('NetCast') !== -1;
        var isWebOSTV = isWebOSByUA || (typeof window.webOS !== 'undefined');

        if (isWebOSTV) {
            if (response.charAt(0) === 'k' && (response.charAt(1) === '[' || response.charAt(1) === '{')) {
                response = response.substring(1);
            }
            response = response.replace(/^\uFEFF/, '');
            response = response.replace(/[\x00-\x1F\x7F]/g, '');
        } else {
            response = response.replace(/^\uFEFF/, '');
        }

        return response.trim();
    }

    function parseJSON(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            var cleaned = cleanResponse(text);
            try {
                return JSON.parse(cleaned);
            } catch (e2) {
                throw e2;
            }
        }
    }

    function makeRequest(url, callback, retryCount) {
        if (!config.server || !config.username || !config.password) {
            if (callback) callback({ error: 'NOT_CONFIGURED', message: 'API not configured' });
            return;
        }
        retryCount = retryCount || 0;

        var xhr = new XMLHttpRequest();
        var timeoutId;

        timeoutId = setTimeout(function() {
            xhr.abort();
            if (retryCount < config.retryAttempts - 1) {
                makeRequest(url, callback, retryCount + 1);
            } else {
                callback('Timeout after ' + config.retryAttempts + ' attempts', null);
            }
        }, config.timeout);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                clearTimeout(timeoutId);

                if (xhr.status === 200) {
                    try {
                        var data = parseJSON(xhr.responseText);

                        if (typeof data === 'object' && data !== null) {
                            if (data.result && data.result.length !== undefined) {
                                data = data.result;
                            } else if (data.channels && data.channels.length !== undefined) {
                                data = data.channels;
                            } else if (data.categories && data.categories.length !== undefined) {
                                data = data.categories;
                            }
                        }

                        callback(null, data);
                    } catch (e) {
                        if (retryCount < config.retryAttempts - 1) {
                            makeRequestWithHeaders(url, callback, retryCount + 1);
                        } else {
                            callback('Parse error: ' + e.message, null);
                        }
                    }
                } else if (xhr.status === 0) {
                    if (retryCount < config.retryAttempts - 1) {
                        makeRequest(url, callback, retryCount + 1);
                    } else {
                        callback('Network error after ' + config.retryAttempts + ' attempts', null);
                    }
                } else {
                    callback('HTTP ' + xhr.status, null);
                }
            }
        };

        xhr.onerror = function() {
            clearTimeout(timeoutId);
            if (retryCount < config.retryAttempts - 1) {
                makeRequest(url, callback, retryCount + 1);
            } else {
                callback('Network error', null);
            }
        };

        xhr.open('GET', url, true);

        try {
            xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
        } catch (e) {
            // Silent fail
        }

        xhr.send();
    }

    function makeRequestWithHeaders(url, callback, retryCount) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = config.timeout;

        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var data = parseJSON(xhr.responseText);
                    callback(null, data);
                } catch (e) {
                    callback('Parse error: ' + e.message, null);
                }
            } else {
                callback('HTTP ' + xhr.status, null);
            }
        };

        xhr.onerror = function() {
            callback('Network error', null);
        };

        xhr.ontimeout = function() {
            callback('Timeout', null);
        };

        xhr.open('GET', url, true);

        try {
            xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/538.2 (KHTML, like Gecko) Large Screen WebAppManager Safari/538.2');
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        } catch (e) {
            // Silent fail
        }

        xhr.send();
    }

    return {
        setConfig: function(newConfig) {
            for (var key in newConfig) {
                if (newConfig.hasOwnProperty(key)) {
                    config[key] = newConfig[key];
                }
            }
        },

        getServerInfo: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password;
            makeRequest(url, callback);
        },

        getLiveStreams: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_live_streams';
            makeRequest(url, callback);
        },

        getLiveCategories: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_live_categories';
            makeRequest(url, callback);
        },

        getVodStreams: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_vod_streams';
            makeRequest(url, callback);
        },

        getVodCategories: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_vod_categories';
            makeRequest(url, callback);
        },

        getSeries: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_series';
            makeRequest(url, callback);
        },

        getSeriesCategories: function(callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_series_categories';
            makeRequest(url, callback);
        },

        getSeriesInfo: function(seriesId, callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_series_info&series_id=' + seriesId;
            makeRequest(url, callback);
        },

        // Get full movie/VOD info (description, cast, rating, etc.)
        getVodInfo: function(vodId, callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_vod_info&vod_id=' + vodId;
            makeRequest(url, callback);
        },

        // EPG - Short EPG for a specific stream (current/next program)
        getShortEPG: function(streamId, callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_short_epg&stream_id=' + streamId;
            makeRequest(url, callback);
        },

        // EPG - Full EPG for a specific stream (all programs)
        getStreamEPG: function(streamId, callback) {
            var url = config.server + '/player_api.php?username=' + config.username + '&password=' + config.password + '&action=get_simple_data_table&stream_id=' + streamId;
            makeRequest(url, callback);
        },

        // EPG - XMLTV format (full EPG data) - returns XML, not JSON
        getXMLTV: function(callback) {
            var url = config.server + '/xmltv.php?username=' + config.username + '&password=' + config.password;
            // Note: This returns XML, handle differently
            makeRequest(url, callback);
        },

        getStreamUrl: function(streamId, type, extension) {
            type = type || 'live';

            switch(type) {
                case 'live':
                    return config.server + '/' + config.username + '/' + config.password + '/' + streamId;

                case 'movie':
                    var ext = extension || 'mp4';
                    return config.server + '/movie/' + config.username + '/' + config.password + '/' + streamId + '.' + ext;

                case 'series':
                    var ext = extension || 'mp4';
                    return config.server + '/series/' + config.username + '/' + config.password + '/' + streamId + '.' + ext;

                default:
                    return config.server + '/' + config.username + '/' + config.password + '/' + streamId;
            }
        },

        testConnection: function(callback) {
            this.getServerInfo(function(err, data) {
                if (err) {
                    callback(false, err);
                } else {
                    callback(true, data);
                }
            });
        },

        isConfigured: function() {
            // Check if API has valid credentials configured
            return !!(config.server && config.username && config.password);
        },

        getConfig: function() {
            return {
                server: config.server,
                username: config.username,
                password: config.password
            };
        }
    };
})();
