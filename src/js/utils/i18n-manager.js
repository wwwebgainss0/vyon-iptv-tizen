/**
 * i18n Manager - Internationalization for WebOS 3.x
 * ES3 Compatible - Zero allocations in hotpath
 *
 * Features:
 * - Multi-language support (en-US, de-DE, fr-FR)
 * - localStorage persistence
 * - Parameter interpolation: i18n.t('key', {param: 'value'})
 * - Fallback to English
 * - System language detection
 */

window.i18n = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_language',
        DEFAULT_LANG: 'en-US',
        FALLBACK_LANG: 'en-US'
    };

    // ===== SUPPORTED LANGUAGES =====
    var LANGUAGES = {
        'en-US': 'English',
        'de-DE': 'Deutsch',
        'fr-FR': 'Français'
    };

    // ===== STATE =====
    var state = {
        lang: 'en-US',
        strings: {},
        isInitialized: false
    };

    // ===== INITIALIZATION =====
    function init() {
        if (state.isInitialized) return;

        loadPreference();
        loadStrings();
        state.isInitialized = true;

        console.log('[i18n] Initialized with language:', state.lang);
    }

    // ===== STORAGE =====
    function loadPreference() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored && LANGUAGES[stored]) {
                state.lang = stored;
            } else {
                // Detect system language
                state.lang = detectSystemLanguage();
            }
        } catch (e) {
            console.error('[i18n] Failed to load preference:', e);
            state.lang = CONFIG.DEFAULT_LANG;
        }
    }

    function savePreference() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, state.lang);
        } catch (e) {
            console.error('[i18n] Failed to save preference:', e);
        }
    }

    // ===== LANGUAGE DETECTION =====
    function detectSystemLanguage() {
        var navLang = navigator.language || navigator.userLanguage || '';
        navLang = navLang.toLowerCase().replace('_', '-');

        // Check exact match
        for (var lang in LANGUAGES) {
            if (LANGUAGES.hasOwnProperty(lang)) {
                if (lang.toLowerCase() === navLang) {
                    return lang;
                }
            }
        }

        // Check language code prefix (e.g., 'de' from 'de-AT')
        var langCode = navLang.substring(0, 2);
        for (var lang in LANGUAGES) {
            if (LANGUAGES.hasOwnProperty(lang)) {
                if (lang.toLowerCase().substring(0, 2) === langCode) {
                    return lang;
                }
            }
        }

        return CONFIG.DEFAULT_LANG;
    }

    // ===== TRANSLATION LOADING =====
    function loadStrings() {
        if (window.LOCALES && window.LOCALES[state.lang]) {
            state.strings = window.LOCALES[state.lang];
        } else if (window.LOCALES && window.LOCALES[CONFIG.FALLBACK_LANG]) {
            state.strings = window.LOCALES[CONFIG.FALLBACK_LANG];
            console.warn('[i18n] Language not found, using fallback:', CONFIG.FALLBACK_LANG);
        } else {
            state.strings = {};
            console.warn('[i18n] No locale files loaded');
        }
    }

    // ===== TRANSLATION GETTER =====
    /**
     * Get translated string
     * @param {string} key - Translation key (e.g., 'nav.live_tv')
     * @param {object} params - Optional parameters for interpolation
     * @returns {string} Translated string
     *
     * Usage:
     *   i18n.t('nav.live_tv')  // → "Live TV"
     *   i18n.t('error.loading', {type: 'channels'})  // → "Failed to load channels"
     */
    function t(key, params) {
        // Get from current language
        var text = state.strings[key];

        // Fallback to English if not found
        if (!text && state.lang !== CONFIG.FALLBACK_LANG) {
            if (window.LOCALES && window.LOCALES[CONFIG.FALLBACK_LANG]) {
                text = window.LOCALES[CONFIG.FALLBACK_LANG][key];
            }
        }

        // Return key as last resort
        if (!text) {
            text = key;
        }

        // Parameter interpolation: {{param}} → value
        if (params) {
            for (var k in params) {
                if (params.hasOwnProperty(k)) {
                    var placeholder = '{{' + k + '}}';
                    var value = String(params[k]);
                    // Use split/join for ES3 compatibility (no replaceAll)
                    text = text.split(placeholder).join(value);
                }
            }
        }

        return text;
    }

    // ===== LANGUAGE SWITCHING =====
    function setLanguage(lang) {
        if (!LANGUAGES[lang]) {
            console.error('[i18n] Unsupported language:', lang);
            return false;
        }

        if (state.lang === lang) {
            return true; // Already set
        }

        state.lang = lang;
        savePreference();
        loadStrings();

        console.log('[i18n] Language changed to:', lang);

        // Dispatch event for modules to update
        if (window.dispatchEvent) {
            try {
                var event = document.createEvent('CustomEvent');
                event.initCustomEvent('languageChanged', true, true, { language: lang });
                window.dispatchEvent(event);
            } catch (e) {
                // Fallback for older browsers
            }
        }

        return true;
    }

    // ===== GETTERS =====
    function getCurrentLanguage() {
        return state.lang;
    }

    function getLanguages() {
        return LANGUAGES;
    }

    function getLanguageList() {
        var list = [];
        for (var code in LANGUAGES) {
            if (LANGUAGES.hasOwnProperty(code)) {
                list.push({
                    code: code,
                    name: LANGUAGES[code]
                });
            }
        }
        return list;
    }

    function isInitialized() {
        return state.isInitialized;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        t: t,
        setLanguage: setLanguage,
        getCurrentLanguage: getCurrentLanguage,
        getLanguages: getLanguages,
        getLanguageList: getLanguageList,
        isInitialized: isInitialized,
        // For settings integration
        LANGUAGES: LANGUAGES
    };
})();
