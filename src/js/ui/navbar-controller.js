/**
 * NavBar Controller - Compact Text Navigation
 * ES3 Compatible - WebOS 3.x optimized
 */

window.NavBarController = (function() {
    'use strict';

    var CONFIG = {
        ITEMS: ['livetv', 'movies', 'series', 'activation']
    };

    var state = {
        isNavFocused: false,
        focusedIndex: 0,
        activeScreen: 'livetv',
        searchFocused: false
    };

    var cache = {
        header: null,
        nav: null,
        items: [],
        searchBtn: null,
        indicator: null
    };

    function init() {
        cacheElements();
        createActiveIndicator();
        updateActiveIndicator();
        return true;
    }

    function cacheElements() {
        cache.header = document.querySelector('.header');
        cache.nav = document.querySelector('.main-nav');
        cache.searchBtn = document.getElementById('search-btn');

        for (var i = 0; i < CONFIG.ITEMS.length; i++) {
            var id = CONFIG.ITEMS[i];
            var item = document.getElementById('nav-' + id);
            if (item) {
                cache.items.push(item);
            }
        }
    }

    function createActiveIndicator() {
        var indicator = document.createElement('div');
        indicator.className = 'nav-active-indicator';
        indicator.id = 'nav-indicator';

        if (cache.nav) {
            cache.nav.appendChild(indicator);
        }
        cache.indicator = indicator;
    }

    function enterNavFocus() {
        if (state.isNavFocused) return;
        state.isNavFocused = true;
        updateFocusVisual();
    }

    function exitNavFocus() {
        if (!state.isNavFocused) return;
        state.isNavFocused = false;
        state.searchFocused = false;
        clearAllFocus();
    }

    function focusLeft() {
        if (state.searchFocused) {
            // Move from search to last nav item
            state.searchFocused = false;
            state.focusedIndex = cache.items.length - 1;
        } else if (state.focusedIndex > 0) {
            state.focusedIndex--;
        }
        updateFocusVisual();
        return true;
    }

    function focusRight() {
        if (state.focusedIndex < cache.items.length - 1) {
            state.focusedIndex++;
        } else if (!state.searchFocused && cache.searchBtn) {
            // Move to search button
            state.searchFocused = true;
        }
        updateFocusVisual();
        return true;
    }

    function updateFocusVisual() {
        // Clear all focus
        for (var i = 0; i < cache.items.length; i++) {
            cache.items[i].classList.remove('nav-focus');
        }
        if (cache.searchBtn) {
            cache.searchBtn.classList.remove('focused');
        }

        // Set focus
        if (state.searchFocused) {
            if (cache.searchBtn) {
                cache.searchBtn.classList.add('focused');
            }
        } else {
            var item = cache.items[state.focusedIndex];
            if (item) {
                item.classList.add('nav-focus');
            }
        }
    }

    function clearAllFocus() {
        for (var i = 0; i < cache.items.length; i++) {
            cache.items[i].classList.remove('nav-focus');
        }
        if (cache.searchBtn) {
            cache.searchBtn.classList.remove('focused');
        }
    }

    // ===== ACTIVE STATE =====
    function setActiveScreen(screen) {
        state.activeScreen = screen;

        // Update active class on items
        for (var i = 0; i < cache.items.length; i++) {
            var id = CONFIG.ITEMS[i];
            if (id === screen) {
                cache.items[i].classList.add('nav-active');
                state.focusedIndex = i;  // Focus follows active
            } else {
                cache.items[i].classList.remove('nav-active');
            }
        }

        updateActiveIndicator();
    }

    function updateActiveIndicator() {
        if (!cache.indicator || !cache.nav) return;

        var activeIndex = CONFIG.ITEMS.indexOf(state.activeScreen);
        if (activeIndex < 0) activeIndex = 0;

        var activeItem = cache.items[activeIndex];
        if (!activeItem) return;

        // Use offsetLeft/offsetWidth to avoid forced layout
        cache.indicator.style.left = activeItem.offsetLeft + 'px';
        cache.indicator.style.width = activeItem.offsetWidth + 'px';
    }

    // ===== SELECTION =====
    function select() {
        if (state.searchFocused) {
            // Open search
            if (window.SearchOverlay) {
                window.SearchOverlay.show();
            }
            exitNavFocus();
            return 'search';
        }

        var screen = CONFIG.ITEMS[state.focusedIndex];

        if (screen === 'activation') {
            // Open settings
            if (window.SettingsScreen) {
                window.SettingsScreen.show();
            }
            exitNavFocus();
            return 'settings';
        }

        // Switch screen
        setActiveScreen(screen);
        exitNavFocus();

        // Notify screen manager
        if (window.ScreenManager) {
            window.ScreenManager.switchToScreen(screen);
        }

        return screen;
    }

    return {
        init: init,
        enterNavFocus: enterNavFocus,
        exitNavFocus: exitNavFocus,
        focusLeft: focusLeft,
        focusRight: focusRight,
        select: select,
        setActiveScreen: setActiveScreen,
        isNavFocused: function() { return state.isNavFocused; },
        isExpanded: function() { return false; },
        getCurrentIndex: function() { return state.focusedIndex; },
        isSearchFocused: function() { return state.searchFocused; }
    };
})();
