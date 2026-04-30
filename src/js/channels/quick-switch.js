/**
 * Quick-Switch - Schneller Kanalwechsel
 * Zwischen den letzten 2 Kanälen mit einem Tastendruck wechseln
 * (Alternative zu Multi-View, da WebOS 3.x nur einen Video-Decoder hat)
 * ES3 Compatible - WebOS 3.x optimized
 */

window.QuickSwitch = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_quick_switch'
    };

    // ===== STATE =====
    var state = {
        primary: null,      // Aktueller Kanal {streamId, name, icon, type}
        secondary: null     // Vorheriger Kanal
    };

    // ===== CACHED DOM ELEMENTS =====
    var cache = {
        indicator: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadState();
        createIndicator();
        console.log('[QuickSwitch] Initialized');
    }

    function loadState() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                var data = JSON.parse(stored);
                state.primary = data.primary || null;
                state.secondary = data.secondary || null;
            }
        } catch (e) {
            console.error('[QuickSwitch] Failed to load state:', e);
        }
    }

    function saveState() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
                primary: state.primary,
                secondary: state.secondary
            }));
        } catch (e) {
            console.error('[QuickSwitch] Failed to save state:', e);
        }
    }

    // ===== INDICATOR UI =====
    function createIndicator() {
        // Small indicator showing swap target
        if (document.getElementById('quick-switch-indicator')) return;

        var indicator = document.createElement('div');
        indicator.id = 'quick-switch-indicator';
        indicator.className = 'quick-switch-indicator';
        indicator.style.display = 'none';
        indicator.innerHTML = '<span class="swap-icon">⇄</span><span class="swap-name"></span>';

        document.body.appendChild(indicator);
        cache.indicator = indicator;
    }

    function updateIndicator() {
        if (!cache.indicator) return;

        if (state.secondary && state.primary) {
            var nameSpan = cache.indicator.querySelector('.swap-name');
            if (nameSpan) {
                var displayName = state.secondary.name || 'Previous';
                if (displayName.length > 15) {
                    displayName = displayName.substring(0, 14) + '…';
                }
                nameSpan.textContent = displayName;
            }
            cache.indicator.style.display = 'flex';
        } else {
            cache.indicator.style.display = 'none';
        }
    }

    function showSwapNotification() {
        if (!cache.indicator) return;

        cache.indicator.className = 'quick-switch-indicator swapping';

        // Brief animation
        setTimeout(function() {
            cache.indicator.className = 'quick-switch-indicator';
        }, 300);
    }

    // ===== CHANNEL MANAGEMENT =====
    function setPrimary(channel) {
        if (!channel || !channel.streamId) return;

        // Don't update if same channel
        if (state.primary && state.primary.streamId === channel.streamId) {
            return;
        }

        // Move current primary to secondary
        if (state.primary) {
            state.secondary = {
                streamId: state.primary.streamId,
                name: state.primary.name,
                icon: state.primary.icon,
                type: state.primary.type
            };
        }

        // Set new primary
        state.primary = {
            streamId: channel.streamId,
            name: channel.name || 'Channel',
            icon: channel.icon || '',
            type: channel.type || 'live'
        };

        saveState();
        updateIndicator();

        console.log('[QuickSwitch] Primary:', state.primary.name, '| Secondary:', state.secondary ? state.secondary.name : 'none');
    }

    // ===== SWAP FUNCTION =====
    function swap() {
        if (!canSwap()) {
            console.log('[QuickSwitch] Cannot swap - no secondary channel');
            return false;
        }

        // Swap primary and secondary
        var temp = state.primary;
        state.primary = state.secondary;
        state.secondary = temp;

        saveState();
        updateIndicator();
        showSwapNotification();

        console.log('[QuickSwitch] Swapped to:', state.primary.name);

        // Play the new primary channel
        if (window.PlayerComponent) {
            window.PlayerComponent.play(
                state.primary.streamId,
                state.primary.name,
                state.primary.type || 'live'
            );
        }

        // Update ChannelManager if available
        if (window.ChannelManager) {
            window.ChannelManager.setCurrentChannel(state.primary.streamId, state.primary.name);
        }

        return true;
    }

    function canSwap() {
        return state.secondary !== null && state.primary !== null;
    }

    // ===== GETTERS =====
    function getPrimary() {
        return state.primary;
    }

    function getSecondary() {
        return state.secondary;
    }

    // ===== CLEAR =====
    function clear() {
        state.primary = null;
        state.secondary = null;
        saveState();
        updateIndicator();
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        setPrimary: setPrimary,
        swap: swap,
        canSwap: canSwap,
        getPrimary: getPrimary,
        getSecondary: getSecondary,
        clear: clear,
        // Alias for intuitive naming
        switchChannel: swap,
        // Debug
        getState: function() { return state; }
    };
})();
