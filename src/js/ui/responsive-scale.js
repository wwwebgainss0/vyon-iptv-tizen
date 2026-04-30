/**
 * Responsive Scale - Screen-adaptive sizing for WebOS 3.x
 * Sets root font-size based on screen resolution OR user preference
 * All CSS uses rem units for automatic scaling
 * ES3 Compatible - Zero runtime overhead after init
 */

window.ResponsiveScale = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        baseWidth: 1920,
        baseFontSize: 16,
        storageKey: 'iptv_font_size',
        // Available font size options
        sizes: {
            'auto': 0,      // Automatic based on screen
            'small': 14,
            'normal': 16,
            'large': 18,
            'xlarge': 20,
            'xxlarge': 22
        },
        sizeLabels: {
            'auto': 'Automatisch',
            'small': 'Klein',
            'normal': 'Normal',
            'large': 'Groß',
            'xlarge': 'Sehr Groß',
            'xxlarge': 'Extra Groß'
        }
    };

    // ===== STATE =====
    var state = {
        screenWidth: 0,
        screenHeight: 0,
        scaleFactor: 1,
        rootFontSize: 16,
        userSetting: 'auto',  // User's preference
        initialized: false
    };

    // ===== STORAGE =====
    function loadSetting() {
        try {
            var saved = localStorage.getItem(CONFIG.storageKey);
            if (saved && CONFIG.sizes[saved] !== undefined) {
                state.userSetting = saved;
                return saved;
            }
        } catch (e) {
            // localStorage not available
        }
        return 'auto';
    }

    function saveSetting(setting) {
        try {
            localStorage.setItem(CONFIG.storageKey, setting);
        } catch (e) {
            // localStorage not available
        }
    }

    // ===== INITIALIZATION =====
    function initialize() {
        if (state.initialized) return state;

        // Load user preference
        loadSetting();

        // Detect screen size
        state.screenWidth = window.innerWidth || document.documentElement.clientWidth || 1920;
        state.screenHeight = window.innerHeight || document.documentElement.clientHeight || 1080;

        // Calculate scale factor based on width
        state.scaleFactor = state.screenWidth / CONFIG.baseWidth;

        // Determine root font size
        calculateFontSize();

        // Apply to document
        applyRootFontSize();

        state.initialized = true;

        // Log for debugging
        if (window.console && window.console.log) {
            console.log('[ResponsiveScale] Screen: ' + state.screenWidth + 'x' + state.screenHeight);
            console.log('[ResponsiveScale] Setting: ' + state.userSetting + ', Root Font: ' + state.rootFontSize + 'px');
        }

        return state;
    }

    function calculateFontSize() {
        if (state.userSetting === 'auto') {
            // Auto mode: calculate based on screen
            var calculatedSize = Math.round(CONFIG.baseFontSize * state.scaleFactor);
            // Clamp between 12 and 24
            if (calculatedSize < 12) calculatedSize = 12;
            if (calculatedSize > 24) calculatedSize = 24;
            state.rootFontSize = calculatedSize;
        } else {
            // Manual mode: use fixed size
            state.rootFontSize = CONFIG.sizes[state.userSetting] || 16;
        }
    }

    function applyRootFontSize() {
        var html = document.documentElement;
        var body = document.body;

        if (html) {
            html.style.fontSize = state.rootFontSize + 'px';
        }
        if (body) {
            body.style.fontSize = state.rootFontSize + 'px';
        }
    }

    // ===== SET FONT SIZE =====
    function setFontSize(setting) {
        if (CONFIG.sizes[setting] === undefined) return false;

        state.userSetting = setting;
        saveSetting(setting);
        calculateFontSize();
        applyRootFontSize();

        if (window.console && window.console.log) {
            console.log('[ResponsiveScale] Changed to: ' + setting + ' (' + state.rootFontSize + 'px)');
        }

        return true;
    }

    // ===== GETTERS =====
    function getCurrentSetting() {
        return state.userSetting;
    }

    function getCurrentLabel() {
        return CONFIG.sizeLabels[state.userSetting] || 'Automatisch';
    }

    function getAvailableSizes() {
        var result = [];
        for (var key in CONFIG.sizes) {
            if (CONFIG.sizes.hasOwnProperty(key)) {
                result.push({
                    id: key,
                    label: CONFIG.sizeLabels[key],
                    size: CONFIG.sizes[key]
                });
            }
        }
        return result;
    }

    function getInfo() {
        return {
            screenWidth: state.screenWidth,
            screenHeight: state.screenHeight,
            scaleFactor: state.scaleFactor,
            rootFontSize: state.rootFontSize,
            userSetting: state.userSetting
        };
    }

    // ===== UTILITY =====
    function pxToRem(px) {
        return px / state.rootFontSize;
    }

    function remToPx(rem) {
        return rem * state.rootFontSize;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        setFontSize: setFontSize,
        getCurrentSetting: getCurrentSetting,
        getCurrentLabel: getCurrentLabel,
        getAvailableSizes: getAvailableSizes,
        getInfo: getInfo,
        pxToRem: pxToRem,
        remToPx: remToPx
    };
})();
