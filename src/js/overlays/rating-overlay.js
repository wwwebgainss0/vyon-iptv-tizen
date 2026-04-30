/**
 * Rating Overlay - App Store Bewertungs-Prompt mit Sterne-Auswahl
 *
 * Logik:
 *   1-3 Sterne → Feedback-Formular (In-App)
 *   4-5 Sterne → LG Content Store öffnen
 *
 * ES3 Compatible - WebOS 3.x optimized
 * Zero GC hotpath - slot-based rendering
 */

window.RatingOverlay = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        DAYS_UNTIL_FIRST_PROMPT: 3,   // Tage bis erste Anzeige
        DAYS_UNTIL_REMIND: 7,          // Tage bis Erinnerung nach "Später"
        DELAY_AFTER_LOAD: 5000,        // 5 Sekunden nach App-Start
        APP_ID: 'com.jam.iptv8',
        STORE_APP_ID: 'com.lge.app.appstore'
    };

    var STORAGE_KEYS = {
        FIRST_LAUNCH: 'ultra_iptv_first_launch',
        RATING_STATUS: 'ultra_iptv_rating_status',
        LATER_UNTIL: 'ultra_iptv_rating_later_until',
        USER_RATING: 'ultra_iptv_user_rating',
        USER_FEEDBACK: 'ultra_iptv_user_feedback'
    };

    // ===== STATE =====
    var state = {
        visible: false,
        step: 'stars',        // 'stars', 'feedback', 'thanks'
        selectedStars: 0,     // 0-5
        focusedStar: 0,       // 0-4 (index)
        focusedButton: 0,     // 0=Submit/Send, 1=Later, 2=Never
        focusZone: 'stars',   // 'stars' or 'buttons'
        feedbackText: ''
    };

    // ===== STAR LABELS =====
    var STAR_LABELS = ['Schlecht', 'Geht so', 'OK', 'Gut', 'Ausgezeichnet!'];

    // ===== CACHED DOM ELEMENTS =====
    var cache = {
        overlay: null,
        starsContainer: null,
        stars: [],           // Array of 5 star elements
        starLabel: null,
        submitBtn: null,
        laterBtn: null,
        neverBtn: null,
        feedbackInput: null,
        feedbackContainer: null,
        thanksContainer: null,
        starsStep: null
    };

    // ===== INITIALIZATION =====
    function init() {
        recordFirstLaunch();
        createOverlay();
        cacheElements();
        setupKeyHandler();

        // Prüfe ob Overlay gezeigt werden soll (verzögert)
        setTimeout(function() {
            checkShouldShow();
        }, CONFIG.DELAY_AFTER_LOAD);
    }

    function recordFirstLaunch() {
        try {
            if (!localStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH)) {
                localStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, Date.now().toString());
            }
        } catch (e) {
            console.error('[RatingOverlay] Failed to record first launch:', e);
        }
    }

    function createOverlay() {
        if (document.getElementById('rating-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'rating-overlay';
        overlay.className = 'rating-overlay';

        var t = window.i18n ? window.i18n.t : function(k) { return k; };

        overlay.innerHTML =
            '<div class="rating-content">' +

                // ===== Step 1: Star Selection =====
                '<div id="rating-step-stars" class="rating-step">' +
                    '<div class="rating-icon-large">&#11088;</div>' +
                    '<h2 class="rating-title">Wie gef\u00E4llt dir Jam IPTV?</h2>' +
                    '<p class="rating-text">Dein Feedback hilft uns, die App zu verbessern!</p>' +
                    '<div class="rating-stars-row" id="rating-stars-container">' +
                        '<span class="rating-star" id="rating-star-0" data-index="0">&#9734;</span>' +
                        '<span class="rating-star" id="rating-star-1" data-index="1">&#9734;</span>' +
                        '<span class="rating-star" id="rating-star-2" data-index="2">&#9734;</span>' +
                        '<span class="rating-star" id="rating-star-3" data-index="3">&#9734;</span>' +
                        '<span class="rating-star" id="rating-star-4" data-index="4">&#9734;</span>' +
                    '</div>' +
                    '<div class="rating-star-label" id="rating-star-label">&nbsp;</div>' +
                    '<div class="rating-buttons">' +
                        '<button class="rating-btn primary" id="rating-btn-submit">Bewerten</button>' +
                        '<button class="rating-btn secondary" id="rating-btn-later">' + t('rating.later') + '</button>' +
                        '<button class="rating-btn tertiary" id="rating-btn-never">' + t('rating.never') + '</button>' +
                    '</div>' +
                '</div>' +

                // ===== Step 2a: Feedback (1-3 Stars) =====
                '<div id="rating-step-feedback" class="rating-step" style="display:none;">' +
                    '<h2 class="rating-title">Was k\u00F6nnen wir verbessern?</h2>' +
                    '<div class="rating-stars-mini" id="rating-stars-mini"></div>' +
                    '<p class="rating-text">Dein Feedback hilft uns, Jam IPTV besser zu machen.</p>' +
                    '<div class="rating-feedback-box">' +
                        '<div class="rating-feedback-input" id="rating-feedback-input" contenteditable="false">' +
                            'Dr\u00FCcke OK um Feedback einzugeben...' +
                        '</div>' +
                    '</div>' +
                    '<div class="rating-buttons">' +
                        '<button class="rating-btn primary" id="rating-btn-send">Feedback senden</button>' +
                        '<button class="rating-btn tertiary" id="rating-btn-skip">\u00DCberspringen</button>' +
                    '</div>' +
                '</div>' +

                // ===== Step 3: Thank You =====
                '<div id="rating-step-thanks" class="rating-step" style="display:none;">' +
                    '<div class="rating-icon-large" id="rating-thanks-icon">&#127881;</div>' +
                    '<h2 class="rating-title" id="rating-thanks-title">Vielen Dank!</h2>' +
                    '<p class="rating-text" id="rating-thanks-text">' +
                        'Deine Bewertung hilft anderen Nutzern, Jam IPTV zu entdecken.' +
                    '</p>' +
                    '<div class="rating-buttons">' +
                        '<button class="rating-btn secondary" id="rating-btn-close">Schlie\u00DFen</button>' +
                    '</div>' +
                '</div>' +

            '</div>';

        // Inject styles for star-based rating
        if (!document.getElementById('rating-overlay-styles-v2')) {
            var style = document.createElement('style');
            style.id = 'rating-overlay-styles-v2';
            style.textContent =
                '.rating-stars-row { display: flex; justify-content: center; gap: 16px; margin: 16px 0 8px; }' +
                '.rating-star { font-size: 40px; cursor: pointer; transition: transform 0.2s, color 0.2s; color: #666; user-select: none; }' +
                '.rating-star.filled { color: #FFB300; }' +
                '.rating-star.focused { transform: scale(1.25); text-shadow: 0 0 12px rgba(255,179,0,0.6); }' +
                '.rating-star-label { text-align: center; font-size: 14px; color: #999; min-height: 20px; margin-bottom: 12px; }' +
                '.rating-icon-large { font-size: 48px; text-align: center; margin-bottom: 8px; }' +
                '.rating-stars-mini { display: flex; justify-content: center; gap: 4px; margin: 8px 0; }' +
                '.rating-stars-mini .mini-star { font-size: 20px; color: #666; }' +
                '.rating-stars-mini .mini-star.filled { color: #FFB300; }' +
                '.rating-feedback-box { margin: 12px 0; }' +
                '.rating-feedback-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); ' +
                    'border-radius: 8px; padding: 12px; min-height: 60px; color: #999; font-size: 14px; outline: none; }' +
                '.rating-feedback-input.focused { border-color: #E50914; color: #fff; }' +
                '.rating-step { animation: fadeIn 0.3s ease; }' +
                '@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }';
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);
    }

    function cacheElements() {
        cache.overlay = document.getElementById('rating-overlay');
        cache.starsStep = document.getElementById('rating-step-stars');
        cache.feedbackContainer = document.getElementById('rating-step-feedback');
        cache.thanksContainer = document.getElementById('rating-step-thanks');
        cache.starsContainer = document.getElementById('rating-stars-container');
        cache.starLabel = document.getElementById('rating-star-label');
        cache.submitBtn = document.getElementById('rating-btn-submit');
        cache.laterBtn = document.getElementById('rating-btn-later');
        cache.neverBtn = document.getElementById('rating-btn-never');
        cache.feedbackInput = document.getElementById('rating-feedback-input');

        // Cache individual stars
        cache.stars = [];
        for (var i = 0; i < 5; i++) {
            cache.stars.push(document.getElementById('rating-star-' + i));
        }
    }

    // ===== VISIBILITY LOGIC =====
    function shouldShow() {
        try {
            var status = localStorage.getItem(STORAGE_KEYS.RATING_STATUS);
            if (status === 'rated' || status === 'feedback' || status === 'never') {
                return false;
            }
            if (status === 'later') {
                var laterUntil = parseInt(localStorage.getItem(STORAGE_KEYS.LATER_UNTIL) || '0', 10);
                if (Date.now() < laterUntil) {
                    return false;
                }
            }
            var firstLaunch = parseInt(localStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH) || '0', 10);
            if (firstLaunch === 0) {
                return false;
            }
            var daysSinceFirst = (Date.now() - firstLaunch) / (1000 * 60 * 60 * 24);
            return daysSinceFirst >= CONFIG.DAYS_UNTIL_FIRST_PROMPT;
        } catch (e) {
            console.error('[RatingOverlay] Error checking shouldShow:', e);
            return false;
        }
    }

    function checkShouldShow() {
        if (shouldShow()) {
            show();
        }
    }

    // ===== SHOW/HIDE =====
    function show() {
        if (!cache.overlay) {
            createOverlay();
            cacheElements();
        }

        // Reset to initial state
        state.visible = true;
        state.step = 'stars';
        state.selectedStars = 0;
        state.focusedStar = 2; // Focus middle star
        state.focusedButton = 0;
        state.focusZone = 'stars';
        state.feedbackText = '';

        showStep('stars');
        updateStarDisplay();
        updateFocus();

        cache.overlay.className = 'rating-overlay visible';

        if (window.NavigationStack) {
            window.NavigationStack.push('rating-overlay', 95, {
                onBack: function() {
                    if (state.step === 'feedback') {
                        // Go back to stars from feedback
                        state.step = 'stars';
                        state.focusZone = 'stars';
                        showStep('stars');
                        return true;
                    }
                    handleLater();
                    return true;
                }
            });
        }

        console.log('[RatingOverlay] Showing star-based rating prompt');
    }

    function hide() {
        if (cache.overlay) {
            cache.overlay.className = 'rating-overlay';
        }
        state.visible = false;

        if (window.NavigationStack) {
            window.NavigationStack.pop('rating-overlay');
        }
    }

    function showStep(stepName) {
        if (cache.starsStep) cache.starsStep.style.display = (stepName === 'stars') ? '' : 'none';
        if (cache.feedbackContainer) cache.feedbackContainer.style.display = (stepName === 'feedback') ? '' : 'none';
        if (cache.thanksContainer) cache.thanksContainer.style.display = (stepName === 'thanks') ? '' : 'none';
    }

    // ===== STAR DISPLAY =====
    function updateStarDisplay() {
        for (var i = 0; i < 5; i++) {
            var star = cache.stars[i];
            if (!star) continue;

            var isFilled = i < state.selectedStars;
            var isFocused = (state.focusZone === 'stars' && i === state.focusedStar);

            star.innerHTML = isFilled ? '&#9733;' : '&#9734;'; // ★ or ☆
            star.className = 'rating-star' +
                (isFilled ? ' filled' : '') +
                (isFocused ? ' focused' : '');
        }

        // Update label
        if (cache.starLabel) {
            if (state.selectedStars > 0) {
                cache.starLabel.textContent = STAR_LABELS[state.selectedStars - 1];
                cache.starLabel.style.color = state.selectedStars >= 4 ? '#FFB300' : '#999';
            } else {
                cache.starLabel.innerHTML = '&nbsp;';
            }
        }
    }

    // ===== FOCUS MANAGEMENT =====
    function updateFocus() {
        if (state.step === 'stars') {
            updateStarDisplay();

            // Buttons
            var buttons = [cache.submitBtn, cache.laterBtn, cache.neverBtn];
            for (var i = 0; i < buttons.length; i++) {
                if (!buttons[i]) continue;
                var baseClass = i === 0 ? 'rating-btn primary' : (i === 1 ? 'rating-btn secondary' : 'rating-btn tertiary');
                buttons[i].className = baseClass + (state.focusZone === 'buttons' && state.focusedButton === i ? ' focused' : '');
            }
        } else if (state.step === 'feedback') {
            var sendBtn = document.getElementById('rating-btn-send');
            var skipBtn = document.getElementById('rating-btn-skip');
            if (sendBtn) sendBtn.className = 'rating-btn primary' + (state.focusedButton === 0 ? ' focused' : '');
            if (skipBtn) skipBtn.className = 'rating-btn tertiary' + (state.focusedButton === 1 ? ' focused' : '');
            if (cache.feedbackInput) {
                cache.feedbackInput.className = 'rating-feedback-input' + (state.focusZone === 'input' ? ' focused' : '');
            }
        } else if (state.step === 'thanks') {
            var closeBtn = document.getElementById('rating-btn-close');
            if (closeBtn) closeBtn.className = 'rating-btn secondary focused';
        }
    }

    // ===== BUTTON ACTIONS =====
    function handleSubmitRating() {
        if (state.selectedStars === 0) return;

        console.log('[RatingOverlay] Rating submitted: ' + state.selectedStars + ' stars');

        try {
            localStorage.setItem(STORAGE_KEYS.USER_RATING, state.selectedStars.toString());
        } catch (e) {}

        if (state.selectedStars >= 4) {
            // 4-5 Stars → Open Store
            openStore();
            showThanks(true);
        } else {
            // 1-3 Stars → Show feedback form
            state.step = 'feedback';
            state.focusedButton = 0;
            state.focusZone = 'buttons';
            showStep('feedback');
            buildMiniStars();
            updateFocus();
        }
    }

    function buildMiniStars() {
        var container = document.getElementById('rating-stars-mini');
        if (!container) return;
        var html = '';
        for (var i = 0; i < 5; i++) {
            html += '<span class="mini-star' + (i < state.selectedStars ? ' filled' : '') + '">' +
                (i < state.selectedStars ? '&#9733;' : '&#9734;') + '</span>';
        }
        container.innerHTML = html;
    }

    function handleSendFeedback() {
        console.log('[RatingOverlay] Feedback sent: "' + state.feedbackText + '"');

        try {
            localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'feedback');
            localStorage.setItem(STORAGE_KEYS.USER_FEEDBACK, state.feedbackText);
        } catch (e) {}

        showThanks(false);
    }

    function showThanks(isPositive) {
        state.step = 'thanks';
        state.focusedButton = 0;
        showStep('thanks');

        var icon = document.getElementById('rating-thanks-icon');
        var title = document.getElementById('rating-thanks-title');
        var text = document.getElementById('rating-thanks-text');

        if (icon) icon.innerHTML = isPositive ? '&#127881;' : '&#128591;'; // 🎉 or 🙏
        if (title) title.textContent = isPositive ? 'Vielen Dank!' : 'Danke f\u00FCr dein Feedback!';
        if (text) text.textContent = isPositive
            ? 'Deine Bewertung im LG Content Store hilft anderen Nutzern, Jam IPTV zu entdecken.'
            : 'Wir arbeiten st\u00E4ndig daran, die App zu verbessern. Dein Feedback ist uns wichtig!';

        updateFocus();
    }

    function openStore() {
        console.log('[RatingOverlay] Opening LG Content Store...');

        var params = JSON.stringify({
            id: CONFIG.STORE_APP_ID,
            params: { id: CONFIG.APP_ID }
        });

        if (window.PalmServiceBridge) {
            try {
                var bridge = new PalmServiceBridge();
                bridge.onservicecallback = function(response) {
                    console.log('[RatingOverlay] PalmServiceBridge response:', response);
                    try {
                        localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'rated');
                    } catch (e) {}
                };
                bridge.call('luna://com.webos.applicationManager/launch', params);
                return;
            } catch (e) {
                console.error('[RatingOverlay] PalmServiceBridge error:', e);
            }
        }

        if (window.webOS && window.webOS.service && window.webOS.service.request) {
            webOS.service.request('luna://com.webos.applicationManager', {
                method: 'launch',
                parameters: JSON.parse(params),
                onSuccess: function() {
                    console.log('[RatingOverlay] Store launched successfully');
                    try { localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'rated'); } catch (e) {}
                },
                onFailure: function(err) {
                    console.error('[RatingOverlay] Failed to launch store:', err);
                    try { localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'rated'); } catch (e) {}
                }
            });
        } else {
            console.log('[RatingOverlay] WebOS API not available, marking as rated');
            try { localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'rated'); } catch (e) {}
        }
    }

    function handleLater() {
        console.log('[RatingOverlay] User selected "Later"');
        try {
            var laterUntil = Date.now() + (CONFIG.DAYS_UNTIL_REMIND * 24 * 60 * 60 * 1000);
            localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'later');
            localStorage.setItem(STORAGE_KEYS.LATER_UNTIL, laterUntil.toString());
        } catch (e) {}
        hide();
    }

    function handleNever() {
        console.log('[RatingOverlay] User selected "Never"');
        try {
            localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'never');
        } catch (e) {}
        hide();
    }

    // ===== KEY HANDLER =====
    function setupKeyHandler() {
        document.addEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(event) {
        if (!state.visible) return;

        var keyCode = event.keyCode;
        var handled = false;

        if (state.step === 'stars') {
            handled = handleStarsNavigation(keyCode);
        } else if (state.step === 'feedback') {
            handled = handleFeedbackNavigation(keyCode);
        } else if (state.step === 'thanks') {
            handled = handleThanksNavigation(keyCode);
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function handleStarsNavigation(keyCode) {
        switch (keyCode) {
            case 37: // LEFT
                if (state.focusZone === 'stars') {
                    state.focusedStar = Math.max(0, state.focusedStar - 1);
                    updateFocus();
                }
                return true;

            case 39: // RIGHT
                if (state.focusZone === 'stars') {
                    state.focusedStar = Math.min(4, state.focusedStar + 1);
                    updateFocus();
                }
                return true;

            case 38: // UP
                if (state.focusZone === 'buttons') {
                    if (state.focusedButton === 0) {
                        state.focusZone = 'stars';
                    } else {
                        state.focusedButton = Math.max(0, state.focusedButton - 1);
                    }
                    updateFocus();
                }
                return true;

            case 40: // DOWN
                if (state.focusZone === 'stars') {
                    state.focusZone = 'buttons';
                    state.focusedButton = 0;
                } else if (state.focusZone === 'buttons') {
                    state.focusedButton = Math.min(2, state.focusedButton + 1);
                }
                updateFocus();
                return true;

            case 13: // OK/ENTER
                if (state.focusZone === 'stars') {
                    // Select star
                    state.selectedStars = state.focusedStar + 1;
                    updateStarDisplay();
                    // Auto-move to submit button
                    state.focusZone = 'buttons';
                    state.focusedButton = 0;
                    updateFocus();
                } else if (state.focusZone === 'buttons') {
                    switch (state.focusedButton) {
                        case 0: handleSubmitRating(); break;
                        case 1: handleLater(); break;
                        case 2: handleNever(); break;
                    }
                }
                return true;

            case 461: case 10009: case 8: case 27: // BACK
                handleLater();
                return true;
        }
        return false;
    }

    function handleFeedbackNavigation(keyCode) {
        switch (keyCode) {
            case 38: // UP
                if (state.focusZone === 'buttons' && state.focusedButton === 0) {
                    state.focusZone = 'input';
                } else if (state.focusZone === 'buttons') {
                    state.focusedButton = Math.max(0, state.focusedButton - 1);
                }
                updateFocus();
                return true;

            case 40: // DOWN
                if (state.focusZone === 'input') {
                    state.focusZone = 'buttons';
                    state.focusedButton = 0;
                } else if (state.focusZone === 'buttons') {
                    state.focusedButton = Math.min(1, state.focusedButton + 1);
                }
                updateFocus();
                return true;

            case 13: // OK/ENTER
                if (state.focusZone === 'buttons') {
                    if (state.focusedButton === 0) {
                        handleSendFeedback();
                    } else {
                        // Skip
                        try { localStorage.setItem(STORAGE_KEYS.RATING_STATUS, 'feedback'); } catch (e) {}
                        showThanks(false);
                    }
                }
                return true;

            case 461: case 10009: case 8: case 27: // BACK
                // Go back to stars
                state.step = 'stars';
                state.focusZone = 'stars';
                showStep('stars');
                updateFocus();
                return true;
        }
        return false;
    }

    function handleThanksNavigation(keyCode) {
        switch (keyCode) {
            case 13: // OK/ENTER
            case 461: case 10009: case 8: case 27: // BACK
                hide();
                return true;
        }
        return false;
    }

    // ===== DEBUG/TESTING =====
    function resetForTesting() {
        try {
            localStorage.removeItem(STORAGE_KEYS.FIRST_LAUNCH);
            localStorage.removeItem(STORAGE_KEYS.RATING_STATUS);
            localStorage.removeItem(STORAGE_KEYS.LATER_UNTIL);
            localStorage.removeItem(STORAGE_KEYS.USER_RATING);
            localStorage.removeItem(STORAGE_KEYS.USER_FEEDBACK);
            console.log('[RatingOverlay] Reset for testing - restart app to see overlay');
        } catch (e) {}
    }

    function forceShow() {
        show();
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        openStore: openStore,
        isVisible: function() { return state.visible; },
        resetForTesting: resetForTesting,
        forceShow: forceShow
    };
})();
