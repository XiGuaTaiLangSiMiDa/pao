/**
 * Normalize indicator values to 0-100 range
 * @param {number} value - Raw indicator value
 * @returns {number} Normalized value
 */
export function normalizeValue(value) {
    return Math.min(Math.max((value + 3) / 6 * 100, 0), 100);
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
 * Create chunks from array
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
export function createChunks(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, Math.min(i + size, array.length)));
    }
    return chunks;
}
