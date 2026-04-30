/**
 * Unified Navigation Handler for WebOS Remote
 * Single keydown handler - Uses NavigationStack for back button
 * ES3 Compatible
 */

window.NavigationHandler = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        isEnabled: true,
        playerActive: false,
        keyRepeatThrottle: 150
    };

    var lastKeyTime = 0;

    // ===== INITIALIZATION =====
    function initialize() {
        // Use capture phase (true) to handle events BEFORE other handlers
        document.addEventListener('keydown', handleKeyDown, true);
        return true;
    }

    // ===== KEY HANDLING =====
    function handleKeyDown(event) {
        if (!state.isEnabled) return;

        // If SetupScreen is active (first-run / no config), route ALL keys to it
        // first so it can swallow BACK and steer UP/DOWN/OK without other handlers
        // stealing input.
        if (window.SetupScreen && window.SetupScreen.isActive && window.SetupScreen.isActive()) {
            if (window.SetupScreen.handleKey(event)) return;
        }

        // If onboarding is visible, let it handle ALL keys
        if (window.OnboardingOverlay && window.OnboardingOverlay.isVisible()) {
            return;
        }

        var keyCode = event.keyCode;

        // BACK BUTTON - Check overlays FIRST, then use NavigationStack
        if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
            event.preventDefault();
            // Use stopImmediatePropagation to prevent other handlers on same element
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                event.stopPropagation();
            }

            // Check EPGGrid FIRST - close it directly
            if (window.EPGGrid && window.EPGGrid.isVisible()) {
                window.EPGGrid.hide();
                return;
            }

            // Use NavigationStack for everything else
            handleBack();
            return;
        }

        // ===== COLOR BUTTONS (handle BEFORE overlay checks) =====

        // RED (403) - Search
        if (keyCode === 403) {
            // Defer to player's own RED handler when player is active
            if (state.playerActive) {
                return;
            }
            event.preventDefault();
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                event.stopPropagation();
            }
            handleRedSearch();
            return;
        }

        // GREEN (404) - Sort
        if (keyCode === 404) {
            event.preventDefault();
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                event.stopPropagation();
            }
            handleGreenSort();
            return;
        }

        // BLUE (406) - EPG
        if (keyCode === 406) {
            // Defer to player's own BLUE handler when player is active
            if (state.playerActive) {
                return;
            }
            event.preventDefault();
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                event.stopPropagation();
            }
            handleEPGToggle();
            return;
        }

        // Check if MovieOverlay is visible EARLY - it handles ALL its own keys
        // (except BACK which is handled above via NavigationStack)
        if (window.MovieOverlay && window.MovieOverlay.isVisible()) {
            return;
        }

        // Check if SettingsScreen is visible - it handles its own navigation keys
        if (window.SettingsScreen && window.SettingsScreen.isVisible()) {
            return;
        }

        // Check if ChannelOverlay is visible - it handles its own keys
        if (window.ChannelOverlay && window.ChannelOverlay.isVisible()) {
            return;
        }

        // Check if SeriesOverlay is visible - it handles its own keys
        if (window.SeriesOverlay && window.SeriesOverlay.isVisible()) {
            return;
        }

        // Check if SortOverlay is visible - it handles its own keys
        if (window.SortOverlay && window.SortOverlay.isVisible()) {
            return;
        }

        // Check if SearchOverlay is visible - it handles its own keys
        if (window.SearchOverlay && window.SearchOverlay.isVisible()) {
            return;
        }

        // Check if EPGGrid is visible - it handles its own keys
        if (window.EPGGrid && window.EPGGrid.isVisible()) {
            return;
        }

        // Handle number keys for Channel Number Input (0-9)
        if (window.ChannelNumberInput) {
            var digit = window.ChannelNumberInput.getDigitFromKeyCode(keyCode);
            if (digit !== null) {
                var handled = window.ChannelNumberInput.handleDigit(digit);
                if (handled) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
            }
        }

        var now = Date.now();

        if (now - lastKeyTime < state.keyRepeatThrottle) {
            return;
        }
        lastKeyTime = now;

        var handled = false;

        switch(keyCode) {
            case 38: // UP
                handled = handleUp();
                break;
            case 40: // DOWN
                handled = handleDown();
                break;
            case 37: // LEFT
                handled = handleLeft();
                break;
            case 39: // RIGHT
                handled = handleRight();
                break;
            case 13: // ENTER / OK
                handled = handleEnter();
                // Stop propagation to prevent overlays from receiving the same event
                if (handled) {
                    event.preventDefault();
                    if (event.stopImmediatePropagation) {
                        event.stopImmediatePropagation();
                    } else {
                        event.stopPropagation();
                    }
                    return;
                }
                break;
            case 10252: // PLAY
            case 415:
                handled = handlePlay();
                break;
            case 19: // PAUSE
            case 463:
                handled = handlePause();
                break;
            case 405: // YELLOW - Toggle Favorite
                handled = handleYellow();
                break;
            // Note: GREEN (404) and BLUE (406) are handled above before overlay checks

            // ===== MARKET LEADER FEATURE KEYS (v11.0.0) =====

            case 412: // REWIND (WebOS)
            case 227: // REWIND (alt)
                handled = handleRewind();
                break;

            case 417: // FAST_FORWARD (WebOS)
            case 228: // FAST_FORWARD (alt)
                handled = handleFastForward();
                break;

            case 413: // STOP
                handled = handleStop();
                break;

            case 600: // MIC BUTTON (WebOS Magic Remote)
                handled = handleMic();
                break;

            case 48: // 0 KEY - Quick Switch when in player
                if (state.playerActive && window.QuickSwitch) {
                    handled = window.QuickSwitch.swap();
                }
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // ===== NAVIGATION ACTIONS =====
    function handleUp() {
        if (state.playerActive) {
            return false;
        }

        // If navbar is focused, stay in navbar (can't go up further)
        if (window.NavBarController && window.NavBarController.isNavFocused()) {
            return true;
        }

        if (window.ScreenManager && window.ScreenManager.handleNavigationUp()) {
            return true;
        }

        // Check if at top of grid (slot 0) - enter navbar
        if (window.FocusManager && window.FocusManager.state.currentSlot === 0) {
            if (window.NavBarController) {
                window.NavBarController.enterNavFocus();
                return true;
            }
        }

        var moved = false;
        if (window.FocusManager) {
            moved = window.FocusManager.moveUp();
            if (moved && window.ProgressiveImageLoader) {
                window.ProgressiveImageLoader.triggerProcess();
            }
        }

        return moved;
    }

    function handleDown() {
        if (state.playerActive) {
            return false;
        }

        // If navbar is focused, exit to grid
        if (window.NavBarController && window.NavBarController.isNavFocused()) {
            window.NavBarController.exitNavFocus();
            return true;
        }

        if (window.ScreenManager && window.ScreenManager.handleNavigationDown()) {
            return true;
        }

        if (window.FocusManager) {
            var moved = window.FocusManager.moveDown();
            if (moved && window.ProgressiveImageLoader) {
                window.ProgressiveImageLoader.triggerProcess();
            }
            return moved;
        }
        return false;
    }

    function handleLeft() {
        if (state.playerActive) {
            return false;
        }

        // If navbar is focused, navigate within navbar
        if (window.NavBarController && window.NavBarController.isNavFocused()) {
            return window.NavBarController.focusLeft();
        }

        if (window.ScreenManager && window.ScreenManager.handleNavigationLeft()) {
            return true;
        }

        if (window.FocusManager) {
            var moved = window.FocusManager.moveLeft();
            if (!moved && window.ScreenManager && window.ScreenManager.cycleScreen) {
                // Edge-swipe: at left edge, switch to previous screen
                window.ScreenManager.cycleScreen('prev');
            }
            return true;
        }
        return false;
    }

    function handleRight() {
        if (state.playerActive) {
            return false;
        }

        // If navbar is focused, navigate within navbar
        if (window.NavBarController && window.NavBarController.isNavFocused()) {
            return window.NavBarController.focusRight();
        }

        if (window.ScreenManager && window.ScreenManager.handleNavigationRight()) {
            return true;
        }

        if (window.FocusManager) {
            var moved = window.FocusManager.moveRight();
            if (!moved && window.ScreenManager && window.ScreenManager.cycleScreen) {
                // Edge-swipe: at right edge, switch to next screen
                window.ScreenManager.cycleScreen('next');
            }
            return true;
        }
        return false;
    }

    function handleEnter() {
        // If player is active, let player handle OK button
        if (state.playerActive) {
            return false;
        }

        // If navbar is focused, select current item
        if (window.NavBarController && window.NavBarController.isNavFocused()) {
            window.NavBarController.select();
            return true;
        }

        if (window.ScreenManager && window.ScreenManager.handleNavigationOK()) {
            return true;
        }

        // Check if we're on series screen - open SeriesOverlay
        if (window.ScreenManager && window.ScreenManager.getCurrentScreen() === 'series') {
            var seriesData = getSelectedSeriesData();
            if (seriesData && window.SeriesOverlay) {
                window.SeriesOverlay.show(seriesData);
                return true;
            }
        }

        if (window.FocusManager) {
            return window.FocusManager.activate();
        }
        return false;
    }

    function getSelectedSeriesData() {
        if (!window.FocusManager || !window.SlotRenderer) return null;

        var focusState = window.FocusManager.state;
        var rendererState = window.SlotRenderer.getState();

        if (!rendererState || !rendererState.allRows) return null;

        var absoluteRowIndex = rendererState.currentOffset + focusState.currentSlot;
        var row = rendererState.allRows[absoluteRowIndex];

        if (!row || !row.channels) return null;

        var cardIndex = focusState.currentCard;

        // Handle paginated rows
        if (row.isPaginatedRow && window.HorizontalPageManager) {
            var pageData = window.HorizontalPageManager.getVisibleItems(row.id);
            if (pageData && pageData.items && pageData.items[cardIndex]) {
                return pageData.items[cardIndex];
            }
        }

        // Regular row
        if (row.channels[cardIndex]) {
            return row.channels[cardIndex];
        }

        return null;
    }

    function handleBack() {
        // Use NavigationStack for all back handling
        if (window.NavigationStack) {
            var handled = window.NavigationStack.handleBack();
            if (handled) {
                // Update playerActive state if player was closed
                if (!window.NavigationStack.has('player')) {
                    state.playerActive = false;
                }
                return true;
            }
        }

        // Fallback for simple player case
        if (state.playerActive && window.PlayerComponent) {
            window.PlayerComponent.close();
            state.playerActive = false;
            return true;
        }

        return false;
    }

    function handlePlay() {
        if (state.playerActive && window.PlayerComponent) {
            window.PlayerComponent.play();
            return true;
        }
        return false;
    }

    function handlePause() {
        if (state.playerActive && window.PlayerComponent) {
            window.PlayerComponent.pause();
            return true;
        }
        return false;
    }

    function handleYellow() {
        // Don't handle in player mode or header navigation
        if (state.playerActive) return false;
        if (window.ScreenManager && window.ScreenManager.isNavFocused()) return false;

        // Get current screen type
        var screenType = 'livetv';
        if (window.ScreenManager) {
            screenType = window.ScreenManager.getCurrentScreen();
        }

        // Get focused item
        var item = getSelectedItem();
        if (!item) return false;

        // Toggle favorite
        if (window.FavoritesManager) {
            var isNowFavorite = window.FavoritesManager.toggleFavorite(item, screenType);
            showFavoriteToast(isNowFavorite, item);

            // Refresh screen to show/update favorites row
            if (window.ScreenManager && window.ScreenManager.refreshCurrentScreen) {
                setTimeout(function() {
                    window.ScreenManager.refreshCurrentScreen();
                }, 100);
            }

            return true;
        }

        return false;
    }

    function handleRedSearch() {
        // Don't open search while in player
        if (state.playerActive) return false;

        if (window.SearchOverlay) {
            if (window.SearchOverlay.isVisible()) {
                window.SearchOverlay.hide();
            } else {
                window.SearchOverlay.show();
            }
            return true;
        }
        return false;
    }

    function handleGreenSort() {
        // Don't open sort while in player
        if (state.playerActive) return false;

        if (window.SortOverlay) {
            if (window.SortOverlay.isVisible()) {
                window.SortOverlay.hide();
            } else {
                window.SortOverlay.show();
            }
            return true;
        }
        return false;
    }

    function handleEPGToggle() {
        // If EPG Grid is visible, close it (toggle off)
        if (window.EPGGrid && window.EPGGrid.isVisible()) {
            window.EPGGrid.hide();
            return true;
        }

        // Get selected channel from ChannelOverlay before closing it
        var focusChannel = null;
        if (window.ChannelOverlay && window.ChannelOverlay.isVisible()) {
            focusChannel = window.ChannelOverlay.getSelectedChannel();
            window.ChannelOverlay.hide();
        }

        // If no channel from overlay, get currently playing channel
        if (!focusChannel && window.ChannelManager && window.ChannelManager.getCurrentChannel) {
            focusChannel = window.ChannelManager.getCurrentChannel();
        }

        // Open EPG Grid (works from anywhere - navbar, grid, or player)
        if (window.EPGGrid) {
            // Pass the selected channel to focus on it in EPG
            window.EPGGrid.show(focusChannel);
            return true;
        }

        return false;
    }

    // ===== MARKET LEADER FEATURE HANDLERS (v11.0.0) =====

    function handleRewind() {
        // First check if TimeshiftManager can handle it
        if (window.TimeshiftManager && window.TimeshiftManager.isEnabled()) {
            return window.TimeshiftManager.seekBack();
        }

        // Fallback to player seek
        if (state.playerActive && window.PlayerComponent && window.PlayerComponent.seekBack) {
            window.PlayerComponent.seekBack(30);
            return true;
        }

        return false;
    }

    function handleFastForward() {
        // First check if TimeshiftManager can handle it
        if (window.TimeshiftManager && window.TimeshiftManager.isEnabled()) {
            return window.TimeshiftManager.seekForward();
        }

        // Fallback to player seek
        if (state.playerActive && window.PlayerComponent && window.PlayerComponent.seekForward) {
            window.PlayerComponent.seekForward(30);
            return true;
        }

        return false;
    }

    function handleStop() {
        // If timeshifting, return to live
        if (window.TimeshiftManager && window.TimeshiftManager.isActive()) {
            return window.TimeshiftManager.goLive();
        }

        // Otherwise close player
        if (state.playerActive && window.PlayerComponent) {
            window.PlayerComponent.close();
            state.playerActive = false;
            return true;
        }

        return false;
    }

    function handleMic() {
        // Toggle voice control
        if (window.VoiceControl) {
            if (window.VoiceControl.isActive()) {
                window.VoiceControl.stop();
            } else {
                window.VoiceControl.start();
            }
            return true;
        }

        return false;
    }

    function getSelectedItem() {
        if (!window.FocusManager || !window.SlotRenderer) return null;

        var focusState = window.FocusManager.state;
        var rendererState = window.SlotRenderer.getState();

        if (!rendererState || !rendererState.allRows) return null;

        var absoluteRowIndex = rendererState.currentOffset + focusState.currentSlot;
        var row = rendererState.allRows[absoluteRowIndex];

        if (!row || !row.channels) return null;

        var cardIndex = focusState.currentCard;

        // Handle paginated rows
        if (row.isPaginatedRow && window.HorizontalPageManager) {
            var pageData = window.HorizontalPageManager.getVisibleItems(row.id);
            if (pageData && pageData.items && pageData.items[cardIndex]) {
                return pageData.items[cardIndex];
            }
        }

        // Regular row
        if (row.channels[cardIndex]) {
            return row.channels[cardIndex];
        }

        return null;
    }

    function showFavoriteToast(isNowFavorite, item) {
        var name = item.name || item.title || 'Item';
        var message = isNowFavorite ? '★ Added to Favorites' : '☆ Removed from Favorites';

        // Create toast
        var toast = document.createElement('div');
        toast.className = 'favorite-toast';
        toast.innerHTML = '<span class="favorite-toast-icon">' + (isNowFavorite ? '★' : '☆') + '</span>' +
                         '<span class="favorite-toast-text">' + message + '</span>';
        document.body.appendChild(toast);

        // Show
        setTimeout(function() {
            toast.classList.add('show');
        }, 10);

        // Hide and remove
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 1500);
    }

    // ===== CONTROL =====
    function enable() {
        state.isEnabled = true;
    }

    function disable() {
        state.isEnabled = false;
    }

    function setPlayerActive(active) {
        state.playerActive = active;
    }

    function setThrottle(ms) {
        state.keyRepeatThrottle = ms;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        enable: enable,
        disable: disable,
        setPlayerActive: setPlayerActive,
        setThrottle: setThrottle
    };
})();
