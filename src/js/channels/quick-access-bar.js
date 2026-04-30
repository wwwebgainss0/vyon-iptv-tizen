/**
 * Quick Access Bar - Recent Channels
 * Horizontale Leiste über dem Header mit den letzten 5 Kanälen
 * ES3 Compatible - WebOS 3.x optimized
 */

window.QuickAccessBar = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        MAX_CHANNELS: 5,
        STORAGE_KEY: 'ultra_iptv_recent_channels',
        ENABLED_KEY: 'ultra_iptv_quick_access_enabled'
    };

    // ===== STATE =====
    var state = {
        channels: [],       // Array of {streamId, name, icon}
        focusIndex: -1,     // -1 = not focused, 0-4 = channel index
        visible: true,
        enabled: true
    };

    // ===== CACHED DOM ELEMENTS =====
    var cache = {
        bar: null,
        container: null,
        items: []           // Pre-allocated array for 5 items
    };

    // ===== INITIALIZATION =====
    function init() {
        loadSettings();
        loadChannels();
        createDOM();
        cacheElements();
        render();

        console.log('[QuickAccessBar] Initialized with', state.channels.length, 'recent channels');
    }

    function loadSettings() {
        try {
            var enabled = localStorage.getItem(CONFIG.ENABLED_KEY);
            state.enabled = enabled !== 'false';  // Default true
        } catch (e) {
            state.enabled = true;
        }
    }

    function loadChannels() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                state.channels = JSON.parse(stored);
                // Validate and limit to MAX_CHANNELS
                if (!state.channels || !state.channels.length) {
                    state.channels = [];
                }
                if (state.channels.length > CONFIG.MAX_CHANNELS) {
                    state.channels = state.channels.slice(0, CONFIG.MAX_CHANNELS);
                }
            }
        } catch (e) {
            console.error('[QuickAccessBar] Failed to load channels:', e);
            state.channels = [];
        }
    }

    function saveChannels() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.channels));
        } catch (e) {
            console.error('[QuickAccessBar] Failed to save channels:', e);
        }
    }

    // ===== DOM CREATION =====
    function createDOM() {
        // Check if already exists
        if (document.getElementById('quick-access-bar')) return;

        var bar = document.createElement('div');
        bar.id = 'quick-access-bar';
        bar.className = 'quick-access-bar';

        var t = window.i18n ? window.i18n.t : function(k) { return k; };

        var html = '<div class="quick-access-label">' + t('quickAccess.recent') + '</div>';
        html += '<div class="quick-access-container" id="quick-access-container">';

        // Pre-create 5 slots
        for (var i = 0; i < CONFIG.MAX_CHANNELS; i++) {
            html += '<div class="quick-access-item" id="quick-access-item-' + i + '" data-index="' + i + '">';
            html += '<div class="quick-access-icon"></div>';
            html += '<div class="quick-access-name"></div>';
            html += '</div>';
        }

        html += '</div>';

        bar.innerHTML = html;

        // Insert before header
        var header = document.querySelector('.app-header');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(bar, header);
        } else {
            document.body.insertBefore(bar, document.body.firstChild);
        }
    }

    function cacheElements() {
        cache.bar = document.getElementById('quick-access-bar');
        cache.container = document.getElementById('quick-access-container');

        // Cache all 5 item elements
        cache.items = [];
        for (var i = 0; i < CONFIG.MAX_CHANNELS; i++) {
            var item = document.getElementById('quick-access-item-' + i);
            if (item) {
                cache.items.push({
                    element: item,
                    icon: item.querySelector('.quick-access-icon'),
                    name: item.querySelector('.quick-access-name')
                });
            }
        }
    }

    // ===== RENDERING =====
    function render() {
        if (!cache.bar) return;

        // Show/hide bar based on enabled and channels available
        if (!state.enabled || state.channels.length === 0) {
            cache.bar.style.display = 'none';
            return;
        }

        cache.bar.style.display = 'flex';

        // Update each slot
        for (var i = 0; i < CONFIG.MAX_CHANNELS; i++) {
            var item = cache.items[i];
            if (!item) continue;

            var channel = state.channels[i];

            if (channel) {
                item.element.style.display = 'flex';
                item.element.className = 'quick-access-item' + (state.focusIndex === i ? ' focused' : '');

                // Set icon (use first letter if no icon)
                if (channel.icon) {
                    item.icon.style.backgroundImage = 'url(' + channel.icon + ')';
                    item.icon.textContent = '';
                } else {
                    item.icon.style.backgroundImage = 'none';
                    item.icon.textContent = channel.name ? channel.name.charAt(0).toUpperCase() : '?';
                }

                // Set name (truncate if needed)
                var displayName = channel.name || 'Channel';
                if (displayName.length > 10) {
                    displayName = displayName.substring(0, 9) + '…';
                }
                item.name.textContent = displayName;
            } else {
                item.element.style.display = 'none';
            }
        }
    }

    // ===== CHANNEL MANAGEMENT =====
    function addChannel(streamId, name, icon) {
        if (!streamId) return;

        // Remove if already exists (will re-add at front)
        for (var i = 0; i < state.channels.length; i++) {
            if (state.channels[i].streamId === streamId) {
                state.channels.splice(i, 1);
                break;
            }
        }

        // Add to front
        state.channels.unshift({
            streamId: streamId,
            name: name || 'Channel',
            icon: icon || ''
        });

        // Limit to MAX_CHANNELS
        if (state.channels.length > CONFIG.MAX_CHANNELS) {
            state.channels = state.channels.slice(0, CONFIG.MAX_CHANNELS);
        }

        saveChannels();
        render();

        console.log('[QuickAccessBar] Added channel:', name);
    }

    function getChannel(index) {
        if (index >= 0 && index < state.channels.length) {
            return state.channels[index];
        }
        return null;
    }

    // ===== FOCUS MANAGEMENT =====
    function setFocus(index) {
        if (index < 0) {
            state.focusIndex = -1;
        } else if (index >= state.channels.length) {
            state.focusIndex = state.channels.length - 1;
        } else {
            state.focusIndex = index;
        }
        render();
    }

    function focusFirst() {
        if (state.channels.length > 0) {
            setFocus(0);
            return true;
        }
        return false;
    }

    function focusLast() {
        if (state.channels.length > 0) {
            setFocus(state.channels.length - 1);
            return true;
        }
        return false;
    }

    function clearFocus() {
        state.focusIndex = -1;
        render();
    }

    function isFocused() {
        return state.focusIndex >= 0;
    }

    // ===== KEY HANDLING =====
    function handleKey(keyCode) {
        if (!state.enabled || state.channels.length === 0) {
            return false;
        }

        switch (keyCode) {
            case 37: // LEFT
                if (state.focusIndex > 0) {
                    setFocus(state.focusIndex - 1);
                    return true;
                }
                break;

            case 39: // RIGHT
                if (state.focusIndex < state.channels.length - 1) {
                    setFocus(state.focusIndex + 1);
                    return true;
                }
                break;

            case 40: // DOWN
                // Exit quick access bar, go to main content
                clearFocus();
                return false;  // Let navigation handler take over

            case 13: // OK/ENTER
                if (state.focusIndex >= 0) {
                    selectCurrent();
                    return true;
                }
                break;
        }

        return false;
    }

    function selectCurrent() {
        var channel = getChannel(state.focusIndex);
        if (channel && window.PlayerComponent) {
            console.log('[QuickAccessBar] Playing:', channel.name);
            window.PlayerComponent.play(channel.streamId, channel.name, 'live');
        }
    }

    // ===== VISIBILITY CONTROL =====
    function show() {
        state.visible = true;
        if (cache.bar && state.enabled && state.channels.length > 0) {
            cache.bar.style.display = 'flex';
        }
    }

    function hide() {
        state.visible = false;
        if (cache.bar) {
            cache.bar.style.display = 'none';
        }
    }

    function setEnabled(enabled) {
        state.enabled = enabled;
        try {
            localStorage.setItem(CONFIG.ENABLED_KEY, enabled ? 'true' : 'false');
        } catch (e) {}
        render();
    }

    function isEnabled() {
        return state.enabled;
    }

    function hasChannels() {
        return state.channels.length > 0;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        addChannel: addChannel,
        getChannel: getChannel,
        setFocus: setFocus,
        focusFirst: focusFirst,
        focusLast: focusLast,
        clearFocus: clearFocus,
        isFocused: isFocused,
        handleKey: handleKey,
        show: show,
        hide: hide,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        hasChannels: hasChannels,
        render: render,
        // For debugging
        getState: function() { return state; }
    };
})();
