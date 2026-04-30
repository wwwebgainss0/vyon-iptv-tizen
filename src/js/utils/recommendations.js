/**
 * Recommendations - Personalized Content Suggestions
 * Analyzes watch history to suggest similar content
 * ES3 Compatible - WebOS 3.x optimized
 */

window.Recommendations = (function() {
    'use strict';

    // ===== CONFIGURATION =====
    var CONFIG = {
        MAX_RECOMMENDATIONS: 20,
        MIN_HISTORY_FOR_RECS: 3,  // Need at least 3 watched items
        GENRE_WEIGHT: 3,
        CATEGORY_WEIGHT: 2,
        RECENCY_WEIGHT: 1
    };

    // ===== STATE =====
    var state = {
        recommendations: [],
        genrePreferences: {},
        categoryPreferences: {},
        lastUpdate: 0
    };

    // ===== INITIALIZATION =====
    function init() {
        // Recommendations are generated on demand
    }

    /**
     * Generate recommendations based on watch history
     * @param {array} allMovies - All available movies
     * @param {array} allSeries - All available series
     * @returns {array} - Recommended items
     */
    function generateRecommendations(allMovies, allSeries) {
        state.recommendations = [];
        state.genrePreferences = {};
        state.categoryPreferences = {};

        // Get watch history
        var history = [];
        if (window.WatchHistory) {
            history = window.WatchHistory.getHistory();
        }

        if (history.length < CONFIG.MIN_HISTORY_FOR_RECS) {
            return getTrendingFallback(allMovies, allSeries);
        }

        // Analyze watch history for preferences
        analyzePreferences(history);

        // Score all content
        var scored = [];

        // Score movies
        if (allMovies && allMovies.length > 0) {
            for (var i = 0; i < allMovies.length; i++) {
                var movie = allMovies[i];
                if (!isAlreadyWatched(movie.stream_id, history)) {
                    var score = scoreItem(movie);
                    if (score > 0) {
                        scored.push({
                            item: movie,
                            type: 'movie',
                            score: score
                        });
                    }
                }
            }
        }

        // Score series
        if (allSeries && allSeries.length > 0) {
            for (var j = 0; j < allSeries.length; j++) {
                var series = allSeries[j];
                if (!isAlreadyWatched(series.series_id, history)) {
                    var seriesScore = scoreItem(series);
                    if (seriesScore > 0) {
                        scored.push({
                            item: series,
                            type: 'series',
                            score: seriesScore
                        });
                    }
                }
            }
        }

        // Sort by score (highest first)
        scored.sort(function(a, b) {
            return b.score - a.score;
        });

        // Take top recommendations
        var topItems = scored.slice(0, CONFIG.MAX_RECOMMENDATIONS);
        state.recommendations = topItems;
        state.lastUpdate = Date.now();

        return topItems;
    }

    /**
     * Analyze watch history to build preference profiles
     */
    function analyzePreferences(history) {
        for (var i = 0; i < history.length; i++) {
            var item = history[i];

            // Weight by recency (newer = higher weight)
            var ageInDays = (Date.now() - (item.lastWatched || 0)) / (1000 * 60 * 60 * 24);
            var recencyMultiplier = Math.max(0.5, 1 - (ageInDays / 30)); // Decay over 30 days

            // Track genre preferences
            if (item.genre) {
                var genres = item.genre.split(/[,\/]/);
                for (var g = 0; g < genres.length; g++) {
                    var genre = genres[g].trim().toLowerCase();
                    if (genre) {
                        state.genrePreferences[genre] = (state.genrePreferences[genre] || 0) + recencyMultiplier;
                    }
                }
            }

            // Track category preferences
            if (item.categoryId) {
                state.categoryPreferences[item.categoryId] = (state.categoryPreferences[item.categoryId] || 0) + recencyMultiplier;
            }
        }
    }

    /**
     * Score an item based on user preferences
     */
    function scoreItem(item) {
        var score = 0;

        // Genre matching
        if (item.genre) {
            var genres = item.genre.split(/[,\/]/);
            for (var g = 0; g < genres.length; g++) {
                var genre = genres[g].trim().toLowerCase();
                if (state.genrePreferences[genre]) {
                    score += state.genrePreferences[genre] * CONFIG.GENRE_WEIGHT;
                }
            }
        }

        // Category matching
        var categoryId = item.category_id || item.categoryId;
        if (categoryId && state.categoryPreferences[categoryId]) {
            score += state.categoryPreferences[categoryId] * CONFIG.CATEGORY_WEIGHT;
        }

        // Bonus for highly rated content
        if (item.rating && parseFloat(item.rating) > 7) {
            score += (parseFloat(item.rating) - 7) * 0.5;
        }

        return score;
    }

    /**
     * Check if item was already watched
     */
    function isAlreadyWatched(streamId, history) {
        for (var i = 0; i < history.length; i++) {
            if (history[i].streamId === streamId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Fallback: Return trending/popular content
     */
    function getTrendingFallback(allMovies, allSeries) {
        var trending = [];

        // Get highest rated movies
        if (allMovies && allMovies.length > 0) {
            var sortedMovies = allMovies.slice().sort(function(a, b) {
                var ratingA = parseFloat(a.rating) || 0;
                var ratingB = parseFloat(b.rating) || 0;
                return ratingB - ratingA;
            });

            for (var i = 0; i < Math.min(10, sortedMovies.length); i++) {
                trending.push({
                    item: sortedMovies[i],
                    type: 'movie',
                    score: parseFloat(sortedMovies[i].rating) || 0
                });
            }
        }

        // Get highest rated series
        if (allSeries && allSeries.length > 0) {
            var sortedSeries = allSeries.slice().sort(function(a, b) {
                var ratingA = parseFloat(a.rating) || 0;
                var ratingB = parseFloat(b.rating) || 0;
                return ratingB - ratingA;
            });

            for (var j = 0; j < Math.min(10, sortedSeries.length); j++) {
                trending.push({
                    item: sortedSeries[j],
                    type: 'series',
                    score: parseFloat(sortedSeries[j].rating) || 0
                });
            }
        }

        // Shuffle and mix
        trending.sort(function() { return Math.random() - 0.5; });

        return trending.slice(0, CONFIG.MAX_RECOMMENDATIONS);
    }

    /**
     * Get recommendations formatted for SlotRenderer
     * @param {string} reasonText - e.g., "Weil Sie Action mögen"
     */
    function getRecommendationsRow(allMovies, allSeries) {
        var recs = generateRecommendations(allMovies, allSeries);

        if (recs.length === 0) return null;

        // Find top genre for "reason" text
        var topGenre = '';
        var topScore = 0;
        for (var genre in state.genrePreferences) {
            if (state.genrePreferences[genre] > topScore) {
                topScore = state.genrePreferences[genre];
                topGenre = genre;
            }
        }

        var title = 'Empfohlen für Sie';
        if (topGenre) {
            title = 'Weil Sie ' + capitalizeFirst(topGenre) + ' mögen';
        }

        return {
            title: title,
            items: recs.map(function(rec) {
                var item = rec.item;
                return {
                    stream_id: item.stream_id || item.series_id,
                    series_id: rec.type === 'series' ? item.series_id : null,
                    name: item.name || item.title,
                    stream_icon: item.stream_icon || item.cover,
                    cover: item.cover || item.stream_icon,
                    container_extension: item.container_extension || '',
                    category_id: item.category_id,
                    rating: item.rating,
                    _type: rec.type,
                    _recommendation: true,
                    _score: rec.score
                };
            })
        };
    }

    /**
     * Get "Because you watched X" row
     * @param {object} watchedItem - Recently watched item
     * @param {array} allContent - All available content
     */
    function getBecauseYouWatchedRow(watchedItem, allContent) {
        if (!watchedItem || !allContent) return null;

        var similar = [];
        var watchedGenres = (watchedItem.genre || '').toLowerCase().split(/[,\/]/);
        var watchedCategory = watchedItem.category_id;

        for (var i = 0; i < allContent.length; i++) {
            var item = allContent[i];
            var itemId = item.stream_id || item.series_id;

            // Skip the watched item itself
            if (itemId === watchedItem.stream_id || itemId === watchedItem.series_id) {
                continue;
            }

            var score = 0;

            // Genre matching
            var itemGenres = (item.genre || '').toLowerCase().split(/[,\/]/);
            for (var g = 0; g < watchedGenres.length; g++) {
                var wg = watchedGenres[g].trim();
                if (wg) {
                    for (var ig = 0; ig < itemGenres.length; ig++) {
                        if (itemGenres[ig].trim() === wg) {
                            score += 2;
                        }
                    }
                }
            }

            // Same category bonus
            if (item.category_id === watchedCategory) {
                score += 1;
            }

            if (score > 0) {
                similar.push({
                    item: item,
                    score: score
                });
            }
        }

        // Sort by score
        similar.sort(function(a, b) {
            return b.score - a.score;
        });

        // Take top 12
        var topSimilar = similar.slice(0, 12);

        if (topSimilar.length === 0) return null;

        return {
            title: 'Weil Sie "' + (watchedItem.name || 'diesen Film').substring(0, 30) + '" gesehen haben',
            items: topSimilar.map(function(s) {
                return s.item;
            })
        };
    }

    // ===== HELPERS =====
    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function getLastRecommendations() {
        return state.recommendations;
    }

    function getPreferences() {
        return {
            genres: state.genrePreferences,
            categories: state.categoryPreferences
        };
    }

    // ===== PUBLIC API =====
    return {
        init: init,
        generateRecommendations: generateRecommendations,
        getRecommendationsRow: getRecommendationsRow,
        getBecauseYouWatchedRow: getBecauseYouWatchedRow,
        getLastRecommendations: getLastRecommendations,
        getPreferences: getPreferences
    };
})();
