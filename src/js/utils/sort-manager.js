/**
 * Sort Manager - Reusable sorting module for Movies/Channels/Series
 * ES3 Compatible - Zero allocations in hotpath
 */

window.SortManager = (function() {
    'use strict';

    // ===== SORT OPTIONS =====
    var SORT_OPTIONS = {
        NAME_AZ: 'name_az',
        NAME_ZA: 'name_za',
        DATE_NEW: 'date_new',
        DATE_OLD: 'date_old',
        RATING_HIGH: 'rating_high',
        RATING_LOW: 'rating_low'
    };

    // ===== SORT LABELS =====
    var SORT_LABELS = {};
    SORT_LABELS[SORT_OPTIONS.NAME_AZ] = 'Name A-Z';
    SORT_LABELS[SORT_OPTIONS.NAME_ZA] = 'Name Z-A';
    SORT_LABELS[SORT_OPTIONS.DATE_NEW] = 'Newest First';
    SORT_LABELS[SORT_OPTIONS.DATE_OLD] = 'Oldest First';
    SORT_LABELS[SORT_OPTIONS.RATING_HIGH] = 'Rating High-Low';
    SORT_LABELS[SORT_OPTIONS.RATING_LOW] = 'Rating Low-High';

    // ===== STATE =====
    var state = {
        currentSort: {},  // Per-screen sort state: {movies: 'date_new', livetv: 'name_az'}
        originalData: {}  // Per-screen original data backup
    };

    // ===== COMPARE FUNCTIONS =====

    /**
     * Get name from item (handles different field names)
     */
    function getName(item) {
        return item.name || item.title || '';
    }

    /**
     * Get added date from item (Unix timestamp)
     */
    function getAdded(item) {
        var added = item.added || item.releaseDate || item.release_date || 0;
        if (typeof added === 'string') {
            added = parseInt(added, 10) || 0;
        }
        return added;
    }

    /**
     * Get rating from item
     */
    function getRating(item) {
        var rating = item.rating || item.rating_5based || item.imdb_rating || 0;
        if (typeof rating === 'string') {
            rating = parseFloat(rating) || 0;
        }
        return rating;
    }

    /**
     * Compare function for Name A-Z
     */
    function compareNameAZ(a, b) {
        var nameA = getName(a).toLowerCase();
        var nameB = getName(b).toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    }

    /**
     * Compare function for Name Z-A
     */
    function compareNameZA(a, b) {
        return compareNameAZ(b, a);
    }

    /**
     * Compare function for Date Newest First
     */
    function compareDateNew(a, b) {
        return getAdded(b) - getAdded(a);
    }

    /**
     * Compare function for Date Oldest First
     */
    function compareDateOld(a, b) {
        return getAdded(a) - getAdded(b);
    }

    /**
     * Compare function for Rating High-Low
     */
    function compareRatingHigh(a, b) {
        return getRating(b) - getRating(a);
    }

    /**
     * Compare function for Rating Low-High
     */
    function compareRatingLow(a, b) {
        return getRating(a) - getRating(b);
    }

    /**
     * Get compare function for sort option
     */
    function getCompareFunction(sortOption) {
        switch (sortOption) {
            case SORT_OPTIONS.NAME_AZ:
                return compareNameAZ;
            case SORT_OPTIONS.NAME_ZA:
                return compareNameZA;
            case SORT_OPTIONS.DATE_NEW:
                return compareDateNew;
            case SORT_OPTIONS.DATE_OLD:
                return compareDateOld;
            case SORT_OPTIONS.RATING_HIGH:
                return compareRatingHigh;
            case SORT_OPTIONS.RATING_LOW:
                return compareRatingLow;
            default:
                return compareNameAZ;
        }
    }

    // ===== PUBLIC API =====

    /**
     * Sort array of items
     * @param {Array} items - Items to sort
     * @param {string} sortOption - Sort option from SORT_OPTIONS
     * @returns {Array} - Sorted array (modifies in place for zero allocation)
     */
    function sortItems(items, sortOption) {
        if (!items || items.length === 0) {
            return items;
        }

        var compareFunc = getCompareFunction(sortOption);
        items.sort(compareFunc);
        return items;
    }

    /**
     * Sort items within each category (for rows structure)
     * @param {Array} rows - Array of row objects with channels property
     * @param {string} sortOption - Sort option
     * @returns {Array} - Rows with sorted channels
     */
    function sortRowsContent(rows, sortOption) {
        if (!rows || rows.length === 0) {
            return rows;
        }

        var compareFunc = getCompareFunction(sortOption);

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.channels && row.channels.length > 0) {
                // Skip continue watching row
                if (row.isContinueWatching) {
                    continue;
                }
                row.channels.sort(compareFunc);
            }
        }

        return rows;
    }

    /**
     * Get available sort options for a screen type
     * @param {string} screenType - 'movies', 'series', 'livetv'
     * @returns {Array} - Array of {id, label} objects
     */
    function getOptionsForScreen(screenType) {
        var options = [];

        // All screens get name sorting
        options.push({ id: SORT_OPTIONS.NAME_AZ, label: SORT_LABELS[SORT_OPTIONS.NAME_AZ] });
        options.push({ id: SORT_OPTIONS.NAME_ZA, label: SORT_LABELS[SORT_OPTIONS.NAME_ZA] });

        // Movies and Series get date and rating
        if (screenType === 'movies' || screenType === 'series') {
            options.push({ id: SORT_OPTIONS.DATE_NEW, label: SORT_LABELS[SORT_OPTIONS.DATE_NEW] });
            options.push({ id: SORT_OPTIONS.DATE_OLD, label: SORT_LABELS[SORT_OPTIONS.DATE_OLD] });
            options.push({ id: SORT_OPTIONS.RATING_HIGH, label: SORT_LABELS[SORT_OPTIONS.RATING_HIGH] });
            options.push({ id: SORT_OPTIONS.RATING_LOW, label: SORT_LABELS[SORT_OPTIONS.RATING_LOW] });
        }

        return options;
    }

    /**
     * Get current sort for screen
     * @param {string} screenType - Screen type
     * @returns {string} - Current sort option
     */
    function getCurrentSort(screenType) {
        return state.currentSort[screenType] || SORT_OPTIONS.DATE_NEW;
    }

    /**
     * Set current sort for screen
     * @param {string} screenType - Screen type
     * @param {string} sortOption - Sort option
     */
    function setCurrentSort(screenType, sortOption) {
        state.currentSort[screenType] = sortOption;
    }

    /**
     * Get sort label
     * @param {string} sortOption - Sort option
     * @returns {string} - Human readable label
     */
    function getSortLabel(sortOption) {
        return SORT_LABELS[sortOption] || 'Unknown';
    }

    /**
     * Backup original data order
     * @param {string} screenType - Screen type
     * @param {Array} items - Original items array
     */
    function backupOriginalOrder(screenType, items) {
        if (!items) return;

        // Create shallow copy of array
        var backup = [];
        for (var i = 0; i < items.length; i++) {
            backup.push(items[i]);
        }
        state.originalData[screenType] = backup;
    }

    /**
     * Get original data order
     * @param {string} screenType - Screen type
     * @returns {Array|null} - Original items or null
     */
    function getOriginalOrder(screenType) {
        return state.originalData[screenType] || null;
    }

    /**
     * Clear backup for screen
     * @param {string} screenType - Screen type
     */
    function clearBackup(screenType) {
        delete state.originalData[screenType];
    }

    return {
        // Constants
        SORT_OPTIONS: SORT_OPTIONS,
        SORT_LABELS: SORT_LABELS,

        // Core functions
        sortItems: sortItems,
        sortRowsContent: sortRowsContent,

        // Screen helpers
        getOptionsForScreen: getOptionsForScreen,
        getCurrentSort: getCurrentSort,
        setCurrentSort: setCurrentSort,
        getSortLabel: getSortLabel,

        // Data backup
        backupOriginalOrder: backupOriginalOrder,
        getOriginalOrder: getOriginalOrder,
        clearBackup: clearBackup
    };
})();
