/**
 * EPG Reminders - Program Reminders
 * Set reminders for upcoming TV programs
 * ES3 Compatible - WebOS 3.x optimized
 */

window.EPGReminders = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        STORAGE_KEY: 'ultra_iptv_reminders',
        CHECK_INTERVAL: 30000,  // Check every 30 seconds
        ALERT_BEFORE: 60000,    // Alert 1 minute before
        MAX_REMINDERS: 20
    };

    // ===== STATE =====
    var state = {
        reminders: [],      // Array of reminder objects
        checkTimer: null,   // Interval timer
        notificationVisible: false
    };

    // ===== DOM CACHE =====
    var cache = {
        notification: null,
        notificationTitle: null,
        notificationChannel: null,
        notificationTime: null,
        notificationActions: null
    };

    // ===== INITIALIZATION =====
    function init() {
        loadReminders();
        createNotificationDOM();
        startChecking();
    }

    function createNotificationDOM() {
        var notification = document.getElementById('epg-reminder-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'epg-reminder-notification';
            notification.className = 'epg-reminder-notification';

            var html = '<div class="reminder-notification-content">';
            html += '  <div class="reminder-notification-icon">🔔</div>';
            html += '  <div class="reminder-notification-info">';
            html += '    <div class="reminder-notification-label">Erinnerung</div>';
            html += '    <div id="reminder-notification-title" class="reminder-notification-title"></div>';
            html += '    <div id="reminder-notification-channel" class="reminder-notification-channel"></div>';
            html += '    <div id="reminder-notification-time" class="reminder-notification-time"></div>';
            html += '  </div>';
            html += '  <div class="reminder-notification-actions" id="reminder-notification-actions">';
            html += '    <div class="reminder-btn reminder-btn-watch" id="reminder-btn-watch">Jetzt ansehen</div>';
            html += '    <div class="reminder-btn reminder-btn-dismiss" id="reminder-btn-dismiss">Schließen</div>';
            html += '  </div>';
            html += '</div>';

            notification.innerHTML = html;
            document.body.appendChild(notification);

            // Setup click handlers
            var btnWatch = document.getElementById('reminder-btn-watch');
            var btnDismiss = document.getElementById('reminder-btn-dismiss');

            if (btnWatch) {
                btnWatch.onclick = function() {
                    watchNow();
                };
            }
            if (btnDismiss) {
                btnDismiss.onclick = function() {
                    hideNotification();
                };
            }
        }

        cache.notification = notification;
        cache.notificationTitle = document.getElementById('reminder-notification-title');
        cache.notificationChannel = document.getElementById('reminder-notification-channel');
        cache.notificationTime = document.getElementById('reminder-notification-time');
        cache.notificationActions = document.getElementById('reminder-notification-actions');

        setupKeyHandler();
    }

    function setupKeyHandler() {
        document.addEventListener('keydown', function(e) {
            if (!state.notificationVisible) return;

            var keyCode = e.keyCode;

            switch (keyCode) {
                case 13: // OK - Watch now
                    watchNow();
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 461: // BACK (WebOS)
                case 10009: // BACK (Tizen)
                case 8: // Backspace
                case 27: // ESC
                    hideNotification();
                    e.preventDefault();
                    e.stopPropagation();
                    break;
            }
        }, true);
    }

    // ===== STORAGE =====
    function loadReminders() {
        try {
            var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                state.reminders = JSON.parse(stored);
                // Clean up old reminders
                cleanupOldReminders();
            }
        } catch (e) {
            console.error('[EPGReminders] Failed to load:', e);
            state.reminders = [];
        }
    }

    function saveReminders() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.reminders));
        } catch (e) {
            console.error('[EPGReminders] Failed to save:', e);
        }
    }

    function cleanupOldReminders() {
        var now = Date.now();
        var cleaned = [];

        for (var i = 0; i < state.reminders.length; i++) {
            var reminder = state.reminders[i];
            // Keep reminders that haven't passed yet (with 5 min buffer)
            if (reminder.startTime > now - 300000) {
                cleaned.push(reminder);
            }
        }

        if (cleaned.length !== state.reminders.length) {
            state.reminders = cleaned;
            saveReminders();
        }
    }

    // ===== REMINDER MANAGEMENT =====
    /**
     * Add a reminder for a program
     * @param {object} program - Program data from EPG
     * @param {string} channelId - Channel stream ID
     * @param {string} channelName - Channel name
     */
    function addReminder(program, channelId, channelName) {
        if (!program || !program.start) {
            console.error('[EPGReminders] Invalid program data');
            return false;
        }

        // Check if already exists
        var existingIndex = findReminder(program.id || program.start, channelId);
        if (existingIndex !== -1) {
            console.log('[EPGReminders] Reminder already exists');
            return false;
        }

        // Check max limit
        if (state.reminders.length >= CONFIG.MAX_REMINDERS) {
            alert('Maximale Anzahl an Erinnerungen erreicht (' + CONFIG.MAX_REMINDERS + ')');
            return false;
        }

        var reminder = {
            id: generateId(),
            programId: program.id || null,
            title: program.title || 'Unbekannte Sendung',
            channelId: channelId,
            channelName: channelName,
            startTime: program.start,  // Unix timestamp in ms
            endTime: program.end || 0,
            notified: false,
            createdAt: Date.now()
        };

        state.reminders.push(reminder);
        saveReminders();

        console.log('[EPGReminders] Reminder added:', reminder.title);
        return true;
    }

    /**
     * Remove a reminder
     * @param {string} reminderId - Reminder ID
     */
    function removeReminder(reminderId) {
        for (var i = 0; i < state.reminders.length; i++) {
            if (state.reminders[i].id === reminderId) {
                state.reminders.splice(i, 1);
                saveReminders();
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a program has a reminder
     * @param {string} programId - Program ID
     * @param {string} channelId - Channel ID
     */
    function hasReminder(programId, channelId) {
        return findReminder(programId, channelId) !== -1;
    }

    function findReminder(programId, channelId) {
        for (var i = 0; i < state.reminders.length; i++) {
            var r = state.reminders[i];
            if (r.programId === programId && r.channelId === channelId) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Toggle reminder for a program
     */
    function toggleReminder(program, channelId, channelName) {
        var index = findReminder(program.id || program.start, channelId);
        if (index !== -1) {
            removeReminder(state.reminders[index].id);
            return false; // Removed
        } else {
            addReminder(program, channelId, channelName);
            return true; // Added
        }
    }

    // ===== CHECKING =====
    function startChecking() {
        if (state.checkTimer) {
            clearInterval(state.checkTimer);
        }
        state.checkTimer = setInterval(checkReminders, CONFIG.CHECK_INTERVAL);
        // Check immediately
        checkReminders();
    }

    function stopChecking() {
        if (state.checkTimer) {
            clearInterval(state.checkTimer);
            state.checkTimer = null;
        }
    }

    function checkReminders() {
        var now = Date.now();
        var alertTime = now + CONFIG.ALERT_BEFORE;

        for (var i = 0; i < state.reminders.length; i++) {
            var reminder = state.reminders[i];

            // Skip if already notified
            if (reminder.notified) continue;

            // Check if it's time to notify
            if (reminder.startTime <= alertTime && reminder.startTime > now - 60000) {
                // Mark as notified
                reminder.notified = true;
                saveReminders();

                // Show notification
                showNotification(reminder);
                break; // Only show one at a time
            }
        }
    }

    // ===== NOTIFICATION =====
    var currentReminder = null;

    function showNotification(reminder) {
        if (!cache.notification) return;

        currentReminder = reminder;
        state.notificationVisible = true;

        // Update content
        if (cache.notificationTitle) {
            cache.notificationTitle.textContent = reminder.title;
        }
        if (cache.notificationChannel) {
            cache.notificationChannel.textContent = reminder.channelName;
        }
        if (cache.notificationTime) {
            var timeStr = formatTime(reminder.startTime);
            cache.notificationTime.textContent = 'Startet um ' + timeStr;
        }

        cache.notification.className = 'epg-reminder-notification visible';

        // Auto-hide after 30 seconds
        setTimeout(function() {
            if (state.notificationVisible) {
                hideNotification();
            }
        }, 30000);
    }

    function hideNotification() {
        if (cache.notification) {
            cache.notification.className = 'epg-reminder-notification';
        }
        state.notificationVisible = false;
        currentReminder = null;
    }

    function watchNow() {
        if (!currentReminder) {
            hideNotification();
            return;
        }

        var channelId = currentReminder.channelId;
        var channelName = currentReminder.channelName;

        hideNotification();

        // Tune to channel
        if (window.PlayerComponent) {
            setTimeout(function() {
                window.PlayerComponent.play(channelId, channelName, 'live');
            }, 100);
        }
    }

    // ===== HELPERS =====
    function generateId() {
        return 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatTime(timestamp) {
        var date = new Date(timestamp);
        var hours = date.getHours();
        var minutes = date.getMinutes();
        return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
    }

    /**
     * Get all reminders
     */
    function getReminders() {
        cleanupOldReminders();
        return state.reminders.slice();
    }

    /**
     * Get reminder count
     */
    function getCount() {
        return state.reminders.length;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        addReminder: addReminder,
        removeReminder: removeReminder,
        toggleReminder: toggleReminder,
        hasReminder: hasReminder,
        getReminders: getReminders,
        getCount: getCount,
        showNotification: showNotification,
        hideNotification: hideNotification
    };
})();
