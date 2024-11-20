/**
 * Find most effective indicator combinations
 * @param {Object} combinations - Map of combinations by type
 * @param {number} minSamples - Minimum number of samples required
 * @param {number} minEffectiveness - Minimum effectiveness threshold
 * @returns {Object} Effective combinations by type
 */
export function findEffectiveCombinations(combinations, minSamples = 5, minEffectiveness = 0.6) {
    const results = {
        upward: [],
        downward: []
    };

    ['upward', 'downward'].forEach(type => {
        const typeResults = [];
        for (const [key, stats] of combinations[type].entries()) {
            if (stats.total >= minSamples) {
                const effectiveness = stats.effective / stats.total;
                if (effectiveness >= minEffectiveness) {
                    typeResults.push({
                        combination: key,
                        effectiveness,
                        total: stats.total,
                        effective: stats.effective,
                        indicators: stats.indicators
                    });
                }
            }
        }

        // Sort by effectiveness in descending order
        results[type] = typeResults.sort((a, b) => b.effectiveness - a.effectiveness);
    });

    return results;
}

/**
 * Generate a key for indicator combination based on their ranges
 * @param {Object} indicators - Indicator values
 * @returns {string} Combination key
 */
export function generateCombinationKey(indicators) {
    const ranges = [
        Math.floor(indicators.trend.adx / 10) * 10,
        indicators.trend.macd.histogram > 0 ? 1 : 0,
        Math.floor(indicators.trend.stochRSI / 10) * 10,
        Math.floor(normalizeValue(indicators.momentum.momentum) / 10) * 10,
        Math.floor(normalizeValue(indicators.momentum.roc) / 10) * 10,
        Math.floor(normalizeValue(indicators.volatility.atr) / 10) * 10,
        Math.floor(indicators.volatility.bollingerBands.percentB / 10) * 10,
        indicators.volume.cmf > 0 ? 1 : 0,
        indicators.momentum.obv > 0 ? 1 : 0
    ];

    return ranges.join('|');
}

/**
 * Normalize indicator values to 0-100 range
 * @param {number} value - Raw indicator value
 * @returns {number} Normalized value
 */
function normalizeValue(value) {
    return Math.min(Math.max((value + 3) / 6 * 100, 0), 100);
}

/**
 * Merge multiple combination results
 * @param {Array} results - Array of combination results
 * @returns {Object} Merged combinations
 */
export function mergeCombinationResults(results) {
    const merged = {
        upward: new Map(),
        downward: new Map()
    };

    results.forEach(result => {
        ['upward', 'downward'].forEach(type => {
            for (const [key, value] of result[type]) {
                if (!merged[type].has(key)) {
                    merged[type].set(key, value);
                } else {
                    const existing = merged[type].get(key);
                    existing.total += value.total;
                    existing.effective += value.effective;
                }
            }
        });
    });

    return merged;
}
