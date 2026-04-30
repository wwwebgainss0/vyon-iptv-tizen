/**
 * Parental Control Module
 * PIN-based content locking system
 * ES3 Compatible for WebOS 3.x
 */

window.ParentalControl = (function() {
    'use strict';

    // ===== CONFIG =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_parental',
        DEFAULT_PIN: '0000',
        LOCK_TIMEOUT: 30 * 60 * 1000, // 30 minutes until re-lock
        RATINGS: ['All', '6+', '12+', '16+', '18+'],
        RATING_VALUES: { 'All': 0, '6+': 6, '12+': 12, '16+': 16, '18+': 18 }
    };

    // ===== STATE =====
    var state = {
        isEnabled: false,
        pin: CONFIG.DEFAULT_PIN,
        maxRating: 'All',
        lockedCategories: [],
        lockedChannels: [],
        isUnlocked: false,
        unlockTime: 0,
        appLockEnabled: false
    };

    // ===== INITIALIZATION =====
    function init() {
        loadSettings();

        // Check if app needs PIN on startup
        if (state.appLockEnabled && state.isEnabled) {
            showAppLockScreen();
        }

        return true;
    }

    function loadSettings() {
        try {
            var saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                var data = JSON.parse(saved);
                state.isEnabled = data.isEnabled || false;
                state.pin = data.pin || CONFIG.DEFAULT_PIN;
                state.maxRating = data.maxRating || 'All';
                state.lockedCategories = data.lockedCategories || [];
                state.lockedChannels = data.lockedChannels || [];
                state.appLockEnabled = data.appLockEnabled || false;
            }
        } catch (e) {
            console.warn('[ParentalControl] Failed to load settings:', e);
        }
    }

    function saveSettings() {
        try {
            var data = {
                isEnabled: state.isEnabled,
                pin: state.pin,
                maxRating: state.maxRating,
                lockedCategories: state.lockedCategories,
                lockedChannels: state.lockedChannels,
                appLockEnabled: state.appLockEnabled
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('[ParentalControl] Failed to save settings:', e);
        }
    }

    // ===== APP LOCK =====
    function showAppLockScreen() {
        if (!window.PINInput) return;

        // Create app lock overlay
        var lockOverlay = document.getElementById('app-lock-overlay');
        if (!lockOverlay) {
            lockOverlay = document.createElement('div');
            lockOverlay.id = 'app-lock-overlay';
            lockOverlay.className = 'app-lock-overlay';
            lockOverlay.innerHTML = '<div class="app-lock-content">' +
                '<div class="app-lock-icon">🔒</div>' +
                '<div class="app-lock-title">Ultra IPTV</div>' +
                '<div class="app-lock-subtitle">PIN erforderlich</div>' +
                '</div>';
            document.body.appendChild(lockOverlay);
        }

        lockOverlay.style.display = 'flex';

        // Show PIN input
        setTimeout(function() {
            window.PINInput.show({
                title: 'App-PIN eingeben',
                onComplete: function(enteredPIN) {
                    if (enteredPIN === null) {
                        // User cancelled - close app
                        if (window.webOS && window.webOS.platformBack) {
                            window.close();
                        }
                        return;
                    }

                    if (verifyPIN(enteredPIN)) {
                        lockOverlay.style.display = 'none';
                        state.isUnlocked = true;
                        state.unlockTime = Date.now();
                        showToast('✓ App entsperrt');
                    } else {
                        showToast('✗ Falscher PIN');
                        // Show PIN input again
                        setTimeout(function() {
                            showAppLockScreen();
                        }, 500);
                    }
                }
            });
        }, 300);
    }

    // ===== PIN VERIFICATION =====
    function verifyPIN(enteredPIN) {
        return enteredPIN === state.pin;
    }

    function isSessionUnlocked() {
        if (!state.isUnlocked) return false;

        // Check if lock timeout expired
        if (Date.now() - state.unlockTime > CONFIG.LOCK_TIMEOUT) {
            state.isUnlocked = false;
            return false;
        }

        return true;
    }

    function requestUnlock(callback) {
        if (!window.PINInput) {
            callback(false);
            return;
        }

        // Already unlocked?
        if (isSessionUnlocked()) {
            callback(true);
            return;
        }

        window.PINInput.show({
            title: 'PIN eingeben',
            onComplete: function(enteredPIN) {
                if (enteredPIN === null) {
                    callback(false);
                    return;
                }

                if (verifyPIN(enteredPIN)) {
                    state.isUnlocked = true;
                    state.unlockTime = Date.now();
                    callback(true);
                } else {
                    showToast('✗ Falscher PIN');
                    callback(false);
                }
            }
        });
    }

    // ===== CONTENT CHECKS =====
    function isChannelLocked(channel) {
        if (!state.isEnabled) return false;

        // Check if channel is in locked list
        var channelId = channel.stream_id || channel.id;
        for (var i = 0; i < state.lockedChannels.length; i++) {
            if (state.lockedChannels[i] == channelId) {
                return true;
            }
        }

        // Check if category is locked
        var categoryId = channel.category_id;
        if (categoryId) {
            for (var j = 0; j < state.lockedCategories.length; j++) {
                if (state.lockedCategories[j] == categoryId) {
                    return true;
                }
            }
        }

        // Check age rating
        var rating = channel.rating || channel.age_rating || 0;
        var maxValue = CONFIG.RATING_VALUES[state.maxRating] || 0;
        if (maxValue > 0 && rating > maxValue) {
            return true;
        }

        return false;
    }

    function isCategoryLocked(categoryId) {
        if (!state.isEnabled) return false;

        for (var i = 0; i < state.lockedCategories.length; i++) {
            if (state.lockedCategories[i] == categoryId) {
                return true;
            }
        }

        return false;
    }

    function canPlayChannel(channel, callback) {
        if (!state.isEnabled) {
            callback(true);
            return;
        }

        if (!isChannelLocked(channel)) {
            callback(true);
            return;
        }

        // Channel is locked - request PIN
        requestUnlock(callback);
    }

    // ===== PIN MANAGEMENT =====
    function changePIN(callback) {
        if (!window.PINInput) {
            callback(false);
            return;
        }

        // First verify current PIN
        window.PINInput.show({
            title: 'Aktuellen PIN eingeben',
            onComplete: function(currentPIN) {
                if (currentPIN === null) {
                    callback(false);
                    return;
                }

                if (!verifyPIN(currentPIN)) {
                    showToast('✗ Falscher PIN');
                    callback(false);
                    return;
                }

                // Now enter new PIN
                window.PINInput.show({
                    title: 'Neuen PIN eingeben',
                    onComplete: function(newPIN) {
                        if (newPIN === null) {
                            callback(false);
                            return;
                        }

                        if (newPIN.length !== 4) {
                            showToast('✗ PIN muss 4 Ziffern haben');
                            callback(false);
                            return;
                        }

                        // Confirm new PIN
                        window.PINInput.show({
                            title: 'Neuen PIN bestätigen',
                            onComplete: function(confirmPIN) {
                                if (confirmPIN === null) {
                                    callback(false);
                                    return;
                                }

                                if (confirmPIN !== newPIN) {
                                    showToast('✗ PINs stimmen nicht überein');
                                    callback(false);
                                    return;
                                }

                                state.pin = newPIN;
                                saveSettings();
                                showToast('✓ PIN geändert');
                                callback(true);
                            }
                        });
                    }
                });
            }
        });
    }

    function resetPIN(callback) {
        // Reset to default PIN - useful if forgotten
        state.pin = CONFIG.DEFAULT_PIN;
        saveSettings();
        showToast('PIN zurückgesetzt auf: ' + CONFIG.DEFAULT_PIN);
        if (callback) callback(true);
    }

    // ===== LOCK MANAGEMENT =====
    function lockChannel(channelId) {
        if (!state.isEnabled) return false;

        for (var i = 0; i < state.lockedChannels.length; i++) {
            if (state.lockedChannels[i] == channelId) {
                return false; // Already locked
            }
        }

        state.lockedChannels.push(channelId);
        saveSettings();
        return true;
    }

    function unlockChannel(channelId) {
        for (var i = 0; i < state.lockedChannels.length; i++) {
            if (state.lockedChannels[i] == channelId) {
                state.lockedChannels.splice(i, 1);
                saveSettings();
                return true;
            }
        }
        return false;
    }

    function lockCategory(categoryId) {
        if (!state.isEnabled) return false;

        for (var i = 0; i < state.lockedCategories.length; i++) {
            if (state.lockedCategories[i] == categoryId) {
                return false; // Already locked
            }
        }

        state.lockedCategories.push(categoryId);
        saveSettings();
        return true;
    }

    function unlockCategory(categoryId) {
        for (var i = 0; i < state.lockedCategories.length; i++) {
            if (state.lockedCategories[i] == categoryId) {
                state.lockedCategories.splice(i, 1);
                saveSettings();
                return true;
            }
        }
        return false;
    }

    function toggleCategoryLock(categoryId) {
        if (isCategoryLocked(categoryId)) {
            unlockCategory(categoryId);
            return false;
        } else {
            lockCategory(categoryId);
            return true;
        }
    }

    // ===== SETTINGS =====
    function enable() {
        state.isEnabled = true;
        saveSettings();
    }

    function disable() {
        state.isEnabled = false;
        state.isUnlocked = false;
        saveSettings();
    }

    function setMaxRating(rating) {
        if (CONFIG.RATINGS.indexOf(rating) !== -1) {
            state.maxRating = rating;
            saveSettings();
        }
    }

    function setAppLock(enabled) {
        state.appLockEnabled = enabled;
        saveSettings();
    }

    // ===== UI HELPERS =====
    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'parental-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            toast.classList.add('show');
        }, 10);

        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }

    function getLockIcon(channel) {
        if (!state.isEnabled) return '';
        if (!isChannelLocked(channel)) return '';
        return '🔒';
    }

    // ===== SETTINGS UI =====
    function showSettingsMenu(callback) {
        // First verify PIN
        requestUnlock(function(unlocked) {
            if (!unlocked) {
                if (callback) callback(false);
                return;
            }

            // Show parental control settings
            showParentalSettingsOverlay(callback);
        });
    }

    function showParentalSettingsOverlay(callback) {
        var overlay = document.getElementById('parental-settings-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'parental-settings-overlay';
            overlay.className = 'parental-settings-overlay';
            document.body.appendChild(overlay);
        }

        var html = '<div class="parental-settings-modal">';
        html += '<div class="parental-settings-title">Kindersicherung</div>';
        html += '<div class="parental-settings-options">';

        // Enable/Disable
        html += '<div class="parental-option' + (state.isEnabled ? ' active' : '') + '" data-action="toggle-enabled">';
        html += '<span class="parental-option-label">Kindersicherung aktiv</span>';
        html += '<span class="parental-option-value">' + (state.isEnabled ? 'AN' : 'AUS') + '</span>';
        html += '</div>';

        // App Lock
        html += '<div class="parental-option' + (state.appLockEnabled ? ' active' : '') + '" data-action="toggle-applock">';
        html += '<span class="parental-option-label">App-Sperre beim Start</span>';
        html += '<span class="parental-option-value">' + (state.appLockEnabled ? 'AN' : 'AUS') + '</span>';
        html += '</div>';

        // Max Rating
        html += '<div class="parental-option" data-action="change-rating">';
        html += '<span class="parental-option-label">Max. Altersfreigabe</span>';
        html += '<span class="parental-option-value">' + state.maxRating + '</span>';
        html += '</div>';

        // Change PIN
        html += '<div class="parental-option" data-action="change-pin">';
        html += '<span class="parental-option-label">PIN ändern</span>';
        html += '<span class="parental-option-value">****</span>';
        html += '</div>';

        // Reset PIN
        html += '<div class="parental-option danger" data-action="reset-pin">';
        html += '<span class="parental-option-label">PIN zurücksetzen</span>';
        html += '<span class="parental-option-value">→ ' + CONFIG.DEFAULT_PIN + '</span>';
        html += '</div>';

        // Locked Categories Count
        html += '<div class="parental-option info" data-action="manage-categories">';
        html += '<span class="parental-option-label">Gesperrte Kategorien</span>';
        html += '<span class="parental-option-value">' + state.lockedCategories.length + '</span>';
        html += '</div>';

        html += '</div>';
        html += '<div class="parental-settings-hint">BACK = Schließen</div>';
        html += '</div>';

        overlay.innerHTML = html;
        overlay.style.display = 'flex';

        // Setup navigation
        var options = overlay.querySelectorAll('.parental-option');
        var focusIndex = 0;

        function updateFocus() {
            for (var i = 0; i < options.length; i++) {
                options[i].classList.remove('focused');
            }
            if (options[focusIndex]) {
                options[focusIndex].classList.add('focused');
            }
        }

        function handleAction() {
            var action = options[focusIndex].getAttribute('data-action');

            switch (action) {
                case 'toggle-enabled':
                    if (state.isEnabled) {
                        disable();
                    } else {
                        enable();
                    }
                    showParentalSettingsOverlay(callback);
                    break;

                case 'toggle-applock':
                    setAppLock(!state.appLockEnabled);
                    showParentalSettingsOverlay(callback);
                    break;

                case 'change-rating':
                    var currentIndex = CONFIG.RATINGS.indexOf(state.maxRating);
                    var nextIndex = (currentIndex + 1) % CONFIG.RATINGS.length;
                    setMaxRating(CONFIG.RATINGS[nextIndex]);
                    showParentalSettingsOverlay(callback);
                    break;

                case 'change-pin':
                    overlay.style.display = 'none';
                    changePIN(function(success) {
                        showParentalSettingsOverlay(callback);
                    });
                    break;

                case 'reset-pin':
                    resetPIN();
                    showParentalSettingsOverlay(callback);
                    break;

                case 'manage-categories':
                    // Could open category lock manager
                    showToast('Kategorien in der Liste mit GELB sperren');
                    break;
            }
        }

        function closeOverlay() {
            overlay.style.display = 'none';
            document.removeEventListener('keydown', keyHandler);

            // Remove from navigation stack
            if (window.NavigationStack && window.NavigationStack.has('parental-settings')) {
                window.NavigationStack.remove('parental-settings');
            }

            if (callback) callback(true);
        }

        function keyHandler(event) {
            var keyCode = event.keyCode;

            switch (keyCode) {
                case 38: // UP
                    focusIndex = Math.max(0, focusIndex - 1);
                    updateFocus();
                    event.preventDefault();
                    break;
                case 40: // DOWN
                    focusIndex = Math.min(options.length - 1, focusIndex + 1);
                    updateFocus();
                    event.preventDefault();
                    break;
                case 13: // OK
                    handleAction();
                    event.preventDefault();
                    break;
                case 461: // BACK
                case 10009:
                case 8:
                case 27:
                    closeOverlay();
                    event.preventDefault();
                    break;
            }
        }

        document.addEventListener('keydown', keyHandler, false);
        updateFocus();

        // Push to nav stack
        if (window.NavigationStack) {
            window.NavigationStack.push('parental-settings', window.NavigationStack.LAYERS.MODAL, {
                onBack: function() {
                    closeOverlay();
                    return true;
                }
            });
        }
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        isEnabled: function() { return state.isEnabled; },
        isChannelLocked: isChannelLocked,
        isCategoryLocked: isCategoryLocked,
        canPlayChannel: canPlayChannel,
        requestUnlock: requestUnlock,
        lockChannel: lockChannel,
        unlockChannel: unlockChannel,
        lockCategory: lockCategory,
        unlockCategory: unlockCategory,
        toggleCategoryLock: toggleCategoryLock,
        changePIN: changePIN,
        enable: enable,
        disable: disable,
        setMaxRating: setMaxRating,
        setAppLock: setAppLock,
        showSettings: showSettingsMenu,
        getLockIcon: getLockIcon,
        getRatings: function() { return CONFIG.RATINGS; },
        getMaxRating: function() { return state.maxRating; }
    };
})();
