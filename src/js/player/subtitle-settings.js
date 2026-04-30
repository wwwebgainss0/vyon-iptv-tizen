/**
 * Subtitle Settings - Customize Subtitle Appearance
 * Font size, color, background settings
 * ES3 Compatible - WebOS 3.x optimized
 */

window.SubtitleSettings = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_subtitle_settings'
    };

    // ===== DEFAULT SETTINGS =====
    var DEFAULTS = {
        fontSize: 'medium',     // small, medium, large, xlarge
        fontColor: 'white',     // white, yellow, green, cyan
        background: 'semi',     // none, semi, solid
        position: 'bottom'      // bottom, top
    };

    // ===== OPTIONS =====
    var OPTIONS = {
        fontSize: [
            { id: 'small', label: 'Klein', size: '18px' },
            { id: 'medium', label: 'Normal', size: '24px' },
            { id: 'large', label: 'Groß', size: '32px' },
            { id: 'xlarge', label: 'Sehr Groß', size: '42px' }
        ],
        fontColor: [
            { id: 'white', label: 'Weiß', color: '#FFFFFF' },
            { id: 'yellow', label: 'Gelb', color: '#FFFF00' },
            { id: 'green', label: 'Grün', color: '#00FF00' },
            { id: 'cyan', label: 'Cyan', color: '#00FFFF' }
        ],
        background: [
            { id: 'none', label: 'Aus', bg: 'transparent' },
            { id: 'semi', label: 'Halbtransparent', bg: 'rgba(0,0,0,0.6)' },
            { id: 'solid', label: 'Schwarz', bg: '#000000' }
        ],
        position: [
            { id: 'bottom', label: 'Unten' },
            { id: 'top', label: 'Oben' }
        ]
    };

    // ===== STATE =====
    var state = {
        visible: false,
        settings: {},
        focusSection: 0,  // 0=fontSize, 1=fontColor, 2=background, 3=position
        focusOption: [0, 0, 0, 0]  // Current option in each section
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        preview: null,
        sections: []
    };

    // ===== INITIALIZATION =====
    function init() {
        loadSettings();
        applySettings();
    }

    // ===== STORAGE =====
    function loadSettings() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                state.settings = JSON.parse(stored);
            } else {
                state.settings = JSON.parse(JSON.stringify(DEFAULTS));
            }
        } catch (e) {
            console.error('[SubtitleSettings] Failed to load:', e);
            state.settings = JSON.parse(JSON.stringify(DEFAULTS));
        }

        // Ensure all settings exist
        for (var key in DEFAULTS) {
            if (state.settings[key] === undefined) {
                state.settings[key] = DEFAULTS[key];
            }
        }

        // Set focus to current values
        state.focusOption[0] = findOptionIndex('fontSize', state.settings.fontSize);
        state.focusOption[1] = findOptionIndex('fontColor', state.settings.fontColor);
        state.focusOption[2] = findOptionIndex('background', state.settings.background);
        state.focusOption[3] = findOptionIndex('position', state.settings.position);
    }

    function saveSettings() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.settings));
        } catch (e) {
            console.error('[SubtitleSettings] Failed to save:', e);
        }
    }

    function findOptionIndex(section, value) {
        var options = OPTIONS[section];
        for (var i = 0; i < options.length; i++) {
            if (options[i].id === value) {
                return i;
            }
        }
        return 0;
    }

    // ===== APPLY SETTINGS =====
    function applySettings() {
        // Create or update style element
        var styleId = 'subtitle-custom-style';
        var style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        var fontSize = getOptionById('fontSize', state.settings.fontSize);
        var fontColor = getOptionById('fontColor', state.settings.fontColor);
        var background = getOptionById('background', state.settings.background);

        var css = '';
        css += '::cue {';
        css += '  font-size: ' + (fontSize ? fontSize.size : '24px') + ';';
        css += '  color: ' + (fontColor ? fontColor.color : '#FFFFFF') + ';';
        css += '  background-color: ' + (background ? background.bg : 'rgba(0,0,0,0.6)') + ';';
        css += '  padding: 4px 8px;';
        css += '  border-radius: 4px;';
        css += '}';

        // Position
        if (state.settings.position === 'top') {
            css += 'video::cue { line: 10%; }';
        }

        style.textContent = css;
    }

    function getOptionById(section, id) {
        var options = OPTIONS[section];
        for (var i = 0; i < options.length; i++) {
            if (options[i].id === id) {
                return options[i];
            }
        }
        return null;
    }

    // ===== OVERLAY =====
    function createOverlay() {
        var overlay = document.getElementById('subtitle-settings-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'subtitle-settings-overlay';
            overlay.className = 'subtitle-settings-overlay';

            var html = '<div class="subtitle-settings-content">';
            html += '  <div class="subtitle-settings-header">Untertitel Einstellungen</div>';

            // Preview
            html += '  <div class="subtitle-preview" id="subtitle-preview">';
            html += '    <div class="subtitle-preview-text">Beispiel Untertitel</div>';
            html += '  </div>';

            // Sections
            html += '  <div class="subtitle-sections">';

            // Font Size
            html += '  <div class="subtitle-section" data-section="0">';
            html += '    <div class="subtitle-section-label">Schriftgröße</div>';
            html += '    <div class="subtitle-options" id="subtitle-fontSize"></div>';
            html += '  </div>';

            // Font Color
            html += '  <div class="subtitle-section" data-section="1">';
            html += '    <div class="subtitle-section-label">Schriftfarbe</div>';
            html += '    <div class="subtitle-options" id="subtitle-fontColor"></div>';
            html += '  </div>';

            // Background
            html += '  <div class="subtitle-section" data-section="2">';
            html += '    <div class="subtitle-section-label">Hintergrund</div>';
            html += '    <div class="subtitle-options" id="subtitle-background"></div>';
            html += '  </div>';

            // Position
            html += '  <div class="subtitle-section" data-section="3">';
            html += '    <div class="subtitle-section-label">Position</div>';
            html += '    <div class="subtitle-options" id="subtitle-position"></div>';
            html += '  </div>';

            html += '  </div>'; // sections

            html += '</div>';
            html += '<div class="subtitle-settings-hint">↑↓ Kategorie • ←→ Auswahl • OK Speichern • BACK Abbrechen</div>';

            overlay.innerHTML = html;
            document.body.appendChild(overlay);
        }

        cache.overlay = overlay;
        cache.preview = document.getElementById('subtitle-preview');
        cache.sections = [
            document.getElementById('subtitle-fontSize'),
            document.getElementById('subtitle-fontColor'),
            document.getElementById('subtitle-background'),
            document.getElementById('subtitle-position')
        ];
    }

    function show() {
        createOverlay();
        state.visible = true;
        state.focusSection = 0;

        // Reset focus options to current settings
        state.focusOption[0] = findOptionIndex('fontSize', state.settings.fontSize);
        state.focusOption[1] = findOptionIndex('fontColor', state.settings.fontColor);
        state.focusOption[2] = findOptionIndex('background', state.settings.background);
        state.focusOption[3] = findOptionIndex('position', state.settings.position);

        renderOptions();
        updatePreview();
        cache.overlay.className = 'subtitle-settings-overlay visible';

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('subtitle-settings', window.NavigationStack.LAYERS.MODAL, {});
        }

        setupKeyHandler();
    }

    function hide() {
        if (cache.overlay) {
            cache.overlay.className = 'subtitle-settings-overlay';
        }
        state.visible = false;

        if (window.NavigationStack) {
            window.NavigationStack.pop('subtitle-settings');
        }
    }

    function renderOptions() {
        var sections = ['fontSize', 'fontColor', 'background', 'position'];

        for (var s = 0; s < sections.length; s++) {
            var sectionName = sections[s];
            var container = cache.sections[s];
            if (!container) continue;

            var options = OPTIONS[sectionName];
            var html = '';

            for (var o = 0; o < options.length; o++) {
                var opt = options[o];
                var isFocused = (state.focusSection === s && state.focusOption[s] === o);
                var isSelected = (state.settings[sectionName] === opt.id);
                var classes = 'subtitle-option';
                if (isFocused) classes += ' focused';
                if (isSelected) classes += ' selected';

                // Color preview for fontColor
                var colorStyle = '';
                if (sectionName === 'fontColor') {
                    colorStyle = ' style="border-left: 4px solid ' + opt.color + ';"';
                }

                html += '<div class="' + classes + '"' + colorStyle + ' data-id="' + opt.id + '">';
                html += opt.label;
                if (isSelected) html += ' ✓';
                html += '</div>';
            }

            container.innerHTML = html;
        }

        // Highlight active section
        var sectionElements = cache.overlay.querySelectorAll('.subtitle-section');
        for (var i = 0; i < sectionElements.length; i++) {
            if (i === state.focusSection) {
                sectionElements[i].className = 'subtitle-section active';
            } else {
                sectionElements[i].className = 'subtitle-section';
            }
        }
    }

    function updatePreview() {
        if (!cache.preview) return;

        var fontSize = getOptionById('fontSize', state.settings.fontSize);
        var fontColor = getOptionById('fontColor', state.settings.fontColor);
        var background = getOptionById('background', state.settings.background);

        var previewText = cache.preview.querySelector('.subtitle-preview-text');
        if (previewText) {
            previewText.style.fontSize = fontSize ? fontSize.size : '24px';
            previewText.style.color = fontColor ? fontColor.color : '#FFFFFF';
            previewText.style.backgroundColor = background ? background.bg : 'rgba(0,0,0,0.6)';
        }

        if (state.settings.position === 'top') {
            cache.preview.style.alignItems = 'flex-start';
        } else {
            cache.preview.style.alignItems = 'flex-end';
        }
    }

    // ===== KEY HANDLING =====
    var keyHandlerAdded = false;

    function setupKeyHandler() {
        if (keyHandlerAdded) return;
        keyHandlerAdded = true;

        document.addEventListener('keydown', handleKeyDown, true);
    }

    function handleKeyDown(e) {
        if (!state.visible) return;

        var keyCode = e.keyCode;
        var handled = false;

        switch (keyCode) {
            case 38: // UP
                if (state.focusSection > 0) {
                    state.focusSection--;
                    renderOptions();
                }
                handled = true;
                break;
            case 40: // DOWN
                if (state.focusSection < 3) {
                    state.focusSection++;
                    renderOptions();
                }
                handled = true;
                break;
            case 37: // LEFT
                navigateOption(-1);
                handled = true;
                break;
            case 39: // RIGHT
                navigateOption(1);
                handled = true;
                break;
            case 13: // OK - Save
                saveAndClose();
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
    }

    function navigateOption(direction) {
        var sections = ['fontSize', 'fontColor', 'background', 'position'];
        var sectionName = sections[state.focusSection];
        var maxIndex = OPTIONS[sectionName].length - 1;

        var newIndex = state.focusOption[state.focusSection] + direction;
        if (newIndex < 0) newIndex = 0;
        if (newIndex > maxIndex) newIndex = maxIndex;

        state.focusOption[state.focusSection] = newIndex;

        // Update setting immediately for preview
        var opt = OPTIONS[sectionName][newIndex];
        state.settings[sectionName] = opt.id;

        renderOptions();
        updatePreview();
    }

    function saveAndClose() {
        saveSettings();
        applySettings();
        hide();
    }

    // ===== PUBLIC API =====
    function getSettings() {
        return state.settings;
    }

    function isVisible() {
        return state.visible;
    }

    return {
        init: init,
        show: show,
        hide: hide,
        getSettings: getSettings,
        applySettings: applySettings,
        isVisible: isVisible
    };
})();
