/**
 * Search Overlay - Filter Content by Screen
 * ES3 Compatible - WebOS 3.x optimized
 * Filters Live TV, Movies, or Series based on current screen
 */

window.SearchOverlay = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        visible: false,
        query: '',
        originalData: null,
        currentScreen: 'livetv'
    };

    // ===== CACHED DOM =====
    var cache = {
        overlay: null,
        backdrop: null,
        container: null,
        input: null,
        clearBtn: null,
        resultCount: null,
        closeBtn: null
    };

    // ===== INITIALIZATION =====
    var isInitialized = false;

    function initialize() {
        if (isInitialized) return;
        isInitialized = true;

        createOverlayDOM();
        setupEventHandlers();
    }

    function createOverlayDOM() {
        var overlay = document.createElement('div');
        overlay.id = 'search-overlay';
        overlay.className = 'search-overlay';

        var html = '';
        html += '<div class="search-backdrop"></div>';
        html += '<div class="search-container">';

        // Search box
        html += '  <div class="search-box">';
        html += '    <svg class="search-box-icon" viewBox="0 0 24 24" fill="currentColor">';
        html += '      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>';
        html += '    </svg>';
        html += '    <input type="text" id="search-input" class="search-input" placeholder="Suchen..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">';
        html += '    <button id="search-clear" class="search-clear" style="display:none;">✕</button>';
        html += '  </div>';

        // Result info
        html += '  <div id="search-result-count" class="search-result-count"></div>';

        // Hints
        html += '  <div class="search-hints">';
        html += '    <span>Eingeben zum Suchen</span>';
        html += '    <span>BACK Schliessen</span>';
        html += '  </div>';

        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        // Cache references
        cache.overlay = overlay;
        cache.backdrop = overlay.querySelector('.search-backdrop');
        cache.container = overlay.querySelector('.search-container');
        cache.input = document.getElementById('search-input');
        cache.clearBtn = document.getElementById('search-clear');
        cache.resultCount = document.getElementById('search-result-count');
    }

    function setupEventHandlers() {
        // Input handler - filter on each keystroke
        cache.input.addEventListener('input', function() {
            state.query = cache.input.value.toLowerCase();

            // Show/hide clear button
            if (state.query.length > 0) {
                cache.clearBtn.style.display = 'block';
            } else {
                cache.clearBtn.style.display = 'none';
            }

            filterContent();
        });

        // Clear button
        cache.clearBtn.addEventListener('click', function() {
            cache.input.value = '';
            state.query = '';
            cache.clearBtn.style.display = 'none';
            cache.input.focus();
            restoreOriginalData();
        });

        // Key handler for overlay
        document.addEventListener('keydown', function(e) {
            if (!state.visible) return;

            var keyCode = e.keyCode;

            // Back button - close search and restore data
            if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                hide();
                restoreOriginalData();
                hideHeaderSearch();
                return;
            }

            // Enter - confirm search, close overlay, show header indicator
            if (keyCode === 13) {
                e.preventDefault();
                e.stopPropagation();
                if (state.query && state.query.length > 0) {
                    showHeaderSearch(state.query);
                }
                hideOverlayOnly();
                return;
            }
        }, true);
    }

    // ===== HEADER SEARCH INDICATOR =====
    function showHeaderSearch(query) {
        var indicator = document.getElementById('header-search-active');
        if (!indicator) return;

        var termSpan = indicator.querySelector('.search-term');
        if (termSpan) {
            termSpan.textContent = '"' + query + '"';
        }

        indicator.style.display = 'flex';

        // Add click handler for clear button
        var clearBtn = indicator.querySelector('.search-term-clear');
        if (clearBtn) {
            clearBtn.onclick = function(e) {
                e.stopPropagation();
                restoreOriginalData();
                hideHeaderSearch();
            };
        }

        // Click on indicator opens search overlay
        indicator.onclick = function() {
            if (window.SearchOverlay) {
                window.SearchOverlay.show();
            }
        };
    }

    function hideHeaderSearch() {
        var indicator = document.getElementById('header-search-active');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // Close overlay but keep filter active
    function hideOverlayOnly() {
        state.visible = false;
        cache.overlay.className = 'search-overlay';
        cache.input.blur();

        // Pop from stack
        if (window.NavigationStack) {
            window.NavigationStack.pop('search-overlay');
        }

        // Restore focus to grid
        if (window.FocusManager) {
            setTimeout(function() {
                window.FocusManager.restoreFocus();
            }, 100);
        }
    }

    // ===== SHOW/HIDE =====
    function show() {
        state.visible = true;

        // Store current screen
        if (window.ScreenManager && window.ScreenManager.getCurrentScreen) {
            state.currentScreen = window.ScreenManager.getCurrentScreen();
        }

        // Check if we have an active search (header indicator visible)
        var indicator = document.getElementById('header-search-active');
        var hasActiveSearch = indicator && indicator.style.display === 'flex';

        // Only store original data if no active search
        if (!hasActiveSearch) {
            storeOriginalData();
            state.query = '';
            cache.input.value = '';
            cache.clearBtn.style.display = 'none';
            cache.resultCount.textContent = '';
        } else {
            // Pre-fill with current search term
            cache.input.value = state.query;
            cache.clearBtn.style.display = state.query.length > 0 ? 'block' : 'none';
        }

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('search-overlay', window.NavigationStack.LAYERS.MODAL, {});
        }

        cache.overlay.className = 'search-overlay visible';

        // Focus input to show keyboard
        setTimeout(function() {
            cache.input.focus();
        }, 100);
    }

    function hide() {
        state.visible = false;
        cache.overlay.className = 'search-overlay';
        cache.input.blur();

        // Pop from stack
        if (window.NavigationStack) {
            window.NavigationStack.pop('search-overlay');
        }

        // Restore focus to grid
        if (window.FocusManager) {
            setTimeout(function() {
                window.FocusManager.restoreFocus();
            }, 100);
        }
    }

    // ===== DATA MANAGEMENT =====
    function storeOriginalData() {
        if (window.SlotRenderer) {
            var rendererState = window.SlotRenderer.getState();
            // Deep copy the rows array
            state.originalData = [];
            for (var i = 0; i < rendererState.allRows.length; i++) {
                state.originalData.push(rendererState.allRows[i]);
            }
        }
    }

    function restoreOriginalData() {
        if (state.originalData && window.SlotRenderer) {
            window.SlotRenderer.setData(state.originalData);
            cache.resultCount.textContent = '';

            // Restore focus
            if (window.FocusManager) {
                window.FocusManager.setPosition(0, 0);
            }
        }
    }

    // ===== FILTERING =====
    function filterContent() {
        if (!state.originalData || !window.SlotRenderer) return;

        var query = state.query;

        // Empty query - restore original
        if (!query || query.length === 0) {
            restoreOriginalData();
            return;
        }

        var filteredRows = [];
        var totalMatches = 0;

        // Filter each row's channels
        for (var i = 0; i < state.originalData.length; i++) {
            var row = state.originalData[i];
            var channels = row.channels || [];
            var matchingChannels = [];

            // Check each channel/item
            for (var j = 0; j < channels.length; j++) {
                var channel = channels[j];
                var name = (channel.name || channel.title || '').toLowerCase();

                if (name.indexOf(query) > -1) {
                    matchingChannels.push(channel);
                }
            }

            // If row has matching items, include it
            if (matchingChannels.length > 0) {
                // Create filtered row copy
                var filteredRow = {
                    title: row.title,
                    id: row.id,
                    channels: matchingChannels,
                    isPaginatedRow: false // Disable pagination for search results
                };
                filteredRows.push(filteredRow);
                totalMatches += matchingChannels.length;
            }
        }

        // Update result count
        if (totalMatches > 0) {
            cache.resultCount.textContent = totalMatches + ' Ergebnis' + (totalMatches === 1 ? '' : 'se') + ' gefunden';
            cache.resultCount.style.color = '#4CAF50';
        } else {
            cache.resultCount.textContent = 'Keine Ergebnisse für "' + state.query + '"';
            cache.resultCount.style.color = '#f44336';
        }

        // Update renderer with filtered data
        window.SlotRenderer.setData(filteredRows);

        // Reset focus to first item
        if (window.FocusManager) {
            window.FocusManager.setPosition(0, 0);
        }
    }

    // ===== PUBLIC API =====
    return {
        init: initialize,
        show: show,
        hide: hide,
        restoreOriginalData: restoreOriginalData,
        hideHeaderSearch: hideHeaderSearch,
        isVisible: function() { return state.visible; },
        getQuery: function() { return state.query; }
    };
})();
