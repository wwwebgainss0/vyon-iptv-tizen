/**
 * EPG Search - Search in EPG Titles/Descriptions
 * Find programs by keyword across all channels
 * ES3 Compatible - WebOS 3.x optimized
 */

window.EPGSearch = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        visible: false,
        searchTerm: '',
        results: [],
        focusIndex: 0,
        keyboardFocused: true, // true = keyboard, false = results
        keyboardRow: 0,
        keyboardCol: 0,
        isSearching: false
    };

    // ===== KEYBOARD LAYOUT =====
    var KEYBOARD = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö'],
        ['Y', 'X', 'C', 'V', 'B', 'N', 'M', 'Ä', 'Ü', 'ß'],
        ['SPACE', 'DEL', 'CLEAR', 'SEARCH']
    ];

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        searchInput: null,
        keyboard: null,
        resultsList: null,
        resultCount: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createDOM();
        setupKeyHandler();
    }

    function createDOM() {
        var overlay = document.getElementById('epg-search-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'epg-search-overlay';
            overlay.className = 'epg-search-overlay';

            var html = '<div class="epg-search-content">';
            html += '  <div class="epg-search-header">';
            html += '    <span class="epg-search-icon">🔍</span>';
            html += '    <span>EPG Suche</span>';
            html += '  </div>';

            // Search input display
            html += '  <div class="epg-search-input-wrapper">';
            html += '    <div id="epg-search-input" class="epg-search-input"></div>';
            html += '    <div id="epg-result-count" class="epg-result-count"></div>';
            html += '  </div>';

            // Virtual keyboard
            html += '  <div id="epg-keyboard" class="epg-keyboard"></div>';

            // Results list
            html += '  <div class="epg-search-results-wrapper">';
            html += '    <div id="epg-search-results" class="epg-search-results"></div>';
            html += '  </div>';

            html += '</div>';
            html += '<div class="epg-search-hint">↑↓←→ Navigation • OK Auswahl • BACK Schließen</div>';

            overlay.innerHTML = html;
            document.body.appendChild(overlay);
        }

        cache.overlay = overlay;
        cache.searchInput = document.getElementById('epg-search-input');
        cache.keyboard = document.getElementById('epg-keyboard');
        cache.resultsList = document.getElementById('epg-search-results');
        cache.resultCount = document.getElementById('epg-result-count');

        renderKeyboard();
    }

    function renderKeyboard() {
        if (!cache.keyboard) return;

        var html = '';
        for (var row = 0; row < KEYBOARD.length; row++) {
            html += '<div class="epg-keyboard-row">';
            for (var col = 0; col < KEYBOARD[row].length; col++) {
                var key = KEYBOARD[row][col];
                var isFocused = (state.keyboardFocused && state.keyboardRow === row && state.keyboardCol === col);
                var classes = 'epg-key';

                if (key === 'SPACE') classes += ' epg-key-space';
                else if (key === 'DEL') classes += ' epg-key-del';
                else if (key === 'CLEAR') classes += ' epg-key-clear';
                else if (key === 'SEARCH') classes += ' epg-key-search';

                if (isFocused) classes += ' focused';

                var displayKey = key;
                if (key === 'SPACE') displayKey = '␣';
                else if (key === 'DEL') displayKey = '⌫';
                else if (key === 'CLEAR') displayKey = 'CLR';

                html += '<div class="' + classes + '" data-key="' + key + '">' + displayKey + '</div>';
            }
            html += '</div>';
        }
        cache.keyboard.innerHTML = html;
    }

    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!state.visible) return;

            var keyCode = e.keyCode;
            var handled = false;

            switch (keyCode) {
                case 38: // UP
                    handled = navigateUp();
                    break;
                case 40: // DOWN
                    handled = navigateDown();
                    break;
                case 37: // LEFT
                    handled = navigateLeft();
                    break;
                case 39: // RIGHT
                    handled = navigateRight();
                    break;
                case 13: // OK/ENTER
                    handled = handleOK();
                    break;
                case 461: // BACK (WebOS)
                case 10009: // BACK (Tizen)
                case 8: // Backspace
                case 27: // ESC
                    hide();
                    handled = true;
                    break;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    // ===== NAVIGATION =====
    function navigateUp() {
        if (state.keyboardFocused) {
            if (state.keyboardRow > 0) {
                state.keyboardRow--;
                // Adjust column if new row is shorter
                var maxCol = KEYBOARD[state.keyboardRow].length - 1;
                if (state.keyboardCol > maxCol) {
                    state.keyboardCol = maxCol;
                }
                renderKeyboard();
            }
        } else {
            // In results
            if (state.focusIndex > 0) {
                state.focusIndex--;
                renderResults();
            } else {
                // Move to keyboard
                state.keyboardFocused = true;
                state.keyboardRow = KEYBOARD.length - 1;
                renderKeyboard();
                renderResults();
            }
        }
        return true;
    }

    function navigateDown() {
        if (state.keyboardFocused) {
            if (state.keyboardRow < KEYBOARD.length - 1) {
                state.keyboardRow++;
                var maxCol = KEYBOARD[state.keyboardRow].length - 1;
                if (state.keyboardCol > maxCol) {
                    state.keyboardCol = maxCol;
                }
                renderKeyboard();
            } else if (state.results.length > 0) {
                // Move to results
                state.keyboardFocused = false;
                state.focusIndex = 0;
                renderKeyboard();
                renderResults();
            }
        } else {
            if (state.focusIndex < state.results.length - 1) {
                state.focusIndex++;
                renderResults();
                scrollResultIntoView();
            }
        }
        return true;
    }

    function navigateLeft() {
        if (state.keyboardFocused) {
            if (state.keyboardCol > 0) {
                state.keyboardCol--;
                renderKeyboard();
            }
        }
        return true;
    }

    function navigateRight() {
        if (state.keyboardFocused) {
            var maxCol = KEYBOARD[state.keyboardRow].length - 1;
            if (state.keyboardCol < maxCol) {
                state.keyboardCol++;
                renderKeyboard();
            }
        }
        return true;
    }

    function handleOK() {
        if (state.keyboardFocused) {
            var key = KEYBOARD[state.keyboardRow][state.keyboardCol];
            handleKeyPress(key);
        } else {
            // Select result
            selectResult();
        }
        return true;
    }

    function handleKeyPress(key) {
        if (key === 'SPACE') {
            state.searchTerm += ' ';
        } else if (key === 'DEL') {
            state.searchTerm = state.searchTerm.slice(0, -1);
        } else if (key === 'CLEAR') {
            state.searchTerm = '';
            state.results = [];
            renderResults();
        } else if (key === 'SEARCH') {
            performSearch();
        } else {
            state.searchTerm += key;
        }
        updateSearchInput();
    }

    function updateSearchInput() {
        if (cache.searchInput) {
            cache.searchInput.textContent = state.searchTerm + '_';
        }
    }

    // ===== SEARCH =====
    function performSearch() {
        if (!state.searchTerm || state.searchTerm.length < 2) {
            state.results = [];
            renderResults();
            return;
        }

        state.isSearching = true;
        state.results = [];

        if (cache.resultCount) {
            cache.resultCount.textContent = 'Suche...';
        }

        // Search in EPG data
        if (window.EPGManager && window.EPGManager.searchEPG) {
            window.EPGManager.searchEPG(state.searchTerm, function(err, results) {
                state.isSearching = false;
                if (err || !results) {
                    state.results = [];
                } else {
                    state.results = results.slice(0, 50); // Limit to 50 results
                }
                state.focusIndex = 0;
                renderResults();
            });
        } else {
            // Fallback: Search locally in cached EPG
            searchLocalEPG();
        }
    }

    function searchLocalEPG() {
        state.isSearching = false;
        var searchLower = state.searchTerm.toLowerCase();

        // Try to get channels from ScreenManager or ChannelManager
        var channels = [];
        if (window.ScreenManager && window.ScreenManager.getLiveTVData) {
            var data = window.ScreenManager.getLiveTVData();
            if (data && data.channels) {
                channels = data.channels;
            }
        }

        // For now, show message that no EPG search available
        if (channels.length === 0) {
            state.results = [];
            if (cache.resultCount) {
                cache.resultCount.textContent = 'EPG Daten nicht verfügbar';
            }
            renderResults();
            return;
        }

        // Search in channel names (basic fallback)
        state.results = [];
        for (var i = 0; i < channels.length && state.results.length < 50; i++) {
            var channel = channels[i];
            var name = (channel.name || '').toLowerCase();
            if (name.indexOf(searchLower) !== -1) {
                state.results.push({
                    type: 'channel',
                    channelName: channel.name,
                    channelId: channel.stream_id,
                    title: channel.name,
                    time: 'Kanal'
                });
            }
        }

        renderResults();
    }

    function renderResults() {
        if (!cache.resultsList) return;

        if (state.results.length === 0) {
            if (state.searchTerm.length >= 2 && !state.isSearching) {
                cache.resultsList.innerHTML = '<div class="epg-no-results">Keine Ergebnisse gefunden</div>';
                if (cache.resultCount) {
                    cache.resultCount.textContent = '0 Ergebnisse';
                }
            } else {
                cache.resultsList.innerHTML = '';
                if (cache.resultCount) {
                    cache.resultCount.textContent = '';
                }
            }
            return;
        }

        if (cache.resultCount) {
            cache.resultCount.textContent = state.results.length + ' Ergebnisse';
        }

        var html = '';
        for (var i = 0; i < state.results.length; i++) {
            var result = state.results[i];
            var isFocused = (!state.keyboardFocused && i === state.focusIndex);
            var classes = 'epg-search-result' + (isFocused ? ' focused' : '');

            html += '<div class="' + classes + '" data-index="' + i + '">';
            html += '  <div class="epg-result-channel">' + escapeHtml(result.channelName || '') + '</div>';
            html += '  <div class="epg-result-title">' + escapeHtml(result.title || '') + '</div>';
            if (result.time) {
                html += '  <div class="epg-result-time">' + escapeHtml(result.time) + '</div>';
            }
            if (result.description) {
                html += '  <div class="epg-result-desc">' + escapeHtml(result.description).substring(0, 100) + '</div>';
            }
            html += '</div>';
        }

        cache.resultsList.innerHTML = html;
    }

    function scrollResultIntoView() {
        var results = cache.resultsList;
        if (!results) return;

        var items = results.querySelectorAll('.epg-search-result');
        if (items[state.focusIndex]) {
            items[state.focusIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectResult() {
        var result = state.results[state.focusIndex];
        if (!result) return;

        // Tune to channel
        if (result.channelId && window.PlayerComponent) {
            hide();
            setTimeout(function() {
                window.PlayerComponent.play(result.channelId, result.channelName, 'live');
            }, 100);
        }
    }

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ===== SHOW/HIDE =====
    function show() {
        state.visible = true;
        state.searchTerm = '';
        state.results = [];
        state.focusIndex = 0;
        state.keyboardFocused = true;
        state.keyboardRow = 0;
        state.keyboardCol = 0;

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('epg-search', window.NavigationStack.LAYERS.MODAL, {});
        }

        updateSearchInput();
        renderKeyboard();
        renderResults();
        cache.overlay.className = 'epg-search-overlay visible';
    }

    function hide() {
        state.visible = false;
        cache.overlay.className = 'epg-search-overlay';

        // Pop from NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.pop('epg-search');
        }
    }

    function isVisible() {
        return state.visible;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        isVisible: isVisible
    };
})();
