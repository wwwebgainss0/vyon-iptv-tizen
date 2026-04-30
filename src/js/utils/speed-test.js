/**
 * Speed Test Module - IPTV Server Connection Test
 * Beautiful animated speedtest for Settings
 * ES3 Compatible - WebOS 3.x optimized
 */

window.SpeedTest = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        // Test file sizes (bytes)
        PING_TIMEOUT: 5000,
        DOWNLOAD_TIMEOUT: 15000,
        TEST_DURATION: 8000,        // 8 seconds download test
        UPDATE_INTERVAL: 100,       // Update UI every 100ms
        // Speed thresholds (Mbps)
        SPEED_EXCELLENT: 25,
        SPEED_GOOD: 10,
        SPEED_FAIR: 5,
        SPEED_POOR: 2
    };

    // ===== STATE =====
    var state = {
        isRunning: false,
        phase: 'idle',  // idle, ping, download, complete
        ping: 0,
        downloadSpeed: 0,
        peakSpeed: 0,
        progress: 0,
        startTime: 0,
        bytesLoaded: 0,
        lastBytesLoaded: 0,
        lastTime: 0,
        samples: [],
        updateTimer: null,
        currentXhr: null,
        onUpdate: null,
        onComplete: null
    };

    // ===== INITIALIZATION =====
    function init() {
        console.log('[SpeedTest] Initialized');
        return true;
    }

    // ===== GET IPTV SERVER URL =====
    function getServerUrl() {
        if (window.XtreamAPI && window.XtreamAPI.getConfig) {
            var config = window.XtreamAPI.getConfig();
            if (config && config.server) {
                return config.server;
            }
        }
        return null;
    }

    // ===== PING TEST =====
    function testPing(callback) {
        var serverUrl = getServerUrl();
        if (!serverUrl) {
            callback('Server nicht konfiguriert', 0);
            return;
        }

        state.phase = 'ping';
        updateUI();

        var startTime = Date.now();
        var pingUrl = serverUrl + '/player_api.php?action=ping&t=' + startTime;

        var xhr = new XMLHttpRequest();
        xhr.open('HEAD', serverUrl, true);
        xhr.timeout = CONFIG.PING_TIMEOUT;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                var endTime = Date.now();
                var ping = endTime - startTime;

                if (xhr.status === 200 || xhr.status === 0) {
                    // Some servers return 0 for HEAD, still valid
                    state.ping = ping;
                    callback(null, ping);
                } else {
                    // Try alternate method
                    testPingAlternate(callback);
                }
            }
        };

        xhr.onerror = function() {
            testPingAlternate(callback);
        };

        xhr.ontimeout = function() {
            callback('Timeout', 9999);
        };

        xhr.send();
    }

    function testPingAlternate(callback) {
        var serverUrl = getServerUrl();
        var startTime = Date.now();

        // Use GET with minimal response
        var config = window.XtreamAPI ? window.XtreamAPI.getConfig() : null;
        if (!config) {
            callback('Keine Konfiguration', 0);
            return;
        }

        var url = serverUrl + '/player_api.php?username=' + config.username +
                  '&password=' + config.password + '&action=get_live_categories';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = CONFIG.PING_TIMEOUT;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 2) {  // Headers received = fastest response
                var ping = Date.now() - startTime;
                state.ping = ping;
                callback(null, ping);
                xhr.abort();
            }
        };

        xhr.onerror = function() {
            callback('Verbindungsfehler', 0);
        };

        xhr.ontimeout = function() {
            callback('Timeout', 9999);
        };

        xhr.send();
    }

    // ===== DOWNLOAD SPEED TEST =====
    function testDownload(callback) {
        var serverUrl = getServerUrl();
        if (!serverUrl) {
            callback('Server nicht konfiguriert', 0);
            return;
        }

        state.phase = 'download';
        state.bytesLoaded = 0;
        state.lastBytesLoaded = 0;
        state.samples = [];
        state.peakSpeed = 0;
        state.startTime = Date.now();
        state.lastTime = state.startTime;

        updateUI();

        // Get a live stream URL to test with (uses actual IPTV bandwidth)
        var config = window.XtreamAPI ? window.XtreamAPI.getConfig() : null;
        if (!config) {
            callback('Keine Konfiguration', 0);
            return;
        }

        // Use the xmltv.php which returns larger data
        var testUrl = serverUrl + '/xmltv.php?username=' + config.username +
                      '&password=' + config.password + '&t=' + Date.now();

        var xhr = new XMLHttpRequest();
        state.currentXhr = xhr;

        xhr.open('GET', testUrl, true);
        xhr.timeout = CONFIG.DOWNLOAD_TIMEOUT;
        xhr.responseType = 'arraybuffer';

        // Track progress
        xhr.onprogress = function(e) {
            if (e.lengthComputable || e.loaded > 0) {
                state.bytesLoaded = e.loaded;
                calculateSpeed();
            }
        };

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                stopSpeedCalculation();

                if (state.downloadSpeed > 0) {
                    callback(null, state.downloadSpeed);
                } else {
                    // Fallback: calculate from total
                    var totalTime = (Date.now() - state.startTime) / 1000;
                    var totalBytes = state.bytesLoaded;
                    if (totalTime > 0 && totalBytes > 0) {
                        var speed = (totalBytes * 8 / totalTime) / 1000000;
                        state.downloadSpeed = speed;
                        callback(null, speed);
                    } else {
                        callback('Keine Daten', 0);
                    }
                }
            }
        };

        xhr.onerror = function() {
            stopSpeedCalculation();
            callback('Download fehlgeschlagen', 0);
        };

        xhr.ontimeout = function() {
            stopSpeedCalculation();
            // Still calculate with data we have
            if (state.downloadSpeed > 0) {
                callback(null, state.downloadSpeed);
            } else {
                callback('Timeout', 0);
            }
        };

        xhr.send();

        // Start speed calculation timer
        state.updateTimer = setInterval(function() {
            calculateSpeed();
            updateUI();

            // Stop after TEST_DURATION
            if (Date.now() - state.startTime > CONFIG.TEST_DURATION) {
                if (state.currentXhr) {
                    state.currentXhr.abort();
                }
            }
        }, CONFIG.UPDATE_INTERVAL);
    }

    function calculateSpeed() {
        var now = Date.now();
        var timeDelta = (now - state.lastTime) / 1000;

        if (timeDelta < 0.1) return;  // Min 100ms between samples

        var bytesDelta = state.bytesLoaded - state.lastBytesLoaded;

        if (bytesDelta > 0 && timeDelta > 0) {
            var bitsPerSecond = (bytesDelta * 8) / timeDelta;
            var mbps = bitsPerSecond / 1000000;

            // Add sample
            state.samples.push(mbps);
            if (state.samples.length > 20) {
                state.samples.shift();
            }

            // Calculate average (ignore outliers)
            var sortedSamples = state.samples.slice().sort(function(a, b) { return a - b; });
            var trimCount = Math.floor(sortedSamples.length * 0.1);
            var trimmedSamples = sortedSamples.slice(trimCount, sortedSamples.length - trimCount);

            if (trimmedSamples.length > 0) {
                var sum = 0;
                for (var i = 0; i < trimmedSamples.length; i++) {
                    sum += trimmedSamples[i];
                }
                state.downloadSpeed = sum / trimmedSamples.length;
            }

            // Track peak
            if (mbps > state.peakSpeed) {
                state.peakSpeed = mbps;
            }
        }

        state.lastBytesLoaded = state.bytesLoaded;
        state.lastTime = now;

        // Update progress (0-100)
        var elapsed = now - state.startTime;
        state.progress = Math.min(100, (elapsed / CONFIG.TEST_DURATION) * 100);
    }

    function stopSpeedCalculation() {
        if (state.updateTimer) {
            clearInterval(state.updateTimer);
            state.updateTimer = null;
        }
    }

    // ===== RUN FULL TEST =====
    function runTest(onUpdate, onComplete) {
        if (state.isRunning) {
            console.log('[SpeedTest] Already running');
            return false;
        }

        state.isRunning = true;
        state.phase = 'idle';
        state.ping = 0;
        state.downloadSpeed = 0;
        state.peakSpeed = 0;
        state.progress = 0;
        state.onUpdate = onUpdate;
        state.onComplete = onComplete;

        console.log('[SpeedTest] Starting test...');

        // Phase 1: Ping
        testPing(function(err, ping) {
            if (!state.isRunning) return;  // Cancelled

            if (err) {
                console.log('[SpeedTest] Ping error:', err);
            } else {
                console.log('[SpeedTest] Ping:', ping, 'ms');
            }

            // Phase 2: Download
            testDownload(function(err, speed) {
                if (!state.isRunning) return;  // Cancelled

                state.phase = 'complete';
                state.isRunning = false;
                state.progress = 100;

                if (err) {
                    console.log('[SpeedTest] Download error:', err);
                } else {
                    console.log('[SpeedTest] Speed:', speed.toFixed(2), 'Mbps');
                }

                updateUI();

                if (state.onComplete) {
                    state.onComplete(getResults());
                }
            });
        });

        return true;
    }

    // ===== CANCEL TEST =====
    function cancel() {
        state.isRunning = false;
        state.phase = 'idle';

        if (state.currentXhr) {
            state.currentXhr.abort();
            state.currentXhr = null;
        }

        stopSpeedCalculation();
    }

    // ===== UPDATE UI =====
    function updateUI() {
        if (state.onUpdate) {
            state.onUpdate(getResults());
        }
    }

    // ===== GET RESULTS =====
    function getResults() {
        return {
            phase: state.phase,
            isRunning: state.isRunning,
            ping: state.ping,
            downloadSpeed: state.downloadSpeed,
            peakSpeed: state.peakSpeed,
            progress: state.progress,
            rating: getSpeedRating(state.downloadSpeed),
            recommendation: getRecommendation(state.downloadSpeed)
        };
    }

    function getSpeedRating(speed) {
        if (speed >= CONFIG.SPEED_EXCELLENT) return 'excellent';
        if (speed >= CONFIG.SPEED_GOOD) return 'good';
        if (speed >= CONFIG.SPEED_FAIR) return 'fair';
        if (speed >= CONFIG.SPEED_POOR) return 'poor';
        return 'very-poor';
    }

    function getRecommendation(speed) {
        if (speed >= CONFIG.SPEED_EXCELLENT) {
            return { quality: '4K Ultra HD', icon: '4K', color: '#4CAF50' };
        }
        if (speed >= CONFIG.SPEED_GOOD) {
            return { quality: 'Full HD 1080p', icon: 'FHD', color: '#8BC34A' };
        }
        if (speed >= CONFIG.SPEED_FAIR) {
            return { quality: 'HD 720p', icon: 'HD', color: '#FFC107' };
        }
        if (speed >= CONFIG.SPEED_POOR) {
            return { quality: 'SD 480p', icon: 'SD', color: '#FF9800' };
        }
        return { quality: 'Niedrige Qualitaet', icon: 'LQ', color: '#f44336' };
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        run: runTest,
        cancel: cancel,
        isRunning: function() { return state.isRunning; },
        getResults: getResults
    };
})();
