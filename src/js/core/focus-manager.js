/**
 * Focus Manager v3.0 - Zero GC Hotpath
 * ZERO object allocations in navigation path
 * Object pooling for all return values
 * ES3 Compatible
 */

window.FocusManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        SLOT_HEIGHT: 280,       // Title 54 + Cards 146 + Padding 30 + Margin 50 = 280
        CARD_WIDTH: 260,
        VIEWPORT_TOP: 90,       // Must match #slot-container top in CSS
        VIEWPORT_HEIGHT: 0
    };

    // ===== STATE =====
    var state = {
        currentSlot: 0,
        currentCard: 0,
        isInitialized: false
    };

    // ===== ROW MEMORY =====
    var rowMemory = {};

    // ===== CACHED REFERENCES =====
    var cache = {
        focusedElement: null,
        slotContainer: null
    };

    // ===== OBJECT POOL =====
    var pool = {
        position: {slot: 0, card: 0},
        stats: {
            currentSlot: 0,
            currentCard: 0,
            slotHeight: 0,
            cardWidth: 0,
            viewportHeight: 0,
            scrollTop: 0
        }
    };

    // ===== CALLBACKS =====
    var callbacks = {
        onFocusChange: null
    };

    // ===== INITIALIZATION =====
    function initialize(config) {
        if (config && config.onFocusChange) {
            callbacks.onFocusChange = config.onFocusChange;
        }

        cache.slotContainer = document.getElementById('slot-container');
        CONFIG.VIEWPORT_HEIGHT = window.innerHeight || document.documentElement.clientHeight;

        state.isInitialized = true;
        return true;
    }

    // ===== MATHEMATICAL SCROLL =====
    function ensureSlotVisible(slotIndex) {
        if (!cache.slotContainer) return;

        // Get mode and scale factor
        var isMovieMode = window.SlotRenderer && window.SlotRenderer.getState &&
                          window.SlotRenderer.getState().mode === 'movies';
        var scaleFactor = isMovieMode ? 1.12 : 1;

        // Get dynamic slot height from SlotRenderer (movies vs livetv)
        var slotHeight = CONFIG.SLOT_HEIGHT;
        if (window.SlotRenderer && window.SlotRenderer.getRowHeight) {
            slotHeight = window.SlotRenderer.getRowHeight();
        }

        // Calculate position with scale overflow buffer
        var scaleBuffer = isMovieMode ? 30 : 0;
        var slotTop = (slotIndex * slotHeight) - scaleBuffer;
        var slotBottom = slotTop + slotHeight + (scaleBuffer * 2);

        var scrollTop = cache.slotContainer.scrollTop;
        var scrollBottom = scrollTop + CONFIG.VIEWPORT_HEIGHT - CONFIG.VIEWPORT_TOP;

        // Add buffer to scroll earlier
        var scrollBuffer = isMovieMode ? 60 : 20;

        if (slotTop < scrollTop + scrollBuffer) {
            cache.slotContainer.scrollTop = Math.max(0, slotTop - scrollBuffer);
        } else if (slotBottom > scrollBottom - scrollBuffer) {
            cache.slotContainer.scrollTop = slotBottom - CONFIG.VIEWPORT_HEIGHT + CONFIG.VIEWPORT_TOP + scrollBuffer;
        }
    }

    function ensureCardVisible(slotIndex, cardIndex, cardElement) {
        if (!cardElement) return;

        var rowItems = cardElement.parentNode;
        while (rowItems && !rowItems.classList.contains('row-items')) {
            rowItems = rowItems.parentNode;
        }

        if (!rowItems) return;

        // Get mode
        var isMovieMode = window.SlotRenderer && window.SlotRenderer.getState &&
                          window.SlotRenderer.getState().mode === 'movies';

        // BASE card width (unscaled) - this is how cards are actually positioned in DOM
        // Movies: 200px card + 8px border + 20px gap = 228px
        // LiveTV: 250px card + 15px gap = 265px
        var baseCardWidth = isMovieMode ? 228 : 265;

        // Use SCREEN width for visibility calculation
        var screenWidth = window.innerWidth || 1920;
        var visibleWidth = screenWidth * 0.92; // 4% padding each side

        // How many cards fit on screen
        var visibleCards = Math.floor(visibleWidth / baseCardWidth);

        // Calculate card position based on BASE width
        var cardLeft = cardIndex * baseCardWidth;
        var cardRight = cardLeft + baseCardWidth;

        var scrollLeft = rowItems.scrollLeft;

        // Scroll BEFORE card reaches edge
        // Both modes: start scrolling when 2 cards from right edge
        var cardsBeforeScroll = visibleCards - 2;
        if (cardsBeforeScroll < 1) cardsBeforeScroll = 1;

        var scrollThreshold = cardsBeforeScroll * baseCardWidth;

        if (cardLeft < scrollLeft + baseCardWidth) {
            // Scroll left - keep 1 card visible on left
            rowItems.scrollLeft = Math.max(0, cardLeft - baseCardWidth);
        } else if (cardLeft > scrollLeft + scrollThreshold) {
            // Scroll right - center the card
            rowItems.scrollLeft = cardLeft - baseCardWidth;
        }
    }

    // ===== FOCUS MANAGEMENT =====
    function setFocus(slotIndex, cardIndex) {
        if (!window.SlotRenderer) {
            return false;
        }

        var cardElement = window.SlotRenderer.getCardElement(slotIndex, cardIndex);
        if (!cardElement) {
            return false;
        }

        if (cardElement.style.display === 'none') {
            return false;
        }

        if (cache.focusedElement) {
            cache.focusedElement.classList.remove('focused');
            cache.focusedElement.style.willChange = 'auto';
        }

        cardElement.classList.add('focused');
        cardElement.style.willChange = 'transform';
        cache.focusedElement = cardElement;

        state.currentSlot = slotIndex;
        state.currentCard = cardIndex;

        ensureSlotVisible(slotIndex);
        ensureCardVisible(slotIndex, cardIndex, cardElement);

        if (callbacks.onFocusChange) {
            callbacks.onFocusChange(slotIndex, cardIndex);
        }

        return true;
    }

    function moveUp() {
        var slotState = window.SlotRenderer ? window.SlotRenderer.getState() : null;
        var currentRowIndex = slotState ? slotState.currentOffset + state.currentSlot : state.currentSlot;

        rowMemory[currentRowIndex] = state.currentCard;

        if (state.currentSlot > 0) {
            var targetRowIndex = slotState ? slotState.currentOffset + (state.currentSlot - 1) : state.currentSlot - 1;
            var targetCard = (rowMemory[targetRowIndex] !== undefined) ? rowMemory[targetRowIndex] : 0;
            return setFocus(state.currentSlot - 1, targetCard);
        } else {
            if (window.SlotRenderer && window.SlotRenderer.scrollUp()) {
                var newState = window.SlotRenderer.getState();
                var newRowIndex = newState ? newState.currentOffset + state.currentSlot : state.currentSlot;
                var targetCard = (rowMemory[newRowIndex] !== undefined) ? rowMemory[newRowIndex] : 0;
                return setFocus(state.currentSlot, targetCard);
            }
        }
        return false;
    }

    function moveDown() {
        var maxSlot = window.SlotRenderer ? window.SlotRenderer.CONFIG.SLOT_COUNT - 1 : 5;

        var slotState = window.SlotRenderer ? window.SlotRenderer.getState() : null;
        var currentRowIndex = slotState ? slotState.currentOffset + state.currentSlot : state.currentSlot;

        rowMemory[currentRowIndex] = state.currentCard;

        if (state.currentSlot < maxSlot) {
            var targetRowIndex = slotState ? slotState.currentOffset + (state.currentSlot + 1) : state.currentSlot + 1;
            var targetCard = (rowMemory[targetRowIndex] !== undefined) ? rowMemory[targetRowIndex] : 0;
            return setFocus(state.currentSlot + 1, targetCard);
        } else {
            if (window.SlotRenderer && window.SlotRenderer.scrollDown()) {
                var newState = window.SlotRenderer.getState();
                var newRowIndex = newState ? newState.currentOffset + state.currentSlot : state.currentSlot;
                var targetCard = (rowMemory[newRowIndex] !== undefined) ? rowMemory[newRowIndex] : 0;
                return setFocus(state.currentSlot, targetCard);
            }
        }
        return false;
    }

    function moveLeft() {
        var rowData = getCurrentRowData();

        if (state.currentCard > 0) {
            var moved = setFocus(state.currentSlot, state.currentCard - 1);
            return moved;
        }

        if (rowData && rowData.isPaginatedRow && window.HorizontalPageManager) {
            var slideResult = window.HorizontalPageManager.slideWindowLeft(rowData.id);

            if (slideResult === true) {
                var slotState = window.SlotRenderer.getState();

                if (!slotState) {
                    return false;
                }

                var rowIndex = slotState.currentOffset + state.currentSlot;
                var freshRowData = slotState.allRows[rowIndex];
                var dataToRender = freshRowData ? freshRowData : rowData;

                try {
                    window.SlotRenderer.updateSlot(state.currentSlot, dataToRender, rowIndex);
                } catch (e) {
                    return false;
                }

                var SLIDE_AMOUNT = 6;
                var newCard = state.currentCard + SLIDE_AMOUNT;

                var maxCard = 11;
                if (window.SlotRenderer && window.SlotRenderer.getCardsPerRow) {
                    maxCard = window.SlotRenderer.getCardsPerRow() - 1;
                }
                if (newCard > maxCard) {
                    newCard = maxCard;
                }

                setFocus(state.currentSlot, newCard);
                return true;
            }
        }

        return false;
    }

    function moveRight() {
        // Get dynamic max card based on mode
        var maxCard = 11;
        if (window.SlotRenderer && window.SlotRenderer.getCardsPerRow) {
            maxCard = window.SlotRenderer.getCardsPerRow() - 1;
        }
        var rowData = getCurrentRowData();

        if (state.currentCard < maxCard) {
            var cardElement = window.SlotRenderer.getCardElement(state.currentSlot, state.currentCard + 1);

            if (cardElement && cardElement.style.display !== 'none') {
                var moved = setFocus(state.currentSlot, state.currentCard + 1);

                if (moved && rowData && rowData.isPaginatedRow && window.HorizontalPageManager) {
                    var windowStart = window.HorizontalPageManager.getWindowStart(rowData.id);
                    var virtualIndex = windowStart + state.currentCard;
                    window.HorizontalPageManager.checkPrefetch(rowData.id, virtualIndex);
                }

                return moved;
            }
        }

        if (rowData && rowData.isPaginatedRow && window.HorizontalPageManager) {
            var slideResult = window.HorizontalPageManager.slideWindowRight(rowData.id);

            if (slideResult === true) {
                var slotState = window.SlotRenderer.getState();

                if (!slotState) {
                    return false;
                }

                var rowIndex = slotState.currentOffset + state.currentSlot;
                var freshRowData = slotState.allRows[rowIndex];
                var dataToRender = freshRowData ? freshRowData : rowData;

                try {
                    window.SlotRenderer.updateSlot(state.currentSlot, dataToRender, rowIndex);
                } catch (e) {
                    return false;
                }

                // After sliding right, focus on FIRST NEW content (not old overlap)
                var cardsPerRow = 8;
                if (window.SlotRenderer && window.SlotRenderer.getCardsPerRow) {
                    cardsPerRow = window.SlotRenderer.getCardsPerRow();
                }
                var SLIDE_AMOUNT = 6;
                var overlap = cardsPerRow - SLIDE_AMOUNT; // Cards showing old content (0 to overlap-1)
                // Focus on first NEW card (at position 'overlap')
                var newCard = overlap;

                var moved = setFocus(state.currentSlot, newCard);

                if (moved === true) {
                    if (window.ProgressiveImageLoader) {
                        if (window.ProgressiveImageLoader.processImages) {
                            setTimeout(function() {
                                window.ProgressiveImageLoader.processImages();
                            }, 50);
                        }
                    }
                }

                return moved;
            }
        }

        return false;
    }

    function getCurrentRowData() {
        if (!window.SlotRenderer) return null;

        var slotState = window.SlotRenderer.getState();
        var rowIndex = slotState.currentOffset + state.currentSlot;

        return slotState.allRows[rowIndex];
    }

    function activate() {
        if (cache.focusedElement) {
            if (cache.focusedElement.onclick) {
                cache.focusedElement.onclick();
            } else {
                var event = document.createEvent('MouseEvents');
                event.initEvent('click', true, true);
                cache.focusedElement.dispatchEvent(event);
            }
            return true;
        }
        return false;
    }

    // ===== UTILITY =====
    function getFocusedElement() {
        return cache.focusedElement;
    }

    function getCurrentPosition() {
        pool.position.slot = state.currentSlot;
        pool.position.card = state.currentCard;
        return pool.position;
    }

    function reset() {
        if (cache.focusedElement) {
            cache.focusedElement.classList.remove('focused');
            cache.focusedElement.style.willChange = 'auto';
        }
        cache.focusedElement = null;
        state.currentSlot = 0;
        state.currentCard = 0;
    }

    function clearRowMemory() {
        rowMemory = {};
    }

    function getStats() {
        pool.stats.currentSlot = state.currentSlot;
        pool.stats.currentCard = state.currentCard;
        pool.stats.slotHeight = CONFIG.SLOT_HEIGHT;
        pool.stats.cardWidth = CONFIG.CARD_WIDTH;
        pool.stats.viewportHeight = CONFIG.VIEWPORT_HEIGHT;
        pool.stats.scrollTop = cache.slotContainer ? cache.slotContainer.scrollTop : 0;
        return pool.stats;
    }

    function restoreFocus() {
        // Re-apply focus to current position
        setFocus(state.currentSlot, state.currentCard);
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        setFocus: setFocus,
        moveUp: moveUp,
        moveDown: moveDown,
        moveLeft: moveLeft,
        moveRight: moveRight,
        activate: activate,
        getFocusedElement: getFocusedElement,
        getCurrentPosition: getCurrentPosition,
        getStats: getStats,
        reset: reset,
        clearRowMemory: clearRowMemory,
        restoreFocus: restoreFocus,
        state: state,
        CONFIG: CONFIG
    };
})();
