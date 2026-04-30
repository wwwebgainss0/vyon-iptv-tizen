/**
 * Network Speed Display Module
 * Shows download/buffering speed during playback
 * ES3 Compatible for WebOS 3.x
 */

window.NetworkSpeed = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        UPDATE_INTERVAL: 2000,
        SAMPLE_SIZE: 10,
        STORAGE_KEY: 'ultra_iptv_network_speed_enabled'
    };

    // ===== STATE =====
    var state = {
        isEnabled: true,
        isVisible: false,
        currentSpeed: 0,
        samples: [],
        bytesLoaded: 0,
        lastBytesLoaded: 0,
        lastTime: 0,
        updateTimer: null
    };

    // ===== DOM CACHE =====
    var cache = {
        indicator: null,
        speedText: null,
        icon: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadSettings();
        createIndicator();
        return true;
    }

    function loadSettings() {
        try {
            var saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved !== null) {
                state.isEnabled = saved === 'true';
            }
        } catch (e) {
            console.warn('[NetworkSpeed] Failed to load settings');
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, String(state.isEnabled));
        } catch (e) {
            console.warn('[NetworkSpeed] Failed to save settings');
        }
    }

    function createIndicator() {
        var indicator = document.createElement('div');
        indicator.id = 'network-speed-indicator';
        indicator.className = 'network-speed-indicator';
        indicator.style.display = 'none';
        indicator.innerHTML = '<span class="network-speed-icon">↓</span>' +
                             '<span class="network-speed-text" id="network-speed-text">-- Mbps</span>';
        document.body.appendChild(indicator);

        cache.indicator = indicator;
        cache.speedText = document.getElementById('network-speed-text');
        cache.icon = indicator.querySelector('.network-speed-icon');
    }

    // ===== SPEED CALCULATION =====
    function updateSpeed() {
        var video = document.querySelector('video');
        if (!video) {
            setSpeed(0);
            return;
        }

        var now = Date.now();
        var timeDelta = (now - state.lastTime) / 1000; // seconds

        if (timeDelta < 0.5) return; // Min 0.5s between updates

        // Try to get buffered bytes
        var currentBytes = 0;

        // Method 1: Use video.buffered
        if (video.buffered && video.buffered.length > 0) {
            var bufferedEnd = video.buffered.end(video.buffered.length - 1);
            var duration = video.duration || 1;
            // Estimate bytes based on buffer position (rough estimate)
            currentBytes = Math.floor((bufferedEnd / duration) * estimateFileSize(video));
        }

        // Method 2: Use webkitVideoDecodedByteCount (if available)
        if (video.webkitVideoDecodedByteCount) {
            currentBytes = video.webkitVideoDecodedByteCount + (video.webkitAudioDecodedByteCount || 0);
        }

        // Calculate speed
        var bytesDelta = currentBytes - state.lastBytesLoaded;
        if (bytesDelta > 0 && timeDelta > 0) {
            var bitsPerSecond = (bytesDelta * 8) / timeDelta;
            var mbps = bitsPerSecond / 1000000;

            // Add to samples for averaging
            state.samples.push(mbps);
            if (state.samples.length > CONFIG.SAMPLE_SIZE) {
                state.samples.shift();
            }

            // Calculate average
            var sum = 0;
            for (var i = 0; i < state.samples.length; i++) {
                sum += state.samples[i];
            }
            var avgSpeed = sum / state.samples.length;

            setSpeed(avgSpeed);
        }

        state.lastBytesLoaded = currentBytes;
        state.lastTime = now;
    }

    function estimateFileSize(video) {
        // Rough estimate: 5 Mbps * duration for HD video
        var duration = video.duration || 3600; // Default 1 hour
        var estimatedBitrate = 5000000; // 5 Mbps
        return (duration * estimatedBitrate) / 8;
    }

    function setSpeed(mbps) {
        state.currentSpeed = mbps;

        if (cache.speedText) {
            if (mbps > 0) {
                cache.speedText.textContent = mbps.toFixed(1) + ' Mbps';

                // Update icon color based on speed
                if (cache.icon) {
                    if (mbps > 10) {
                        cache.icon.className = 'network-speed-icon speed-excellent';
                    } else if (mbps > 5) {
                        cache.icon.className = 'network-speed-icon speed-good';
                    } else if (mbps > 2) {
                        cache.icon.className = 'network-speed-icon speed-fair';
                    } else {
                        cache.icon.className = 'network-speed-icon speed-poor';
                    }
                }
            } else {
                cache.speedText.textContent = '-- Mbps';
                if (cache.icon) {
                    cache.icon.className = 'network-speed-icon';
                }
            }
        }
    }

    // ===== PUBLIC API =====
    function show() {
        if (!state.isEnabled) return;

        state.isVisible = true;
        state.samples = [];
        state.lastBytesLoaded = 0;
        state.lastTime = Date.now();

        if (cache.indicator) {
            cache.indicator.style.display = 'flex';
        }

        // Start update timer
        if (state.updateTimer) {
            clearInterval(state.updateTimer);
        }
        state.updateTimer = setInterval(updateSpeed, CONFIG.UPDATE_INTERVAL);
    }

    function hide() {
        state.isVisible = false;

        if (cache.indicator) {
            cache.indicator.style.display = 'none';
        }

        // Stop update timer
        if (state.updateTimer) {
            clearInterval(state.updateTimer);
            state.updateTimer = null;
        }

        setSpeed(0);
    }

    function enable() {
        state.isEnabled = true;
        saveSettings();
    }

    function disable() {
        state.isEnabled = false;
        saveSettings();
        hide();
    }

    function toggle() {
        if (state.isEnabled) {
            disable();
        } else {
            enable();
        }
        return state.isEnabled;
    }

    function isEnabled() {
        return state.isEnabled;
    }

    function getSpeed() {
        return state.currentSpeed;
    }

    // ===== RETURN PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        enable: enable,
        disable: disable,
        toggle: toggle,
        isEnabled: isEnabled,
        getSpeed: getSpeed
    };
})();
