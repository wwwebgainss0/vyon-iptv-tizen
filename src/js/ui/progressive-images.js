/**
 * Progressive Image Loading v2.0 for WebOS 3.x
 * Memory-Optimized with LRU Cache & Image Pool Reuse
 * ES3 Compatible
 */

window.ProgressiveImageLoader = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        MAX_CACHE_SIZE: 150,        // More cache for scrolling
        IMAGE_POOL_SIZE: 8,         // More parallel loads
        MAX_LOAD_PER_BATCH: 10,     // Load more per batch
        THROTTLE_MS: 80,            // Faster response
        VIEWPORT_BUFFER: 400        // Preload further ahead
    };

    // ===== LRU CACHE =====
    var imageCache = [];

    function getCacheEntry(url) {
        for (var i = 0; i < imageCache.length; i++) {
            if (imageCache[i].url === url) {
                var entry = imageCache[i];
                imageCache.splice(i, 1);
                imageCache.push(entry);
                return entry.status;
            }
        }
        return null;
    }

    function setCacheEntry(url, status) {
        for (var i = 0; i < imageCache.length; i++) {
            if (imageCache[i].url === url) {
                imageCache.splice(i, 1);
                break;
            }
        }

        imageCache.push({url: url, status: status});

        if (imageCache.length > CONFIG.MAX_CACHE_SIZE) {
            imageCache.shift();
        }
    }

    // ===== IMAGE POOL =====
    var imagePool = [];
    var poolInUse = {};

    function createImagePool() {
        for (var i = 0; i < CONFIG.IMAGE_POOL_SIZE; i++) {
            imagePool.push(new Image());
        }
    }

    function getImageFromPool() {
        if (imagePool.length > 0) {
            return imagePool.pop();
        }
        return new Image();
    }

    function returnImageToPool(img, url) {
        img.onload = null;
        img.onerror = null;
        img.src = '';

        if (poolInUse[url]) {
            delete poolInUse[url];
        }

        if (imagePool.length < CONFIG.IMAGE_POOL_SIZE) {
            imagePool.push(img);
        }
    }

    // ===== STATE =====
    var state = {
        isProcessing: false,
        pendingTimer: null,
        loadCount: 0
    };

    // ===== VISIBILITY CHECK =====
    function isCardVisible(cardElement) {
        if (!cardElement || cardElement.style.display === 'none') return false;

        var rect = cardElement.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var viewportWidth = window.innerWidth || document.documentElement.clientWidth;

        return (
            rect.top >= -CONFIG.VIEWPORT_BUFFER &&
            rect.bottom <= viewportHeight + CONFIG.VIEWPORT_BUFFER &&
            rect.left >= -CONFIG.VIEWPORT_BUFFER &&
            rect.right <= viewportWidth + CONFIG.VIEWPORT_BUFFER
        );
    }

    // ===== IMAGE LOADING =====
    function loadImage(imgElement, cardElement) {
        var url = imgElement.getAttribute('data-src');
        if (!url) return false;

        var cached = getCacheEntry(url);
        if (cached === 'loaded') {
            imgElement.src = url;
            imgElement.style.display = 'block';
            var gradient = cardElement.querySelector('.card-gradient');
            if (gradient) gradient.style.display = 'none';
            imgElement.removeAttribute('data-src');
            return false;
        } else if (cached === 'loading' || cached === 'failed') {
            return false;
        }

        if (poolInUse[url]) {
            return false;
        }

        setCacheEntry(url, 'loading');

        var tempImg = getImageFromPool();
        poolInUse[url] = tempImg;

        (function(img, card, src, poolImg) {
            poolImg.onload = function() {
                img.src = src;
                img.style.display = 'block';

                var gradient = card.querySelector('.card-gradient');
                if (gradient) {
                    gradient.style.display = 'none';
                }

                img.removeAttribute('data-src');
                setCacheEntry(src, 'loaded');
                returnImageToPool(poolImg, src);
                state.loadCount++;
            };

            poolImg.onerror = function() {
                img.removeAttribute('data-src');
                setCacheEntry(src, 'failed');
                returnImageToPool(poolImg, src);
            };

            poolImg.src = src;
        })(imgElement, cardElement, url, tempImg);

        return true;
    }

    // ===== PROCESSING =====
    function processImages() {
        if (state.isProcessing) return;
        state.isProcessing = true;

        var loadCount = 0;

        if (window.SlotRenderer) {
            var cache = window.SlotRenderer.getCache();
            var slots = cache.slots;

            for (var s = 0; s < slots.length && loadCount < CONFIG.MAX_LOAD_PER_BATCH; s++) {
                var slot = slots[s];

                if (slot.element.style.display === 'none') continue;

                var cards = slot.cards;
                for (var c = 0; c < cards.length && loadCount < CONFIG.MAX_LOAD_PER_BATCH; c++) {
                    var card = cards[c];
                    var cardEl = card.element;
                    var imgEl = card.img;

                    if (cardEl.style.display === 'none') continue;

                    if (imgEl.hasAttribute('data-src') && isCardVisible(cardEl)) {
                        if (loadImage(imgEl, cardEl)) {
                            loadCount++;
                        }
                    }
                }
            }
        }

        state.isProcessing = false;
    }

    // ===== THROTTLED TRIGGER =====
    function triggerProcess() {
        if (state.pendingTimer) {
            clearTimeout(state.pendingTimer);
            state.pendingTimer = null;
        }

        state.pendingTimer = setTimeout(function() {
            state.pendingTimer = null;
            processImages();
        }, CONFIG.THROTTLE_MS);
    }

    // ===== IMMEDIATE TRIGGER (no throttle - for slot updates) =====
    function processImmediate() {
        // Cancel any pending throttled process
        if (state.pendingTimer) {
            clearTimeout(state.pendingTimer);
            state.pendingTimer = null;
        }
        // Process right now
        processImages();
    }

    // ===== SCROLL HANDLERS =====
    function onScroll() {
        triggerProcess();
    }

    function onFocus() {
        triggerProcess();
    }

    // ===== INITIALIZATION =====
    function initialize() {
        createImagePool();

        setTimeout(function() {
            processImages();
        }, 500);

        var slotContainer = document.getElementById('slot-container');
        if (slotContainer) {
            slotContainer.addEventListener('scroll', onScroll, false);
        }
        window.addEventListener('scroll', onScroll, false);
        document.addEventListener('focusin', onFocus, true);
    }

    // ===== STATS =====
    var statsPool = {
        cacheSize: 0,
        cacheLimit: 0,
        poolSize: 0,
        poolLimit: 0,
        inUseCount: 0,
        totalLoaded: 0,
        isProcessing: false
    };

    function getStats() {
        var inUseCount = 0;
        for (var key in poolInUse) {
            if (poolInUse.hasOwnProperty(key)) {
                inUseCount++;
            }
        }

        statsPool.cacheSize = imageCache.length;
        statsPool.cacheLimit = CONFIG.MAX_CACHE_SIZE;
        statsPool.poolSize = imagePool.length;
        statsPool.poolLimit = CONFIG.IMAGE_POOL_SIZE;
        statsPool.inUseCount = inUseCount;
        statsPool.totalLoaded = state.loadCount;
        statsPool.isProcessing = state.isProcessing;

        return statsPool;
    }

    function clearCache() {
        imageCache = [];
    }

    // Check if image URL is in cache with 'loaded' status
    function isImageCached(url) {
        if (!url) return false;
        for (var i = 0; i < imageCache.length; i++) {
            if (imageCache[i].url === url && imageCache[i].status === 'loaded') {
                return true;
            }
        }
        return false;
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        processImages: processImages,
        processImmediate: processImmediate,
        triggerProcess: triggerProcess,
        getStats: getStats,
        clearCache: clearCache,
        isImageCached: isImageCached
    };
})();
