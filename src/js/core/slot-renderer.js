/**
 * Slot-Based Renderer v2.0 for WebOS 3.x
 * Based on Bedrock Streaming Pattern: Fixed DOM slots, swap content only
 * ZERO array allocations in hotpath
 * ES3 Compatible
 */

window.SlotRenderer = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        SLOT_COUNT: 6,              // Fixed number of visible slots
        CARDS_PER_ROW: 12,          // Cards per row (LiveTV)
        CARDS_PER_ROW_MOVIES: 12,   // 12 cards rendered, ~8 visible - shows there's more to scroll
        ROW_HEIGHT: 280,            // Fixed row height in px (LiveTV): title 54 + cards 146 + padding 30 + margin 50
        ROW_HEIGHT_MOVIES: 520,     // Row height for movies (with scale 1.12): card 368*1.12 + title 38 + margins
        CARD_WIDTH: 260,            // Card width + gap (LiveTV)
        CARD_WIDTH_MOVIES: 248,     // Card width + gap (Movies: 208px card+border * 1.12 scale + 20px gap)
        // Screen-adaptive values (calculated at init)
        screenWidth: 1920,
        screenHeight: 1080,
        movieScale: 1.12            // Scale factor for focused movie cards
    };

    // ===== SCREEN DETECTION =====
    function detectScreenAndAdjust() {
        CONFIG.screenWidth = window.innerWidth || document.documentElement.clientWidth || 1920;
        CONFIG.screenHeight = window.innerHeight || document.documentElement.clientHeight || 1080;

        // Calculate movie card dimensions with scale
        var movieCardBase = 200;     // Base card width
        var movieBorder = 8;         // 4px border each side
        var movieGap = 20;           // Gap between cards
        var movieCardTotal = (movieCardBase + movieBorder) * CONFIG.movieScale;

        // Calculate how many cards fit on screen
        var availableWidth = CONFIG.screenWidth * 0.92; // 4% padding each side
        var visibleCards = Math.floor(availableWidth / (movieCardTotal + movieGap));

        // Adjust CARD_WIDTH_MOVIES for smooth scrolling
        CONFIG.CARD_WIDTH_MOVIES = Math.ceil(movieCardTotal + movieGap);

        // Calculate row height with scale
        var movieCardHeight = 360;   // Card height (poster + title)
        var movieRowTitle = 40;      // Row title height
        var movieRowMargin = 30;     // Margin between rows
        var moviePadding = 24;       // Padding for overflow
        var scaledHeight = (movieCardHeight + movieBorder) * CONFIG.movieScale;

        CONFIG.ROW_HEIGHT_MOVIES = Math.ceil(scaledHeight + movieRowTitle + movieRowMargin + moviePadding);

        if (window.console && window.console.log) {
            console.log('[SlotRenderer] Screen: ' + CONFIG.screenWidth + 'x' + CONFIG.screenHeight);
            console.log('[SlotRenderer] Movie cards visible: ~' + visibleCards);
            console.log('[SlotRenderer] CARD_WIDTH_MOVIES: ' + CONFIG.CARD_WIDTH_MOVIES);
            console.log('[SlotRenderer] ROW_HEIGHT_MOVIES: ' + CONFIG.ROW_HEIGHT_MOVIES);
        }
    }

    // ===== STATE =====
    var state = {
        allRows: [],                // All row data
        currentOffset: 0,           // Current scroll offset (which row is in slot 0)
        totalRows: 0,
        isInitialized: false,
        mode: 'livetv'              // 'livetv' or 'movies'
    };

    // ===== CACHED REFERENCES =====
    var cache = {
        container: null,
        slots: []                   // Array of slot objects with cached elements
    };

    // ===== OBJECT POOL - Pre-allocated arrays (zero allocation) =====
    var pool = {
        visibleIndices: [0, 0, 0, 0, 0, 0],  // Pre-allocated for getVisibleRowIndices()
        stats: {                               // Reused for getStats()
            slotCount: 0,
            totalRows: 0,
            currentOffset: 0,
            visibleRows: [],                   // Will be assigned pool.visibleIndices
            cacheSize: 0,
            domNodes: 0
        }
    };

    // Initialize stats.visibleRows to point to pool
    pool.stats.visibleRows = pool.visibleIndices;

    // ===== INITIALIZATION =====
    function initialize() {
        cache.container = document.getElementById('slot-container');
        if (!cache.container) {
            console.error('[SlotRenderer] slot-container not found');
            return false;
        }

        // Detect screen and adjust CONFIG values
        detectScreenAndAdjust();

        // Create fixed slots
        createSlots();

        // Build cache
        buildCache();

        state.isInitialized = true;
        return true;
    }

    function createSlots() {
        var html = '';

        for (var i = 0; i < CONFIG.SLOT_COUNT; i++) {
            html += '<div class="slot" id="slot-' + i + '" data-slot="' + i + '">';
            html += '<div class="row-title" id="slot-' + i + '-title"></div>';
            html += '<div class="row-container">';
            html += '<div class="row-items">';
            html += '<div class="row-items-inner" id="slot-' + i + '-cards">';

            // Pre-create card slots (use max of both modes)
            for (var c = 0; c < CONFIG.CARDS_PER_ROW; c++) {
                html += '<div class="card" ';
                html += 'id="slot-' + i + '-card-' + c + '" ';
                html += 'data-slot="' + i + '" ';
                html += 'data-card="' + c + '" ';
                html += 'tabindex="-1">';
                html += '<div class="card-favorite-badge" style="display:none;">★</div>'; // Star for favorites
                html += '<div class="card-image-wrapper">';
                html += '<img class="card-image" alt="" />';
                html += '<div class="card-gradient"><div class="card-text"></div></div>';
                html += '<div class="card-progress" style="display:none;"><div class="card-progress-fill"></div></div>'; // Watch progress bar
                html += '</div>';
                html += '<div class="card-title"></div>'; // Title below poster (movies)
                html += '</div>'; // card
            }

            html += '</div>'; // row-items-inner
            html += '</div>'; // row-items
            html += '</div>'; // row-container
            html += '</div>'; // slot
        }

        cache.container.innerHTML = html;
    }

    function buildCache() {
        for (var i = 0; i < CONFIG.SLOT_COUNT; i++) {
            cache.slots[i] = {
                element: document.getElementById('slot-' + i),
                title: document.getElementById('slot-' + i + '-title'),
                cardsContainer: document.getElementById('slot-' + i + '-cards'),
                cards: []
            };

            for (var c = 0; c < CONFIG.CARDS_PER_ROW; c++) {
                var cardEl = document.getElementById('slot-' + i + '-card-' + c);
                cache.slots[i].cards[c] = {
                    element: cardEl,
                    img: cardEl.querySelector('.card-image'),
                    gradient: cardEl.querySelector('.card-gradient'),
                    text: cardEl.querySelector('.card-text'),
                    cardTitle: cardEl.querySelector('.card-title'), // Title below poster
                    favBadge: cardEl.querySelector('.card-favorite-badge'), // Star badge
                    progressBar: cardEl.querySelector('.card-progress'), // Watch progress container
                    progressFill: cardEl.querySelector('.card-progress-fill') // Watch progress fill
                };

                (function(slotIdx, cardIdx) {
                    cardEl.onclick = function() {
                        playChannel(slotIdx, cardIdx);
                    };
                })(i, c);
            }
        }
    }

    // ===== MODE MANAGEMENT =====
    function setMode(mode) {
        state.mode = mode || 'livetv';

        // Apply/remove movie-mode class from all slots
        for (var i = 0; i < CONFIG.SLOT_COUNT; i++) {
            var slot = cache.slots[i];
            if (slot && slot.element) {
                if (state.mode === 'movies') {
                    slot.element.className = 'slot movie-mode';
                } else {
                    slot.element.className = 'slot';
                }
            }
        }
    }

    function getCardsPerRow() {
        return state.mode === 'movies' ? CONFIG.CARDS_PER_ROW_MOVIES : CONFIG.CARDS_PER_ROW;
    }

    function getCardWidth() {
        return state.mode === 'movies' ? CONFIG.CARD_WIDTH_MOVIES : CONFIG.CARD_WIDTH;
    }

    function getRowHeight() {
        return state.mode === 'movies' ? CONFIG.ROW_HEIGHT_MOVIES : CONFIG.ROW_HEIGHT;
    }

    // ===== DATA MANAGEMENT =====
    function setData(rows) {
        state.allRows = rows || [];
        state.totalRows = rows.length;
        state.currentOffset = 0;

        renderAllSlots();
    }

    // ===== RENDERING =====
    function renderAllSlots() {
        for (var i = 0; i < CONFIG.SLOT_COUNT; i++) {
            var rowIndex = state.currentOffset + i;
            if (rowIndex < state.totalRows) {
                updateSlot(i, state.allRows[rowIndex], rowIndex);
            } else {
                clearSlot(i);
            }
        }

        // Trigger immediate image loading after slots are rendered
        if (window.ProgressiveImageLoader && window.ProgressiveImageLoader.processImmediate) {
            window.ProgressiveImageLoader.processImmediate();
        }
    }

    function updateSlot(slotIndex, rowData, rowIndex) {
        if (!rowData || slotIndex >= CONFIG.SLOT_COUNT) return;

        var slot = cache.slots[slotIndex];

        // Update title (no DOM manipulation, just text)
        slot.title.textContent = rowData.title || 'Category';

        // Get dynamic cards per row based on mode
        var cardsPerRow = getCardsPerRow();

        // ===== NEW: Check if paginated row =====
        if (rowData.isPaginatedRow && window.HorizontalPageManager) {
            // Get current window start for this row
            var windowStart = window.HorizontalPageManager.getWindowStart(rowData.id);

            // Get visible items for current window
            var visibleItems = window.HorizontalPageManager.getVisibleItems(rowData.id, windowStart);

            // Update cards with visible items (use dynamic cardsPerRow)
            for (var c = 0; c < cardsPerRow; c++) {
                if (c < visibleItems.length && visibleItems[c]) {
                    updateCard(slotIndex, c, visibleItems[c], rowIndex, c);
                } else {
                    hideCard(slotIndex, c);
                }
            }
            // Hide remaining cards (in case mode switched from livetv to movies)
            for (var h = cardsPerRow; h < CONFIG.CARDS_PER_ROW; h++) {
                hideCard(slotIndex, h);
            }
        } else {
            // Original non-paginated logic
            var channels = rowData.channels || [];
            for (var c = 0; c < cardsPerRow; c++) {
                if (c < channels.length) {
                    updateCard(slotIndex, c, channels[c], rowIndex, c);
                } else {
                    hideCard(slotIndex, c);
                }
            }
            // Hide remaining cards
            for (var h = cardsPerRow; h < CONFIG.CARDS_PER_ROW; h++) {
                hideCard(slotIndex, h);
            }
        }

        // Show slot
        slot.element.style.display = 'block';
    }

    function updateCard(slotIndex, cardIndex, channelData, rowIndex, colIndex) {
        var card = cache.slots[slotIndex].cards[cardIndex];
        if (!card) return;

        var channelName = channelData.name || channelData.title || 'Unknown';
        var streamId = channelData.stream_id || channelData.series_id || channelData.id;
        var isMovieMode = (state.mode === 'movies');

        // Apply movie card class if in movie mode
        if (isMovieMode) {
            card.element.className = 'card card-movie';
        } else {
            card.element.className = 'card';
        }

        // Update data attributes
        card.element.setAttribute('data-stream-id', streamId);
        card.element.setAttribute('data-channel-id', channelData.num || '0');
        card.element.setAttribute('data-row', rowIndex);
        card.element.setAttribute('data-col', colIndex);

        if (channelData.container_extension) {
            card.element.setAttribute('data-container-ext', channelData.container_extension);
        }

        // Store series_id for series overlay
        if (channelData.series_id) {
            card.element.setAttribute('data-series-id', channelData.series_id);
        }

        // Update text (inside gradient, for LiveTV)
        card.text.textContent = channelName;

        // Update card-title (below poster, for Movies)
        if (card.cardTitle) {
            card.cardTitle.textContent = isMovieMode ? channelName : '';
        }

        // Update image (check cache first, then lazy load)
        // Series use 'cover', movies/channels use 'stream_icon'
        var imageUrl = channelData.stream_icon || channelData.cover || '';
        if (imageUrl && imageUrl.length > 0) {
            var iconUrl = imageUrl;
            var currentSrc = card.img.getAttribute('src') || '';

            if (currentSrc === iconUrl && card.img.style.display === 'block') {
                // Already loaded in this slot - keep it
            } else {
                // Check if image is in cache (already loaded before)
                var isCached = false;
                if (window.ProgressiveImageLoader && window.ProgressiveImageLoader.isImageCached) {
                    isCached = window.ProgressiveImageLoader.isImageCached(iconUrl);
                }

                if (isCached) {
                    // Image was loaded before - show immediately from browser cache
                    card.img.src = iconUrl;
                    card.img.setAttribute('alt', channelName);
                    card.img.style.display = 'block';
                    card.gradient.style.display = 'none';
                    card.img.removeAttribute('data-src');
                } else {
                    // Not cached - use lazy loading
                    card.img.setAttribute('data-src', iconUrl);
                    card.img.setAttribute('alt', channelName);
                    card.img.style.display = 'none';
                    card.gradient.style.display = 'flex';
                }
            }
        } else {
            card.img.style.display = 'none';
            card.img.removeAttribute('src');
            card.img.removeAttribute('data-src');
            card.gradient.style.display = 'flex';
        }

        card.element.style.display = 'block';

        // Show/hide favorite star badge
        if (card.favBadge && window.FavoritesManager) {
            var screenType = state.mode === 'movies' ? 'movies' : (state.mode === 'series' ? 'series' : 'livetv');
            var isFav = window.FavoritesManager.isFavorite(channelData, screenType);
            card.favBadge.style.display = isFav ? 'block' : 'none';
        } else if (card.favBadge) {
            card.favBadge.style.display = 'none';
        }

        // Show watch progress bar for movies/series (Continue Watching)
        if (card.progressBar && card.progressFill) {
            var watchPercent = 0;
            // Check if item has watchPercent from Continue Watching row
            if (channelData.watchPercent && channelData.watchPercent > 0) {
                watchPercent = channelData.watchPercent;
            }
            // Also check WatchHistory for any movie/series card
            else if (isMovieMode && window.WatchHistory) {
                var streamIdForHistory = channelData.stream_id || channelData.series_id || '';
                if (streamIdForHistory) {
                    var resumePos = window.WatchHistory.getResumePosition(streamIdForHistory);
                    if (resumePos > 0 && channelData.duration) {
                        watchPercent = Math.min(95, Math.floor((resumePos / channelData.duration) * 100));
                    }
                }
            }

            if (watchPercent > 0 && isMovieMode) {
                card.progressBar.style.display = 'block';
                card.progressFill.style.width = watchPercent + '%';
            } else {
                card.progressBar.style.display = 'none';
            }
        }
    }

    function hideCard(slotIndex, cardIndex) {
        var card = cache.slots[slotIndex].cards[cardIndex];
        if (card) {
            card.element.style.display = 'none';
        }
    }

    function clearSlot(slotIndex) {
        var slot = cache.slots[slotIndex];
        if (slot) {
            slot.element.style.display = 'none';
        }
    }

    // ===== SCROLLING =====
    function scrollToOffset(newOffset) {
        // Clamp offset
        var maxOffset = Math.max(0, state.totalRows - CONFIG.SLOT_COUNT);
        newOffset = Math.max(0, Math.min(newOffset, maxOffset));

        if (newOffset === state.currentOffset) return false;

        state.currentOffset = newOffset;

        // Re-render all slots with new offset
        renderAllSlots();

        return true;
    }

    function scrollUp() {
        return scrollToOffset(state.currentOffset - 1);
    }

    function scrollDown() {
        return scrollToOffset(state.currentOffset + 1);
    }

    function scrollToRow(rowIndex) {
        // Center the row in viewport
        var offset = Math.max(0, rowIndex - Math.floor(CONFIG.SLOT_COUNT / 2));
        return scrollToOffset(offset);
    }

    // ===== UTILITY =====
    function getSlotForRow(rowIndex) {
        if (rowIndex < state.currentOffset || rowIndex >= state.currentOffset + CONFIG.SLOT_COUNT) {
            return -1; // Not visible
        }
        return rowIndex - state.currentOffset;
    }

    function getCardElement(slotIndex, cardIndex) {
        if (slotIndex < 0 || slotIndex >= CONFIG.SLOT_COUNT) return null;
        if (cardIndex < 0 || cardIndex >= CONFIG.CARDS_PER_ROW) return null;

        return cache.slots[slotIndex].cards[cardIndex].element;
    }

    // OPTIMIZED: Reuse pre-allocated array instead of creating new one
    function getVisibleRowIndices() {
        var count = 0;
        for (var i = 0; i < CONFIG.SLOT_COUNT; i++) {
            var rowIndex = state.currentOffset + i;
            if (rowIndex < state.totalRows) {
                pool.visibleIndices[count] = rowIndex;
                count++;
            }
        }
        // Set length property (ES3-safe way to "truncate" array)
        pool.visibleIndices.length = count;
        return pool.visibleIndices;
    }

    // OPTIMIZED: Reuse pooled object instead of creating new one
    function getStats() {
        pool.stats.slotCount = CONFIG.SLOT_COUNT;
        pool.stats.totalRows = state.totalRows;
        pool.stats.currentOffset = state.currentOffset;
        pool.stats.cacheSize = cache.slots.length;
        pool.stats.domNodes = CONFIG.SLOT_COUNT * CONFIG.CARDS_PER_ROW;

        // Update visibleRows in place (already points to pool.visibleIndices)
        getVisibleRowIndices();

        return pool.stats;
    }

    // ===== PLAYER INTEGRATION =====
    function playChannel(slotIndex, cardIndex) {
        var card = cache.slots[slotIndex] && cache.slots[slotIndex].cards[cardIndex];
        if (!card || !card.element) return;

        var streamId = card.element.getAttribute('data-stream-id');
        var channelName = card.text.textContent || 'Unknown Channel';
        var containerExt = card.element.getAttribute('data-container-ext'); // mkv, mp4, avi, etc.

        // Get icon URL for watch history
        var iconUrl = '';
        if (card.img && card.img.src) {
            iconUrl = card.img.src;
        } else if (card.img && card.img.getAttribute('data-src')) {
            iconUrl = card.img.getAttribute('data-src');
        }

        // Determine stream type based on current mode and row data
        var rowIndex = state.currentOffset + slotIndex;
        var rowData = state.allRows[rowIndex];
        var streamType = 'live'; // Default to live TV

        // Use the current mode to determine stream type
        if (state.mode === 'movies') {
            streamType = 'movie';
        } else if (state.mode === 'series') {
            streamType = 'series';
        }
        // For Continue Watching rows, check the stored type
        if (rowData && rowData.isContinueWatching === true) {
            streamType = 'movie'; // Continue watching is always VOD
        }

        // Track channel views for LiveTV
        if (streamType === 'live' && window.ChannelViewTracker) {
            // Get full channel data from row
            var channelData = null;
            if (rowData && rowData.channels) {
                // Get the actual channel data
                if (rowData.isPaginatedRow && window.HorizontalPageManager) {
                    var pageData = window.HorizontalPageManager.getVisibleItems(rowData.id);
                    if (pageData && pageData.items) {
                        channelData = pageData.items[cardIndex];
                    }
                } else {
                    channelData = rowData.channels[cardIndex];
                }
            }
            if (channelData) {
                window.ChannelViewTracker.trackView(channelData);
            }
        }

        // Open player with stream type, container extension AND icon URL
        if (streamType === 'movie') {
            // For movies, show movie overlay with Play/Trailer buttons
            if (window.MovieOverlay) {
                // Get full channel data from row
                var movieData = null;
                if (rowData && rowData.channels) {
                    if (rowData.isPaginatedRow && window.HorizontalPageManager) {
                        var pageData = window.HorizontalPageManager.getVisibleItems(rowData.id);
                        if (pageData) {
                            movieData = pageData[cardIndex];
                        }
                    } else {
                        movieData = rowData.channels[cardIndex];
                    }
                }

                // Fallback: create minimal movie data
                if (!movieData) {
                    movieData = {
                        stream_id: streamId,
                        name: channelName,
                        stream_icon: iconUrl,
                        container_extension: containerExt
                    };
                }

                window.MovieOverlay.show(movieData, containerExt, iconUrl);
            } else if (window.PlayerComponent) {
                // Fallback: direct play if MovieOverlay not available
                window.PlayerComponent.play(streamId, channelName, streamType, containerExt, iconUrl);
            }
        } else if (window.PlayerComponent) {
            window.PlayerComponent.play(streamId, channelName, streamType, containerExt, iconUrl);
        }
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        setData: setData,
        setMode: setMode,
        getCardsPerRow: getCardsPerRow,
        getCardWidth: getCardWidth,
        getRowHeight: getRowHeight,
        scrollUp: scrollUp,
        scrollDown: scrollDown,
        scrollToRow: scrollToRow,
        scrollToOffset: scrollToOffset,
        getSlotForRow: getSlotForRow,
        getCardElement: getCardElement,
        getVisibleRowIndices: getVisibleRowIndices,
        getStats: getStats,
        renderAllSlots: renderAllSlots,
        updateSlot: updateSlot,
        CONFIG: CONFIG,
        getState: function() { return state; },
        getCache: function() { return cache; }
    };
})();
