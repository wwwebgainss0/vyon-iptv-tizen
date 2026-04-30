/**
 * Category Lock Overlay
 * Select categories to lock with parental control
 * Supports Live TV, Movies, and Series categories
 * ES3 Compatible for WebOS 3.x
 */

window.CategoryLock = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        STORAGE_KEYS: {
            livetv: 'ultra_iptv_locked_categories_livetv',
            movies: 'ultra_iptv_locked_categories_movies',
            series: 'ultra_iptv_locked_categories_series'
        },
        AUTO_LOCK_DONE_KEY: 'ultra_iptv_auto_lock_done',
        TITLES: {
            livetv: 'Live TV Kategorien sperren',
            movies: 'Film Kategorien sperren',
            series: 'Serien Kategorien sperren'
        },
        ICONS: {
            livetv: '▶',
            movies: '●',
            series: '■'
        },
        // Keywords für automatische Sperrung (case-insensitive)
        ADULT_KEYWORDS: [
            'xxx', 'adult', 'porn', 'porno', 'sex', 'erotic', 'erotik',
            '18+', '+18', 'x-rated', 'xrated', 'mature', 'explicit',
            'hardcore', 'playboy', 'penthouse', 'brazzers', 'bangbros',
            'naughty', 'sexy', 'hot girls', 'nude', 'naked', 'fetish',
            'bdsm', 'bondage', 'stripper', 'escort', 'cam girls',
            'live sex', 'red light', 'redlight', 'blue movie'
        ]
    };

    // ===== STATE =====
    var state = {
        isVisible: false,
        currentType: 'livetv',  // 'livetv', 'movies', 'series'
        categories: [],
        lockedIds: {
            livetv: [],
            movies: [],
            series: []
        },
        focusIndex: 0,
        scrollOffset: 0,
        maxVisible: 8
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        title: null,
        list: null,
        counter: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadAllLockedCategories();
        createOverlay();
        setupKeyHandler();
        return true;
    }

    // ===== AUTO-LOCK ADULT CONTENT =====
    function isAdultCategory(categoryName) {
        if (!categoryName) return false;
        var nameLower = categoryName.toLowerCase();

        for (var i = 0; i < CONFIG.ADULT_KEYWORDS.length; i++) {
            if (nameLower.indexOf(CONFIG.ADULT_KEYWORDS[i]) !== -1) {
                return true;
            }
        }
        return false;
    }

    function autoLockAdultCategories(categories, type) {
        if (!categories || categories.length === 0) return 0;

        var lockedCount = 0;
        var lockedList = state.lockedIds[type] || [];

        for (var i = 0; i < categories.length; i++) {
            var cat = categories[i];
            var catId = String(cat.category_id);
            var catName = cat.category_name || '';

            // Check if adult category and not already locked
            if (isAdultCategory(catName) && lockedList.indexOf(catId) === -1) {
                lockedList.push(catId);
                lockedCount++;
                console.log('[CategoryLock] Auto-locked adult category:', catName);
            }
        }

        if (lockedCount > 0) {
            state.lockedIds[type] = lockedList;
            // Save to localStorage
            try {
                localStorage.setItem(CONFIG.STORAGE_KEYS[type], JSON.stringify(lockedList));
            } catch (e) {}
        }

        return lockedCount;
    }

    function autoLockAllAdultCategories() {
        var totalLocked = 0;

        // Get categories for each type
        var liveTVCats = getCategoriesForType('livetv');
        var movieCats = getCategoriesForType('movies');
        var seriesCats = getCategoriesForType('series');

        totalLocked += autoLockAdultCategories(liveTVCats, 'livetv');
        totalLocked += autoLockAdultCategories(movieCats, 'movies');
        totalLocked += autoLockAdultCategories(seriesCats, 'series');

        if (totalLocked > 0) {
            console.log('[CategoryLock] Auto-locked ' + totalLocked + ' adult categories');
            showToast(totalLocked + ' Erwachsenen-Kategorien automatisch gesperrt');
        }

        return totalLocked;
    }

    // Called after categories are loaded
    function runAutoLockIfNeeded() {
        // Always check for new adult categories (in case new ones were added)
        setTimeout(function() {
            autoLockAllAdultCategories();
        }, 2000); // Wait for categories to load
    }

    function loadAllLockedCategories() {
        for (var type in CONFIG.STORAGE_KEYS) {
            if (CONFIG.STORAGE_KEYS.hasOwnProperty(type)) {
                loadLockedCategoriesForType(type);
            }
        }
    }

    function loadLockedCategoriesForType(type) {
        try {
            var saved = localStorage.getItem(CONFIG.STORAGE_KEYS[type]);
            if (saved) {
                state.lockedIds[type] = JSON.parse(saved);
            } else {
                state.lockedIds[type] = [];
            }
        } catch (e) {
            state.lockedIds[type] = [];
        }
    }

    function saveLockedCategories() {
        try {
            var key = CONFIG.STORAGE_KEYS[state.currentType];
            localStorage.setItem(key, JSON.stringify(state.lockedIds[state.currentType]));
        } catch (e) {
            console.warn('[CategoryLock] Failed to save');
        }
    }

    function createOverlay() {
        var overlay = document.createElement('div');
        overlay.id = 'category-lock-overlay';
        overlay.className = 'category-lock-overlay';
        overlay.style.display = 'none';

        var html = '';
        html += '<div class="category-lock-modal">';
        html += '<div class="category-lock-header">';
        html += '<div class="category-lock-title" id="category-lock-title">Kategorien sperren</div>';
        html += '<div class="category-lock-counter" id="category-lock-counter">0 gesperrt</div>';
        html += '</div>';
        html += '<div class="category-lock-list" id="category-lock-list"></div>';
        html += '<div class="category-lock-hint">';
        html += '↑↓ Navigieren • OK = Sperren/Entsperren • GELB = Alle entsperren • BACK = Schließen';
        html += '</div>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        cache.overlay = overlay;
        cache.title = document.getElementById('category-lock-title');
        cache.list = document.getElementById('category-lock-list');
        cache.counter = document.getElementById('category-lock-counter');
    }

    function setupKeyHandler() {
        // Use capture phase (true) to intercept before other handlers
        document.addEventListener('keydown', function(event) {
            if (!state.isVisible) return;

            var keyCode = event.keyCode;

            // Handle BACK button immediately with high priority
            if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                hide();
                return false;
            }

            var handled = false;

            switch (keyCode) {
                case 38: // UP
                    handled = navigateUp();
                    break;
                case 40: // DOWN
                    handled = navigateDown();
                    break;
                case 13: // OK
                    handled = toggleCurrentCategory();
                    break;
                case 405: // YELLOW
                case 403:
                    handled = unlockAll();
                    break;
            }

            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);  // true = capture phase
    }

    // ===== NAVIGATION =====
    function navigateUp() {
        if (state.focusIndex > 0) {
            state.focusIndex--;
            if (state.focusIndex < state.scrollOffset) {
                state.scrollOffset = state.focusIndex;
            }
            render();
        }
        return true;
    }

    function navigateDown() {
        if (state.focusIndex < state.categories.length - 1) {
            state.focusIndex++;
            if (state.focusIndex >= state.scrollOffset + state.maxVisible) {
                state.scrollOffset = state.focusIndex - state.maxVisible + 1;
            }
            render();
        }
        return true;
    }

    // ===== LOCK MANAGEMENT =====
    function toggleCurrentCategory() {
        var category = state.categories[state.focusIndex];
        if (!category) return false;

        var catId = String(category.category_id);
        var lockedList = state.lockedIds[state.currentType];
        var index = lockedList.indexOf(catId);

        if (index === -1) {
            // Lock it
            lockedList.push(catId);
        } else {
            // Unlock it
            lockedList.splice(index, 1);
        }

        saveLockedCategories();
        render();
        return true;
    }

    function unlockAll() {
        state.lockedIds[state.currentType] = [];
        saveLockedCategories();
        render();
        showToast('Alle Kategorien entsperrt');
        return true;
    }

    function isLocked(categoryId) {
        var lockedList = state.lockedIds[state.currentType];
        return lockedList.indexOf(String(categoryId)) !== -1;
    }

    function isLockedForType(categoryId, type) {
        var lockedList = state.lockedIds[type] || [];
        return lockedList.indexOf(String(categoryId)) !== -1;
    }

    // ===== RENDERING =====
    function render() {
        if (!cache.list) return;

        // Update title
        if (cache.title) {
            cache.title.textContent = CONFIG.TITLES[state.currentType] || 'Kategorien sperren';
        }

        var html = '';
        var visibleCategories = state.categories.slice(
            state.scrollOffset,
            state.scrollOffset + state.maxVisible
        );

        if (visibleCategories.length === 0) {
            html = '<div class="category-lock-empty">Keine Kategorien verfügbar</div>';
        } else {
            for (var i = 0; i < visibleCategories.length; i++) {
                var cat = visibleCategories[i];
                var actualIndex = state.scrollOffset + i;
                var locked = isLocked(cat.category_id);
                var focused = actualIndex === state.focusIndex;

                var itemClass = 'category-lock-item';
                if (focused) itemClass += ' focused';
                if (locked) itemClass += ' locked';

                html += '<div class="' + itemClass + '" data-id="' + cat.category_id + '">';
                html += '<span class="category-lock-icon">' + (locked ? '[X]' : CONFIG.ICONS[state.currentType]) + '</span>';
                html += '<span class="category-lock-name">' + escapeHtml(cat.category_name) + '</span>';
                html += '<span class="category-lock-status">' + (locked ? 'GESPERRT' : '') + '</span>';
                html += '</div>';
            }
        }

        // Scroll indicators
        if (state.scrollOffset > 0) {
            html = '<div class="category-lock-scroll-up">▲ Mehr</div>' + html;
        }
        if (state.scrollOffset + state.maxVisible < state.categories.length) {
            html += '<div class="category-lock-scroll-down">▼ Mehr</div>';
        }

        cache.list.innerHTML = html;

        // Update counter
        if (cache.counter) {
            var count = state.lockedIds[state.currentType].length;
            cache.counter.textContent = count + ' gesperrt';
        }
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'category-lock-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            toast.classList.add('show');
        }, 10);

        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 1500);
    }

    // ===== SHOW FUNCTIONS FOR EACH TYPE =====
    function showLiveTV(categories) {
        show(categories, 'livetv');
    }

    function showMovies(categories) {
        show(categories, 'movies');
    }

    function showSeries(categories) {
        show(categories, 'series');
    }

    // ===== PUBLIC API =====
    function show(categories, type) {
        state.currentType = type || 'livetv';

        // Auto-fetch categories if not provided
        if (!categories || categories.length === 0) {
            categories = getCategoriesForType(state.currentType);
        }

        state.categories = categories || [];
        state.focusIndex = 0;
        state.scrollOffset = 0;
        state.isVisible = true;

        // Refresh locked IDs for current type
        loadLockedCategoriesForType(state.currentType);

        if (cache.overlay) {
            cache.overlay.style.display = 'flex';
        }

        render();

        // Push to navigation stack
        if (window.NavigationStack) {
            window.NavigationStack.push('category-lock', window.NavigationStack.LAYERS.MODAL, {
                onBack: function() {
                    hide();
                    return true;
                }
            });
        }
    }

    function getCategoriesForType(type) {
        if (type === 'livetv') {
            // Try to get live TV categories from ScreenManager first
            if (window.ScreenManager && window.ScreenManager.getLiveTVCategories) {
                var cats = window.ScreenManager.getLiveTVCategories();
                if (cats && cats.length > 0) return cats;
            }
            // Fallback to IPTVApp
            if (window.IPTVApp && window.IPTVApp.getState) {
                var appState = window.IPTVApp.getState();
                return appState.categories || [];
            }
        } else if (type === 'movies') {
            // Try to get movie categories from ScreenManager
            if (window.ScreenManager && window.ScreenManager.getMovieCategories) {
                return window.ScreenManager.getMovieCategories() || [];
            }
        } else if (type === 'series') {
            // Try to get series categories from ScreenManager
            if (window.ScreenManager && window.ScreenManager.getSeriesCategories) {
                return window.ScreenManager.getSeriesCategories() || [];
            }
        }
        return [];
    }

    function hide() {
        state.isVisible = false;

        if (cache.overlay) {
            cache.overlay.style.display = 'none';
        }

        // Remove from navigation stack
        if (window.NavigationStack && window.NavigationStack.has('category-lock')) {
            window.NavigationStack.remove('category-lock');
        }
    }

    function getLockedCategories(type) {
        type = type || state.currentType;
        return state.lockedIds[type] ? state.lockedIds[type].slice() : [];
    }

    function isCategoryLocked(categoryId, type) {
        type = type || 'livetv';
        return isLockedForType(categoryId, type);
    }

    function getLockedCount(type) {
        if (type) {
            return state.lockedIds[type] ? state.lockedIds[type].length : 0;
        }
        // Total across all types
        var total = 0;
        for (var t in state.lockedIds) {
            if (state.lockedIds.hasOwnProperty(t)) {
                total += state.lockedIds[t].length;
            }
        }
        return total;
    }

    // ===== RETURN PUBLIC API =====
    return {
        init: init,
        show: show,
        showLiveTV: showLiveTV,
        showMovies: showMovies,
        showSeries: showSeries,
        hide: hide,
        isVisible: function() { return state.isVisible; },
        getLockedCategories: getLockedCategories,
        isCategoryLocked: isCategoryLocked,
        getLockedCount: getLockedCount,
        // Auto-lock adult content
        isAdultCategory: isAdultCategory,
        autoLockAdultCategories: autoLockAllAdultCategories,
        runAutoLock: runAutoLockIfNeeded
    };
})();
