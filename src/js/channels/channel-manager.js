/**
 * Channel Manager v1.0 - WebOS 3.x
 * Manages current channel and category for Player navigation
 * CODE_STANDARDS: ES3, Zero allocations, Object pooling
 */

window.ChannelManager = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        allChannels: [],           // All channels from API
        categories: [],            // All categories
        currentChannelIndex: -1,   // Global index in all channels
        currentCategoryId: '',     // Current category ID
        currentCategoryChannels: [], // Channels in current category
        currentCategoryIndex: -1,  // Index within category
        isInitialized: false
    };

    // ===== INITIALIZATION =====
    function initialize(channels, categories) {
        state.allChannels = channels || [];
        state.categories = categories || [];
        state.isInitialized = true;
        return true;
    }

    // ===== CHANNEL SELECTION =====
    function setCurrentChannel(streamId, channelName) {
        // Find channel index
        for (var i = 0; i < state.allChannels.length; i++) {
            if (state.allChannels[i].stream_id == streamId) {
                state.currentChannelIndex = i;
                state.currentCategoryId = state.allChannels[i].category_id || '0';

                // Build category channels list
                buildCategoryChannelsList();
                return true;
            }
        }

        console.warn('[ChannelManager] Channel not found:', streamId);
        return false;
    }

    function buildCategoryChannelsList() {
        // Build list of channels in current category
        var categoryChannels = [];
        var currentIndexInCategory = -1;

        for (var i = 0; i < state.allChannels.length; i++) {
            var channel = state.allChannels[i];
            if (channel.category_id == state.currentCategoryId) {
                if (i === state.currentChannelIndex) {
                    currentIndexInCategory = categoryChannels.length;
                }
                categoryChannels.push(channel);
            }
        }

        state.currentCategoryChannels = categoryChannels;
        state.currentCategoryIndex = currentIndexInCategory;
    }

    // ===== NAVIGATION =====
    function nextChannel() {
        if (!state.isInitialized || state.currentCategoryIndex === -1) {
            console.warn('[ChannelManager] Not initialized or no current channel');
            return false;
        }

        // Move to next in category (wrap around)
        var nextIndex = (state.currentCategoryIndex + 1) % state.currentCategoryChannels.length;
        var nextChannel = state.currentCategoryChannels[nextIndex];

        if (nextChannel && window.PlayerComponent) {
            window.PlayerComponent.play(nextChannel.stream_id, nextChannel.name, 'live');

            // Update state
            state.currentCategoryIndex = nextIndex;

            // Find global index
            for (var i = 0; i < state.allChannels.length; i++) {
                if (state.allChannels[i].stream_id == nextChannel.stream_id) {
                    state.currentChannelIndex = i;
                    break;
                }
            }

            return true;
        }

        return false;
    }

    function previousChannel() {
        if (!state.isInitialized || state.currentCategoryIndex === -1) {
            console.warn('[ChannelManager] Not initialized or no current channel');
            return false;
        }

        // Move to previous in category (wrap around)
        var prevIndex = state.currentCategoryIndex - 1;
        if (prevIndex < 0) {
            prevIndex = state.currentCategoryChannels.length - 1;
        }

        var prevChannel = state.currentCategoryChannels[prevIndex];

        if (prevChannel && window.PlayerComponent) {
            window.PlayerComponent.play(prevChannel.stream_id, prevChannel.name, 'live');

            // Update state
            state.currentCategoryIndex = prevIndex;

            // Find global index
            for (var i = 0; i < state.allChannels.length; i++) {
                if (state.allChannels[i].stream_id == prevChannel.stream_id) {
                    state.currentChannelIndex = i;
                    break;
                }
            }

            return true;
        }

        return false;
    }

    function playChannelByIndex(globalIndex) {
        if (globalIndex < 0 || globalIndex >= state.allChannels.length) {
            return false;
        }

        var channel = state.allChannels[globalIndex];
        if (channel && window.PlayerComponent) {
            window.PlayerComponent.play(channel.stream_id, channel.name, 'live');

            // Update state
            state.currentChannelIndex = globalIndex;
            state.currentCategoryId = channel.category_id || '0';
            buildCategoryChannelsList();

            return true;
        }

        return false;
    }

    // ===== GETTERS =====
    function getCurrentChannel() {
        if (state.currentChannelIndex >= 0 && state.currentChannelIndex < state.allChannels.length) {
            return state.allChannels[state.currentChannelIndex];
        }
        return null;
    }

    function getCurrentCategory() {
        for (var i = 0; i < state.categories.length; i++) {
            if (state.categories[i].category_id == state.currentCategoryId) {
                return state.categories[i];
            }
        }
        return null;
    }

    function getCategoryChannels() {
        return state.currentCategoryChannels;
    }

    function getAllChannels() {
        return state.allChannels;
    }

    function getAllCategories() {
        return state.categories;
    }

    function getCurrentCategoryIndex() {
        for (var i = 0; i < state.categories.length; i++) {
            if (state.categories[i].category_id == state.currentCategoryId) {
                return i;
            }
        }
        return 0;
    }

    function switchToCategory(categoryIndex) {
        if (categoryIndex < 0 || categoryIndex >= state.categories.length) {
            return false;
        }

        var category = state.categories[categoryIndex];
        state.currentCategoryId = category.category_id;

        // Build new category channels list
        var categoryChannels = [];
        for (var i = 0; i < state.allChannels.length; i++) {
            var channel = state.allChannels[i];
            if (channel.category_id == state.currentCategoryId) {
                categoryChannels.push(channel);
            }
        }

        state.currentCategoryChannels = categoryChannels;
        state.currentCategoryIndex = 0; // Reset to first channel in category

        return true;
    }

    function nextCategory() {
        var currentIdx = getCurrentCategoryIndex();
        var nextIdx = (currentIdx + 1) % state.categories.length;
        return switchToCategory(nextIdx);
    }

    function previousCategory() {
        var currentIdx = getCurrentCategoryIndex();
        var prevIdx = currentIdx - 1;
        if (prevIdx < 0) {
            prevIdx = state.categories.length - 1;
        }
        return switchToCategory(prevIdx);
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        setCurrentChannel: setCurrentChannel,
        nextChannel: nextChannel,
        previousChannel: previousChannel,
        nextCategory: nextCategory,
        previousCategory: previousCategory,
        playChannelByIndex: playChannelByIndex,
        getCurrentChannel: getCurrentChannel,
        getCurrentCategory: getCurrentCategory,
        getCategoryChannels: getCategoryChannels,
        getAllChannels: getAllChannels,
        getAllCategories: getAllCategories,
        getState: function() { return state; }
    };
})();
