/**
 * Format combination details for display
 * @param {string} combination - Combination key string
 * @returns {string} Formatted combination details
 */
export function formatCombinationDetails(combination) {
    const indicators = {
        0: 'ADX',
        1: 'MACD',
        2: 'StochRSI',
        3: 'Momentum',
        4: 'ROC',
        5: 'ATR',
        6: 'BBands%B',
        7: 'CMF',
        8: 'OBV'
    };

    return combination.split('|')
        .map((value, index) => {
            const indicator = indicators[index];
            if (index === 1 || index === 7 || index === 8) {
                // Binary indicators (MACD, CMF, OBV)
                return `${indicator}: ${value === '1' ? 'Positive' : 'Negative'}`;
            } else {
                // Range-based indicators
                return `${indicator}: ${value}`;
            }
        })
        .join(' | ');
}

/**
 * Format effectiveness percentage
 * @param {number} effectiveness - Effectiveness value (0-1)
 * @returns {string} Formatted percentage
 */
export function formatEffectiveness(effectiveness) {
    return `${(effectiveness * 100).toFixed(2)}%`;
}

/**
 * Format combination statistics
 * @param {Object} combo - Combination object
 * @returns {string} Formatted statistics
 */
export function formatCombinationStats(combo) {
    return [
        `Effectiveness: ${formatEffectiveness(combo.effectiveness)}`,
        `(${combo.effective}/${combo.total} samples)`,
        `\nIndicators: ${formatCombinationDetails(combo.combination)}`
    ].join(' ');
}

/**
 * Format analysis results summary
 * @param {Object} results - Analysis results
 * @returns {string} Formatted summary
 */
export function formatAnalysisSummary(results) {
    const summary = [];

    // Add metadata
    summary.push('\n=== Analysis Summary ===');
    summary.push(`Total klines: ${results.metadata.totalKlines}`);
    summary.push(`Total reversals: ${results.metadata.totalReversals}`);
    summary.push(`Upward reversals: ${results.metadata.upwardReversals}`);
    summary.push(`Downward reversals: ${results.metadata.downwardReversals}`);
    summary.push(`Processing time: ${results.metadata.processingTime}s`);
    summary.push(`Average time per reversal: ${results.metadata.averageTimePerReversal}ms`);

    // Add combinations
    ['upward', 'downward'].forEach(type => {
        summary.push(`\n${type.toUpperCase()} REVERSALS:`);
        results.combinations[type].slice(0, 10).forEach((combo, i) => {
            summary.push(`\n${i + 1}. ${formatCombinationStats(combo)}`);
        });
    });

    return summary.join('\n');
}

/**
 * Format results for JSON storage
 * @param {Object} results - Analysis results
 * @returns {string} Formatted JSON string
 */
export function formatResultsForStorage(results) {
    return JSON.stringify(results, null, 2);
}
