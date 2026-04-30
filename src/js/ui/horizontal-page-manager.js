/**
 * Horizontal Page Manager v1.0
 * Paginated List with Prefetch (Bedrock Pattern)
 * ES3 Compatible - Zero GC in hotpath
 */

window.HorizontalPageManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        PAGE_SIZE: 30,
        VISIBLE_CARDS: 12,
        PREFETCH_THRESHOLD: 20,
        MAX_PAGES_IN_MEMORY: 5,
        SLIDE_AMOUNT: 6
    };

    // ===== STATE PER ROW =====
    var rowStates = {};

    // ===== OBJECT POOL (Zero GC) =====
    var pool = {
        pageInfo: {pageIndex: 0, startIndex: 0, endIndex: 0},
        visibleItems: []
    };

    for (var i = 0; i < CONFIG.VISIBLE_CARDS; i++) {
        pool.visibleItems.push(null);
    }

    // ===== INITIALIZATION =====
    function initializeRow(rowId, allItems) {
        var pages = [];
        var totalPages = Math.ceil(allItems.length / CONFIG.PAGE_SIZE);

        for (var i = 0; i < totalPages; i++) {
            var start = i * CONFIG.PAGE_SIZE;
            var end = Math.min(start + CONFIG.PAGE_SIZE, allItems.length);

            pages.push({
                index: i,
                items: allItems.slice(start, end),
                isLoaded: true
            });
        }

        rowStates[rowId] = {
            pages: pages,
            windowStart: 0,
            loadedPages: [0],
            totalItems: allItems.length,
            totalPages: totalPages,
            isLoading: false
        };
    }

    // ===== MATHEMATICAL PAGE CALCULATION =====
    function getPageForIndex(virtualIndex) {
        pool.pageInfo.pageIndex = Math.floor(virtualIndex / CONFIG.PAGE_SIZE);
        pool.pageInfo.startIndex = pool.pageInfo.pageIndex * CONFIG.PAGE_SIZE;
        pool.pageInfo.endIndex = pool.pageInfo.startIndex + CONFIG.PAGE_SIZE - 1;
        return pool.pageInfo;
    }

    // ===== GET VISIBLE ITEMS FOR CARDS =====
    function getVisibleItems(rowId, startVirtualIndex) {
        var state = rowStates[rowId];
        if (!state) {
            return [];
        }

        var items = [];

        for (var i = 0; i < CONFIG.VISIBLE_CARDS; i++) {
            var virtualIndex = startVirtualIndex + i;

            if (virtualIndex >= state.totalItems) {
                break;
            }

            var pageIndex = Math.floor(virtualIndex / CONFIG.PAGE_SIZE);
            var itemIndexInPage = virtualIndex % CONFIG.PAGE_SIZE;

            if (state.pages[pageIndex] && state.pages[pageIndex].isLoaded) {
                var item = state.pages[pageIndex].items[itemIndexInPage];
                if (item) {
                    items.push(item);
                }
            }
        }

        return items;
    }

    // ===== SLIDE WINDOW =====
    function slideWindowRight(rowId) {
        var state = rowStates[rowId];
        if (!state) {
            return false;
        }

        var newWindowStart = state.windowStart + CONFIG.SLIDE_AMOUNT;

        if (newWindowStart + CONFIG.VISIBLE_CARDS > state.totalItems) {
            var maxWindowStart = state.totalItems - CONFIG.VISIBLE_CARDS;
            if (maxWindowStart <= state.windowStart) {
                return false;
            }
            newWindowStart = maxWindowStart;
        }

        state.windowStart = newWindowStart;
        return true;
    }

    function slideWindowLeft(rowId) {
        var state = rowStates[rowId];
        if (!state) return false;

        var newWindowStart = state.windowStart - CONFIG.SLIDE_AMOUNT;

        if (newWindowStart < 0) {
            if (state.windowStart === 0) {
                return false;
            }
            newWindowStart = 0;
        }

        state.windowStart = newWindowStart;
        return true;
    }

    // ===== PREFETCH LOGIC =====
    function checkPrefetch(rowId, currentVirtualIndex) {
        var state = rowStates[rowId];
        if (!state || state.isLoading) return false;

        var currentPage = Math.floor(currentVirtualIndex / CONFIG.PAGE_SIZE);
        var itemsIntoPage = currentVirtualIndex % CONFIG.PAGE_SIZE;

        if (itemsIntoPage >= CONFIG.PREFETCH_THRESHOLD) {
            var nextPage = currentPage + 1;

            if (nextPage < state.totalPages && !isPageLoaded(rowId, nextPage)) {
                loadPage(rowId, nextPage);
                return true;
            }
        }

        return false;
    }

    function isPageLoaded(rowId, pageIndex) {
        var state = rowStates[rowId];
        if (!state) return false;

        for (var i = 0; i < state.loadedPages.length; i++) {
            if (state.loadedPages[i] === pageIndex) {
                return true;
            }
        }
        return false;
    }

    // ===== LOAD PAGE =====
    function loadPage(rowId, pageIndex) {
        var state = rowStates[rowId];
        if (!state || state.isLoading) return;

        state.isLoading = true;

        if (state.pages[pageIndex]) {
            state.pages[pageIndex].isLoaded = true;
            state.loadedPages.push(pageIndex);

            if (state.loadedPages.length > CONFIG.MAX_PAGES_IN_MEMORY) {
                var oldestPage = state.loadedPages.shift();
                var currentPage = Math.floor(state.windowStart / CONFIG.PAGE_SIZE);
                if (oldestPage < currentPage - 1) {
                    if (state.pages[oldestPage]) {
                        state.pages[oldestPage].items = null;
                        state.pages[oldestPage].isLoaded = false;
                    }
                }
            }
        }

        state.isLoading = false;
    }

    // ===== GET WINDOW POSITION =====
    function getWindowStart(rowId) {
        var state = rowStates[rowId];
        return state ? state.windowStart : 0;
    }

    function setWindowStart(rowId, windowStart) {
        var state = rowStates[rowId];
        if (state) {
            state.windowStart = windowStart;
        }
    }

    // ===== CHECK IF CAN MOVE =====
    function canMoveRight(rowId, currentCardIndex) {
        var state = rowStates[rowId];
        if (!state) return false;

        var virtualIndex = state.windowStart + currentCardIndex;

        if (virtualIndex >= state.totalItems - 1) {
            return false;
        }

        return true;
    }

    function canMoveLeft(rowId, currentCardIndex) {
        var state = rowStates[rowId];
        if (!state) return false;

        var virtualIndex = state.windowStart + currentCardIndex;

        if (virtualIndex <= 0) {
            return false;
        }

        return true;
    }

    // ===== STATS =====
    function getStats(rowId) {
        var state = rowStates[rowId];
        if (!state) return null;

        return {
            rowId: rowId,
            totalItems: state.totalItems,
            totalPages: state.totalPages,
            loadedPages: state.loadedPages.length,
            windowStart: state.windowStart,
            windowEnd: state.windowStart + CONFIG.VISIBLE_CARDS - 1
        };
    }

    // ===== PUBLIC API =====
    return {
        init: initializeRow,
        getVisibleItems: getVisibleItems,
        slideWindowRight: slideWindowRight,
        slideWindowLeft: slideWindowLeft,
        checkPrefetch: checkPrefetch,
        getPageForIndex: getPageForIndex,
        getWindowStart: getWindowStart,
        setWindowStart: setWindowStart,
        canMoveRight: canMoveRight,
        canMoveLeft: canMoveLeft,
        getState: function(rowId) { return rowStates[rowId]; },
        getStats: getStats,
        CONFIG: CONFIG
    };
})();
