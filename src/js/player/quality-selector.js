/**
 * Quality Selector - Video Quality Selection
 * Allows switching between Auto/High/Medium/Low quality
 * ES3 Compatible - WebOS 3.x optimized
 */

window.QualitySelector = (function() {
    'use strict';

    // ===== QUALITY OPTIONS =====
    var QUALITY_OPTIONS = [
        { id: 'auto', label: 'Auto', height: 0 },
        { id: '1080p', label: '1080p (Full HD)', height: 1080 },
        { id: '720p', label: '720p (HD)', height: 720 },
        { id: '480p', label: '480p (SD)', height: 480 },
        { id: '360p', label: '360p (Low)', height: 360 }
    ];

    // ===== STATE =====
    var state = {
        visible: false,
        selectedIndex: 0,
        focusIndex: 0,
        availableQualities: [],
        currentQuality: 'auto',
        hlsInstance: null
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        qualityList: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createDOM();
        setupKeyHandler();
    }

    function createDOM() {
        var overlay = document.getElementById('quality-selector');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'quality-selector';
            overlay.className = 'quality-selector';

            var html = '<div class="quality-selector-content">';
            html += '  <div class="quality-selector-header">';
            html += '    <span class="quality-icon">⚙</span>';
            html += '    <span>Video Qualität</span>';
            html += '  </div>';
            html += '  <div id="quality-list" class="quality-list"></div>';
            html += '</div>';
            html += '<div class="quality-selector-hint">↑↓ Auswahl • OK Bestätigen • BACK Schließen</div>';

            overlay.innerHTML = html;
            document.body.appendChild(overlay);
        }

        cache.overlay = overlay;
        cache.qualityList = document.getElementById('quality-list');
    }

    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!state.visible) return;

            var keyCode = e.keyCode;
            var handled = false;

            switch (keyCode) {
                case 38: // UP
                    if (state.focusIndex > 0) {
                        state.focusIndex--;
                        render();
                    }
                    handled = true;
                    break;
                case 40: // DOWN
                    if (state.focusIndex < state.availableQualities.length - 1) {
                        state.focusIndex++;
                        render();
                    }
                    handled = true;
                    break;
                case 13: // OK/ENTER
                    selectQuality();
                    handled = true;
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

    // ===== SHOW/HIDE =====
    function show(hlsInstance) {
        state.hlsInstance = hlsInstance || null;
        state.visible = true;
        state.focusIndex = state.selectedIndex;

        // Detect available qualities
        detectQualities();

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('quality-selector', window.NavigationStack.LAYERS.MODAL, {});
        }

        render();
        cache.overlay.className = 'quality-selector visible';
    }

    function hide() {
        state.visible = false;
        cache.overlay.className = 'quality-selector';

        // Pop from NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.pop('quality-selector');
        }
    }

    // ===== QUALITY DETECTION =====
    function detectQualities() {
        state.availableQualities = [];

        // Check if we have HLS.js instance with quality levels
        if (state.hlsInstance && state.hlsInstance.levels && state.hlsInstance.levels.length > 1) {
            // Add Auto option
            state.availableQualities.push({
                id: 'auto',
                label: 'Auto',
                index: -1,
                height: 0
            });

            // Add actual HLS levels
            var levels = state.hlsInstance.levels;
            for (var i = 0; i < levels.length; i++) {
                var level = levels[i];
                var height = level.height || 0;
                var bitrate = level.bitrate || 0;
                var label = height + 'p';

                if (bitrate > 0) {
                    label += ' (' + formatBitrate(bitrate) + ')';
                }

                state.availableQualities.push({
                    id: height + 'p',
                    label: label,
                    index: i,
                    height: height,
                    bitrate: bitrate
                });
            }

            // Sort by height descending
            state.availableQualities.sort(function(a, b) {
                if (a.id === 'auto') return -1;
                if (b.id === 'auto') return 1;
                return b.height - a.height;
            });
        } else {
            // No HLS.js or single quality - show default options
            state.availableQualities = [
                { id: 'auto', label: 'Auto (Empfohlen)', index: -1, height: 0 },
                { id: 'info', label: 'Qualität wird automatisch angepasst', index: -2, height: 0, disabled: true }
            ];
        }

        // Find current selection
        for (var j = 0; j < state.availableQualities.length; j++) {
            if (state.availableQualities[j].id === state.currentQuality) {
                state.selectedIndex = j;
                break;
            }
        }
    }

    function formatBitrate(bitrate) {
        if (bitrate >= 1000000) {
            return (bitrate / 1000000).toFixed(1) + ' Mbps';
        } else if (bitrate >= 1000) {
            return Math.round(bitrate / 1000) + ' Kbps';
        }
        return bitrate + ' bps';
    }

    // ===== RENDERING =====
    function render() {
        if (!cache.qualityList) return;

        var html = '';
        for (var i = 0; i < state.availableQualities.length; i++) {
            var quality = state.availableQualities[i];
            var isFocused = (i === state.focusIndex);
            var isSelected = (i === state.selectedIndex);
            var isDisabled = quality.disabled;

            var classes = 'quality-option';
            if (isFocused) classes += ' focused';
            if (isSelected) classes += ' selected';
            if (isDisabled) classes += ' disabled';

            html += '<div class="' + classes + '" data-index="' + i + '">';
            html += '  <span class="quality-label">' + quality.label + '</span>';
            if (isSelected && !isDisabled) {
                html += '  <span class="quality-check">✓</span>';
            }
            html += '</div>';
        }

        cache.qualityList.innerHTML = html;
    }

    // ===== SELECTION =====
    function selectQuality() {
        var quality = state.availableQualities[state.focusIndex];
        if (!quality || quality.disabled) return;

        state.selectedIndex = state.focusIndex;
        state.currentQuality = quality.id;

        // Apply quality change
        if (state.hlsInstance && quality.index !== undefined) {
            if (quality.index === -1) {
                // Auto mode
                state.hlsInstance.currentLevel = -1;
                state.hlsInstance.loadLevel = -1;
            } else if (quality.index >= 0) {
                // Specific quality
                state.hlsInstance.currentLevel = quality.index;
            }
        }

        // Update badge if visible
        updateQualityBadge();

        hide();
    }

    function updateQualityBadge() {
        var badge = document.getElementById('quality-badge');
        if (!badge) return;

        if (state.currentQuality === 'auto') {
            badge.style.display = 'none';
        } else {
            badge.textContent = state.currentQuality.toUpperCase();
            badge.style.display = 'block';
        }
    }

    // ===== PUBLIC API =====
    function getCurrentQuality() {
        return state.currentQuality;
    }

    function setHLSInstance(hls) {
        state.hlsInstance = hls;
    }

    function isVisible() {
        return state.visible;
    }

    return {
        init: init,
        show: show,
        hide: hide,
        getCurrentQuality: getCurrentQuality,
        setHLSInstance: setHLSInstance,
        isVisible: isVisible
    };
})();
