/**
 * Trial Banner - Shows trial status at top of screen
 * ES3 Compatible - WebOS 3.x optimized
 */

window.TrialBanner = (function() {
    'use strict';

    var state = {
        isVisible: false,
        daysLeft: 0,
        banner: null
    };

    function initialize() {
        createBanner();
    }

    function createBanner() {
        var banner = document.createElement('div');
        banner.id = 'trial-banner';
        banner.className = 'trial-banner';
        banner.style.display = 'none';

        banner.innerHTML = '' +
            '<div class="trial-banner-content">' +
            '  <span class="trial-banner-icon">&#9201;</span>' +
            '  <span class="trial-banner-text" id="trial-banner-text">Testversion</span>' +
            '  <button class="trial-banner-btn" id="trial-banner-btn">Jetzt aktivieren</button>' +
            '</div>';

        // Insert at top of body
        document.body.insertBefore(banner, document.body.firstChild);
        state.banner = banner;

        // Click handler for button
        var btn = document.getElementById('trial-banner-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                openActivation();
            });
        }
    }

    function show(daysLeft) {
        if (!state.banner) {
            createBanner();
        }

        state.daysLeft = daysLeft;
        state.isVisible = true;

        // Update text
        var textEl = document.getElementById('trial-banner-text');
        if (textEl) {
            if (daysLeft <= 1) {
                textEl.innerHTML = '<strong>Letzter Tag!</strong> Testversion endet heute';
                state.banner.classList.add('trial-banner-urgent');
            } else if (daysLeft <= 3) {
                textEl.innerHTML = 'Testversion: Noch <strong>' + daysLeft + ' Tage</strong>';
                state.banner.classList.add('trial-banner-warning');
            } else {
                textEl.innerHTML = 'Testversion: Noch ' + daysLeft + ' Tage';
                state.banner.classList.remove('trial-banner-urgent', 'trial-banner-warning');
            }
        }

        state.banner.style.display = 'flex';

        // Adjust body padding
        document.body.style.paddingTop = '50px';
    }

    function hide() {
        if (state.banner) {
            state.banner.style.display = 'none';
        }
        state.isVisible = false;
        document.body.style.paddingTop = '0';
    }

    function openActivation() {
        hide();
        if (window.ActivationScreen) {
            window.ActivationScreen.show('license');
        }
    }

    function isVisible() {
        return state.isVisible;
    }

    // Public API
    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: isVisible
    };
})();
