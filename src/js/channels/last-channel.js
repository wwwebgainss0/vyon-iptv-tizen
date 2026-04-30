/**
 * Last Channel Manager v1.0
 * Saves and restores last watched live TV channel
 * ES3 Compatible - WebOS 3.x
 */

window.LastChannel = (function() {
    'use strict';

    var STORAGE_KEY = 'jam_iptv_last_channel';

    // Save last channel to localStorage
    function save(streamId, channelName) {
        if (!streamId) return false;

        try {
            var data = JSON.stringify({
                stream_id: streamId,
                name: channelName || 'Unknown',
                timestamp: Date.now()
            });
            localStorage.setItem(STORAGE_KEY, data);
            return true;
        } catch (e) {
            console.error('[LastChannel] Error saving:', e);
            return false;
        }
    }

    // Load last channel from localStorage
    function load() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('[LastChannel] Error loading:', e);
        }
        return null;
    }

    // Clear saved channel
    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('[LastChannel] Error clearing:', e);
        }
    }

    // Check if there's a saved channel
    function hasSavedChannel() {
        return load() !== null;
    }

    // Public API
    return {
        save: save,
        load: load,
        clear: clear,
        hasSavedChannel: hasSavedChannel
    };
})();
