/**
 * VYON+ Paywall Overlay for WebOS
 * Shows premium pricing and sync code redemption.
 * No in-app purchase on WebOS - uses sync code from mobile.
 */
window.PaywallOverlay = (function() {
    'use strict';

    var STORAGE_KEYS = {
        PREMIUM_STATUS: 'ultra_iptv_premium_status',
        PREMIUM_TIER: 'ultra_iptv_premium_tier',
        SYNC_CODE: 'ultra_iptv_sync_code',
        PREMIUM_EXPIRES: 'ultra_iptv_premium_expires'
    };

    var state = {
        visible: false,
        focusZone: 'cards',   // 'cards' | 'sync' | 'close'
        focusedCard: 1,       // 0=weekly, 1=yearly, 2=lifetime
        focusedSyncChar: 0,
        syncCode: '',
        isPremium: false
    };

    var cache = {
        overlay: null,
        cards: [],
        syncInput: null,
        syncButton: null,
        closeButton: null
    };

    // ===== PRICING DATA =====
    var PLANS = [
        { id: 'weekly',   title: 'Woche',    price: '3,49\u20AC', period: '/Woche',  badge: '' },
        { id: 'yearly',   title: 'Jahr',      price: '27,99\u20AC', period: '/Jahr',   badge: 'BEST DEAL' },
        { id: 'lifetime', title: 'Lifetime',  price: '79,99\u20AC', period: 'einmalig', badge: 'Beliebteste Wahl' }
    ];

    var FEATURES = [
        { name: 'Mehrere Playlisten', free: false, premium: true },
        { name: '4K Streaming', free: false, premium: true },
        { name: 'Voller EPG Guide', free: false, premium: true },
        { name: 'Downloads', free: false, premium: true },
        { name: 'Jugendschutz', free: false, premium: true },
        { name: 'Werbefrei', free: false, premium: true },
        { name: 'Cross-Platform Sync', free: false, premium: true },
        { name: 'SD/HD Streaming', free: true, premium: true },
        { name: '1 Playlist', free: true, premium: true },
        { name: 'Demo Streams', free: true, premium: true }
    ];

    function init() {
        loadPremiumState();
        createOverlay();
        cacheElements();
    }

    function loadPremiumState() {
        try {
            state.isPremium = localStorage.getItem(STORAGE_KEYS.PREMIUM_STATUS) === 'true';
            state.syncCode = localStorage.getItem(STORAGE_KEYS.SYNC_CODE) || '';
        } catch (e) {}
    }

    function isPremium() {
        loadPremiumState();
        return state.isPremium;
    }

    function createOverlay() {
        var style = document.createElement('style');
        style.id = 'paywall-overlay-styles';
        style.textContent = [
            '#paywall-overlay { position:fixed; top:0; left:0; width:100%; height:100%; z-index:96; display:none; background:linear-gradient(180deg,#0d0d0d,#1a1a2e,#0d0d0d); overflow-y:auto; font-family:sans-serif; }',
            '#paywall-overlay.visible { display:flex; flex-direction:column; align-items:center; }',
            '.pw-header { width:100%; display:flex; justify-content:space-between; align-items:center; padding:20px 40px; }',
            '.pw-logo { font-size:28px; font-weight:bold; color:#FFD700; }',
            '.pw-close { font-size:18px; color:rgba(255,255,255,0.5); cursor:pointer; padding:8px 16px; border-radius:8px; border:1px solid transparent; }',
            '.pw-close.focused { border-color:#FFD700; color:#FFD700; }',
            '.pw-title { font-size:32px; font-weight:bold; color:#fff; text-align:center; margin:10px 0; }',
            '.pw-subtitle { font-size:16px; color:rgba(255,255,255,0.6); text-align:center; max-width:500px; margin-bottom:30px; }',
            '.pw-cards { display:flex; gap:16px; padding:0 40px; width:100%; max-width:900px; justify-content:center; }',
            '.pw-card { flex:1; border:2px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s; }',
            '.pw-card.focused { border-color:#FFD700; background:rgba(255,255,255,0.08); transform:scale(1.03); }',
            '.pw-card.highlighted { border-color:#FFD700; }',
            '.pw-card-title { font-size:20px; font-weight:600; color:#fff; }',
            '.pw-card-price { font-size:24px; font-weight:bold; color:#fff; margin-top:8px; }',
            '.pw-card-period { font-size:13px; color:rgba(255,255,255,0.5); }',
            '.pw-card-badge { display:inline-block; background:#FFD700; color:#000; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px; margin-left:8px; }',
            '.pw-card-sub { font-size:12px; color:rgba(255,215,0,0.8); margin-top:4px; }',
            '.pw-features { width:100%; max-width:700px; padding:30px 40px; }',
            '.pw-features-title { font-size:20px; font-weight:bold; color:#fff; margin-bottom:16px; }',
            '.pw-feature-row { display:flex; align-items:center; padding:8px 0; }',
            '.pw-feature-name { flex:1; font-size:14px; color:rgba(255,255,255,0.8); }',
            '.pw-feature-check { width:20px; text-align:center; margin:0 12px; }',
            '.pw-feature-yes { color:#4CAF50; }',
            '.pw-feature-no { color:#FF5252; }',
            '.pw-feature-gold { color:#FFD700; }',
            '.pw-sync-section { width:100%; max-width:500px; padding:20px 40px; text-align:center; }',
            '.pw-sync-title { font-size:16px; color:rgba(255,255,255,0.7); margin-bottom:12px; }',
            '.pw-sync-input { background:rgba(255,255,255,0.1); border:2px solid rgba(255,255,255,0.2); border-radius:8px; color:#FFD700; font-size:24px; font-weight:bold; font-family:monospace; text-align:center; letter-spacing:4px; padding:12px; width:200px; outline:none; }',
            '.pw-sync-input.focused { border-color:#FFD700; }',
            '.pw-sync-btn { margin-top:12px; background:#FFD700; color:#000; border:none; border-radius:8px; padding:12px 32px; font-size:16px; font-weight:600; cursor:pointer; }',
            '.pw-sync-btn.focused { outline:2px solid #fff; outline-offset:2px; }',
            '.pw-sync-msg { margin-top:8px; font-size:14px; }',
            '.pw-sync-msg.success { color:#4CAF50; }',
            '.pw-sync-msg.error { color:#FF5252; }',
            '.pw-later { font-size:14px; color:rgba(255,255,255,0.4); margin:20px 0 40px; cursor:pointer; }'
        ].join('\n');
        document.head.appendChild(style);

        var html = '<div id="paywall-overlay">';
        html += '<div class="pw-header"><span class="pw-logo">VYON+</span><span class="pw-close" id="pw-close">Schlie\u00DFen</span></div>';
        html += '<div class="pw-title">Upgrade auf Premium</div>';
        html += '<div class="pw-subtitle">Nutze den Sync-Code von deinem Smartphone, um Premium auf diesem Ger\u00E4t zu aktivieren.</div>';

        // Cards
        html += '<div class="pw-cards">';
        PLANS.forEach(function(plan, i) {
            var cls = 'pw-card' + (i === 1 ? ' highlighted' : '');
            html += '<div class="' + cls + '" data-index="' + i + '">';
            html += '<div class="pw-card-title">' + plan.title;
            if (plan.badge) html += '<span class="pw-card-badge">' + plan.badge + '</span>';
            html += '</div>';
            html += '<div class="pw-card-price">' + plan.price + '</div>';
            html += '<div class="pw-card-period">' + plan.period + '</div>';
            if (plan.id === 'yearly') html += '<div class="pw-card-sub">7 Tage kostenlos testen</div>';
            html += '</div>';
        });
        html += '</div>';

        // Sync section
        html += '<div class="pw-sync-section">';
        html += '<div class="pw-sync-title">Sync-Code von deinem Smartphone eingeben:</div>';
        html += '<input class="pw-sync-input" id="pw-sync-input" maxlength="6" placeholder="VY3K9M">';
        html += '<br><button class="pw-sync-btn" id="pw-sync-btn">Premium aktivieren</button>';
        html += '<div class="pw-sync-msg" id="pw-sync-msg"></div>';
        html += '</div>';

        // Features
        html += '<div class="pw-features">';
        html += '<div class="pw-features-title">Free vs. VYON+</div>';
        FEATURES.forEach(function(f) {
            html += '<div class="pw-feature-row">';
            html += '<span class="pw-feature-name">' + f.name + '</span>';
            html += '<span class="pw-feature-check ' + (f.free ? 'pw-feature-yes' : 'pw-feature-no') + '">' + (f.free ? '\u2713' : '\u2717') + '</span>';
            html += '<span class="pw-feature-check pw-feature-gold">\u2713</span>';
            html += '</div>';
        });
        html += '</div>';

        html += '<div class="pw-later" id="pw-later">Sp\u00E4ter</div>';
        html += '</div>';

        document.body.insertAdjacentHTML('beforeend', html);
    }

    function cacheElements() {
        cache.overlay = document.getElementById('paywall-overlay');
        cache.cards = cache.overlay ? cache.overlay.querySelectorAll('.pw-card') : [];
        cache.syncInput = document.getElementById('pw-sync-input');
        cache.syncButton = document.getElementById('pw-sync-btn');
        cache.closeButton = document.getElementById('pw-close');
    }

    function show() {
        if (!cache.overlay) return;
        state.visible = true;
        state.focusZone = 'cards';
        state.focusedCard = 1;
        cache.overlay.classList.add('visible');
        updateFocus();
        if (window.NavigationStack) window.NavigationStack.push('paywall');
    }

    function hide() {
        if (!cache.overlay) return;
        state.visible = false;
        cache.overlay.classList.remove('visible');
        if (window.NavigationStack) window.NavigationStack.pop();
    }

    function updateFocus() {
        // Clear all focus
        for (var i = 0; i < cache.cards.length; i++) {
            cache.cards[i].classList.remove('focused');
        }
        if (cache.syncInput) cache.syncInput.classList.remove('focused');
        if (cache.syncButton) cache.syncButton.classList.remove('focused');
        if (cache.closeButton) cache.closeButton.classList.remove('focused');

        if (state.focusZone === 'cards' && cache.cards[state.focusedCard]) {
            cache.cards[state.focusedCard].classList.add('focused');
        } else if (state.focusZone === 'sync') {
            if (cache.syncInput) cache.syncInput.classList.add('focused');
        } else if (state.focusZone === 'syncbtn') {
            if (cache.syncButton) cache.syncButton.classList.add('focused');
        } else if (state.focusZone === 'close') {
            if (cache.closeButton) cache.closeButton.classList.add('focused');
        }
    }

    function handleKey(e) {
        if (!state.visible) return false;
        var key = e.keyCode;

        switch (key) {
            case 37: // LEFT
                if (state.focusZone === 'cards') {
                    state.focusedCard = Math.max(0, state.focusedCard - 1);
                }
                break;
            case 39: // RIGHT
                if (state.focusZone === 'cards') {
                    state.focusedCard = Math.min(2, state.focusedCard + 1);
                }
                break;
            case 38: // UP
                if (state.focusZone === 'syncbtn') state.focusZone = 'sync';
                else if (state.focusZone === 'sync') state.focusZone = 'cards';
                else if (state.focusZone === 'cards') state.focusZone = 'close';
                break;
            case 40: // DOWN
                if (state.focusZone === 'close') state.focusZone = 'cards';
                else if (state.focusZone === 'cards') state.focusZone = 'sync';
                else if (state.focusZone === 'sync') state.focusZone = 'syncbtn';
                break;
            case 13: // OK/Enter
                if (state.focusZone === 'close') {
                    hide();
                } else if (state.focusZone === 'sync') {
                    if (cache.syncInput) cache.syncInput.focus();
                } else if (state.focusZone === 'syncbtn') {
                    redeemCode();
                }
                break;
            case 461: case 10009: case 8: case 27: // BACK
                hide();
                return true;
        }

        updateFocus();
        return true;
    }

    function redeemCode() {
        var code = cache.syncInput ? cache.syncInput.value.toUpperCase().trim() : '';
        var msgEl = document.getElementById('pw-sync-msg');

        if (code.length !== 6) {
            if (msgEl) {
                msgEl.className = 'pw-sync-msg error';
                msgEl.textContent = 'Bitte 6-stelligen Code eingeben';
            }
            return;
        }

        // Activate premium
        try {
            var expires = Date.now() + (30 * 24 * 60 * 60 * 1000);
            localStorage.setItem(STORAGE_KEYS.PREMIUM_STATUS, 'true');
            localStorage.setItem(STORAGE_KEYS.PREMIUM_TIER, 'yearly');
            localStorage.setItem(STORAGE_KEYS.SYNC_CODE, code);
            localStorage.setItem(STORAGE_KEYS.PREMIUM_EXPIRES, expires.toString());
            state.isPremium = true;
            state.syncCode = code;
        } catch (e) {}

        if (msgEl) {
            msgEl.className = 'pw-sync-msg success';
            msgEl.textContent = 'Premium erfolgreich aktiviert!';
        }

        setTimeout(function() { hide(); }, 2000);
    }

    // Public API
    return {
        init: init,
        show: show,
        hide: hide,
        isPremium: isPremium,
        handleKey: handleKey,
        isVisible: function() { return state.visible; }
    };
})();
