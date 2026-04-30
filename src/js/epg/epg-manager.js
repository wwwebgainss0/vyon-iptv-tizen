/**
 * EPG Manager - Efficient EPG data fetching and caching
 * WebOS 3.x Compatible (ES3)
 */

window.EPGManager = (function() {
    'use strict';
    
    // EPG Cache with expiry
    var cache = {
        short: {},  // Short EPG data (current + next)
        full: {},   // Full EPG data (all day)
        timestamps: {} // Cache timestamps
    };
    
    var CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
    var pendingRequests = {}; // Prevent duplicate requests

    // Base64 decode function (ES3 compatible)
    function decodeBase64(str) {
        if (!str) return str;
        try {
            // Use atob if available
            if (typeof atob === 'function') {
                // Handle UTF-8 encoded strings
                var decoded = atob(str);
                // Try to decode UTF-8
                try {
                    return decodeURIComponent(escape(decoded));
                } catch (e) {
                    return decoded;
                }
            }
            return str;
        } catch (e) {
            // If decoding fails, return original string
            return str;
        }
    }
    
    // Get config from main app
    function getConfig() {
        if (window.IPTVApp && window.IPTVApp.getConfig) {
            return window.IPTVApp.getConfig();
        }
        return { server: '', username: '', password: '' };
    }
    
    // Check if cache is still valid
    function isCacheValid(streamId, type) {
        var timestamp = cache.timestamps[type + '_' + streamId];
        if (!timestamp) return false;
        
        var now = new Date().getTime();
        return (now - timestamp) < CACHE_DURATION;
    }
    
    // Get short EPG (current + next program)
    function getShortEPG(streamId, callback) {
        var cfg = getConfig();
        if (!cfg.server) {
            if (callback) callback(null);
            return;
        }
        var cacheKey = 'short_' + streamId;

        // Return cached data if valid
        if (isCacheValid(streamId, 'short') && cache.short[streamId]) {
            callback(null, cache.short[streamId]);
            return;
        }

        // Check if request is already pending
        if (pendingRequests[cacheKey]) {
            // Add callback to pending queue
            pendingRequests[cacheKey].push(callback);
            return;
        }

        // Start new request
        pendingRequests[cacheKey] = [callback];

        var config = cfg;
        var url = config.server + '/player_api.php?username=' + config.username + 
                  '&password=' + config.password + 
                  '&action=get_short_epg&stream_id=' + streamId + '&limit=2';
        
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 5000; // 5 second timeout
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            
            var callbacks = pendingRequests[cacheKey];
            delete pendingRequests[cacheKey];
            
            if (xhr.status === 200) {
                try {
                    var response = xhr.responseText;
                    
                    // Handle leading 'k' character
                    if (response && response.charAt(0) === 'k') {
                        response = response.substring(1);
                    }
                    
                    var data = JSON.parse(response);
                    
                    // Process EPG data
                    var processed = processShortEPG(data, streamId);
                    
                    // Cache the data
                    cache.short[streamId] = processed;
                    cache.timestamps[cacheKey] = new Date().getTime();
                    
                    // Call all waiting callbacks
                    for (var i = 0; i < callbacks.length; i++) {
                        callbacks[i](null, processed);
                    }
                } catch (e) {
                    // Error parsing
                    for (var i = 0; i < callbacks.length; i++) {
                        callbacks[i]('Parse error: ' + e.message, null);
                    }
                }
            } else {
                // Request failed
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i]('Request failed: ' + xhr.status, null);
                }
            }
        };
        
        xhr.onerror = function() {
            var callbacks = pendingRequests[cacheKey];
            delete pendingRequests[cacheKey];
            
            for (var i = 0; i < callbacks.length; i++) {
                callbacks[i]('Network error', null);
            }
        };
        
        xhr.send();
    }
    
    // Process short EPG data
    function processShortEPG(data, streamId) {
        var result = {
            current: null,
            next: null,
            hasEPG: false
        };
        
        // Check if data is directly an array (short EPG format)
        // Use Object.prototype.toString for ES3 compatibility
        var epgData = null;
        var isArray = Object.prototype.toString.call(data) === '[object Array]';
        if (data && isArray) {
            epgData = data;
        } else if (data && data.epg_listings) {
            epgData = data.epg_listings;
        } else {
            return result;
        }
        var now = new Date().getTime() / 1000; // Current time in seconds
        
        // Find current and next programs
        for (var i = 0; i < epgData.length; i++) {
            var program = epgData[i];
            
            // Parse times
            var startTime = parseInt(program.start_timestamp) || parseDateTime(program.start);
            var endTime = parseInt(program.stop_timestamp) || parseDateTime(program.stop);
            
            if (startTime && endTime) {
                if (startTime <= now && endTime > now) {
                    // Current program
                    // Handle different title formats from API
                    var title = 'Unbekannt';
                    if (program.title) {
                        if (typeof program.title === 'string') {
                            title = program.title;
                        } else if (typeof program.title === 'object' && program.title !== null) {
                            // Try different object properties
                            if (program.title.en) title = program.title.en;
                            else if (program.title.de) title = program.title.de;
                            else if (program.title.value) title = program.title.value;
                            else if (program.title.text) title = program.title.text;
                            else if (program.title.name) title = program.title.name;
                            else if (program.title[0]) title = program.title[0]; // Could be array
                        }
                    }
                    // Also check alternative field names
                    if (title === 'Unbekannt' && program.programme_title) {
                        title = program.programme_title;
                    }
                    if (title === 'Unbekannt' && program.epg_title) {
                        title = program.epg_title;
                    }
                    
                    result.current = {
                        title: decodeBase64(String(title)), // Decode Base64
                        description: decodeBase64(program.description || ''),
                        start: startTime,
                        end: endTime,
                        progress: calculateProgress(startTime, endTime, now)
                    };
                    result.hasEPG = true;
                } else if (startTime > now && !result.next) {
                    // Next program
                    // Handle different title formats from API
                    var nextTitle = 'Unbekannt';
                    if (program.title) {
                        if (typeof program.title === 'string') {
                            nextTitle = program.title;
                        } else if (typeof program.title === 'object' && program.title !== null) {
                            // Try different object properties
                            if (program.title.en) nextTitle = program.title.en;
                            else if (program.title.de) nextTitle = program.title.de;
                            else if (program.title.value) nextTitle = program.title.value;
                            else if (program.title.text) nextTitle = program.title.text;
                            else if (program.title.name) nextTitle = program.title.name;
                            else if (program.title[0]) nextTitle = program.title[0]; // Could be array
                        }
                    }
                    // Also check alternative field names
                    if (nextTitle === 'Unbekannt' && program.programme_title) {
                        nextTitle = program.programme_title;
                    }
                    if (nextTitle === 'Unbekannt' && program.epg_title) {
                        nextTitle = program.epg_title;
                    }
                    
                    result.next = {
                        title: decodeBase64(String(nextTitle)), // Decode Base64
                        description: decodeBase64(program.description || ''),
                        start: startTime,
                        end: endTime
                    };
                }
            }
        }
        
        return result;
    }
    
    // Parse date/time string to timestamp
    function parseDateTime(dateStr) {
        if (!dateStr) return null;
        
        // Format: "2024-01-20 14:30:00"
        var parts = dateStr.split(' ');
        if (parts.length !== 2) return null;
        
        var dateParts = parts[0].split('-');
        var timeParts = parts[1].split(':');
        
        if (dateParts.length !== 3 || timeParts.length !== 3) return null;
        
        var date = new Date(
            parseInt(dateParts[0]), // Year
            parseInt(dateParts[1]) - 1, // Month (0-indexed)
            parseInt(dateParts[2]), // Day
            parseInt(timeParts[0]), // Hours
            parseInt(timeParts[1]), // Minutes
            parseInt(timeParts[2])  // Seconds
        );
        
        return date.getTime() / 1000; // Return timestamp in seconds
    }
    
    // Calculate progress percentage
    function calculateProgress(start, end, current) {
        var total = end - start;
        var elapsed = current - start;
        
        if (total <= 0) return 0;
        
        var progress = (elapsed / total) * 100;
        return Math.min(100, Math.max(0, progress));
    }
    
    // Format time for display
    function formatTime(timestamp) {
        var date = new Date(timestamp * 1000);
        var hours = date.getHours();
        var minutes = date.getMinutes();
        
        // Add leading zeros
        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        
        return hours + ':' + minutes;
    }
    
    // Get full EPG for more info (lazy loaded)
    function getFullEPG(streamId, callback) {
        var cfg = getConfig();
        if (!cfg.server) {
            if (callback) callback(null);
            return;
        }
        var cacheKey = 'full_' + streamId;

        // Return cached data if valid
        if (isCacheValid(streamId, 'full') && cache.full[streamId]) {
            callback(null, cache.full[streamId]);
            return;
        }

        // Check if request is already pending
        if (pendingRequests[cacheKey]) {
            pendingRequests[cacheKey].push(callback);
            return;
        }

        // Start new request
        pendingRequests[cacheKey] = [callback];

        var config = cfg;
        var url = config.server + '/player_api.php?username=' + config.username +
                  '&password=' + config.password +
                  '&action=get_simple_data_table&stream_id=' + streamId;

        console.log('[EPGManager] Fetching full EPG from:', url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 10000; // 10 second timeout for full data
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            
            var callbacks = pendingRequests[cacheKey];
            delete pendingRequests[cacheKey];
            
            if (xhr.status === 200) {
                try {
                    var response = xhr.responseText;
                    console.log('[EPGManager] Response length:', response ? response.length : 0);

                    // Handle leading 'k' character
                    if (response && response.charAt(0) === 'k') {
                        response = response.substring(1);
                    }

                    var data = JSON.parse(response);
                    console.log('[EPGManager] Parsed data keys:', data ? Object.keys(data) : 'null');

                    // Process full EPG data
                    var processed = processFullEPG(data);
                    console.log('[EPGManager] Processed programs:', processed.programs.length);
                    
                    // Cache the data
                    cache.full[streamId] = processed;
                    cache.timestamps[cacheKey] = new Date().getTime();
                    
                    // Call all waiting callbacks
                    for (var i = 0; i < callbacks.length; i++) {
                        callbacks[i](null, processed);
                    }
                } catch (e) {
                    for (var i = 0; i < callbacks.length; i++) {
                        callbacks[i]('Parse error: ' + e.message, null);
                    }
                }
            } else {
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i]('Request failed: ' + xhr.status, null);
                }
            }
        };
        
        xhr.onerror = function() {
            var callbacks = pendingRequests[cacheKey];
            delete pendingRequests[cacheKey];
            
            for (var i = 0; i < callbacks.length; i++) {
                callbacks[i]('Network error', null);
            }
        };
        
        xhr.send();
    }
    
    // Process full EPG data
    function processFullEPG(data) {
        var result = {
            programs: [],
            hasEPG: false
        };
        
        if (!data || !data.epg_listings) return result;
        
        var epgData = data.epg_listings;
        
        // Sort by start time and limit to reasonable amount
        epgData.sort(function(a, b) {
            var aStart = parseInt(a.start_timestamp) || 0;
            var bStart = parseInt(b.start_timestamp) || 0;
            return aStart - bStart;
        });
        
        // Process up to 20 programs
        var limit = Math.min(epgData.length, 20);
        for (var i = 0; i < limit; i++) {
            var program = epgData[i];
            
            var startTime = parseInt(program.start_timestamp) || parseDateTime(program.start);
            var endTime = parseInt(program.stop_timestamp) || parseDateTime(program.stop);
            
            if (startTime && endTime) {
                // Handle different title formats from API
                var progTitle = 'Unbekannt';
                if (program.title) {
                    if (typeof program.title === 'string') {
                        progTitle = program.title;
                    } else if (typeof program.title === 'object' && program.title !== null) {
                        // Try different object properties
                        if (program.title.en) progTitle = program.title.en;
                        else if (program.title.de) progTitle = program.title.de;
                        else if (program.title.value) progTitle = program.title.value;
                        else if (program.title.text) progTitle = program.title.text;
                        else if (program.title.name) progTitle = program.title.name;
                        else if (program.title[0]) progTitle = program.title[0]; // Could be array
                    }
                }
                // Also check alternative field names
                if (progTitle === 'Unbekannt' && program.programme_title) {
                    progTitle = program.programme_title;
                }
                if (progTitle === 'Unbekannt' && program.epg_title) {
                    progTitle = program.epg_title;
                }
                
                result.programs.push({
                    title: decodeBase64(String(progTitle)), // Decode Base64
                    description: decodeBase64(program.description || ''),
                    start: startTime,
                    end: endTime,
                    startFormatted: formatTime(startTime),
                    endFormatted: formatTime(endTime)
                });
                result.hasEPG = true;
            }
        }
        
        return result;
    }
    
    // Clear cache for a specific stream or all
    function clearCache(streamId) {
        if (streamId) {
            delete cache.short[streamId];
            delete cache.full[streamId];
            delete cache.timestamps['short_' + streamId];
            delete cache.timestamps['full_' + streamId];
        } else {
            cache.short = {};
            cache.full = {};
            cache.timestamps = {};
        }
    }
    
    // Public API
    return {
        getShortEPG: getShortEPG,
        getFullEPG: getFullEPG,
        clearCache: clearCache,
        formatTime: formatTime
    };
})();