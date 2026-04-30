/**
 * Profile Manager - Multi-User Profile System
 * Separate favorites, watch history, and settings per profile
 * ES3 Compatible - WebOS 3.x optimized
 */

window.ProfileManager = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_profiles',
        CURRENT_PROFILE_KEY: 'ultra_iptv_current_profile',
        MAX_PROFILES: 5,
        DEFAULT_AVATAR: 0
    };

    // ===== AVAILABLE AVATARS =====
    var AVATARS = [
        { id: 0, icon: '👤', color: '#e50914', name: 'Red' },
        { id: 1, icon: '👨', color: '#2196F3', name: 'Blue' },
        { id: 2, icon: '👩', color: '#4CAF50', name: 'Green' },
        { id: 3, icon: '🧒', color: '#FF9800', name: 'Orange' },
        { id: 4, icon: '👴', color: '#9C27B0', name: 'Purple' },
        { id: 5, icon: '👵', color: '#00BCD4', name: 'Cyan' },
        { id: 6, icon: '🐱', color: '#795548', name: 'Brown' },
        { id: 7, icon: '🐶', color: '#607D8B', name: 'Gray' }
    ];

    // ===== STATE =====
    var state = {
        profiles: [],
        currentProfileId: null,
        showingSelector: false,
        selectorFocus: 0,
        editMode: false,
        editingProfileId: null
    };

    // ===== CACHED DOM ELEMENTS =====
    var cache = {
        overlay: null,
        profileList: null,
        addButton: null,
        editButton: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadProfiles();
        createOverlayElements();
        cacheElements();

        // Create default profile if none exist
        if (state.profiles.length === 0) {
            createProfile('Hauptprofil', 0);
            state.currentProfileId = state.profiles[0].id;
            saveProfiles();
        }

        // Load current profile
        loadCurrentProfile();

        // Apply current profile data
        applyProfileData();
    }

    function createOverlayElements() {
        // Check if already exists
        if (document.getElementById('profile-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'profile-overlay';
        overlay.className = 'profile-overlay';

        overlay.innerHTML =
            '<div class="profile-overlay-content">' +
                '<h2 class="profile-overlay-title">Wer schaut?</h2>' +
                '<div class="profile-list" id="profile-list"></div>' +
                '<div class="profile-actions">' +
                    '<div class="profile-action-btn" id="profile-add-btn">' +
                        '<span class="profile-action-icon">+</span>' +
                        '<span>Neues Profil</span>' +
                    '</div>' +
                    '<div class="profile-action-btn" id="profile-edit-btn">' +
                        '<span class="profile-action-icon">✎</span>' +
                        '<span>Bearbeiten</span>' +
                    '</div>' +
                '</div>' +
                '<div class="profile-hint">↑↓ ← → Navigieren • OK Auswählen • BACK Abbrechen</div>' +
            '</div>';

        document.body.appendChild(overlay);
    }

    function cacheElements() {
        cache.overlay = document.getElementById('profile-overlay');
        cache.profileList = document.getElementById('profile-list');
        cache.addButton = document.getElementById('profile-add-btn');
        cache.editButton = document.getElementById('profile-edit-btn');
    }

    // ===== STORAGE =====
    function loadProfiles() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                state.profiles = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[ProfileManager] Failed to load profiles:', e);
            state.profiles = [];
        }
    }

    function saveProfiles() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.profiles));
        } catch (e) {
            console.error('[ProfileManager] Failed to save profiles:', e);
        }
    }

    function loadCurrentProfile() {
        try {
            var stored = localStorage.getItem(CONFIG.CURRENT_PROFILE_KEY);
            if (stored) {
                state.currentProfileId = stored;
            } else if (state.profiles.length > 0) {
                state.currentProfileId = state.profiles[0].id;
            }
        } catch (e) {
            if (state.profiles.length > 0) {
                state.currentProfileId = state.profiles[0].id;
            }
        }
    }

    function saveCurrentProfile() {
        try {
            localStorage.setItem(CONFIG.CURRENT_PROFILE_KEY, state.currentProfileId);
        } catch (e) {
            console.error('[ProfileManager] Failed to save current profile:', e);
        }
    }

    // ===== PROFILE MANAGEMENT =====
    function createProfile(name, avatarId) {
        if (state.profiles.length >= CONFIG.MAX_PROFILES) {
            return null;
        }

        var profile = {
            id: generateId(),
            name: name || 'Profil ' + (state.profiles.length + 1),
            avatarId: avatarId || 0,
            createdAt: Date.now(),
            // Profile-specific storage keys
            storageKeys: {
                favorites: 'ultra_iptv_favorites_' + generateId(),
                watchHistory: 'ultra_iptv_history_' + generateId(),
                watchlist: 'ultra_iptv_watchlist_' + generateId(),
                settings: 'ultra_iptv_settings_' + generateId()
            }
        };

        state.profiles.push(profile);
        saveProfiles();

        return profile;
    }

    function deleteProfile(profileId) {
        // Cannot delete if only one profile
        if (state.profiles.length <= 1) {
            return false;
        }

        var index = -1;
        for (var i = 0; i < state.profiles.length; i++) {
            if (state.profiles[i].id === profileId) {
                index = i;
                break;
            }
        }

        if (index === -1) return false;

        var profile = state.profiles[index];

        // Clear profile-specific storage
        try {
            localStorage.removeItem(profile.storageKeys.favorites);
            localStorage.removeItem(profile.storageKeys.watchHistory);
            localStorage.removeItem(profile.storageKeys.watchlist);
            localStorage.removeItem(profile.storageKeys.settings);
        } catch (e) {}

        // Remove profile
        state.profiles.splice(index, 1);
        saveProfiles();

        // Switch to first profile if current was deleted
        if (state.currentProfileId === profileId) {
            state.currentProfileId = state.profiles[0].id;
            saveCurrentProfile();
            applyProfileData();
        }

        return true;
    }

    function updateProfile(profileId, name, avatarId) {
        var profile = getProfileById(profileId);
        if (!profile) return false;

        if (name !== undefined) {
            profile.name = name;
        }
        if (avatarId !== undefined) {
            profile.avatarId = avatarId;
        }

        saveProfiles();
        return true;
    }

    function switchProfile(profileId) {
        var profile = getProfileById(profileId);
        if (!profile) return false;

        state.currentProfileId = profileId;
        saveCurrentProfile();
        applyProfileData();

        return true;
    }

    function getProfileById(profileId) {
        for (var i = 0; i < state.profiles.length; i++) {
            if (state.profiles[i].id === profileId) {
                return state.profiles[i];
            }
        }
        return null;
    }

    function getCurrentProfile() {
        return getProfileById(state.currentProfileId);
    }

    function getProfiles() {
        return state.profiles.slice();
    }

    function getAvatars() {
        return AVATARS.slice();
    }

    // ===== PROFILE DATA APPLICATION =====
    function applyProfileData() {
        var profile = getCurrentProfile();
        if (!profile) return;

        // Update storage keys for modules that use localStorage
        // Favorites
        if (window.FavoritesManager) {
            window.FavoritesManager.setStorageKey(profile.storageKeys.favorites);
        }

        // Watch History
        if (window.WatchHistory) {
            window.WatchHistory.setStorageKey(profile.storageKeys.watchHistory);
        }

        // Watchlist
        if (window.Watchlist) {
            window.Watchlist.setStorageKey(profile.storageKeys.watchlist);
        }

        console.log('[ProfileManager] Switched to profile:', profile.name);
    }

    /**
     * Get storage key for current profile
     * @param {string} type - 'favorites', 'watchHistory', 'watchlist', 'settings'
     * @returns {string} Storage key
     */
    function getStorageKey(type) {
        var profile = getCurrentProfile();
        if (profile && profile.storageKeys[type]) {
            return profile.storageKeys[type];
        }
        // Fallback to default keys
        switch (type) {
            case 'favorites': return 'ultra_iptv_favorites';
            case 'watchHistory': return 'ultra_iptv_watch_history';
            case 'watchlist': return 'ultra_iptv_watchlist';
            case 'settings': return 'ultra_iptv_settings';
            default: return 'ultra_iptv_' + type;
        }
    }

    // ===== PROFILE SELECTOR UI =====
    function show() {
        if (!cache.overlay) {
            createOverlayElements();
            cacheElements();
        }

        state.showingSelector = true;
        state.selectorFocus = 0;
        state.editMode = false;

        renderProfiles();
        updateFocus();

        cache.overlay.className = 'profile-overlay visible';

        // Push to navigation stack
        if (window.NavigationStack) {
            window.NavigationStack.push('profile-selector', 25, {
                onBack: function() {
                    hide();
                    return true;
                }
            });
        }
    }

    function hide() {
        if (cache.overlay) {
            cache.overlay.className = 'profile-overlay';
        }
        state.showingSelector = false;
        state.editMode = false;

        if (window.NavigationStack) {
            window.NavigationStack.pop('profile-selector');
        }
    }

    function renderProfiles() {
        if (!cache.profileList) return;

        var html = '';
        for (var i = 0; i < state.profiles.length; i++) {
            var profile = state.profiles[i];
            var avatar = AVATARS[profile.avatarId] || AVATARS[0];
            var isSelected = profile.id === state.currentProfileId;

            html += '<div class="profile-item" data-id="' + profile.id + '" data-index="' + i + '">';
            html += '<div class="profile-avatar" style="background-color: ' + avatar.color + '">';
            html += '<span class="profile-avatar-icon">' + avatar.icon + '</span>';
            if (state.editMode) {
                html += '<span class="profile-delete">✕</span>';
            }
            html += '</div>';
            html += '<div class="profile-name">' + profile.name + '</div>';
            if (isSelected) {
                html += '<div class="profile-current">✓</div>';
            }
            html += '</div>';
        }

        cache.profileList.innerHTML = html;
    }

    function updateFocus() {
        if (!cache.profileList) return;

        // Remove all focused states
        var items = cache.profileList.querySelectorAll('.profile-item');
        for (var i = 0; i < items.length; i++) {
            items[i].className = 'profile-item';
        }

        if (cache.addButton) {
            cache.addButton.className = 'profile-action-btn';
        }
        if (cache.editButton) {
            cache.editButton.className = 'profile-action-btn';
        }

        // Apply focus
        var totalProfiles = state.profiles.length;

        if (state.selectorFocus < totalProfiles) {
            // Focus on profile
            var profileItems = cache.profileList.querySelectorAll('.profile-item');
            if (profileItems[state.selectorFocus]) {
                profileItems[state.selectorFocus].className = 'profile-item focused';
            }
        } else if (state.selectorFocus === totalProfiles) {
            // Focus on Add button
            if (cache.addButton) {
                cache.addButton.className = 'profile-action-btn focused';
            }
        } else {
            // Focus on Edit button
            if (cache.editButton) {
                cache.editButton.className = 'profile-action-btn focused';
            }
        }
    }

    function navigate(direction) {
        var totalItems = state.profiles.length + 2; // profiles + add + edit

        switch (direction) {
            case 'left':
                if (state.selectorFocus > 0) {
                    state.selectorFocus--;
                }
                break;
            case 'right':
                if (state.selectorFocus < totalItems - 1) {
                    state.selectorFocus++;
                }
                break;
            case 'up':
                // Move from actions to profiles
                if (state.selectorFocus >= state.profiles.length) {
                    state.selectorFocus = Math.min(state.selectorFocus, state.profiles.length - 1);
                }
                break;
            case 'down':
                // Move from profiles to actions
                if (state.selectorFocus < state.profiles.length) {
                    state.selectorFocus = state.profiles.length;
                }
                break;
        }

        updateFocus();
    }

    function select() {
        var totalProfiles = state.profiles.length;

        if (state.selectorFocus < totalProfiles) {
            // Selected a profile
            var profile = state.profiles[state.selectorFocus];

            if (state.editMode && state.profiles.length > 1) {
                // Delete profile in edit mode
                if (confirm('Profil "' + profile.name + '" löschen?')) {
                    deleteProfile(profile.id);
                    renderProfiles();
                    if (state.selectorFocus >= state.profiles.length) {
                        state.selectorFocus = state.profiles.length - 1;
                    }
                    updateFocus();
                }
            } else {
                // Switch to profile
                switchProfile(profile.id);
                hide();

                // Refresh screens to show profile data
                if (window.ScreenManager && window.ScreenManager.refreshCurrentScreen) {
                    window.ScreenManager.refreshCurrentScreen();
                }
            }
        } else if (state.selectorFocus === totalProfiles) {
            // Add new profile
            if (state.profiles.length < CONFIG.MAX_PROFILES) {
                var newName = prompt('Profilname:', 'Profil ' + (state.profiles.length + 1));
                if (newName) {
                    var avatarId = state.profiles.length % AVATARS.length;
                    createProfile(newName, avatarId);
                    renderProfiles();
                    updateFocus();
                }
            } else {
                alert('Maximale Anzahl an Profilen erreicht (' + CONFIG.MAX_PROFILES + ')');
            }
        } else {
            // Toggle edit mode
            state.editMode = !state.editMode;
            renderProfiles();
            updateFocus();
        }
    }

    // ===== KEY HANDLING =====
    function handleKeyDown(event) {
        if (!state.showingSelector) return false;

        var keyCode = event.keyCode;
        var handled = false;

        switch (keyCode) {
            case 37: // LEFT
                navigate('left');
                handled = true;
                break;
            case 39: // RIGHT
                navigate('right');
                handled = true;
                break;
            case 38: // UP
                navigate('up');
                handled = true;
                break;
            case 40: // DOWN
                navigate('down');
                handled = true;
                break;
            case 13: // OK/ENTER
                select();
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
            event.preventDefault();
            event.stopPropagation();
        }

        return handled;
    }

    // ===== HELPERS =====
    function generateId() {
        return 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        createProfile: createProfile,
        deleteProfile: deleteProfile,
        updateProfile: updateProfile,
        switchProfile: switchProfile,
        getCurrentProfile: getCurrentProfile,
        getProfiles: getProfiles,
        getAvatars: getAvatars,
        getStorageKey: getStorageKey,
        handleKeyDown: handleKeyDown,
        isShowing: function() { return state.showingSelector; }
    };
})();
