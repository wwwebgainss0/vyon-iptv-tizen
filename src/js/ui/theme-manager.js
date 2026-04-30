/**
 * Theme Manager - Color Themes & Dark Mode Variants
 * Netflix Dark, Pure Black (OLED), Custom Accent Colors
 * ES3 Compatible - WebOS 3.x optimized
 */

window.ThemeManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_theme'
    };

    // ===== AVAILABLE THEMES =====
    var THEMES = {
        'netflix': {
            name: 'Netflix Dark',
            description: 'Standard dunkles Theme',
            colors: {
                background: '#141414',
                surface: '#1a1a1a',
                card: '#2a2a2a',
                cardHover: '#333333',
                accent: '#e50914',
                accentHover: '#f40612',
                text: '#ffffff',
                textSecondary: '#888888',
                border: '#333333'
            }
        },
        'oled': {
            name: 'Pure Black (OLED)',
            description: 'Tiefes Schwarz für OLED TVs',
            colors: {
                background: '#000000',
                surface: '#0a0a0a',
                card: '#1a1a1a',
                cardHover: '#252525',
                accent: '#e50914',
                accentHover: '#f40612',
                text: '#ffffff',
                textSecondary: '#777777',
                border: '#222222'
            }
        },
        'midnight': {
            name: 'Midnight Blue',
            description: 'Dunkles Blau',
            colors: {
                background: '#0d1117',
                surface: '#161b22',
                card: '#21262d',
                cardHover: '#30363d',
                accent: '#2196F3',
                accentHover: '#1976D2',
                text: '#ffffff',
                textSecondary: '#8b949e',
                border: '#30363d'
            }
        },
        'forest': {
            name: 'Forest Green',
            description: 'Beruhigendes Grün',
            colors: {
                background: '#0d1512',
                surface: '#121f1a',
                card: '#1a2d24',
                cardHover: '#243d32',
                accent: '#4CAF50',
                accentHover: '#43A047',
                text: '#ffffff',
                textSecondary: '#8b9e94',
                border: '#2d4037'
            }
        },
        'purple': {
            name: 'Royal Purple',
            description: 'Elegantes Violett',
            colors: {
                background: '#12101a',
                surface: '#1a1625',
                card: '#251f35',
                cardHover: '#342a4a',
                accent: '#9C27B0',
                accentHover: '#8E24AA',
                text: '#ffffff',
                textSecondary: '#9e8bae',
                border: '#3d3055'
            }
        }
    };

    // ===== STATE =====
    var state = {
        currentTheme: 'netflix',
        customAccent: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadTheme();
        applyTheme();
    }

    // ===== STORAGE =====
    function loadTheme() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                var data = JSON.parse(stored);
                state.currentTheme = data.theme || 'netflix';
                state.customAccent = data.customAccent || null;
            }
        } catch (e) {
            console.error('[ThemeManager] Failed to load:', e);
            state.currentTheme = 'netflix';
        }
    }

    function saveTheme() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
                theme: state.currentTheme,
                customAccent: state.customAccent
            }));
        } catch (e) {
            console.error('[ThemeManager] Failed to save:', e);
        }
    }

    // ===== APPLY THEME =====
    function applyTheme(themeName) {
        if (themeName) {
            state.currentTheme = themeName;
        }

        var theme = THEMES[state.currentTheme];
        if (!theme) {
            theme = THEMES['netflix'];
        }

        var colors = theme.colors;

        // Apply custom accent if set
        if (state.customAccent) {
            colors = JSON.parse(JSON.stringify(colors));
            colors.accent = state.customAccent;
            colors.accentHover = adjustBrightness(state.customAccent, -20);
        }

        // Create or update CSS variables style
        var styleId = 'theme-custom-style';
        var style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        var css = ':root {\n';
        css += '  --theme-bg: ' + colors.background + ';\n';
        css += '  --theme-surface: ' + colors.surface + ';\n';
        css += '  --theme-card: ' + colors.card + ';\n';
        css += '  --theme-card-hover: ' + colors.cardHover + ';\n';
        css += '  --theme-accent: ' + colors.accent + ';\n';
        css += '  --theme-accent-hover: ' + colors.accentHover + ';\n';
        css += '  --theme-text: ' + colors.text + ';\n';
        css += '  --theme-text-secondary: ' + colors.textSecondary + ';\n';
        css += '  --theme-border: ' + colors.border + ';\n';
        css += '}\n\n';

        // Override default styles
        css += 'body { background-color: ' + colors.background + ' !important; color: ' + colors.text + ' !important; }\n';
        css += '.header { background: ' + colors.surface + ' !important; }\n';
        css += '.card { background: ' + colors.card + ' !important; }\n';
        css += '.card.focused { outline-color: ' + colors.accent + ' !important; background: rgba(' + hexToRgb(colors.accent) + ', 0.15) !important; }\n';
        css += '.nav-item.focused { color: ' + colors.accent + ' !important; }\n';
        css += '.nav-item.focused::after { background: ' + colors.accent + ' !important; }\n';
        css += '.movie-btn.focused { background: ' + colors.accent + ' !important; }\n';
        css += '.genre-item.selected { background: ' + colors.accent + ' !important; }\n';
        css += '.epg-key.focused { background: ' + colors.accent + ' !important; }\n';
        css += '.quality-option.focused { background: ' + colors.accent + ' !important; }\n';
        css += '.subtitle-option.focused { background: ' + colors.accent + ' !important; }\n';
        css += '.track-option.focused { background: ' + colors.accent + ' !important; }\n';
        css += '.reminder-btn-watch { background: ' + colors.accent + ' !important; }\n';
        css += '.progress { background: ' + colors.accent + ' !important; }\n';
        css += '.logo { color: ' + colors.accent + ' !important; }\n';

        style.textContent = css;

        saveTheme();
    }

    // ===== THEME SELECTOR =====
    function getThemes() {
        var list = [];
        for (var key in THEMES) {
            if (THEMES.hasOwnProperty(key)) {
                list.push({
                    id: key,
                    name: THEMES[key].name,
                    description: THEMES[key].description,
                    colors: THEMES[key].colors
                });
            }
        }
        return list;
    }

    function getCurrentTheme() {
        return state.currentTheme;
    }

    function setTheme(themeName) {
        if (THEMES[themeName]) {
            state.currentTheme = themeName;
            applyTheme();
            return true;
        }
        return false;
    }

    function setCustomAccent(hexColor) {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
            state.customAccent = hexColor;
            applyTheme();
            return true;
        }
        return false;
    }

    function clearCustomAccent() {
        state.customAccent = null;
        applyTheme();
    }

    // ===== HELPERS =====
    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return parseInt(result[1], 16) + ', ' + parseInt(result[2], 16) + ', ' + parseInt(result[3], 16);
        }
        return '229, 9, 20'; // Default red
    }

    function adjustBrightness(hex, percent) {
        var num = parseInt(hex.replace('#', ''), 16);
        var amt = Math.round(2.55 * percent);
        var R = (num >> 16) + amt;
        var G = (num >> 8 & 0x00FF) + amt;
        var B = (num & 0x0000FF) + amt;

        R = Math.max(Math.min(255, R), 0);
        G = Math.max(Math.min(255, G), 0);
        B = Math.max(Math.min(255, B), 0);

        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        getThemes: getThemes,
        getCurrentTheme: getCurrentTheme,
        setTheme: setTheme,
        setCustomAccent: setCustomAccent,
        clearCustomAccent: clearCustomAccent,
        applyTheme: applyTheme
    };
})();
