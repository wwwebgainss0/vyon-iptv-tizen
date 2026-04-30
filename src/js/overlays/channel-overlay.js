/**
 * Channel Overlay Component v2.1 - Full Page EPG
 * Shows channel list, EPG as full screen overlay (LEFT key)
 * CODE_STANDARDS: ES3, Modular, Zero allocations in hotpath
 */

window.ChannelOverlay = (function() {
    'use strict';

    // ===== STATE =====
    var state = {
        isVisible: false,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        focusedIndex: 0,
        itemsPerPage: 15,
        scrollOffset: 0,
        // EPG Panel state
        epgPanelVisible: false,
        epgFocusedIndex: 0,
        epgPrograms: [],
        currentStreamId: null,
        currentChannelName: ''
    };

    // ===== CACHED ELEMENTS =====
    var cache = {
        overlay: null,
        backdrop: null,
        content: null,
        categoryName: null,
        channelCount: null,
        channelList: null,
        // EPG Panel elements (full page)
        epgOverlay: null,
        epgPanel: null,
        epgTitle: null,
        epgChannelName: null,
        epgList: null
    };

    // ===== INITIALIZATION =====
    function initialize() {
        createOverlay();
        return true;
    }

    function createOverlay() {
        if (cache.overlay) return;

        // Create overlay container
        var overlay = document.createElement('div');
        overlay.id = 'channel-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;display:none;';

        // Backdrop
        var backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);';

        // Main content box - FULL WIDTH channel list
        var content = document.createElement('div');
        content.id = 'channel-content';
        content.style.cssText = 'position:absolute;top:5%;left:5%;right:5%;height:90%;background:rgba(30,30,30,0.98);border:2px solid rgba(255,255,255,0.3);border-radius:8px;padding:25px;box-sizing:border-box;';

        // Header - responsive
        var header = document.createElement('div');
        header.style.cssText = 'margin-bottom:1vw;display:flex;justify-content:space-between;align-items:center;';
        header.innerHTML = '<h2 id="overlay-category-name" style="color:white;font-size:1.4vw;margin:0;font-weight:600;">Category</h2>' +
                          '<span id="overlay-channel-count" style="color:rgba(255,255,255,0.6);font-size:0.9vw;">0 Sender</span>';

        // Channel list container
        var channelList = document.createElement('div');
        channelList.id = 'overlay-channel-list';
        channelList.style.cssText = 'height:calc(100% - 120px);overflow:hidden;position:relative;';

        // Footer - responsive
        var footer = document.createElement('div');
        footer.style.cssText = 'position:absolute;bottom:1.5vw;left:2vw;right:2vw;color:rgba(255,255,255,0.7);text-align:center;font-size:0.9vw;background:rgba(0,0,0,0.5);padding:0.8vw 1.5vw;border-radius:0.4vw;';
        footer.innerHTML = '← → <span style="color:#e50914;">Kategorie</span> • ↑↓ <span style="color:#e50914;">Navigation</span> • <span style="color:#46d369;">GREEN</span> EPG • OK Abspielen • BACK Schließen';

        // Assemble content
        content.appendChild(header);
        content.appendChild(channelList);
        content.appendChild(footer);

        // Assemble channel overlay
        overlay.appendChild(backdrop);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // ===== EPG FULL PAGE OVERLAY (separate, on top) =====
        var epgOverlay = document.createElement('div');
        epgOverlay.id = 'epg-overlay';
        epgOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10001;display:none;';

        // EPG Backdrop
        var epgBackdrop = document.createElement('div');
        epgBackdrop.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.98);';

        // EPG Panel - Full page centered
        var epgPanel = document.createElement('div');
        epgPanel.id = 'epg-panel';
        epgPanel.style.cssText = 'position:absolute;top:3%;left:3%;right:3%;bottom:3%;background:linear-gradient(135deg, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.99) 100%);border:2px solid #e50914;border-radius:12px;padding:30px;box-sizing:border-box;';

        // EPG Header
        var epgHeader = document.createElement('div');
        epgHeader.style.cssText = 'margin-bottom:20px;border-bottom:2px solid rgba(229,9,20,0.5);padding-bottom:20px;display:flex;justify-content:space-between;align-items:center;';
        epgHeader.innerHTML = '<div>' +
                             '<h2 id="epg-panel-title" style="color:white;font-size:28px;margin:0;font-weight:bold;">TV Guide</h2>' +
                             '<div id="epg-panel-channel" style="color:#e50914;font-size:20px;margin-top:8px;font-weight:500;"></div>' +
                             '</div>' +
                             '<div style="color:rgba(255,255,255,0.5);font-size:14px;">← BACK to Channels</div>';

        // EPG List - Full height
        var epgList = document.createElement('div');
        epgList.id = 'epg-panel-list';
        epgList.style.cssText = 'height:calc(100% - 140px);overflow:hidden;';

        // EPG Footer
        var epgFooter = document.createElement('div');
        epgFooter.style.cssText = 'position:absolute;bottom:20px;left:30px;right:30px;color:rgba(255,255,255,0.6);text-align:center;font-size:14px;background:rgba(0,0,0,0.5);padding:10px;border-radius:6px;';
        epgFooter.innerHTML = '↑↓ Navigate Programs • ← / BACK Close EPG • OK Select Program';

        epgPanel.appendChild(epgHeader);
        epgPanel.appendChild(epgList);
        epgPanel.appendChild(epgFooter);

        // Assemble EPG overlay
        epgOverlay.appendChild(epgBackdrop);
        epgOverlay.appendChild(epgPanel);
        document.body.appendChild(epgOverlay);

        // Cache elements
        cache.overlay = overlay;
        cache.backdrop = backdrop;
        cache.content = content;
        cache.categoryName = document.getElementById('overlay-category-name');
        cache.channelCount = document.getElementById('overlay-channel-count');
        cache.channelList = channelList;
        cache.epgOverlay = epgOverlay;
        cache.epgPanel = epgPanel;
        cache.epgTitle = document.getElementById('epg-panel-title');
        cache.epgChannelName = document.getElementById('epg-panel-channel');
        cache.epgList = epgList;

        // Setup key handler
        setupKeyHandler();
    }

    // ===== DISPLAY =====
    function show() {
        if (!cache.overlay) {
            createOverlay();
        }

        // Get current category from ChannelManager
        if (!window.ChannelManager) {
            console.error('[ChannelOverlay] ChannelManager not available');
            return false;
        }

        var category = window.ChannelManager.getCurrentCategory();
        var channels = window.ChannelManager.getCategoryChannels();
        var currentChannel = window.ChannelManager.getCurrentChannel();

        if (!channels || channels.length === 0) {
            console.warn('[ChannelOverlay] No channels available');
            return false;
        }

        // Update header
        if (cache.categoryName) {
            cache.categoryName.textContent = category ? category.category_name : 'All Channels';
        }
        if (cache.channelCount) {
            cache.channelCount.textContent = channels.length + ' Channels';
        }

        // Find current channel index
        state.focusedIndex = 0;
        if (currentChannel) {
            for (var i = 0; i < channels.length; i++) {
                if (channels[i].stream_id == currentChannel.stream_id) {
                    state.focusedIndex = i;
                    break;
                }
            }
        }

        // Reset EPG panel state
        state.epgPanelVisible = false;
        if (cache.epgOverlay) {
            cache.epgOverlay.style.display = 'none';
        }

        // Render channel list
        renderChannelList(channels);

        // Register with NavigationStack
        if (window.NavigationStack) {
            window.NavigationStack.push('channel-overlay', window.NavigationStack.LAYERS.CHANNEL_OVERLAY, {});
        }

        // Show overlay
        cache.overlay.style.display = 'block';
        state.isVisible = true;
        return true;
    }

    function hide() {
        if (cache.overlay) {
            cache.overlay.style.display = 'none';
        }
        state.isVisible = false;
        state.epgPanelVisible = false;
    }

    // ===== CHANNEL LIST RENDERING =====
    function renderChannelList(channels) {
        if (!cache.channelList) return;

        var html = '';
        var itemHeight = 50; // Single line with EPG next to name
        var itemsPerPage = 14; // More channels visible

        if (channels.length === 0) {
            html = '<div style="color:white;text-align:center;padding:50px;font-size:20px;">No channels available</div>';
        } else {
            var visibleItems = Math.min(itemsPerPage, channels.length);
            var startIndex = state.focusedIndex - Math.floor(visibleItems / 3);

            if (startIndex < 0) {
                startIndex = 0;
            } else if (startIndex + visibleItems > channels.length) {
                startIndex = Math.max(0, channels.length - visibleItems);
            }

            var endIndex = Math.min(channels.length, startIndex + visibleItems);

            // Top indicator
            if (startIndex > 0) {
                html += '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:5px;font-size:12px;">↑ ' + startIndex + ' more</div>';
            }

            // Render visible items
            for (var i = startIndex; i < endIndex; i++) {
                var channel = channels[i];
                var isFocused = (i === state.focusedIndex) && !state.epgPanelVisible;

                var bgColor = isFocused ? 'rgba(229,9,20,0.9)' : 'rgba(255,255,255,0.05)';
                var borderLeft = isFocused ? '4px solid #e50914' : '4px solid transparent';

                var itemStyle = 'display:flex;align-items:center;padding:8px 15px;margin:3px 0;' +
                               'background:' + bgColor + ';border-radius:4px;border-left:' + borderLeft + ';' +
                               'min-height:' + itemHeight + 'px;box-sizing:border-box;';

                html += '<div class="channel-item" data-index="' + i + '" style="' + itemStyle + '">';
                html += '<span style="color:rgba(255,255,255,0.6);font-size:0.75vw;width:2.5vw;text-align:right;margin-right:0.8vw;">' + (channel.num || (i + 1)) + '</span>';

                // Channel icon
                if (channel.stream_icon) {
                    html += '<img style="width:2.5vw;height:1.8vw;object-fit:contain;margin-right:0.8vw;border-radius:3px;background:rgba(0,0,0,0.3);" src="' + channel.stream_icon + '" onerror="this.style.display=\'none\'">';
                }

                // Favorite check
                var isFavorite = window.FavoritesManager && window.FavoritesManager.isFavorite(channel, 'livetv');

                html += '<div style="flex:1;overflow:hidden;display:flex;align-items:center;gap:15px;">';
                // Channel name (left)
                html += '<div style="min-width:30%;max-width:35%;display:flex;align-items:center;gap:8px;">';
                html += '<span style="color:white;font-size:1.1vw;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (channel.name || 'Unknown') + '</span>';
                if (isFavorite) {
                    html += '<span style="color:#FFD700;font-size:0.9vw;">★</span>';
                }
                html += '</div>';
                // EPG info (right, next to channel name)
                html += '<div style="flex:1;display:flex;align-items:center;gap:15px;overflow:hidden;">';
                html += '<span id="epg-current-' + channel.stream_id + '" style="font-size:0.85vw;color:#46d369;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%;"></span>';
                html += '<span id="epg-next-' + channel.stream_id + '" style="font-size:0.75vw;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;"></span>';
                html += '</div>';
                html += '</div>';

                html += '</div>';
            }

            // Bottom indicator
            if (endIndex < channels.length) {
                html += '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:5px;font-size:12px;">↓ ' + (channels.length - endIndex) + ' more</div>';
            }
        }

        // Set HTML first, THEN load EPG data
        cache.channelList.innerHTML = html;

        // Now load EPG for visible channels (after DOM is ready)
        if (channels.length > 0) {
            var visibleItems = Math.min(12, channels.length);
            var startIndex = state.focusedIndex - Math.floor(visibleItems / 3);
            if (startIndex < 0) startIndex = 0;
            if (startIndex + visibleItems > channels.length) {
                startIndex = Math.max(0, channels.length - visibleItems);
            }
            var endIndex = Math.min(channels.length, startIndex + visibleItems);

            for (var j = startIndex; j < endIndex; j++) {
                loadChannelEPG(channels[j].stream_id);
            }
        }
    }

    function loadChannelEPG(streamId) {
        if (!window.EPGManager) return;

        window.EPGManager.getShortEPG(streamId, function(err, epgData) {
            if (err || !epgData || !epgData.hasEPG) return;

            // Current program
            var currentEl = document.getElementById('epg-current-' + streamId);
            if (currentEl && epgData.current) {
                var progress = Math.round(epgData.current.progress || 0);
                var endTime = window.EPGManager.formatTime(epgData.current.end);
                currentEl.innerHTML = '● ' + epgData.current.title + ' <span style="color:rgba(255,255,255,0.4);">(' + progress + '% · bis ' + endTime + ')</span>';
            }

            // Next program
            var nextEl = document.getElementById('epg-next-' + streamId);
            if (nextEl && epgData.next) {
                var startTime = window.EPGManager.formatTime(epgData.next.start);
                nextEl.innerHTML = '→ ' + startTime + ': ' + epgData.next.title;
            }
        });
    }

    // ===== EPG PANEL (Full Page) =====
    function showEPGPanel() {
        var channels = window.ChannelManager ? window.ChannelManager.getCategoryChannels() : [];
        var channel = channels[state.focusedIndex];

        if (!channel) return;

        state.currentStreamId = channel.stream_id;
        state.currentChannelName = channel.name || 'Unknown';
        state.epgPanelVisible = true;
        state.epgFocusedIndex = 0;

        // Update panel header
        if (cache.epgChannelName) {
            cache.epgChannelName.textContent = state.currentChannelName;
        }

        // Show full page EPG overlay
        if (cache.epgOverlay) {
            cache.epgOverlay.style.display = 'block';
        }

        // Load EPG data
        loadEPGPanel(channel.stream_id);
    }

    function hideEPGPanel() {
        state.epgPanelVisible = false;

        // Hide full page EPG overlay
        if (cache.epgOverlay) {
            cache.epgOverlay.style.display = 'none';
        }
    }

    function loadEPGPanel(streamId) {
        if (!window.EPGManager) {
            cache.epgList.innerHTML = '<div style="color:rgba(255,255,255,0.5);text-align:center;padding:40px;">EPG not available</div>';
            return;
        }

        cache.epgList.innerHTML = '<div style="color:rgba(255,255,255,0.5);text-align:center;padding:40px;">Loading EPG...</div>';

        window.EPGManager.getFullEPG(streamId, function(err, epgData) {
            if (err || !epgData || !epgData.programs || epgData.programs.length === 0) {
                cache.epgList.innerHTML = '<div style="color:rgba(255,255,255,0.5);text-align:center;padding:40px;">No EPG data available</div>';
                return;
            }

            state.epgPrograms = epgData.programs;
            renderEPGList();
        });
    }

    function renderEPGList() {
        var programs = state.epgPrograms;
        if (!programs || programs.length === 0) return;

        var html = '';
        var now = Math.floor(Date.now() / 1000);

        // Find current program index
        var currentProgramIndex = 0;
        for (var i = 0; i < programs.length; i++) {
            if (programs[i].start <= now && programs[i].end > now) {
                currentProgramIndex = i;
                break;
            }
        }

        // Show programs starting from current - more visible on full page
        var startIdx = Math.max(0, currentProgramIndex - 1);
        var displayCount = Math.min(12, programs.length - startIdx); // Show up to 12 programs

        // Calculate visible range with scroll
        var scrollOffset = Math.max(0, state.epgFocusedIndex - 5); // Keep focused in middle
        startIdx = startIdx + scrollOffset;
        if (startIdx + displayCount > programs.length) {
            startIdx = Math.max(0, programs.length - displayCount);
        }

        for (var i = startIdx; i < Math.min(startIdx + displayCount, programs.length); i++) {
            var prog = programs[i];
            var relativeIndex = i - startIdx;
            var isFocused = (i === state.epgFocusedIndex + currentProgramIndex - 1);
            var isCurrent = (prog.start <= now && prog.end > now);
            var isPast = (prog.end < now);

            var bgColor = isFocused ? 'rgba(229,9,20,0.95)' : (isCurrent ? 'rgba(70,211,105,0.2)' : 'rgba(255,255,255,0.03)');
            var borderColor = isCurrent ? '#46d369' : (isFocused ? '#e50914' : 'transparent');
            var opacity = isPast ? '0.5' : '1';
            var textColor = isFocused ? 'white' : (isCurrent ? '#46d369' : 'rgba(255,255,255,0.7)');

            var startTime = window.EPGManager.formatTime(prog.start);
            var endTime = window.EPGManager.formatTime(prog.end);

            // Calculate progress for current program
            var progressBar = '';
            if (isCurrent) {
                var duration = prog.end - prog.start;
                var elapsed = now - prog.start;
                var progress = Math.round((elapsed / duration) * 100);
                progressBar = '<div style="background:rgba(255,255,255,0.15);height:4px;margin-top:10px;border-radius:2px;">' +
                             '<div style="background:#e50914;height:100%;width:' + progress + '%;border-radius:2px;"></div></div>';
            }

            // Full page layout - bigger cards
            html += '<div class="epg-item" data-index="' + i + '" style="padding:15px 20px;margin:8px 0;background:' + bgColor + ';border-radius:8px;border-left:4px solid ' + borderColor + ';opacity:' + opacity + ';">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="color:' + textColor + ';font-size:16px;font-weight:bold;">' + startTime + ' - ' + endTime + '</span>';
            if (isCurrent) {
                html += '<span style="background:#46d369;color:black;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:bold;">● LIVE</span>';
            } else if (isPast) {
                html += '<span style="color:rgba(255,255,255,0.3);font-size:11px;">Beendet</span>';
            }
            html += '</div>';
            html += '<div style="color:white;font-size:18px;margin-top:8px;font-weight:' + (isCurrent || isFocused ? 'bold' : 'normal') + ';">' + (prog.title || 'Unknown') + '</div>';
            if (prog.description) {
                // Show more description on full page
                html += '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:6px;line-height:1.4;max-height:40px;overflow:hidden;text-overflow:ellipsis;">' + prog.description + '</div>';
            }
            html += progressBar;
            html += '</div>';
        }

        cache.epgList.innerHTML = html;
    }

    // ===== FULL EPG VIEW (GREEN Button) =====
    function showFullEPG() {
        // TODO: Implement full Netflix-style EPG view
        // For now, just show the EPG panel
        if (!state.epgPanelVisible) {
            showEPGPanel();
        }
    }

    // ===== NAVIGATION =====
    function navigateUp() {
        if (state.epgPanelVisible) {
            if (state.epgFocusedIndex > 0) {
                state.epgFocusedIndex--;
                renderEPGList();
            }
        } else {
            if (state.focusedIndex > 0) {
                state.focusedIndex--;
                updateFocus();
            }
        }
    }

    function navigateDown() {
        if (state.epgPanelVisible) {
            // Allow navigating through all programs
            if (state.epgFocusedIndex < state.epgPrograms.length - 1) {
                state.epgFocusedIndex++;
                renderEPGList();
            }
        } else {
            var channels = window.ChannelManager ? window.ChannelManager.getCategoryChannels() : [];
            if (state.focusedIndex < channels.length - 1) {
                state.focusedIndex++;
                updateFocus();
            }
        }
    }

    function navigateLeft() {
        if (state.epgPanelVisible) {
            // LEFT closes EPG panel when visible
            hideEPGPanel();
        } else {
            // LEFT switches to previous category
            if (window.ChannelManager && window.ChannelManager.previousCategory) {
                window.ChannelManager.previousCategory();
                refreshOverlay();
            }
        }
    }

    function navigateRight() {
        if (state.epgPanelVisible) {
            // RIGHT closes EPG panel when visible
            hideEPGPanel();
        } else {
            // RIGHT switches to next category
            if (window.ChannelManager && window.ChannelManager.nextCategory) {
                window.ChannelManager.nextCategory();
                refreshOverlay();
            }
        }
    }

    function refreshOverlay() {
        // Refresh category name and channel list
        var category = window.ChannelManager.getCurrentCategory();
        var channels = window.ChannelManager.getCategoryChannels();

        if (cache.categoryName) {
            cache.categoryName.textContent = category ? category.category_name : 'Alle Sender';
        }
        if (cache.channelCount) {
            cache.channelCount.textContent = channels.length + ' Sender';
        }

        state.focusedIndex = 0; // Reset to first channel
        renderChannelList(channels);
    }

    function updateFocus() {
        var channels = window.ChannelManager ? window.ChannelManager.getCategoryChannels() : [];
        renderChannelList(channels);
    }

    function selectChannel() {
        var channels = window.ChannelManager ? window.ChannelManager.getCategoryChannels() : [];
        var channel = channels[state.focusedIndex];

        if (channel && window.PlayerComponent) {
            if (window.NavigationStack) {
                window.NavigationStack.pop('channel-overlay');
            }
            hide();
            window.PlayerComponent.play(channel.stream_id, channel.name, 'live');
        }
    }

    // ===== KEY HANDLING =====
    function setupKeyHandler() {
        document.addEventListener('keydown', handleKeys, true);
    }

    function handleKeys(event) {
        if (!state.isVisible) return;

        var keyCode = event.keyCode;
        var handled = false;

        // Back button - close EPG first, then let NavigationStack handle channel list
        if (keyCode === 461 || keyCode === 10009 || keyCode === 8 || keyCode === 27) {
            if (state.epgPanelVisible) {
                hideEPGPanel();
                handled = true;
            }
            // If EPG was not visible, don't handle - let NavigationStack close overlay
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
            return;
        }

        switch (keyCode) {
            case 38: // UP
                navigateUp();
                handled = true;
                break;

            case 40: // DOWN
                navigateDown();
                handled = true;
                break;

            case 37: // LEFT
                navigateLeft();
                handled = true;
                break;

            case 39: // RIGHT
                navigateRight();
                handled = true;
                break;

            case 13: // OK / ENTER
                selectChannel();
                handled = true;
                break;

            case 404: // GREEN button
                showFullEPG();
                handled = true;
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    }

    // ===== PUBLIC API =====
    function getSelectedChannel() {
        // Get currently focused channel in the overlay
        if (!state.isVisible) return null;
        var channels = window.ChannelManager ? window.ChannelManager.getCategoryChannels() : [];
        if (channels && channels[state.focusedIndex]) {
            return channels[state.focusedIndex];
        }
        return null;
    }

    return {
        init: initialize,
        show: show,
        hide: hide,
        isVisible: function() { return state.isVisible; },
        getSelectedChannel: getSelectedChannel
    };
})();
