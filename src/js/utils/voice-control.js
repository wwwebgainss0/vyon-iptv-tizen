/**
 * Voice Control - Sprachsteuerung
 * Sprachbefehle via Magic Remote Mikrofon
 * Nutzt WebOS Luna API für Voice Recognition
 * ES3 Compatible - WebOS 3.x optimized
 */

window.VoiceControl = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        ENABLED_KEY: 'ultra_iptv_voice_enabled',
        LUNA_SERVICE: 'luna://com.webos.service.ai.voice'
    };

    // ===== VOICE COMMAND KEYWORDS =====
    // German + English keywords
    var KEYWORDS = {
        // Play channel
        play: ['spiele', 'play', 'starte', 'start', 'zeige', 'show', 'kanal', 'channel'],
        // Search
        search: ['suche', 'search', 'finde', 'find', 'such'],
        // Pause/Resume
        pause: ['pause', 'stopp', 'stop', 'halt', 'anhalten'],
        resume: ['weiter', 'continue', 'resume', 'fortsetzen', 'abspielen'],
        // Navigation
        next: ['nächster', 'next', 'weiter', 'vorwärts', 'forward'],
        previous: ['vorheriger', 'previous', 'zurück', 'back', 'rückwärts'],
        // Volume
        volumeUp: ['lauter', 'louder', 'volume up', 'lautstärke hoch'],
        volumeDown: ['leiser', 'quieter', 'volume down', 'lautstärke runter'],
        mute: ['stumm', 'mute', 'ton aus'],
        // EPG
        epg: ['programm', 'program', 'guide', 'epg', 'tv guide'],
        // Favorites
        favorites: ['favoriten', 'favorites', 'lieblings'],
        // Settings
        settings: ['einstellungen', 'settings', 'optionen', 'options'],
        // Quick Switch
        swap: ['wechsel', 'switch', 'swap', 'umschalten'],
        // Live
        live: ['live', 'direkt']
    };

    // ===== STATE =====
    var state = {
        enabled: true,
        active: false,          // Currently listening
        supported: false,       // Voice API available
        subscription: null      // Luna subscription
    };

    // ===== CACHED DOM =====
    var cache = {
        indicator: null,
        textDisplay: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadSettings();
        checkSupport();
        createUI();

        console.log('[VoiceControl] Initialized, supported:', state.supported, 'enabled:', state.enabled);
    }

    function loadSettings() {
        try {
            var enabled = localStorage.getItem(CONFIG.ENABLED_KEY);
            state.enabled = enabled !== 'false';  // Default true
        } catch (e) {
            state.enabled = true;
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(CONFIG.ENABLED_KEY, state.enabled ? 'true' : 'false');
        } catch (e) {}
    }

    // ===== SUPPORT CHECK =====
    function checkSupport() {
        // Voice service rides on the webOS Luna IPC channel; on Tizen / browser
        // there is no SmartTV-mic equivalent for IPTV apps, so support stays false.
        state.supported = !!(window.Platform && window.Platform.canUseLunaService && window.Platform.canUseLunaService());

        // Additional check for voice-specific service
        if (state.supported) {
            // Try to ping the voice service
            window.Platform.requestLunaService(CONFIG.LUNA_SERVICE, {
                method: 'getState',
                parameters: {},
                onSuccess: function() {
                    state.supported = true;
                    console.log('[VoiceControl] Voice service available');
                },
                onFailure: function() {
                    // Service might not be available on all devices
                    state.supported = false;
                    console.log('[VoiceControl] Voice service not available');
                }
            });
        }
    }

    // ===== UI =====
    function createUI() {
        if (document.getElementById('voice-indicator')) return;

        var indicator = document.createElement('div');
        indicator.id = 'voice-indicator';
        indicator.className = 'voice-indicator';
        indicator.style.display = 'none';

        var t = window.i18n ? window.i18n.t : function(k) { return k; };

        indicator.innerHTML =
            '<div class="voice-mic">🎤</div>' +
            '<div class="voice-text" id="voice-text">' + t('voice.listening') + '</div>' +
            '<div class="voice-hint">' + t('voice.hint') + '</div>';

        document.body.appendChild(indicator);

        cache.indicator = indicator;
        cache.textDisplay = document.getElementById('voice-text');
    }

    // ===== START/STOP LISTENING =====
    function start() {
        if (!state.enabled || !state.supported) {
            console.log('[VoiceControl] Cannot start - not enabled or not supported');
            return false;
        }

        if (state.active) {
            console.log('[VoiceControl] Already listening');
            return true;
        }

        state.active = true;
        showIndicator();

        // Subscribe to voice recognition. Platform.requestLunaService preserves
        // the subscription handle on webOS and routes throws to onFailure for us.
        state.subscription = window.Platform.requestLunaService(CONFIG.LUNA_SERVICE, {
            method: 'getResponse',
            parameters: {
                subscribe: true
            },
            onSuccess: function(response) {
                if (response.text) {
                    handleVoiceInput(response.text);
                }
            },
            onFailure: function(error) {
                console.error('[VoiceControl] Voice error:', error);
                stop();
            }
        });

        if (!state.subscription) {
            // Platform reported luna-unsupported (Tizen / browser); state.active
            // already flipped, hide UI and bail out.
            console.error('[VoiceControl] Failed to start: luna-unsupported');
            state.active = false;
            hideIndicator();
            return false;
        }

        console.log('[VoiceControl] Started listening');
        return true;
    }

    function stop() {
        if (!state.active) return;

        state.active = false;
        hideIndicator();

        // Cancel subscription
        if (state.subscription) {
            try {
                state.subscription.cancel();
            } catch (e) {}
            state.subscription = null;
        }

        console.log('[VoiceControl] Stopped listening');
    }

    // ===== VOICE INPUT HANDLING =====
    function handleVoiceInput(text) {
        if (!text) return;

        var normalized = text.toLowerCase().trim();
        console.log('[VoiceControl] Received:', normalized);

        // Update UI with recognized text
        if (cache.textDisplay) {
            cache.textDisplay.textContent = '"' + text + '"';
        }

        // Parse and execute command
        var executed = parseAndExecute(normalized);

        if (executed) {
            // Brief pause then hide indicator
            setTimeout(function() {
                hideIndicator();
            }, 1500);
        } else {
            // Show not understood message
            showNotUnderstood();
        }
    }

    function parseAndExecute(text) {
        // Check each command category
        for (var cmd in KEYWORDS) {
            if (KEYWORDS.hasOwnProperty(cmd)) {
                var keywords = KEYWORDS[cmd];
                for (var i = 0; i < keywords.length; i++) {
                    if (text.indexOf(keywords[i]) !== -1) {
                        // Extract parameter (text after keyword)
                        var param = extractParameter(text, keywords[i]);
                        return executeCommand(cmd, param);
                    }
                }
            }
        }
        return false;
    }

    function extractParameter(text, keyword) {
        var idx = text.indexOf(keyword);
        if (idx === -1) return '';
        return text.substring(idx + keyword.length).trim();
    }

    // ===== COMMAND EXECUTION =====
    function executeCommand(command, param) {
        console.log('[VoiceControl] Executing:', command, 'param:', param);

        switch (command) {
            case 'play':
                return playChannel(param);

            case 'search':
                return openSearch(param);

            case 'pause':
                return pausePlayback();

            case 'resume':
                return resumePlayback();

            case 'next':
                return nextChannel();

            case 'previous':
                return previousChannel();

            case 'volumeUp':
                return adjustVolume(true);

            case 'volumeDown':
                return adjustVolume(false);

            case 'mute':
                return toggleMute();

            case 'epg':
                return openEPG();

            case 'favorites':
                return openFavorites();

            case 'settings':
                return openSettings();

            case 'swap':
                return quickSwitch();

            case 'live':
                return goLive();

            default:
                return false;
        }
    }

    // ===== COMMAND IMPLEMENTATIONS =====
    function playChannel(name) {
        if (!name) return false;

        // Search for channel by name
        if (window.ChannelManager && window.ChannelManager.searchByName) {
            var results = window.ChannelManager.searchByName(name);
            if (results && results.length > 0) {
                var channel = results[0];
                if (window.PlayerComponent) {
                    window.PlayerComponent.play(channel.stream_id, channel.name, 'live');
                    showSuccess(channel.name);
                    return true;
                }
            }
        }

        showNotFound(name);
        return false;
    }

    function openSearch(query) {
        if (window.SearchOverlay) {
            window.SearchOverlay.show();
            if (query && window.SearchOverlay.setQuery) {
                window.SearchOverlay.setQuery(query);
            }
            return true;
        }
        return false;
    }

    function pausePlayback() {
        if (window.PlayerComponent && window.PlayerComponent.pauseVideo) {
            window.PlayerComponent.pauseVideo();
            return true;
        }
        return false;
    }

    function resumePlayback() {
        if (window.PlayerComponent && window.PlayerComponent.resumeVideo) {
            window.PlayerComponent.resumeVideo();
            return true;
        }
        return false;
    }

    function nextChannel() {
        if (window.ChannelManager && window.ChannelManager.playNext) {
            window.ChannelManager.playNext();
            return true;
        }
        return false;
    }

    function previousChannel() {
        if (window.ChannelManager && window.ChannelManager.playPrevious) {
            window.ChannelManager.playPrevious();
            return true;
        }
        return false;
    }

    function adjustVolume(up) {
        // Use WebOS volume control via the Platform Luna abstraction
        if (window.Platform && window.Platform.canUseLunaService && window.Platform.canUseLunaService()) {
            var method = up ? 'volumeUp' : 'volumeDown';
            window.Platform.requestLunaService('luna://com.webos.audio', {
                method: method,
                parameters: {},
                onSuccess: function() {},
                onFailure: function() {}
            });
            return true;
        }
        return false;
    }

    function toggleMute() {
        if (window.Platform && window.Platform.canUseLunaService && window.Platform.canUseLunaService()) {
            window.Platform.requestLunaService('luna://com.webos.audio', {
                method: 'setMuted',
                parameters: { muted: true },
                onSuccess: function() {},
                onFailure: function() {}
            });
            return true;
        }
        return false;
    }

    function openEPG() {
        if (window.EPGGrid && window.EPGGrid.show) {
            window.EPGGrid.show();
            return true;
        }
        return false;
    }

    function openFavorites() {
        if (window.ScreenManager && window.ScreenManager.navigateTo) {
            window.ScreenManager.navigateTo('favorites');
            return true;
        }
        return false;
    }

    function openSettings() {
        if (window.SettingsScreen && window.SettingsScreen.show) {
            window.SettingsScreen.show();
            return true;
        }
        return false;
    }

    function quickSwitch() {
        if (window.QuickSwitch && window.QuickSwitch.swap) {
            return window.QuickSwitch.swap();
        }
        return false;
    }

    function goLive() {
        if (window.TimeshiftManager && window.TimeshiftManager.goLive) {
            return window.TimeshiftManager.goLive();
        }
        return false;
    }

    // ===== UI FEEDBACK =====
    function showIndicator() {
        if (cache.indicator) {
            cache.indicator.style.display = 'flex';
            cache.indicator.className = 'voice-indicator active';
        }
    }

    function hideIndicator() {
        if (cache.indicator) {
            cache.indicator.style.display = 'none';
            cache.indicator.className = 'voice-indicator';
        }
    }

    function showSuccess(text) {
        if (cache.textDisplay) {
            cache.textDisplay.textContent = '✓ ' + text;
        }
    }

    function showNotFound(query) {
        var t = window.i18n ? window.i18n.t : function(k) { return k; };
        if (cache.textDisplay) {
            cache.textDisplay.textContent = t('voice.notFound') + ': "' + query + '"';
        }
    }

    function showNotUnderstood() {
        var t = window.i18n ? window.i18n.t : function(k) { return k; };
        if (cache.textDisplay) {
            cache.textDisplay.textContent = t('voice.notUnderstood');
        }
        setTimeout(hideIndicator, 2000);
    }

    // ===== SETTINGS =====
    function setEnabled(enabled) {
        state.enabled = enabled;
        saveSettings();

        if (!enabled && state.active) {
            stop();
        }
    }

    function isEnabled() {
        return state.enabled;
    }

    function isSupported() {
        return state.supported;
    }

    function isActive() {
        return state.active;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        start: start,
        stop: stop,
        toggle: function() { state.active ? stop() : start(); },
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        isSupported: isSupported,
        isActive: isActive,
        // For direct command testing
        executeCommand: executeCommand,
        // Debug
        getState: function() { return state; },
        getKeywords: function() { return KEYWORDS; }
    };
})();
