/**
 * Settings Screen - Comprehensive IPTV Settings
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Features:
 * - Account Info (Device ID, Subscription Status)
 * - Parental Control (PIN protection)
 * - Video Settings (Quality, Buffer, Autoplay)
 * - App Settings (Start Screen, Language, Cache)
 * - About (Version, Device Info)
 */

window.SettingsScreen = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_settings',
        DEFAULT_PIN: '0000',
        VERSION: '11.1.0'
    };

    // ===== DEFAULT SETTINGS =====
    var DEFAULT_SETTINGS = {
        // Parental Control
        parentalEnabled: false,
        parentalPin: '0000',
        appLockEnabled: false,
        maxRating: 'All',
        blockedCategories: [],

        // Video
        videoQuality: 'auto',  // auto, hd, sd
        bufferSize: 'medium',  // small, medium, large
        autoplayNext: true,

        // App
        startScreen: 'livetv',  // livetv, movies, series
        sleepTimer: '0',        // Off by default
        showChannelNumbers: true,
        confirmExit: true,

        // Data
        saveWatchHistory: true,
        networkSpeedEnabled: true,

        // Market Leader Features (v11.0.0)
        quickAccessEnabled: true,
        channelHealthEnabled: true,
        voiceControlEnabled: true
    };

    // ===== STATE =====
    var state = {
        settings: {},
        isVisible: false,
        currentSection: 0,
        currentOption: 0,
        sections: [],
        isEditing: false,
        pinInput: '',
        showActivation: false  // Show activation instead of settings
    };

    // ===== CACHED DOM =====
    var cache = {
        container: null,
        sectionsContainer: null,
        overlay: null
    };

    // ===== SETTINGS STRUCTURE =====
    var SECTIONS = [
        {
            id: 'account',
            title: 'Account & Device',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
            options: [
                { id: 'deviceId', label: 'Device ID', type: 'display' },
                { id: 'subscriptionStatus', label: 'Subscription Status', type: 'display' },
                { id: 'expiryDate', label: 'Expires', type: 'display' },
                { id: 'reactivate', label: 'Change Account / Reactivate', type: 'action' }
            ]
        },
        {
            id: 'parental',
            title: 'Parental Control',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
            options: [
                { id: 'parentalEnabled', label: 'Enable Parental Control', type: 'toggle' },
                { id: 'appLockEnabled', label: 'App-Lock beim Start', type: 'toggle' },
                { id: 'maxRating', label: 'Max. Altersfreigabe', type: 'select', values: ['All', '6+', '12+', '16+', '18+'], labels: ['Alle', 'FSK 6', 'FSK 12', 'FSK 16', 'FSK 18'] },
                { id: 'changePin', label: 'PIN ändern', type: 'action' },
                { id: 'resetPin', label: 'PIN zurücksetzen (0000)', type: 'action' },
                { id: 'lockLiveTVCategories', label: 'Live TV Kategorien sperren', type: 'action' },
                { id: 'lockMovieCategories', label: 'Film Kategorien sperren', type: 'action' },
                { id: 'lockSeriesCategories', label: 'Serien Kategorien sperren', type: 'action' }
            ]
        },
        {
            id: 'video',
            title: 'Video & Streaming',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8l7 4-7 4V8z"/></svg>',
            options: [
                { id: 'videoQuality', label: 'Video Quality', type: 'select', values: ['auto', 'hd', 'sd'], labels: ['Auto (Recommended)', 'HD Only', 'SD (Save Data)'] },
                { id: 'bufferSize', label: 'Buffer Size', type: 'select', values: ['small', 'medium', 'large'], labels: ['Small (Fast Start)', 'Medium', 'Large (Stable)'] },
                { id: 'autoplayNext', label: 'Autoplay Next Episode', type: 'toggle' }
            ]
        },
        {
            id: 'app',
            title: 'App Settings',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
            options: [
                { id: 'language', label: 'Language / Sprache', type: 'select', values: ['en-US', 'de-DE', 'fr-FR'], labels: ['English', 'Deutsch', 'Français'] },
                { id: 'fontSize', label: 'Schriftgröße', type: 'select', values: ['auto', 'small', 'normal', 'large', 'xlarge', 'xxlarge'], labels: ['Automatisch', 'Klein', 'Normal', 'Groß', 'Sehr Groß', 'Extra Groß'] },
                { id: 'startScreen', label: 'Start Screen', type: 'select', values: ['livetv', 'movies', 'series'], labels: ['Live TV', 'Movies', 'Series'] },
                { id: 'sleepTimer', label: 'Sleep Timer', type: 'select', values: ['0', '30', '60', '90', '120', '180'], labels: ['Aus', '30 Min', '1 Std', '1.5 Std', '2 Std', '3 Std'] },
                { id: 'showChannelNumbers', label: 'Show Channel Numbers', type: 'toggle' },
                { id: 'confirmExit', label: 'Confirm Before Exit', type: 'toggle' },
                { id: 'quickAccessEnabled', label: 'Quick Access Bar', type: 'toggle' },
                { id: 'channelHealthEnabled', label: 'Channel Health Monitor', type: 'toggle' },
                { id: 'voiceControlEnabled', label: 'Voice Control', type: 'toggle' }
            ]
        },
        {
            id: 'data',
            title: 'Data & Storage',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
            options: [
                { id: 'saveWatchHistory', label: 'Save Watch History', type: 'toggle' },
                { id: 'networkSpeedEnabled', label: 'Network Speed Display', type: 'toggle' },
                { id: 'runSpeedTest', label: 'Server Speed Test', type: 'action', description: 'Test IPTV server connection' },
                { id: 'clearHistory', label: 'Clear Watch History', type: 'action' },
                { id: 'clearSearchHistory', label: 'Clear Search History', type: 'action' },
                { id: 'clearFavorites', label: 'Clear All Favorites', type: 'action' },
                { id: 'clearCache', label: 'Clear Image Cache', type: 'action' },
                { id: 'clearAllData', label: 'Reset All Settings', type: 'action' }
            ]
        },
        {
            id: 'about',
            title: 'About',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
            options: [
                { id: 'appVersion', label: 'App Version', type: 'display' },
                { id: 'deviceModel', label: 'Device Model', type: 'display' },
                { id: 'webosVersion', label: 'WebOS Version', type: 'display' },
                { id: 'rateApp', label: 'App bewerten', type: 'action', description: 'Im LG Content Store bewerten' },
                { id: 'support', label: 'Support & Help', type: 'action' }
            ]
        }
    ];

    // ===== INITIALIZATION =====
    function initialize() {
        loadSettings();
        createDOM();
        setupKeyHandler();
        state.sections = SECTIONS;
    }

    function loadSettings() {
        var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (stored) {
            try {
                var parsed = JSON.parse(stored);
                // Merge with defaults
                state.settings = {};
                for (var key in DEFAULT_SETTINGS) {
                    if (DEFAULT_SETTINGS.hasOwnProperty(key)) {
                        state.settings[key] = parsed.hasOwnProperty(key) ? parsed[key] : DEFAULT_SETTINGS[key];
                    }
                }
            } catch (e) {
                state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            }
        } else {
            state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    }

    function saveSettings() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.settings));
    }

    // ===== CREATE DOM =====
    function createDOM() {
        var container = document.createElement('div');
        container.id = 'settings-screen';
        container.className = 'settings-screen';
        container.style.display = 'none';

        var html = '';

        // Header
        html += '<div class="settings-header">';
        html += '  <div class="settings-title">Settings</div>';
        html += '  <div class="settings-hint">Use UP/DOWN to navigate, OK to select, BACK to return</div>';
        html += '</div>';

        // Content wrapper
        html += '<div class="settings-content">';

        // Sidebar (sections)
        html += '<div class="settings-sidebar" id="settings-sidebar"></div>';

        // Main content (options)
        html += '<div class="settings-main" id="settings-main"></div>';

        html += '</div>';

        // Footer
        html += '<div class="settings-footer">';
        html += '  <span>Ultra IPTV v' + CONFIG.VERSION + '</span>';
        html += '  <span id="settings-footer-hint"></span>';
        html += '</div>';

        container.innerHTML = html;
        document.body.appendChild(container);

        cache.container = container;
        cache.sidebar = document.getElementById('settings-sidebar');
        cache.main = document.getElementById('settings-main');
        cache.footerHint = document.getElementById('settings-footer-hint');
    }

    function renderSidebar() {
        var html = '';

        for (var i = 0; i < SECTIONS.length; i++) {
            var section = SECTIONS[i];
            var focusedClass = (i === state.currentSection && !state.isEditing) ? ' focused' : '';
            var activeClass = (i === state.currentSection) ? ' active' : '';

            html += '<div class="settings-section-item' + focusedClass + activeClass + '" data-index="' + i + '">';
            html += '  <span class="settings-section-icon">' + section.icon + '</span>';
            html += '  <span class="settings-section-label">' + section.title + '</span>';
            html += '</div>';
        }

        cache.sidebar.innerHTML = html;
    }

    function renderMain() {
        var section = SECTIONS[state.currentSection];
        var html = '';

        html += '<div class="settings-section-header">';
        html += '  <span class="settings-section-icon-large">' + section.icon + '</span>';
        html += '  <h2>' + section.title + '</h2>';
        html += '</div>';

        html += '<div class="settings-options">';

        for (var i = 0; i < section.options.length; i++) {
            var option = section.options[i];
            var focusedClass = (state.isEditing && i === state.currentOption) ? ' focused' : '';
            var value = getOptionValue(option);
            var displayValue = getDisplayValue(option, value);

            html += '<div class="settings-option' + focusedClass + '" data-index="' + i + '">';
            html += '  <div class="settings-option-label">' + getOptionLabel(option) + '</div>';
            html += '  <div class="settings-option-value">';

            if (option.type === 'toggle') {
                var checkedClass = value ? ' checked' : '';
                html += '<div class="settings-toggle' + checkedClass + '">';
                html += '  <div class="settings-toggle-track"></div>';
                html += '  <div class="settings-toggle-thumb"></div>';
                html += '</div>';
            } else if (option.type === 'select') {
                html += '<span class="settings-select-value">' + displayValue + '</span>';
                html += '<span class="settings-select-arrow">&#9656;</span>';
            } else if (option.type === 'display') {
                html += '<span class="settings-display-value">' + displayValue + '</span>';
            } else if (option.type === 'action') {
                html += '<span class="settings-action-arrow">&#9656;</span>';
            }

            html += '  </div>';
            html += '</div>';
        }

        html += '</div>';

        cache.main.innerHTML = html;
    }

    function getOptionValue(option) {
        switch (option.id) {
            // Display values
            case 'deviceId':
                return window.ActivationScreen ? window.ActivationScreen.getDeviceId() : 'N/A';
            case 'subscriptionStatus':
                return 'Active'; // TODO: Check actual status
            case 'expiryDate':
                return 'N/A'; // TODO: Get from API
            case 'appVersion':
                return 'v' + CONFIG.VERSION;
            case 'deviceModel':
                return getDeviceModel();
            case 'webosVersion':
                return getWebOSVersion();

            // Font size - stored separately by ResponsiveScale
            case 'fontSize':
                return window.ResponsiveScale ? window.ResponsiveScale.getCurrentSetting() : 'auto';

            // Language - stored by i18n
            case 'language':
                return window.i18n ? window.i18n.getCurrentLanguage() : 'en-US';

            // Market Leader Features (v11.0.0)
            case 'quickAccessEnabled':
                return window.QuickAccessBar ? window.QuickAccessBar.isEnabled() : true;
            case 'channelHealthEnabled':
                return window.ChannelHealth ? window.ChannelHealth.isEnabled() : true;
            case 'voiceControlEnabled':
                return window.VoiceControl ? window.VoiceControl.isEnabled() : true;

            // Parental Control (v11.1.0) - Use ParentalControl module
            case 'parentalEnabled':
                return window.ParentalControl ? window.ParentalControl.isEnabled() : false;
            case 'appLockEnabled':
                return state.settings.appLockEnabled || false;
            case 'maxRating':
                return window.ParentalControl ? window.ParentalControl.getMaxRating() : 'All';

            // Network Speed Display (v11.1.0)
            case 'networkSpeedEnabled':
                return window.NetworkSpeed ? window.NetworkSpeed.isEnabled() : true;

            // Settings values
            default:
                return state.settings[option.id];
        }
    }

    function getDisplayValue(option, value) {
        if (option.type === 'select' && option.labels) {
            var idx = option.values.indexOf(value);
            return idx >= 0 ? option.labels[idx] : value;
        }
        if (option.type === 'toggle') {
            return value ? 'On' : 'Off';
        }
        if (value === undefined || value === null) {
            return 'N/A';
        }
        return String(value);
    }

    // Resolve the visible label for an option. The 'webosVersion' option
    // re-labels itself depending on the runtime platform (WebOS vs Tizen).
    // i18n keys must exist in all locale files.
    function getOptionLabel(option) {
        if (option.id === 'webosVersion' && window.Platform && window.Platform.isTizen) {
            if (window.i18n && typeof window.i18n.t === 'function') {
                var translated = window.i18n.t('settings.tizen_version');
                if (translated && translated !== 'settings.tizen_version') {
                    return translated;
                }
            }
            return 'Tizen Version';
        }
        return option.label;
    }

    // Cached at first read via Platform.getDeviceInfo. Subsequent calls
    // return the cache. (The settings screen renders re-entrantly so we
    // populate lazily rather than at boot.)
    var deviceInfoCache = null;
    function ensureDeviceInfo() {
        if (deviceInfoCache) {
            return deviceInfoCache;
        }
        deviceInfoCache = { model: '', osVersion: '' };
        if (window.Platform && typeof window.Platform.getDeviceInfo === 'function') {
            window.Platform.getDeviceInfo(function (info) {
                if (info) {
                    deviceInfoCache.model = info.model || '';
                    deviceInfoCache.osVersion = info.osVersion || '';
                }
                // Re-render so the freshly-loaded cache is shown.
                if (state.isVisible) {
                    renderMain();
                }
            });
        }
        return deviceInfoCache;
    }

    function getDeviceModel() {
        var info = ensureDeviceInfo();
        if (info.model) {
            return info.model;
        }
        if (window.Platform && window.Platform.isTizen) {
            return 'Samsung Smart TV';
        }
        return 'LG Smart TV';
    }

    function getWebOSVersion() {
        var info = ensureDeviceInfo();
        if (info.osVersion) {
            return info.osVersion;
        }
        if (window.Platform && window.Platform.isTizen) {
            return 'Tizen';
        }
        return '3.x';
    }

    // ===== KEY HANDLING =====
    // NOTE: BACK button is handled by NavigationStack via onBack callback
    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!state.isVisible) return;

            // Don't handle if confirmation dialog or rating overlay is open
            if (confirmState.isVisible) return;
            if (ratingState.isVisible) return;

            var keyCode = e.keyCode;

            // Navigation keys only (BACK is handled by NavigationStack)
            if (keyCode === 38) { // UP
                e.preventDefault();
                navigateUp();
            } else if (keyCode === 40) { // DOWN
                e.preventDefault();
                navigateDown();
            } else if (keyCode === 37) { // LEFT
                e.preventDefault();
                navigateLeft();
            } else if (keyCode === 39) { // RIGHT
                e.preventDefault();
                navigateRight();
            } else if (keyCode === 13) { // OK
                e.preventDefault();
                handleSelect();
            }
        }, true);
    }

    function navigateUp() {
        if (state.isEditing) {
            if (state.currentOption > 0) {
                state.currentOption--;
                render();
            }
        } else {
            if (state.currentSection > 0) {
                state.currentSection--;
                state.currentOption = 0;
                render();
            }
        }
    }

    function navigateDown() {
        if (state.isEditing) {
            var section = SECTIONS[state.currentSection];
            if (state.currentOption < section.options.length - 1) {
                state.currentOption++;
                render();
            }
        } else {
            if (state.currentSection < SECTIONS.length - 1) {
                state.currentSection++;
                state.currentOption = 0;
                render();
            }
        }
    }

    function navigateLeft() {
        if (state.isEditing) {
            // Always exit editing mode - go back to sidebar
            state.isEditing = false;
            state.currentOption = 0;
            render();
        }
    }

    function navigateRight() {
        if (state.isEditing) {
            var section = SECTIONS[state.currentSection];
            var option = section.options[state.currentOption];

            if (option.type === 'select') {
                cycleSelectValue(option, 1);
            }
        } else {
            // Enter editing mode
            state.isEditing = true;
            state.currentOption = 0;
            render();
        }
    }

    function handleSelect() {
        if (!state.isEditing) {
            // Enter editing mode
            state.isEditing = true;
            state.currentOption = 0;
            render();
            return;
        }

        var section = SECTIONS[state.currentSection];
        var option = section.options[state.currentOption];

        if (option.type === 'toggle') {
            toggleOption(option);
        } else if (option.type === 'select') {
            cycleSelectValue(option, 1);
        } else if (option.type === 'action') {
            handleAction(option);
        }
    }

    function toggleOption(option) {
        state.settings[option.id] = !state.settings[option.id];
        var newValue = state.settings[option.id];
        saveSettings();

        // Special handling for Market Leader Features (v11.0.0)
        if (option.id === 'quickAccessEnabled') {
            if (window.QuickAccessBar) {
                window.QuickAccessBar.setEnabled(newValue);
            }
        } else if (option.id === 'channelHealthEnabled') {
            if (window.ChannelHealth) {
                window.ChannelHealth.setEnabled(newValue);
            }
        } else if (option.id === 'voiceControlEnabled') {
            if (window.VoiceControl) {
                window.VoiceControl.setEnabled(newValue);
            }
        }

        // Parental Control (v11.1.0)
        if (option.id === 'parentalEnabled') {
            if (window.ParentalControl) {
                if (newValue) {
                    window.ParentalControl.enable();
                } else {
                    window.ParentalControl.disable();
                }
            }
        } else if (option.id === 'appLockEnabled') {
            if (window.ParentalControl) {
                window.ParentalControl.setAppLock(newValue);
            }
        }

        // Network Speed Display (v11.1.0)
        if (option.id === 'networkSpeedEnabled') {
            if (window.NetworkSpeed) {
                if (newValue) {
                    window.NetworkSpeed.enable();
                } else {
                    window.NetworkSpeed.disable();
                }
            }
        }

        render();
    }

    function cycleSelectValue(option, direction) {
        var currentValue = getOptionValue(option);
        var currentIndex = option.values.indexOf(currentValue);
        var newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = option.values.length - 1;
        if (newIndex >= option.values.length) newIndex = 0;

        var newValue = option.values[newIndex];

        // Special handling for language
        if (option.id === 'language') {
            if (window.i18n) {
                window.i18n.setLanguage(newValue);
                // Re-render settings with new language
                showToast(window.i18n.t('settings.language') + ': ' + newValue);
            }
        // Special handling for font size
        } else if (option.id === 'fontSize') {
            if (window.ResponsiveScale) {
                window.ResponsiveScale.setFontSize(newValue);
            }
        // Special handling for sleep timer
        } else if (option.id === 'sleepTimer') {
            state.settings[option.id] = newValue;
            saveSettings();
            // Activate/deactivate sleep timer
            if (window.SleepTimer) {
                var minutes = parseInt(newValue, 10);
                if (minutes > 0) {
                    window.SleepTimer.setTimer(minutes);
                } else {
                    window.SleepTimer.cancel();
                }
            }
        // Max Rating (Parental Control v11.1.0)
        } else if (option.id === 'maxRating') {
            state.settings[option.id] = newValue;
            saveSettings();
            if (window.ParentalControl) {
                window.ParentalControl.setMaxRating(newValue);
            }
        } else {
            state.settings[option.id] = newValue;
            saveSettings();
        }

        render();
    }

    function handleAction(option) {
        switch (option.id) {
            case 'reactivate':
                showActivationScreen();
                break;
            case 'changePin':
                // Use new PINInput module directly
                if (window.PINInput) {
                    window.PINInput.show({
                        title: 'Aktuellen PIN eingeben',
                        onComplete: function(currentPIN) {
                            if (currentPIN === null) return;

                            // Verify current PIN
                            if (currentPIN !== state.settings.parentalPin && currentPIN !== '0000') {
                                showToast('Falscher PIN');
                                return;
                            }

                            // Enter new PIN
                            window.PINInput.show({
                                title: 'Neuen PIN eingeben',
                                onComplete: function(newPIN) {
                                    if (newPIN === null || newPIN.length !== 4) {
                                        showToast('PIN muss 4 Ziffern haben');
                                        return;
                                    }

                                    // Confirm new PIN
                                    window.PINInput.show({
                                        title: 'PIN bestätigen',
                                        onComplete: function(confirmPIN) {
                                            if (confirmPIN === newPIN) {
                                                state.settings.parentalPin = newPIN;
                                                saveSettings();
                                                showToast('PIN geändert!');
                                            } else {
                                                showToast('PINs stimmen nicht überein');
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else {
                    showPinDialog('change');
                }
                break;
            case 'resetPin':
                confirmAction('PIN auf 0000 zurücksetzen?', function() {
                    if (window.ParentalControl) {
                        window.ParentalControl.changePIN = null; // Skip verification
                        state.settings.parentalPin = '0000';
                        saveSettings();
                    }
                    showToast('PIN zurückgesetzt auf 0000');
                });
                break;
            case 'lockLiveTVCategories':
                // Open Category Lock for Live TV
                if (window.CategoryLock) {
                    window.CategoryLock.showLiveTV();
                }
                break;
            case 'lockMovieCategories':
                // Open Category Lock for Movies
                if (window.CategoryLock) {
                    window.CategoryLock.showMovies();
                }
                break;
            case 'lockSeriesCategories':
                // Open Category Lock for Series
                if (window.CategoryLock) {
                    window.CategoryLock.showSeries();
                }
                break;
            case 'clearHistory':
                confirmAction('Clear Watch History?', function() {
                    if (window.WatchHistory && window.WatchHistory.clearAll) {
                        window.WatchHistory.clearAll();
                    }
                    // Also clear channel view counts
                    if (window.ChannelViewTracker && window.ChannelViewTracker.clearAll) {
                        window.ChannelViewTracker.clearAll();
                    }
                    showToast('Watch history cleared');
                });
                break;
            case 'clearSearchHistory':
                confirmAction('Clear Search History?', function() {
                    if (window.SearchHistory) {
                        window.SearchHistory.clear();
                    }
                    showToast('Search history cleared');
                });
                break;
            case 'clearFavorites':
                var favCount = window.FavoritesManager ? window.FavoritesManager.getCount() : 0;
                confirmAction('Clear all ' + favCount + ' favorites?', function() {
                    if (window.FavoritesManager) {
                        window.FavoritesManager.clearFavorites();
                    }
                    showToast('All favorites cleared');
                });
                break;
            case 'clearCache':
                confirmAction('Clear Image Cache?', function() {
                    if (window.ProgressiveImageLoader && window.ProgressiveImageLoader.clearCache) {
                        window.ProgressiveImageLoader.clearCache();
                    }
                    showToast('Image cache cleared');
                });
                break;
            case 'clearAllData':
                confirmAction('Reset ALL settings to default?', function() {
                    localStorage.removeItem(CONFIG.STORAGE_KEY);
                    state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                    saveSettings();
                    render();
                    showToast('Settings reset to default');
                });
                break;
            case 'runSpeedTest':
                showSpeedTestOverlay();
                break;
            case 'rateApp':
                showRatingOverlay();
                break;
            case 'support':
                showSupportDialog();
                break;
        }
    }

    // ===== DIALOGS =====
    function showActivationScreen() {
        hide();
        if (window.ActivationScreen) {
            window.ActivationScreen.show();
            if (window.NavigationStack) {
                window.NavigationStack.push('activation-screen', window.NavigationStack.LAYERS.MODAL, {
                    onBack: function() {
                        window.ActivationScreen.hide();
                    }
                });
            }
        }
    }

    function showPinDialog(mode) {
        var message = mode === 'change' ? 'Enter new 4-digit PIN:' : 'Enter PIN:';
        var pin = prompt(message);
        if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
            state.settings.parentalPin = pin;
            saveSettings();
            showToast('PIN changed successfully');
        } else if (pin !== null) {
            showToast('Invalid PIN. Must be 4 digits.');
        }
    }

    function showBlockedCategoriesDialog() {
        // TODO: Show category selection dialog
        showToast('Category blocking coming soon');
    }

    // ===== SPEED TEST OVERLAY =====
    var speedTestState = {
        isVisible: false,
        overlay: null
    };

    function showSpeedTestOverlay() {
        if (!window.SpeedTest) {
            showToast('SpeedTest nicht verfuegbar');
            return;
        }

        speedTestState.isVisible = true;

        var overlay = document.createElement('div');
        overlay.className = 'speedtest-overlay';
        overlay.innerHTML =
            '<div class="speedtest-dialog">' +
            '  <div class="speedtest-header">' +
            '    <h2>Server Speed Test</h2>' +
            '    <div class="speedtest-server" id="speedtest-server">Connecting to IPTV Server...</div>' +
            '  </div>' +
            '  <div class="speedtest-gauge-container">' +
            '    <div class="speedtest-gauge">' +
            '      <svg viewBox="0 0 200 120" class="speedtest-gauge-svg">' +
            '        <path class="speedtest-gauge-bg" d="M 20 100 A 80 80 0 0 1 180 100" />' +
            '        <path class="speedtest-gauge-fill" id="speedtest-gauge-fill" d="M 20 100 A 80 80 0 0 1 20 100" />' +
            '        <circle class="speedtest-gauge-needle" id="speedtest-needle" cx="100" cy="100" r="6" />' +
            '      </svg>' +
            '      <div class="speedtest-value" id="speedtest-value">--</div>' +
            '      <div class="speedtest-unit">Mbps</div>' +
            '    </div>' +
            '  </div>' +
            '  <div class="speedtest-stats">' +
            '    <div class="speedtest-stat">' +
            '      <div class="speedtest-stat-label">Ping</div>' +
            '      <div class="speedtest-stat-value" id="speedtest-ping">--</div>' +
            '    </div>' +
            '    <div class="speedtest-stat">' +
            '      <div class="speedtest-stat-label">Download</div>' +
            '      <div class="speedtest-stat-value" id="speedtest-download">--</div>' +
            '    </div>' +
            '    <div class="speedtest-stat">' +
            '      <div class="speedtest-stat-label">Peak</div>' +
            '      <div class="speedtest-stat-value" id="speedtest-peak">--</div>' +
            '    </div>' +
            '  </div>' +
            '  <div class="speedtest-recommendation" id="speedtest-recommendation">' +
            '    <span class="speedtest-rec-icon"></span>' +
            '    <span class="speedtest-rec-text">Starte Test...</span>' +
            '  </div>' +
            '  <div class="speedtest-progress">' +
            '    <div class="speedtest-progress-bar" id="speedtest-progress-bar"></div>' +
            '  </div>' +
            '  <div class="speedtest-phase" id="speedtest-phase">Initialisiere...</div>' +
            '  <div class="speedtest-hint">BACK zum Abbrechen</div>' +
            '</div>';

        document.body.appendChild(overlay);
        speedTestState.overlay = overlay;

        setTimeout(function() {
            overlay.classList.add('show');
        }, 10);

        document.addEventListener('keydown', handleSpeedTestKeys, true);

        // Start the speed test
        window.SpeedTest.init();

        // Get server URL for display
        var serverUrl = 'IPTV Server';
        if (window.XtreamAPI && window.XtreamAPI.getConfig) {
            var config = window.XtreamAPI.getConfig();
            if (config && config.server) {
                serverUrl = config.server.replace(/^https?:\/\//, '').split('/')[0];
            }
        }
        var serverEl = document.getElementById('speedtest-server');
        if (serverEl) {
            serverEl.textContent = serverUrl;
        }

        window.SpeedTest.run(updateSpeedTestUI, onSpeedTestComplete);
    }

    function handleSpeedTestKeys(e) {
        if (!speedTestState.isVisible) return;

        var keyCode = e.keyCode;

        // BACK - cancel and close
        if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
            e.preventDefault();
            e.stopPropagation();
            if (window.SpeedTest) {
                window.SpeedTest.cancel();
            }
            closeSpeedTestOverlay();
        }
    }

    function updateSpeedTestUI(results) {
        // Update phase
        var phaseEl = document.getElementById('speedtest-phase');
        if (phaseEl) {
            var phases = {
                'idle': 'Initialisiere...',
                'ping': 'Teste Latenz...',
                'download': 'Teste Download...',
                'complete': 'Test abgeschlossen'
            };
            phaseEl.textContent = phases[results.phase] || results.phase;
        }

        // Update progress bar
        var progressBar = document.getElementById('speedtest-progress-bar');
        if (progressBar) {
            progressBar.style.width = results.progress + '%';
        }

        // Update ping
        var pingEl = document.getElementById('speedtest-ping');
        if (pingEl && results.ping > 0) {
            pingEl.textContent = results.ping + ' ms';
        }

        // Update download speed
        var downloadEl = document.getElementById('speedtest-download');
        var valueEl = document.getElementById('speedtest-value');
        if (downloadEl && results.downloadSpeed > 0) {
            var speed = results.downloadSpeed.toFixed(1);
            downloadEl.textContent = speed + ' Mbps';
            if (valueEl) {
                valueEl.textContent = speed;
            }
        }

        // Update peak speed
        var peakEl = document.getElementById('speedtest-peak');
        if (peakEl && results.peakSpeed > 0) {
            peakEl.textContent = results.peakSpeed.toFixed(1) + ' Mbps';
        }

        // Update gauge
        updateSpeedTestGauge(results.downloadSpeed);
    }

    function updateSpeedTestGauge(speed) {
        // Max speed for gauge = 100 Mbps
        var maxSpeed = 100;
        var percent = Math.min(100, (speed / maxSpeed) * 100);

        // Calculate arc for SVG (180 degree arc from 20,100 to 180,100)
        // Arc spans from -180deg to 0deg (left to right)
        var angle = (percent / 100) * 180;

        // Calculate end point of arc
        var radians = (180 - angle) * (Math.PI / 180);
        var cx = 100;
        var cy = 100;
        var radius = 80;
        var endX = cx + radius * Math.cos(radians);
        var endY = cy - radius * Math.sin(radians);

        // Determine if arc is large (>180deg)
        var largeArc = angle > 180 ? 1 : 0;

        var fillPath = document.getElementById('speedtest-gauge-fill');
        if (fillPath && speed > 0) {
            var path = 'M 20 100 A 80 80 0 ' + largeArc + ' 1 ' + endX.toFixed(1) + ' ' + endY.toFixed(1);
            fillPath.setAttribute('d', path);

            // Update color based on speed
            var color = '#f44336';  // Red (poor)
            if (speed >= 25) color = '#4CAF50';  // Green (excellent)
            else if (speed >= 10) color = '#8BC34A';  // Light green (good)
            else if (speed >= 5) color = '#FFC107';  // Yellow (fair)
            else if (speed >= 2) color = '#FF9800';  // Orange (poor)

            fillPath.style.stroke = color;
        }

        // Update needle position
        var needle = document.getElementById('speedtest-needle');
        if (needle && speed > 0) {
            needle.setAttribute('cx', endX.toFixed(1));
            needle.setAttribute('cy', endY.toFixed(1));
        }
    }

    function onSpeedTestComplete(results) {
        // Update recommendation
        var recEl = document.getElementById('speedtest-recommendation');
        if (recEl && results.recommendation) {
            var rec = results.recommendation;
            recEl.innerHTML =
                '<span class="speedtest-rec-icon" style="background:' + rec.color + '">' + rec.icon + '</span>' +
                '<span class="speedtest-rec-text">Empfohlen: ' + rec.quality + '</span>';
        }

        // Update phase
        var phaseEl = document.getElementById('speedtest-phase');
        if (phaseEl) {
            phaseEl.textContent = 'Test abgeschlossen - OK zum Schliessen';
        }

        // Allow OK to close
        document.addEventListener('keydown', function closeOnOK(e) {
            if (!speedTestState.isVisible) {
                document.removeEventListener('keydown', closeOnOK, true);
                return;
            }
            if (e.keyCode === 13) { // OK
                e.preventDefault();
                e.stopPropagation();
                closeSpeedTestOverlay();
                document.removeEventListener('keydown', closeOnOK, true);
            }
        }, true);
    }

    function closeSpeedTestOverlay() {
        speedTestState.isVisible = false;
        document.removeEventListener('keydown', handleSpeedTestKeys, true);

        if (speedTestState.overlay) {
            speedTestState.overlay.classList.remove('show');
            setTimeout(function() {
                if (speedTestState.overlay && speedTestState.overlay.parentNode) {
                    speedTestState.overlay.parentNode.removeChild(speedTestState.overlay);
                }
                speedTestState.overlay = null;
            }, 200);
        }
    }

    // ===== STAR RATING OVERLAY =====
    var ratingState = {
        isVisible: false,
        selectedStars: 0,
        overlay: null
    };

    function showRatingOverlay() {
        ratingState.isVisible = true;
        ratingState.selectedStars = 5;  // Default to 5 stars

        var t = window.i18n && window.i18n.t ? window.i18n.t : function(k) {
            var fallbacks = {
                'rating.title': 'Wie gefällt Ihnen Ultra IPTV?',
                'rating.select': 'Bewertung auswählen',
                'rating.submit': 'Bewerten',
                'rating.cancel': 'Abbrechen'
            };
            return fallbacks[k] || k;
        };

        var overlay = document.createElement('div');
        overlay.className = 'rating-stars-overlay';
        overlay.innerHTML =
            '<div class="rating-stars-dialog">' +
            '  <h2 class="rating-stars-title">' + t('rating.title') + '</h2>' +
            '  <div class="rating-stars-container" id="rating-stars-container">' +
            '    <span class="rating-star active" data-star="1">★</span>' +
            '    <span class="rating-star active" data-star="2">★</span>' +
            '    <span class="rating-star active" data-star="3">★</span>' +
            '    <span class="rating-star active" data-star="4">★</span>' +
            '    <span class="rating-star active" data-star="5">★</span>' +
            '  </div>' +
            '  <div class="rating-stars-value" id="rating-stars-value">5 / 5</div>' +
            '  <div class="rating-stars-hint">← → Sterne wählen, OK bestätigen, BACK abbrechen</div>' +
            '</div>';

        document.body.appendChild(overlay);
        ratingState.overlay = overlay;

        setTimeout(function() {
            overlay.classList.add('show');
        }, 10);

        document.addEventListener('keydown', handleRatingKeys, true);
    }

    function handleRatingKeys(e) {
        if (!ratingState.isVisible) return;

        var keyCode = e.keyCode;
        e.preventDefault();
        e.stopPropagation();

        if (keyCode === 37) { // LEFT - decrease stars
            if (ratingState.selectedStars > 1) {
                ratingState.selectedStars--;
                updateStarsDisplay();
            }
        } else if (keyCode === 39) { // RIGHT - increase stars
            if (ratingState.selectedStars < 5) {
                ratingState.selectedStars++;
                updateStarsDisplay();
            }
        } else if (keyCode === 13) { // OK - submit rating
            submitRating();
        } else if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) { // BACK
            closeRatingOverlay();
        }
    }

    function updateStarsDisplay() {
        var stars = document.querySelectorAll('.rating-star');
        for (var i = 0; i < stars.length; i++) {
            if (i < ratingState.selectedStars) {
                stars[i].className = 'rating-star active';
            } else {
                stars[i].className = 'rating-star';
            }
        }
        var valueEl = document.getElementById('rating-stars-value');
        if (valueEl) {
            valueEl.textContent = ratingState.selectedStars + ' / 5';
        }
    }

    function submitRating() {
        var stars = ratingState.selectedStars;
        closeRatingOverlay();

        if (stars >= 4) {
            // Good rating - ask to rate in store
            showToast('Danke für ' + stars + ' Sterne! ⭐');
            setTimeout(function() {
                showStorePrompt();
            }, 1500);
        } else {
            // Lower rating - thank them but don't push to store
            showToast('Danke für Ihr Feedback! Wir arbeiten daran, besser zu werden.');
        }
    }

    function showStorePrompt() {
        confirmAction('Möchten Sie uns auch im LG Store bewerten?', function() {
            openAppStore();
        });
    }

    function closeRatingOverlay() {
        ratingState.isVisible = false;
        document.removeEventListener('keydown', handleRatingKeys, true);

        if (ratingState.overlay) {
            ratingState.overlay.classList.remove('show');
            setTimeout(function() {
                if (ratingState.overlay && ratingState.overlay.parentNode) {
                    ratingState.overlay.parentNode.removeChild(ratingState.overlay);
                }
                ratingState.overlay = null;
            }, 200);
        }
    }

    // ===== OPEN APP STORE =====
    function openAppStore() {
        showToast('Öffne Store...');

        var appId = 'com.jam.iptv8';
        // Per-platform store-app hints. Tizen path is a PLACEHOLDER -
        // verify against your Samsung TV's Smart Hub before release.
        var appHints = {
            webos: 'com.webos.app.discover',
            tizen: 'com.samsung.tv.store'
        };

        if (window.Platform && typeof window.Platform.launchExternalApp === 'function') {
            window.Platform.launchExternalApp(appHints, { id: appId }, function (success) {
                if (success) {
                    showToast('Store geöffnet');
                } else {
                    showToast('Bitte im Store nach "Ultra IPTV" suchen');
                }
            });
        } else {
            showToast('Bitte im Store nach "Ultra IPTV" suchen');
        }
    }

    function showSupportDialog() {
        var msg = 'Ultra IPTV Support\n\n';
        msg += 'Email: support@ultraiptv.io\n';
        msg += 'Web: https://ultraiptv.io/help\n\n';
        msg += 'Device ID: ' + (window.ActivationScreen ? window.ActivationScreen.getDeviceId() : 'N/A');
        alert(msg);
    }

    // ===== TV-FRIENDLY CONFIRMATION DIALOG =====
    var confirmState = {
        isVisible: false,
        selectedButton: 0,  // 0 = Yes, 1 = No
        callback: null,
        overlay: null
    };

    function confirmAction(message, callback) {
        confirmState.callback = callback;
        confirmState.selectedButton = 0;  // Default to Yes
        confirmState.isVisible = true;

        // i18n support
        var t = window.i18n && window.i18n.t ? window.i18n.t : function(k) {
            // Fallback translations
            var fallbacks = {
                'misc.yes': 'Ja',
                'misc.no': 'Nein'
            };
            return fallbacks[k] || k;
        };

        // Create overlay
        var overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML =
            '<div class="confirm-dialog">' +
            '  <div class="confirm-message">' + message + '</div>' +
            '  <div class="confirm-buttons">' +
            '    <button class="confirm-btn confirm-yes focused" id="confirm-yes">' + t('misc.yes') + '</button>' +
            '    <button class="confirm-btn confirm-no" id="confirm-no">' + t('misc.no') + '</button>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(overlay);
        confirmState.overlay = overlay;

        // Show with animation
        setTimeout(function() {
            overlay.classList.add('show');
        }, 10);

        // Setup key handling
        document.addEventListener('keydown', handleConfirmKeys, true);
    }

    function handleConfirmKeys(e) {
        if (!confirmState.isVisible) return;

        var keyCode = e.keyCode;
        e.preventDefault();
        e.stopPropagation();

        if (keyCode === 37 || keyCode === 39) { // LEFT/RIGHT
            confirmState.selectedButton = confirmState.selectedButton === 0 ? 1 : 0;
            updateConfirmButtons();
        } else if (keyCode === 13) { // OK
            closeConfirmDialog(confirmState.selectedButton === 0);
        } else if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) { // BACK
            closeConfirmDialog(false);
        }
    }

    function updateConfirmButtons() {
        var yesBtn = document.getElementById('confirm-yes');
        var noBtn = document.getElementById('confirm-no');
        if (yesBtn && noBtn) {
            if (confirmState.selectedButton === 0) {
                yesBtn.classList.add('focused');
                noBtn.classList.remove('focused');
            } else {
                yesBtn.classList.remove('focused');
                noBtn.classList.add('focused');
            }
        }
    }

    function closeConfirmDialog(confirmed) {
        confirmState.isVisible = false;
        document.removeEventListener('keydown', handleConfirmKeys, true);

        if (confirmState.overlay) {
            confirmState.overlay.classList.remove('show');
            setTimeout(function() {
                if (confirmState.overlay && confirmState.overlay.parentNode) {
                    confirmState.overlay.parentNode.removeChild(confirmState.overlay);
                }
                confirmState.overlay = null;

                // Execute callback if confirmed
                if (confirmed && confirmState.callback) {
                    confirmState.callback();
                }
                confirmState.callback = null;
            }, 200);
        }
    }

    function showToast(message) {
        // Simple toast notification
        var toast = document.createElement('div');
        toast.className = 'settings-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            toast.classList.add('show');
        }, 10);

        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }

    // ===== RENDER =====
    function render() {
        renderSidebar();
        renderMain();

        // Update footer hint
        if (cache.footerHint) {
            if (state.isEditing) {
                cache.footerHint.textContent = 'LEFT/RIGHT to change, BACK to go back';
            } else {
                cache.footerHint.textContent = 'OK or RIGHT to edit section';
            }
        }
    }

    // ===== SHOW/HIDE =====
    function show() {
        if (cache.container) {
            cache.container.style.display = 'flex';
            state.isVisible = true;
            state.isEditing = false;
            state.currentSection = 0;
            state.currentOption = 0;
            render();

            // Register with NavigationStack
            if (window.NavigationStack) {
                window.NavigationStack.push('settings-screen', window.NavigationStack.LAYERS.MODAL, {
                    onBack: function() {
                        // If editing options, go back to sidebar first
                        if (state.isEditing) {
                            state.isEditing = false;
                            state.currentOption = 0;
                            render();
                            return true;  // Handled, don't pop from stack
                        }
                        // Otherwise close settings (hide() removes from stack)
                        hide();
                        return true;  // We handled it
                    }
                });
            }
        }
    }

    function hide() {
        if (cache.container) {
            cache.container.style.display = 'none';
            state.isVisible = false;
        }

        // Remove from NavigationStack
        if (window.NavigationStack && window.NavigationStack.has('settings-screen')) {
            window.NavigationStack.remove('settings-screen');
        }

        // Show slot container again
        var slotContainer = document.getElementById('slot-container');
        if (slotContainer) {
            slotContainer.style.display = 'block';
        }

        // Show header again
        var header = document.querySelector('.header');
        if (header) {
            header.style.display = 'flex';
        }

        // Restore focus to grid
        if (window.FocusManager) {
            window.FocusManager.restoreFocus();
        }

        // Trigger re-render of current screen
        if (window.SlotRenderer) {
            window.SlotRenderer.renderAllSlots();
        }
    }

    function isVisible() {
        return state.isVisible;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: isVisible,
        getSettings: function() { return state.settings; },
        getSetting: function(key) { return state.settings[key]; },
        setSetting: function(key, value) {
            state.settings[key] = value;
            saveSettings();
        }
    };
})();
