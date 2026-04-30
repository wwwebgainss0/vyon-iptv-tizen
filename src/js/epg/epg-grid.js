/**
 * EPG Grid View - Full 7-Day Program Guide
 * Horizontal: Time slots (30 min intervals)
 * Vertical: Channels
 * ES3 Compatible - WebOS 3.x optimized
 */

window.EPGGrid = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        VISIBLE_CHANNELS: 6,        // Visible channel rows
        VISIBLE_HOURS: 3,           // Visible hours (6 x 30min slots)
        SLOT_WIDTH: 200,            // Width per 30min slot
        CHANNEL_ROW_HEIGHT: 80,     // Height per channel row
        CHANNEL_NAME_WIDTH: 200,    // Width of channel name column
        TIME_HEADER_HEIGHT: 50,     // Height of time header
        DAYS_AVAILABLE: 7           // Days of EPG data
    };

    // ===== STATE =====
    var state = {
        visible: false,
        channels: [],               // All channels with EPG
        epgData: {},                // EPG data by channel ID
        currentChannelIndex: 0,     // Current focused channel
        currentTimeOffset: 0,       // Hours offset from now
        currentDayOffset: 0,        // Days offset (0 = today)
        focusedProgram: null,       // Currently focused program
        channelScrollOffset: 0,     // Vertical scroll offset
        loading: false
    };

    // ===== DOM CACHE =====
    var cache = {
        overlay: null,
        header: null,
        dateSelector: null,
        timeHeader: null,
        channelColumn: null,
        gridContainer: null,
        gridContent: null,
        loadingIndicator: null
    };

    // ===== INITIALIZATION =====
    function init() {
        createOverlayDOM();
        setupKeyHandler();
    }

    function createOverlayDOM() {
        if (document.getElementById('epg-grid-overlay')) {
            cacheElements();
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'epg-grid-overlay';
        overlay.className = 'epg-grid-overlay';

        var html = '';

        // Header with date selector
        html += '<div class="epg-grid-header">';
        html += '  <div class="epg-grid-title">TV Programm</div>';
        html += '  <div class="epg-grid-dates" id="epg-dates"></div>';
        html += '  <div class="epg-grid-hint">YELLOW = Suche | BACK = Schließen</div>';
        html += '</div>';

        // Main grid area
        html += '<div class="epg-grid-main">';

        // Channel column (left)
        html += '  <div class="epg-channel-column" id="epg-channel-column">';
        html += '    <div class="epg-time-corner"></div>'; // Top-left corner
        html += '    <div class="epg-channel-list" id="epg-channel-list"></div>';
        html += '  </div>';

        // Grid area (right)
        html += '  <div class="epg-grid-area">';
        html += '    <div class="epg-time-header" id="epg-time-header"></div>';
        html += '    <div class="epg-grid-container" id="epg-grid-container">';
        html += '      <div class="epg-grid-content" id="epg-grid-content"></div>';
        html += '    </div>';
        html += '  </div>';

        html += '</div>';

        // Loading indicator
        html += '<div class="epg-grid-loading" id="epg-grid-loading">';
        html += '  <div class="epg-loading-spinner"></div>';
        html += '  <div class="epg-loading-text">Lade EPG Daten...</div>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        cacheElements();
    }

    function cacheElements() {
        cache.overlay = document.getElementById('epg-grid-overlay');
        cache.dateSelector = document.getElementById('epg-dates');
        cache.timeHeader = document.getElementById('epg-time-header');
        cache.channelColumn = document.getElementById('epg-channel-list');
        cache.gridContainer = document.getElementById('epg-grid-container');
        cache.gridContent = document.getElementById('epg-grid-content');
        cache.loadingIndicator = document.getElementById('epg-grid-loading');
    }

    // ===== KEY HANDLING =====
    function setupKeyHandler() {
        document.addEventListener('keydown', handleKeyDown, false);
    }

    function handleKeyDown(event) {
        if (!state.visible) return;

        var keyCode = event.keyCode;
        var handled = false;

        // BACK and GREEN/BLUE are handled by NavigationHandler - skip here
        if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27 ||
            keyCode === 404 || keyCode === 406) {
            return;
        }

        switch (keyCode) {
            case 38: // UP
                moveChannel(-1);
                handled = true;
                break;
            case 40: // DOWN
                moveChannel(1);
                handled = true;
                break;
            case 37: // LEFT
                moveTime(-1);
                handled = true;
                break;
            case 39: // RIGHT
                moveTime(1);
                handled = true;
                break;
            case 13: // ENTER / OK
                playSelectedChannel();
                handled = true;
                break;
            case 403: // RED - Previous day
            case 33: // Page Up
                changeDay(-1);
                handled = true;
                break;
            case 34: // Page Down
                changeDay(1);
                handled = true;
                break;
            case 405: // YELLOW - Open EPG Search
                if (window.EPGSearch) {
                    window.EPGSearch.show();
                }
                handled = true;
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // ===== NAVIGATION =====
    function moveChannel(direction) {
        var newIndex = state.currentChannelIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= state.channels.length) newIndex = state.channels.length - 1;

        if (newIndex !== state.currentChannelIndex) {
            state.currentChannelIndex = newIndex;
            updateChannelScroll();
            renderGrid();
        }
    }

    function moveTime(direction) {
        // Move by 30 minutes
        state.currentTimeOffset += direction * 0.5;

        // Limit to reasonable range (-2h to +24h from current time)
        if (state.currentTimeOffset < -2) state.currentTimeOffset = -2;
        if (state.currentTimeOffset > 24) state.currentTimeOffset = 24;

        renderTimeHeader();
        renderGrid();
    }

    function changeDay(direction) {
        var newDay = state.currentDayOffset + direction;

        if (newDay < 0) newDay = 0;
        if (newDay >= CONFIG.DAYS_AVAILABLE) newDay = CONFIG.DAYS_AVAILABLE - 1;

        if (newDay !== state.currentDayOffset) {
            state.currentDayOffset = newDay;
            state.currentTimeOffset = 0; // Reset time to start of day
            renderDateSelector();
            loadEPGForDay(newDay);
        }
    }

    function updateChannelScroll() {
        // Calculate scroll offset to keep focused channel visible
        var visibleStart = state.channelScrollOffset;
        var visibleEnd = visibleStart + CONFIG.VISIBLE_CHANNELS - 1;

        if (state.currentChannelIndex < visibleStart) {
            state.channelScrollOffset = state.currentChannelIndex;
        } else if (state.currentChannelIndex > visibleEnd) {
            state.channelScrollOffset = state.currentChannelIndex - CONFIG.VISIBLE_CHANNELS + 1;
        }
    }

    // ===== SHOW / HIDE =====
    // focusChannel: optional channel object to focus on (e.g. from ChannelOverlay)
    function show(focusChannel) {
        if (!cache.overlay) {
            createOverlayDOM();
        }

        state.visible = true;
        state.currentChannelIndex = 0;
        state.currentTimeOffset = 0;
        state.currentDayOffset = 0;
        state.channelScrollOffset = 0;
        state.focusChannelId = focusChannel ? (focusChannel.stream_id || focusChannel.id) : null;

        cache.overlay.style.display = 'flex';

        // Push to navigation stack
        if (window.NavigationStack) {
            window.NavigationStack.push('epg-grid', window.NavigationStack.LAYERS.MODAL);
        }

        // Load channels and EPG data
        loadChannelsAndEPG();
    }

    function hide() {
        state.visible = false;

        if (cache.overlay) {
            cache.overlay.style.display = 'none';
        }

        // Pop from navigation stack
        if (window.NavigationStack) {
            window.NavigationStack.pop('epg-grid');
        }
    }

    function toggle() {
        if (state.visible) {
            hide();
        } else {
            show();
        }
    }

    // ===== DATA LOADING =====
    function loadChannelsAndEPG() {
        showLoading();

        // Get channels from ScreenManager
        if (window.ScreenManager && window.ScreenManager.getLiveTVChannels) {
            state.channels = window.ScreenManager.getLiveTVChannels() || [];
        }

        if (state.channels.length === 0) {
            hideLoading();
            showError('Keine Kanäle verfügbar');
            return;
        }

        // Find focus channel index if provided
        if (state.focusChannelId) {
            for (var i = 0; i < state.channels.length; i++) {
                var ch = state.channels[i];
                if (ch && (ch.stream_id == state.focusChannelId || ch.id == state.focusChannelId)) {
                    state.currentChannelIndex = i;
                    // Update scroll to show this channel
                    updateChannelScroll();
                    console.log('[EPGGrid] Focusing on channel:', ch.name, 'at index:', i);
                    break;
                }
            }
            state.focusChannelId = null; // Clear after use
        }

        renderDateSelector();
        renderChannelColumn();
        renderTimeHeader();
        loadEPGForDay(0);
    }

    function loadEPGForDay(dayOffset) {
        showLoading();

        // For now, load EPG for visible channels only
        var startIdx = state.channelScrollOffset;
        var endIdx = Math.min(startIdx + CONFIG.VISIBLE_CHANNELS + 2, state.channels.length);
        var channelsToLoad = [];

        for (var i = startIdx; i < endIdx; i++) {
            var ch = state.channels[i];
            if (ch && ch.stream_id) {
                channelsToLoad.push(ch);
            }
        }

        var loaded = 0;
        var total = channelsToLoad.length;

        if (total === 0) {
            hideLoading();
            renderGrid();
            return;
        }

        // Load EPG for each channel
        for (var j = 0; j < channelsToLoad.length; j++) {
            (function(channel) {
                loadChannelEPG(channel.stream_id, function(err, data) {
                    if (!err && data) {
                        state.epgData[channel.stream_id] = data;
                    }
                    loaded++;
                    if (loaded >= total) {
                        hideLoading();
                        renderGrid();
                    }
                });
            })(channelsToLoad[j]);
        }
    }

    function loadChannelEPG(streamId, callback) {
        console.log('[EPGGrid] Loading EPG for stream:', streamId);
        if (window.EPGManager && window.EPGManager.getFullEPG) {
            window.EPGManager.getFullEPG(streamId, function(err, data) {
                if (err) {
                    console.log('[EPGGrid] EPG error for', streamId, ':', err);
                } else {
                    console.log('[EPGGrid] EPG data for', streamId, ':', data ? data.programs.length + ' programs' : 'no data');
                }
                callback(err, data);
            });
        } else {
            console.log('[EPGGrid] EPGManager not available');
            callback('EPG Manager not available', null);
        }
    }

    // ===== RENDERING =====
    function renderDateSelector() {
        if (!cache.dateSelector) return;

        var html = '';
        var today = new Date();

        for (var i = 0; i < CONFIG.DAYS_AVAILABLE; i++) {
            var date = new Date(today.getTime() + (i * 24 * 60 * 60 * 1000));
            var dayName = getDayName(date.getDay());
            var dateStr = date.getDate() + '.' + (date.getMonth() + 1) + '.';

            var label = i === 0 ? 'Heute' : (i === 1 ? 'Morgen' : dayName);
            var focused = i === state.currentDayOffset ? ' focused' : '';

            html += '<div class="epg-date-item' + focused + '" data-day="' + i + '">';
            html += '  <div class="epg-date-day">' + label + '</div>';
            html += '  <div class="epg-date-num">' + dateStr + '</div>';
            html += '</div>';
        }

        cache.dateSelector.innerHTML = html;
    }

    function renderChannelColumn() {
        if (!cache.channelColumn) return;

        var html = '';
        var startIdx = state.channelScrollOffset;
        var endIdx = Math.min(startIdx + CONFIG.VISIBLE_CHANNELS, state.channels.length);

        for (var i = startIdx; i < endIdx; i++) {
            var ch = state.channels[i];
            var focused = i === state.currentChannelIndex ? ' focused' : '';
            var logo = ch.stream_icon || '';
            var name = ch.name || 'Kanal ' + (i + 1);

            html += '<div class="epg-channel-row' + focused + '" data-index="' + i + '">';
            if (logo) {
                html += '  <img class="epg-channel-logo" src="' + logo + '" alt="">';
            }
            html += '  <div class="epg-channel-name">' + escapeHtml(name) + '</div>';
            html += '</div>';
        }

        cache.channelColumn.innerHTML = html;
    }

    function renderTimeHeader() {
        if (!cache.timeHeader) return;

        var html = '';
        var baseTime = getBaseTime();
        var slots = CONFIG.VISIBLE_HOURS * 2; // 30 min slots

        for (var i = 0; i < slots; i++) {
            var slotTime = new Date(baseTime.getTime() + (i * 30 * 60 * 1000));
            var timeStr = formatTimeSlot(slotTime);
            html += '<div class="epg-time-slot">' + timeStr + '</div>';
        }

        cache.timeHeader.innerHTML = html;
    }

    function renderGrid() {
        if (!cache.gridContent) return;

        var html = '';
        var startIdx = state.channelScrollOffset;
        var endIdx = Math.min(startIdx + CONFIG.VISIBLE_CHANNELS, state.channels.length);
        var baseTime = getBaseTime();
        var endTime = new Date(baseTime.getTime() + (CONFIG.VISIBLE_HOURS * 60 * 60 * 1000));

        for (var i = startIdx; i < endIdx; i++) {
            var ch = state.channels[i];
            var focused = i === state.currentChannelIndex ? ' focused' : '';
            var epg = state.epgData[ch.stream_id];

            html += '<div class="epg-grid-row' + focused + '" data-index="' + i + '">';

            if (epg && epg.programs && epg.programs.length > 0) {
                html += renderProgramsForRow(epg.programs, baseTime, endTime, i);
            } else {
                // No EPG data
                html += '<div class="epg-program no-data" style="width:' + (CONFIG.SLOT_WIDTH * CONFIG.VISIBLE_HOURS * 2) + 'px;">';
                html += '  <span class="epg-program-title">Keine EPG Daten</span>';
                html += '</div>';
            }

            html += '</div>';
        }

        cache.gridContent.innerHTML = html;

        // Also update channel column focus
        renderChannelColumn();
    }

    function renderProgramsForRow(programs, baseTime, endTime, channelIndex) {
        var html = '';
        var baseTimestamp = baseTime.getTime() / 1000;
        var endTimestamp = endTime.getTime() / 1000;
        var totalWidth = CONFIG.SLOT_WIDTH * CONFIG.VISIBLE_HOURS * 2;
        var now = Date.now() / 1000;

        // Get channel to check catchup availability
        var channel = state.channels[channelIndex];
        var hasCatchup = channel && window.CatchupManager && window.CatchupManager.hasCatchup(channel);

        // Find programs that overlap with visible time range
        for (var i = 0; i < programs.length; i++) {
            var prog = programs[i];

            // Check if program overlaps with visible range
            if (prog.end < baseTimestamp || prog.start > endTimestamp) {
                continue;
            }

            // Calculate position and width
            var progStart = Math.max(prog.start, baseTimestamp);
            var progEnd = Math.min(prog.end, endTimestamp);

            var startOffset = (progStart - baseTimestamp) / 1800; // In 30-min units
            var duration = (progEnd - progStart) / 1800;

            var left = startOffset * CONFIG.SLOT_WIDTH;
            var width = duration * CONFIG.SLOT_WIDTH;

            // Minimum width
            if (width < 50) width = 50;

            var isCurrent = isCurrentProgram(prog);
            var isPast = prog.end < now;
            var currentClass = isCurrent ? ' current' : '';
            var pastClass = isPast ? ' past' : '';
            var catchupClass = (isPast && hasCatchup) ? ' catchup-available' : '';

            html += '<div class="epg-program' + currentClass + pastClass + catchupClass + '" style="left:' + left + 'px;width:' + width + 'px;" data-start="' + prog.start + '" data-end="' + prog.end + '">';
            html += '  <span class="epg-program-time">' + formatTime(prog.start) + '</span>';
            html += '  <span class="epg-program-title">' + escapeHtml(prog.title) + '</span>';
            // Show replay badge for past programs with catchup
            if (isPast && hasCatchup) {
                html += '  <span class="epg-replay-badge">REPLAY</span>';
            }
            html += '</div>';
        }

        return html;
    }

    // ===== ACTIONS =====
    function playSelectedChannel() {
        var channel = state.channels[state.currentChannelIndex];
        if (!channel) return;

        // Get current view time to find focused program
        var baseTime = getBaseTime();
        var viewTimestamp = baseTime.getTime() / 1000;
        var now = Date.now() / 1000;

        // Find the program at current view time
        var epg = state.epgData[channel.stream_id];
        var focusedProgram = null;

        if (epg && epg.programs) {
            for (var i = 0; i < epg.programs.length; i++) {
                var prog = epg.programs[i];
                // Find program that contains the current view time
                if (prog.start <= viewTimestamp && prog.end > viewTimestamp) {
                    focusedProgram = prog;
                    break;
                }
            }
        }

        hide();

        // Check if it's a past program with catchup available
        if (focusedProgram && focusedProgram.end < now) {
            // Past program - try catchup
            if (window.CatchupManager && window.CatchupManager.hasCatchup(channel)) {
                console.log('[EPGGrid] Playing catchup:', focusedProgram.title);
                window.CatchupManager.play(channel, {
                    title: focusedProgram.title,
                    start: focusedProgram.start,
                    stop: focusedProgram.end,
                    duration: Math.ceil((focusedProgram.end - focusedProgram.start) / 60)
                });
                return;
            } else {
                // No catchup - show message
                showToast('Replay nicht verfuegbar');
            }
        }

        // Play live channel
        if (window.PlayerComponent) {
            window.PlayerComponent.play(
                channel.stream_id,
                channel.name,
                'live',
                channel.stream_icon || ''
            );
        }
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);' +
            'background:rgba(0,0,0,0.9);color:#fff;padding:15px 30px;border-radius:8px;' +
            'font-size:18px;z-index:10000;';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 2500);
    }

    // ===== HELPERS =====
    function getBaseTime() {
        var now = new Date();

        // Add day offset
        now.setDate(now.getDate() + state.currentDayOffset);

        // Add time offset (in hours)
        var offsetMs = state.currentTimeOffset * 60 * 60 * 1000;
        now = new Date(now.getTime() + offsetMs);

        // Round down to nearest 30 minutes
        now.setMinutes(Math.floor(now.getMinutes() / 30) * 30);
        now.setSeconds(0);
        now.setMilliseconds(0);

        return now;
    }

    function formatTimeSlot(date) {
        var h = date.getHours();
        var m = date.getMinutes();
        return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }

    function formatTime(timestamp) {
        var date = new Date(timestamp * 1000);
        return formatTimeSlot(date);
    }

    function isCurrentProgram(prog) {
        var now = Date.now() / 1000;
        return prog.start <= now && prog.end > now;
    }

    function getDayName(day) {
        var days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        return days[day];
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showLoading() {
        state.loading = true;
        if (cache.loadingIndicator) {
            cache.loadingIndicator.style.display = 'flex';
        }
    }

    function hideLoading() {
        state.loading = false;
        if (cache.loadingIndicator) {
            cache.loadingIndicator.style.display = 'none';
        }
    }

    function showError(message) {
        if (cache.gridContent) {
            cache.gridContent.innerHTML = '<div class="epg-error">' + escapeHtml(message) + '</div>';
        }
    }

    function isVisible() {
        return state.visible;
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        show: show,
        hide: hide,
        toggle: toggle,
        isVisible: isVisible
    };
})();
