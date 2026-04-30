/**
 * Main App - Slot-Based IPTV Player
 * Coordinates all modules
 * ES3 Compatible
 */

window.IPTVApp = (function() {
    'use strict';

    // ===== CONFIG =====
    var API_CONFIG = {
        server: '',
        username: '',
        password: ''
    };

    (function() {
        if (typeof localStorage === 'undefined') return;
        try {
            var stored = localStorage.getItem('iptv_config');
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && parsed.server) API_CONFIG.server = parsed.server;
                if (parsed && parsed.username) API_CONFIG.username = parsed.username;
                if (parsed && parsed.password) API_CONFIG.password = parsed.password;
            }
        } catch (e) {
            // Corrupt stored config - ignore
        }
    })();

    function persistConfig() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem('iptv_config', JSON.stringify({
                server: API_CONFIG.server,
                username: API_CONFIG.username,
                password: API_CONFIG.password
            }));
        } catch (e) {
            // Storage unavailable - silent fail
        }
    }

    function applyConfigToXtreamAPI() {
        if (window.XtreamAPI && window.XtreamAPI.setConfig) {
            window.XtreamAPI.setConfig({
                server: API_CONFIG.server,
                username: API_CONFIG.username,
                password: API_CONFIG.password
            });
        }
    }

    // ===== STATE =====
    var state = {
        channels: [],
        categories: [],
        rows: [],
        isLoaded: false,
        licenseChecked: false
    };

    // ===== INITIALIZATION =====
    function initialize() {
        // Bring up i18n + minimal modules so SetupScreen can render localized text
        initializeModules();

        // Gate: if no Xtream config, force the setup screen and stop here.
        // SetupScreen will call IPTVApp.startAfterSetup() once the user has
        // entered valid credentials.
        if (!API_CONFIG.server || !API_CONFIG.username || !API_CONFIG.password) {
            if (window.SetupScreen && window.SetupScreen.show) {
                window.SetupScreen.show();
                return;
            }
        }

        applyConfigToXtreamAPI();
        checkLicenseAndStart();
    }

    // Continue boot after SetupScreen has persisted credentials.
    function startAfterSetup() {
        applyConfigToXtreamAPI();
        checkLicenseAndStart();
    }

    // ===== LICENSE CHECK =====
    function checkLicenseAndStart() {
        if (!window.LicenseManager) {
            // No license manager - just start
            loadChannelData();
            return;
        }

        window.LicenseManager.init();

        window.LicenseManager.check(function(status) {
            state.licenseChecked = true;

            if (status.blocked) {
                // Device is blocked - self-destruct
                window.LicenseManager.selfDestruct();
                return;
            }

            if (status.status === 'active') {
                // Licensed - hide any trial UI
                if (window.TrialBanner) {
                    window.TrialBanner.hide();
                }
                loadChannelData();
                return;
            }

            if (status.status === 'trial') {
                // Trial active - show banner with remaining days
                if (window.TrialBanner) {
                    window.TrialBanner.init();
                    window.TrialBanner.show(status.daysLeft);
                }
                loadChannelData();
                return;
            }

            if (status.status === 'expired') {
                // Trial expired - show activation screen
                showExpiredScreen();
                return;
            }

            // Unknown status - allow app to run
            loadChannelData();
        });
    }

    function showExpiredScreen() {
        // Hide loading indicator
        showLoading(false);

        // Show activation screen in license mode
        if (window.ActivationScreen) {
            window.ActivationScreen.show('license');
        }

        // Also show expired message in main container
        var container = document.getElementById('slot-container');
        if (container) {
            container.innerHTML = '' +
                '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;text-align:center;padding:20px;">' +
                '  <div style="font-size:60px;margin-bottom:20px;">⏰</div>' +
                '  <h1 style="color:#e50914;margin-bottom:10px;">Testversion abgelaufen</h1>' +
                '  <p style="color:#999;font-size:18px;max-width:500px;margin-bottom:30px;">' +
                '    Ihre 7-Tage Testversion ist abgelaufen. Bitte geben Sie einen Lizenzschlüssel ein, um Ultra IPTV weiter zu nutzen.' +
                '  </p>' +
                '  <button id="activate-now-btn" style="background:#e50914;color:white;border:none;padding:15px 40px;font-size:18px;border-radius:4px;cursor:pointer;">Jetzt aktivieren</button>' +
                '</div>';

            // Add click handler
            var btn = document.getElementById('activate-now-btn');
            if (btn) {
                btn.addEventListener('click', function() {
                    if (window.ActivationScreen) {
                        window.ActivationScreen.show('license');
                    }
                });
            }
        }
    }

    function initializeModules() {
        // FIRST: Initialize i18n (before other modules use translations)
        if (window.i18n) {
            window.i18n.init();
        }

        // Initialize responsive scaling based on screen size
        if (window.ResponsiveScale) {
            window.ResponsiveScale.init();
        }

        if (window.WatchHistory) {
            window.WatchHistory.init();
        }

        // Initialize Favorites Manager
        if (window.FavoritesManager) {
            window.FavoritesManager.init();
        }

        // Initialize Channel View Tracker (Most Watched feature)
        if (window.ChannelViewTracker) {
            window.ChannelViewTracker.init();
        }

        if (window.SlotRenderer) {
            window.SlotRenderer.init();
        }

        if (window.FocusManager) {
            window.FocusManager.init({
                onFocusChange: onFocusChanged
            });
        }

        if (window.NavigationHandler) {
            window.NavigationHandler.init();
        }

        // Initialize Netflix-style navbar controller
        if (window.NavBarController) {
            window.NavBarController.init();
        }

        if (window.PlayerComponent) {
            window.PlayerComponent.init();
        }

        if (window.ProgressiveImageLoader) {
            window.ProgressiveImageLoader.init();
        }

        if (window.ChannelOverlay) {
            window.ChannelOverlay.init();
        }

        // NOTE: SeriesOverlay.init() is called by ScreenManager.init()
        // Do NOT initialize here to avoid double-init!

        if (window.ScreenManager) {
            window.ScreenManager.init();
        }

        // Initialize Search Overlay
        if (window.SearchOverlay) {
            window.SearchOverlay.init();
            setupSearchButton();
        }

        // Initialize Sort Overlay (BLUE button)
        if (window.SortOverlay) {
            window.SortOverlay.init();
        }

        // Initialize Channel Number Input (direct dial)
        if (window.ChannelNumberInput) {
            window.ChannelNumberInput.init();
        }

        // Initialize Sleep Timer
        if (window.SleepTimer) {
            window.SleepTimer.init();
        }

        // Initialize Binge Overlay (auto-play next episode)
        if (window.BingeOverlay) {
            window.BingeOverlay.init();
        }

        // Initialize EPG Grid View
        if (window.EPGGrid) {
            window.EPGGrid.init();
        }

        // Initialize Quality Selector
        if (window.QualitySelector) {
            window.QualitySelector.init();
        }

        // Initialize EPG Search
        if (window.EPGSearch) {
            window.EPGSearch.init();
        }

        // Initialize EPG Reminders
        if (window.EPGReminders) {
            window.EPGReminders.init();
        }

        // Initialize Watchlist
        if (window.Watchlist) {
            window.Watchlist.init();
        }

        // Initialize Recommendations
        if (window.Recommendations) {
            window.Recommendations.init();
        }

        // Initialize Subtitle Settings
        if (window.SubtitleSettings) {
            window.SubtitleSettings.init();
        }

        // Initialize Theme Manager
        if (window.ThemeManager) {
            window.ThemeManager.init();
        }

        // Initialize Picture-in-Picture
        if (window.PiPManager) {
            window.PiPManager.init();
        }

        // Initialize Profile Manager
        if (window.ProfileManager) {
            window.ProfileManager.init();
        }

        // Initialize Rating Overlay (App Store Prompt)
        if (window.RatingOverlay) {
            window.RatingOverlay.init();
        }

        // Initialize VYON+ Paywall Overlay
        if (window.PaywallOverlay) {
            window.PaywallOverlay.init();
        }

        // Initialize Onboarding Overlay (first launch)
        if (window.OnboardingOverlay) {
            window.OnboardingOverlay.init();
        }

        // ===== MARKET LEADER FEATURES (v11.0.0) =====

        // Initialize Quick Access Bar (Recent Channels)
        if (window.QuickAccessBar) {
            window.QuickAccessBar.init();
        }

        // Initialize Channel Health Monitor
        if (window.ChannelHealth) {
            window.ChannelHealth.init();
        }

        // Initialize Quick-Switch (2-Channel Swap)
        if (window.QuickSwitch) {
            window.QuickSwitch.init();
        }

        // Initialize Catch-Up TV Manager
        if (window.CatchupManager) {
            window.CatchupManager.init();
        }

        // Initialize Timeshift Manager (Live Pause)
        if (window.TimeshiftManager) {
            window.TimeshiftManager.init();
        }

        // Initialize Voice Control
        if (window.VoiceControl) {
            window.VoiceControl.init();
        }

        // ===== OPTIMIZATION FEATURES (v11.1.0) =====

        // Initialize PIN Input (Ziffernfeld)
        if (window.PINInput) {
            window.PINInput.init();
        }

        // Initialize Parental Control (PIN Lock)
        if (window.ParentalControl) {
            window.ParentalControl.init();
        }

        // Initialize Network Speed Display
        if (window.NetworkSpeed) {
            window.NetworkSpeed.init();
        }

        // Initialize Search History
        if (window.SearchHistory) {
            window.SearchHistory.init();
        }

        // Initialize Category Lock
        if (window.CategoryLock) {
            window.CategoryLock.init();
        }

        setupWebOSBackButton();
    }

    // ===== SEARCH BUTTON SETUP =====
    function setupSearchButton() {
        var searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                if (window.SearchOverlay) {
                    window.SearchOverlay.show();
                }
            });
        }

        // YELLOW button (405) is now used for Favorites (handled in navigation-handler.js)
        // Search is available via header search button
    }

    // ===== WEBOS BACK BUTTON SETUP =====
    // All back button handling is now done via NavigationStack
    // This function only sets up WebOS-specific hooks to route to NavigationStack
    function setupWebOSBackButton() {
        // Setup history state for WebOS
        if (window.history) {
            window.history.replaceState({ app: 'iptv' }, '');
            window.history.pushState({ app: 'iptv', page: 'main' }, '', window.location.href);
        }

        // Handle popstate (browser back) - route to NavigationStack
        window.addEventListener('popstate', function(event) {
            event.preventDefault();
            event.stopPropagation();

            // Re-push history to prevent app exit
            if (window.history) {
                window.history.pushState({ app: 'iptv', page: 'main' }, '', window.location.href);
            }

            // Route to NavigationStack
            if (window.NavigationStack) {
                window.NavigationStack.handleBack();
            }

            return false;
        });

        // Handle webOS.platformBack - route to NavigationStack
        if (window.webOS && window.webOS.platformBack) {
            window.webOS.platformBack = function() {
                if (window.NavigationStack) {
                    window.NavigationStack.handleBack();
                }
                // Never call window.history.back() - prevents app exit
            };
        }

        // NO additional keydown handler here!
        // NavigationHandler is the ONLY keydown handler for back button
    }

    // ===== DATA LOADING =====
    function loadChannelData() {
        if (!window.XtreamAPI) {
            showError('API not available');
            return;
        }

        showLoading(true);

        window.XtreamAPI.getLiveCategories(function(err, categories) {
            if (err) {
                categories = [];
            }

            state.categories = categories || [];

            window.XtreamAPI.getLiveStreams(function(err, channels) {
                if (err) {
                    showError('Failed to load channels: ' + err);
                    return;
                }

                state.channels = channels || [];

                if (window.ChannelManager) {
                    window.ChannelManager.init(state.channels, state.categories);
                }

                // Auto-lock adult categories BEFORE processing rows
                if (window.CategoryLock && window.CategoryLock.autoLockAdultCategories) {
                    window.CategoryLock.autoLockAdultCategories();
                }

                processChannelsIntoRows();

                if (window.ScreenManager) {
                    window.ScreenManager.setLiveTVData(state.channels, state.categories, state.rows);
                } else {
                    if (window.SlotRenderer) {
                        window.SlotRenderer.setData(state.rows);
                    }

                    setTimeout(function() {
                        if (window.FocusManager) {
                            window.FocusManager.setFocus(0, 0);
                        }

                        if (window.ProgressiveImageLoader) {
                            setTimeout(function() {
                                window.ProgressiveImageLoader.processImages();
                            }, 300);
                        }
                    }, 100);
                }

                showLoading(false);
                state.isLoaded = true;

                // Auto-play last channel if available
                tryResumeLastChannel();
            });
        });
    }

    // ===== RESUME LAST CHANNEL =====
    function tryResumeLastChannel() {
        if (!window.LastChannel) return;

        var lastChannel = window.LastChannel.load();
        if (!lastChannel || !lastChannel.stream_id) return;

        // Find channel in loaded data to verify it exists
        var channelExists = false;
        for (var i = 0; i < state.channels.length; i++) {
            if (state.channels[i].stream_id == lastChannel.stream_id) {
                channelExists = true;
                break;
            }
        }

        if (!channelExists) {
            console.log('[App] Last channel not found in current data, skipping auto-play');
            return;
        }

        console.log('[App] Resuming last channel:', lastChannel.name);

        // Set current channel in ChannelManager
        if (window.ChannelManager) {
            window.ChannelManager.setCurrentChannel(lastChannel.stream_id, lastChannel.name);
        }

        // Start playback after a short delay to let UI initialize
        setTimeout(function() {
            if (window.PlayerComponent) {
                window.PlayerComponent.play(lastChannel.stream_id, lastChannel.name, 'live');
            }
        }, 500);
    }

    function processChannelsIntoRows() {
        var rows = [];
        var categoryChannels = {};

        for (var i = 0; i < state.channels.length; i++) {
            var channel = state.channels[i];
            var categoryId = channel.category_id || '0';

            if (!categoryChannels[categoryId]) {
                categoryChannels[categoryId] = [];
            }
            categoryChannels[categoryId].push(channel);
        }

        // Use infinity scroll - one row per category
        var PAGINATION_THRESHOLD = 12;

        for (var catId in categoryChannels) {
            if (categoryChannels.hasOwnProperty(catId)) {
                // Skip locked categories
                if (window.CategoryLock && window.CategoryLock.isCategoryLocked(catId, 'livetv')) {
                    continue;
                }

                var categoryName = getCategoryName(catId);
                var channels = categoryChannels[catId];

                if (channels.length > 0) {
                    var rowId = 'livetv-row-' + catId;
                    var rowTitle = categoryName || 'Live TV';

                    // Show count for large categories
                    if (channels.length > PAGINATION_THRESHOLD) {
                        rowTitle += ' (' + channels.length + ')';
                    }

                    // Use HorizontalPageManager for infinity scroll
                    if (channels.length > PAGINATION_THRESHOLD && window.HorizontalPageManager) {
                        rows.push({
                            id: rowId,
                            title: rowTitle,
                            channels: channels,
                            isPaginatedRow: true,
                            categoryId: catId,
                            totalCount: channels.length
                        });

                        window.HorizontalPageManager.init(rowId, channels);
                    } else {
                        // Small categories - no pagination needed
                        rows.push({
                            id: rowId,
                            title: rowTitle,
                            channels: channels,
                            isPaginatedRow: false,
                            categoryId: catId
                        });
                    }
                }
            }
        }

        state.rows = rows;
    }

    function getCategoryName(categoryId) {
        for (var i = 0; i < state.categories.length; i++) {
            if (state.categories[i].category_id == categoryId) {
                return state.categories[i].category_name;
            }
        }
        return 'Uncategorized';
    }

    // ===== EVENT HANDLERS =====
    function onFocusChanged(slotIndex, cardIndex) {
        // Optional: Update hero section
    }

    // ===== UI HELPERS =====
    function showLoading(show) {
        var loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
    }

    function showError(message) {
        var container = document.getElementById('slot-container');
        if (container) {
            container.innerHTML = '<div style="color:white;padding:50px;text-align:center;font-size:20px;">' +
                'Error: ' + message + '</div>';
        }
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        startAfterSetup: startAfterSetup,
        getState: function() { return state; },
        getConfig: function() {
            return {
                server: API_CONFIG.server,
                username: API_CONFIG.username,
                password: API_CONFIG.password
            };
        },
        setConfig: function(server, username, password) {
            if (typeof server === 'string') API_CONFIG.server = server;
            if (typeof username === 'string') API_CONFIG.username = username;
            if (typeof password === 'string') API_CONFIG.password = password;
            persistConfig();
            applyConfigToXtreamAPI();
        }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.IPTVApp.init();
    });
} else {
    window.IPTVApp.init();
}
