/**
 * Navigation Stack - Robust Back Button Handler
 * Central navigation state manager for all screens and overlays
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Flow Examples:
 * - Series: grid → SeriesOverlay → Player → back → SeriesOverlay → back → grid
 * - Live TV: grid → Player → (LEFT) ChannelOverlay → back → Player → back → grid
 * - Movies: grid → Player → back → grid
 */

window.NavigationStack = (function() {
    'use strict';

    // ===== LAYER DEFINITIONS =====
    // Higher priority = handled first
    var LAYERS = {
        GRID: 0,           // Base layer - channel/movie/series grids
        PLAYER: 10,        // Video player
        CHANNEL_OVERLAY: 20,  // Channel list overlay (during live playback)
        SERIES_OVERLAY: 20,   // Series/episode selection overlay
        MODAL: 30          // Future: Dialogs, settings, etc.
    };

    // ===== STATE =====
    var state = {
        stack: [],              // Navigation history stack
        currentScreen: 'livetv' // Current main screen: 'livetv', 'movies', 'series'
    };

    // ===== STACK OPERATIONS =====

    /**
     * Push a new layer onto the stack
     * @param {string} layerId - Unique identifier (e.g., 'player', 'series-overlay')
     * @param {number} priority - Layer priority from LAYERS
     * @param {object} context - Context data to restore when returning
     */
    function push(layerId, priority, context) {
        // Prevent duplicates
        for (var i = 0; i < state.stack.length; i++) {
            if (state.stack[i].id === layerId) {
                // Update context instead of adding duplicate
                state.stack[i].context = context || state.stack[i].context;
                return;
            }
        }

        state.stack.push({
            id: layerId,
            priority: priority || 0,
            context: context || {},
            timestamp: Date.now()
        });

        // Sort by priority (highest first for back handling)
        state.stack.sort(function(a, b) {
            return b.priority - a.priority;
        });
    }

    /**
     * Remove a specific layer from stack
     * @param {string} layerId - Layer to remove
     * @returns {object|null} - Removed layer or null
     */
    function pop(layerId) {
        for (var i = 0; i < state.stack.length; i++) {
            if (state.stack[i].id === layerId) {
                return state.stack.splice(i, 1)[0];
            }
        }
        return null;
    }

    /**
     * Get the topmost (highest priority) layer
     * @returns {object|null} - Top layer or null if empty
     */
    function peek() {
        return state.stack.length > 0 ? state.stack[0] : null;
    }

    /**
     * Check if a specific layer is in the stack
     * @param {string} layerId - Layer to check
     * @returns {boolean}
     */
    function has(layerId) {
        for (var i = 0; i < state.stack.length; i++) {
            if (state.stack[i].id === layerId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get context for a specific layer
     * @param {string} layerId - Layer ID
     * @returns {object|null}
     */
    function getContext(layerId) {
        for (var i = 0; i < state.stack.length; i++) {
            if (state.stack[i].id === layerId) {
                return state.stack[i].context;
            }
        }
        return null;
    }

    /**
     * Update context for a layer
     * @param {string} layerId - Layer ID
     * @param {object} context - New context
     */
    function updateContext(layerId, context) {
        for (var i = 0; i < state.stack.length; i++) {
            if (state.stack[i].id === layerId) {
                state.stack[i].context = context;
                return;
            }
        }
    }

    // ===== BACK BUTTON HANDLER =====

    /**
     * Handle back button press
     * Always returns true - we NEVER want to exit the app via back button
     * @returns {boolean}
     */
    function handleBack() {
        var top = peek();

        if (!top) {
            // Empty stack - at base level, do nothing but don't exit app
            return true;
        }

        var layerId = top.id;
        var context = top.context || {};

        // Check for custom onBack handler first
        if (context.onBack && typeof context.onBack === 'function') {
            var handled = context.onBack();
            // If onBack returns true, it handled internally (don't pop, don't close)
            if (handled === true) {
                return true;
            }
            // Otherwise, onBack didn't handle it - continue to normal close logic below
        }

        // Pop first to prevent double-pop from hide() functions
        pop(layerId);

        // Handle based on layer type
        switch (layerId) {
            case 'channel-overlay':
                if (window.ChannelOverlay) {
                    window.ChannelOverlay.hide();
                }
                return true;

            case 'series-overlay':
                if (window.SeriesOverlay) {
                    window.SeriesOverlay.hide();
                }
                return true;

            case 'movie-overlay':
                if (window.MovieOverlay) {
                    window.MovieOverlay.hide();
                }
                return true;

            case 'search-overlay':
                if (window.SearchOverlay) {
                    window.SearchOverlay.hide();
                    window.SearchOverlay.restoreOriginalData();
                }
                return true;

            case 'epg-grid':
                if (window.EPGGrid) {
                    window.EPGGrid.hide();
                }
                return true;

            case 'quality-selector':
                if (window.QualitySelector) {
                    window.QualitySelector.hide();
                }
                return true;

            case 'epg-search':
                if (window.EPGSearch) {
                    window.EPGSearch.hide();
                }
                return true;

            case 'subtitle-settings':
                if (window.SubtitleSettings) {
                    window.SubtitleSettings.hide();
                }
                return true;

            case 'player':
                // Check if we should return to an overlay
                if (context.returnTo === 'series-overlay' && context.seriesData) {
                    // Close player first
                    if (window.PlayerComponent) {
                        window.PlayerComponent.close();
                    }

                    // Reopen series overlay with saved data
                    if (window.SeriesOverlay) {
                        // Push will be done by SeriesOverlay.show()
                        window.SeriesOverlay.show(context.seriesData);
                    }
                    return true;
                }

                // Normal close - return to grid
                if (window.PlayerComponent) {
                    window.PlayerComponent.close();
                }
                return true;

            default:
                // Unknown layer - already popped, just return
                return true;
        }
    }

    // ===== SCREEN MANAGEMENT =====

    function setCurrentScreen(screen) {
        state.currentScreen = screen;
    }

    function getCurrentScreen() {
        return state.currentScreen;
    }

    // ===== UTILITY =====

    function clear() {
        state.stack = [];
    }

    function getStack() {
        // Return copy for debugging
        return state.stack.slice();
    }

    function getStats() {
        return {
            stackSize: state.stack.length,
            currentScreen: state.currentScreen,
            topLayer: peek() ? peek().id : 'none',
            layers: state.stack.map(function(l) { return l.id; }).join(' → ')
        };
    }

    // ===== PUBLIC API =====
    return {
        // Constants
        LAYERS: LAYERS,

        // Stack operations
        push: push,
        pop: pop,
        remove: pop,  // Alias for pop (removes specific layer by ID)
        peek: peek,
        has: has,
        getContext: getContext,
        updateContext: updateContext,
        clear: clear,

        // Back handling
        handleBack: handleBack,

        // Screen management
        setCurrentScreen: setCurrentScreen,
        getCurrentScreen: getCurrentScreen,

        // Debug
        getStack: getStack,
        getStats: getStats
    };
})();
