/**
 * Onboarding Overlay for WebOS
 * Shows 3 slides on first launch: Cinematic, Smart Sorting, 4K Engine.
 * D-Pad navigation: LEFT/RIGHT for slides, OK to proceed.
 */
window.OnboardingOverlay = (function() {
    'use strict';

    var STORAGE_KEY = 'ultra_iptv_onboarding_seen';

    var SLIDES = [
        {
            title: 'Cinematic Experience',
            subtitle: 'Dein Kino. \u00DCberall.',
            description: 'Streame Tausende von Live-Kan\u00E4len, Filmen und Serien in bester Qualit\u00E4t.',
            icon: '\uD83C\uDFAC',
            gradient: 'linear-gradient(180deg, #1A1A2E, #16213E, #0F3460)',
            accent: '#E94560'
        },
        {
            title: 'Smarte Sortierung',
            subtitle: 'KI sortiert deine Inhalte',
            description: 'Intelligente Kategorisierung, Genre-Filter und personalisierte Empfehlungen.',
            icon: '\uD83E\uDDE0',
            gradient: 'linear-gradient(180deg, #0F0C29, #302B63, #24243E)',
            accent: '#7B68EE'
        },
        {
            title: '4K Streaming Engine',
            subtitle: 'Kristallklar. Ohne Ruckler.',
            description: 'Adaptives Streaming mit Hardware-Beschleunigung. Von SD bis 4K.',
            icon: '\uD83D\uDCFA',
            gradient: 'linear-gradient(180deg, #0D1117, #161B22, #21262D)',
            accent: '#FFD700'
        }
    ];

    var state = {
        visible: false,
        currentSlide: 0,
        focusedButton: 0  // 0=skip, 1=next/start
    };

    var cache = {
        overlay: null,
        slideContainer: null,
        dots: [],
        skipBtn: null,
        nextBtn: null
    };

    function init() {
        if (hasSeenOnboarding()) return;
        createOverlay();
        cacheElements();
        show();
    }

    function hasSeenOnboarding() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch (e) {
            return false;
        }
    }

    function markSeen() {
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {}
    }

    function createOverlay() {
        var style = document.createElement('style');
        style.id = 'onboarding-overlay-styles';
        style.textContent = [
            '#onboarding-overlay { position:fixed; top:0; left:0; width:100%; height:100%; z-index:99; display:none; }',
            '#onboarding-overlay.visible { display:flex; flex-direction:column; align-items:center; justify-content:center; }',
            '.ob-slide { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; position:absolute; top:0; left:0; opacity:0; transition:opacity 0.5s; }',
            '.ob-slide.active { opacity:1; }',
            '.ob-icon { font-size:80px; margin-bottom:24px; }',
            '.ob-title { font-size:36px; font-weight:bold; color:#fff; text-align:center; }',
            '.ob-subtitle { font-size:22px; font-weight:500; margin-top:8px; text-align:center; }',
            '.ob-desc { font-size:16px; color:rgba(255,255,255,0.65); text-align:center; max-width:500px; margin-top:20px; line-height:1.5; }',
            '.ob-bottom { position:absolute; bottom:60px; display:flex; flex-direction:column; align-items:center; gap:24px; }',
            '.ob-dots { display:flex; gap:8px; }',
            '.ob-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.3); transition:all 0.3s; }',
            '.ob-dot.active { width:24px; border-radius:4px; }',
            '.ob-buttons { display:flex; gap:16px; }',
            '.ob-btn { padding:14px 40px; border-radius:30px; font-size:16px; font-weight:600; cursor:pointer; border:2px solid transparent; transition:all 0.2s; }',
            '.ob-btn-skip { background:transparent; color:rgba(255,255,255,0.5); }',
            '.ob-btn-skip.focused { border-color:rgba(255,255,255,0.5); color:#fff; }',
            '.ob-btn-next { color:#fff; }',
            '.ob-btn-next.focused { transform:scale(1.05); box-shadow:0 0 20px rgba(255,255,255,0.2); }'
        ].join('\n');
        document.head.appendChild(style);

        var html = '<div id="onboarding-overlay">';

        // Slides
        for (var si = 0; si < SLIDES.length; si++) {
            var slide = SLIDES[si];
            html += '<div class="ob-slide' + (si === 0 ? ' active' : '') + '" data-index="' + si + '" style="background:' + slide.gradient + '">';
            html += '<div class="ob-icon">' + slide.icon + '</div>';
            html += '<div class="ob-title">' + slide.title + '</div>';
            html += '<div class="ob-subtitle" style="color:' + slide.accent + '">' + slide.subtitle + '</div>';
            html += '<div class="ob-desc">' + slide.description + '</div>';
            html += '</div>';
        }

        // Bottom section
        html += '<div class="ob-bottom">';
        html += '<div class="ob-dots">';
        for (var i = 0; i < 3; i++) {
            html += '<div class="ob-dot' + (i === 0 ? ' active' : '') + '" data-dot="' + i + '"></div>';
        }
        html += '</div>';
        html += '<div class="ob-buttons">';
        html += '<div class="ob-btn ob-btn-skip" id="ob-skip">\u00DCberspringen</div>';
        html += '<div class="ob-btn ob-btn-next" id="ob-next" style="background:' + SLIDES[0].accent + '">Weiter</div>';
        html += '</div>';
        html += '</div>';

        html += '</div>';

        document.body.insertAdjacentHTML('beforeend', html);
    }

    function cacheElements() {
        cache.overlay = document.getElementById('onboarding-overlay');
        cache.slideContainer = cache.overlay;
        cache.dots = cache.overlay ? cache.overlay.querySelectorAll('.ob-dot') : [];
        cache.skipBtn = document.getElementById('ob-skip');
        cache.nextBtn = document.getElementById('ob-next');
    }

    function show() {
        if (!cache.overlay) return;
        state.visible = true;
        state.currentSlide = 0;
        state.focusedButton = 1; // Focus on "Weiter"
        cache.overlay.classList.add('visible');
        updateSlide();
        updateFocus();
        // Register key handler (capture phase to intercept before NavigationHandler)
        document.addEventListener('keydown', handleKey, true);
        if (window.NavigationStack) window.NavigationStack.push('onboarding');
    }

    function hide() {
        if (!cache.overlay) return;
        state.visible = false;
        markSeen();
        cache.overlay.classList.remove('visible');
        document.removeEventListener('keydown', handleKey, true);
        if (window.NavigationStack) window.NavigationStack.pop();
    }

    function updateSlide() {
        if (!cache.overlay) return;
        var slides = cache.overlay.querySelectorAll('.ob-slide');
        for (var i = 0; i < slides.length; i++) {
            if (i === state.currentSlide) {
                slides[i].classList.add('active');
            } else {
                slides[i].classList.remove('active');
            }
        }
        for (var j = 0; j < cache.dots.length; j++) {
            if (j === state.currentSlide) {
                cache.dots[j].classList.add('active');
                cache.dots[j].style.background = SLIDES[state.currentSlide].accent;
            } else {
                cache.dots[j].classList.remove('active');
                cache.dots[j].style.background = 'rgba(255,255,255,0.3)';
            }
        }
        // Update next button
        if (cache.nextBtn) {
            cache.nextBtn.style.background = SLIDES[state.currentSlide].accent;
            cache.nextBtn.textContent = state.currentSlide === 2 ? "Los geht's" : 'Weiter';
        }
    }

    function updateFocus() {
        if (cache.skipBtn) {
            if (state.focusedButton === 0) {
                cache.skipBtn.classList.add('focused');
            } else {
                cache.skipBtn.classList.remove('focused');
            }
        }
        if (cache.nextBtn) {
            if (state.focusedButton === 1) {
                cache.nextBtn.classList.add('focused');
            } else {
                cache.nextBtn.classList.remove('focused');
            }
        }
    }

    function handleKey(e) {
        if (!state.visible) return;
        var key = e.keyCode;

        // Consume all keys while onboarding is visible
        e.preventDefault();
        if (e.stopImmediatePropagation) {
            e.stopImmediatePropagation();
        } else {
            e.stopPropagation();
        }

        switch (key) {
            case 37: // LEFT
                if (state.focusedButton === 1) {
                    state.focusedButton = 0;
                } else if (state.currentSlide > 0) {
                    state.currentSlide--;
                    updateSlide();
                }
                break;
            case 39: // RIGHT
                if (state.focusedButton === 0) {
                    state.focusedButton = 1;
                } else if (state.currentSlide < 2) {
                    state.currentSlide++;
                    updateSlide();
                }
                break;
            case 13: // OK/Enter
                if (state.focusedButton === 0) {
                    hide(); // Skip
                } else {
                    if (state.currentSlide < 2) {
                        state.currentSlide++;
                        updateSlide();
                    } else {
                        hide(); // Complete
                    }
                }
                break;
            case 461: case 10009: case 8: case 27: // BACK
                hide();
                return;
        }

        updateFocus();
    }

    return {
        init: init,
        show: show,
        hide: hide,
        handleKey: handleKey,
        isVisible: function() { return state.visible; }
    };
})();
