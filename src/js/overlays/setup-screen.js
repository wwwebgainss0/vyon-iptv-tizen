/**
 * Setup Screen - First-Run Server/Username/Password Entry
 * ES3 Compatible - WebOS 3.x optimized
 *
 * Activates at boot when IPTVApp.getConfig().server is empty.
 * Provides 3 input fields + a Connect button. TV-remote-navigable.
 * On successful XtreamAPI.testConnection, persists config and re-runs boot.
 */

window.SetupScreen = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        active: false,
        focusIndex: 0, // 0=server, 1=username, 2=password, 3=connect
        server: '',
        username: '',
        password: '',
        errorMessage: '',
        connecting: false
    };

    var INPUT_COUNT = 4;

    // ===== CACHED DOM =====
    var cache = {
        container: null,
        serverInput: null,
        usernameInput: null,
        passwordInput: null,
        errorBox: null,
        connectBtn: null,
        title: null,
        subtitle: null,
        labelServer: null,
        labelUsername: null,
        labelPassword: null
    };

    var isBuilt = false;

    // ===== HELPERS =====
    function getEl(id) {
        return document.getElementById(id);
    }

    function t(key, fallback) {
        if (window.i18n && window.i18n.t) {
            var v = window.i18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    // ===== DOM BUILD =====
    function buildDom() {
        if (isBuilt) return;

        var container = document.createElement('div');
        container.id = 'setup-screen';
        container.className = 'setup-screen';

        var html = '';
        html += '<div class="setup-card">';
        html += '  <h1 id="setup-title" class="setup-title"></h1>';
        html += '  <p id="setup-subtitle" class="setup-subtitle"></p>';
        html += '  <label id="setup-label-server" class="setup-label" for="setup-server-input"></label>';
        html += '  <input id="setup-server-input" type="url" class="setup-input" placeholder="http://example.com:8080" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />';
        html += '  <label id="setup-label-username" class="setup-label" for="setup-username-input"></label>';
        html += '  <input id="setup-username-input" type="text" class="setup-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />';
        html += '  <label id="setup-label-password" class="setup-label" for="setup-password-input"></label>';
        html += '  <input id="setup-password-input" type="password" class="setup-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />';
        html += '  <div id="setup-error" class="setup-error"></div>';
        html += '  <button id="setup-connect-btn" class="setup-button" type="button"></button>';
        html += '  <div class="setup-hint" id="setup-hint"></div>';
        html += '</div>';

        container.innerHTML = html;
        document.body.appendChild(container);

        // Cache
        cache.container = container;
        cache.serverInput = getEl('setup-server-input');
        cache.usernameInput = getEl('setup-username-input');
        cache.passwordInput = getEl('setup-password-input');
        cache.errorBox = getEl('setup-error');
        cache.connectBtn = getEl('setup-connect-btn');
        cache.title = getEl('setup-title');
        cache.subtitle = getEl('setup-subtitle');
        cache.labelServer = getEl('setup-label-server');
        cache.labelUsername = getEl('setup-label-username');
        cache.labelPassword = getEl('setup-label-password');

        // Sync state on input (OSK or hardware keyboard)
        if (cache.serverInput) {
            cache.serverInput.oninput = function() { state.server = cache.serverInput.value; };
        }
        if (cache.usernameInput) {
            cache.usernameInput.oninput = function() { state.username = cache.usernameInput.value; };
        }
        if (cache.passwordInput) {
            cache.passwordInput.oninput = function() { state.password = cache.passwordInput.value; };
        }

        if (cache.connectBtn) {
            cache.connectBtn.onclick = function() { tryConnect(); };
        }

        isBuilt = true;
    }

    function applyTexts() {
        if (cache.title) cache.title.textContent = t('setup.title', 'Set up your IPTV server');
        if (cache.subtitle) cache.subtitle.textContent = t('setup.subtitle', 'Please enter your IPTV provider details.');
        if (cache.labelServer) cache.labelServer.textContent = t('setup.server', 'Server URL');
        if (cache.labelUsername) cache.labelUsername.textContent = t('setup.username', 'Username');
        if (cache.labelPassword) cache.labelPassword.textContent = t('setup.password', 'Password');

        var hintEl = getEl('setup-hint');
        if (hintEl) hintEl.textContent = t('setup.hint', 'UP/DOWN to navigate, OK to confirm');
    }

    function render() {
        buildDom();
        applyTexts();

        cache.container.style.display = 'flex';

        if (cache.serverInput) cache.serverInput.value = state.server || '';
        if (cache.usernameInput) cache.usernameInput.value = state.username || '';
        if (cache.passwordInput) cache.passwordInput.value = state.password || '';

        if (cache.errorBox) {
            cache.errorBox.textContent = state.errorMessage || '';
            cache.errorBox.style.display = state.errorMessage ? 'block' : 'none';
        }

        if (cache.connectBtn) {
            cache.connectBtn.textContent = state.connecting
                ? t('setup.connecting', 'Connecting...')
                : t('setup.connect', 'Connect');
            cache.connectBtn.disabled = state.connecting ? true : false;
        }

        applyFocus();
    }

    function applyFocus() {
        var els = [cache.serverInput, cache.usernameInput, cache.passwordInput, cache.connectBtn];
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (!el) continue;
            if (i === state.focusIndex) {
                if (el.classList && el.classList.add) {
                    el.classList.add('focused');
                }
                try {
                    if (el.focus) el.focus();
                } catch (e) {
                    // WebOS might throw on focus calls in rare cases
                }
            } else {
                if (el.classList && el.classList.remove) {
                    el.classList.remove('focused');
                }
            }
        }
    }

    // ===== KEY HANDLING =====
    function handleKey(e) {
        if (!state.active) return false;

        var code = e.keyCode;

        // UP = 38
        if (code === 38) {
            state.focusIndex = (state.focusIndex - 1 + INPUT_COUNT) % INPUT_COUNT;
            applyFocus();
            if (e.preventDefault) e.preventDefault();
            return true;
        }

        // DOWN = 40
        if (code === 40) {
            state.focusIndex = (state.focusIndex + 1) % INPUT_COUNT;
            applyFocus();
            if (e.preventDefault) e.preventDefault();
            return true;
        }

        // OK / Enter = 13
        if (code === 13) {
            if (state.focusIndex === 3) {
                tryConnect();
                if (e.preventDefault) e.preventDefault();
                return true;
            }
            // For input fields, let the OSK / native handler take over
            return false;
        }

        // BACK = 461 / 10009 / 8 / 27 - swallow so the app doesn't exit before configured
        if (code === 461 || code === 10009 || code === 8 || code === 27) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            return true;
        }

        return false;
    }

    // ===== CONNECTION TEST =====
    function tryConnect() {
        if (state.connecting) return;

        // Read fresh values straight from inputs (covers OSK timing edge-cases)
        if (cache.serverInput) state.server = cache.serverInput.value;
        if (cache.usernameInput) state.username = cache.usernameInput.value;
        if (cache.passwordInput) state.password = cache.passwordInput.value;

        var server = trimString(state.server);
        var username = trimString(state.username);
        var password = trimString(state.password);

        if (!server || !username || !password) {
            state.errorMessage = t('setup.error_missing', 'Please fill in all fields.');
            render();
            return;
        }

        // Auto-prepend http:// if user typed bare host
        if (server.indexOf('http://') !== 0 && server.indexOf('https://') !== 0) {
            server = 'http://' + server;
        }

        // Strip trailing slash
        if (server.charAt(server.length - 1) === '/') {
            server = server.substring(0, server.length - 1);
        }

        state.server = server;
        state.username = username;
        state.password = password;

        state.connecting = true;
        state.errorMessage = '';
        render();

        if (!window.XtreamAPI || !window.XtreamAPI.setConfig || !window.XtreamAPI.testConnection) {
            state.connecting = false;
            state.errorMessage = t('setup.error_api_missing', 'Internal: API not loaded.');
            render();
            return;
        }

        // Apply config to XtreamAPI directly for the test (do NOT persist yet)
        window.XtreamAPI.setConfig({
            server: server,
            username: username,
            password: password
        });

        window.XtreamAPI.testConnection(function(success, data) {
            state.connecting = false;

            if (success && data && typeof data === 'object' && !data.error) {
                // Persist via IPTVApp (writes localStorage + applies to XtreamAPI)
                if (window.IPTVApp && window.IPTVApp.setConfig) {
                    window.IPTVApp.setConfig(server, username, password);
                }
                hide();
                if (window.IPTVApp && window.IPTVApp.startAfterSetup) {
                    window.IPTVApp.startAfterSetup();
                } else if (window.location && window.location.reload) {
                    window.location.reload();
                }
                return;
            }

            // Failure
            var msg = '';
            if (data && typeof data === 'string') {
                msg = data;
            } else if (data && data.message) {
                msg = data.message;
            }
            if (!msg) {
                msg = t('setup.error_connect', 'Connection failed. Please check your input.');
            }
            state.errorMessage = msg;
            render();
        });
    }

    function trimString(s) {
        if (s === null || s === undefined) return '';
        s = String(s);
        // ES3-safe trim
        return s.replace(/^\s+|\s+$/g, '');
    }

    // ===== SHOW / HIDE =====
    function show() {
        state.active = true;
        state.focusIndex = 0;
        state.errorMessage = '';
        state.connecting = false;

        // Pre-fill from existing config (in case the user is fixing bad credentials)
        if (window.IPTVApp && window.IPTVApp.getConfig) {
            var cfg = window.IPTVApp.getConfig();
            if (cfg) {
                state.server = cfg.server || '';
                state.username = cfg.username || '';
                state.password = cfg.password || '';
            }
        }

        render();
    }

    function hide() {
        state.active = false;
        if (cache.container) {
            cache.container.style.display = 'none';
        }
    }

    function isActive() {
        return state.active === true;
    }

    // ===== PUBLIC API =====
    return {
        show: show,
        hide: hide,
        handleKey: handleKey,
        isActive: isActive
    };
})();
