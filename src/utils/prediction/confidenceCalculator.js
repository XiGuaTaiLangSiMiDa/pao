/**
 * Calculate confidence score based on multiple factors
 * @param {number} predictedChange - Predicted price change percentage
 * @param {number} rsi - Current RSI value
 * @param {number} volatility - Current market volatility
 * @param {number} adx - Current ADX value
 * @param {number} cmf - Current CMF value
 * @returns {number} Confidence score (0-100)
 */
export function calculateConfidence(predictedChange, rsi, volatility, adx, cmf) {
    // Adjust confidence calculation for percentage change values
    const changeMagnitude = Math.abs(predictedChange);
    
    // Base confidence components
    const baseConfidence = (
        // Prediction magnitude (25%)
        (Math.min(changeMagnitude/2, 1) * 50) +
        // RSI alignment with prediction (25%)
        ((predictedChange > 0 && rsi < 70) || (predictedChange < 0 && rsi > 30) ? 25 : 10) +
        // Low volatility (20%)
        (Math.max(0, 1 - volatility) * 20) +
        // Base confidence (5%)
        5
    );

    // Additional confidence from new indicators
    const adxConfidence = adx ? Math.min(adx / 50, 1) * 15 : 0; // ADX strength (15%)
    const cmfConfidence = cmf ? (Math.sign(cmf) === Math.sign(predictedChange) ? 10 : 0) : 0; // CMF alignment (10%)

    return Math.min(100, Math.max(0, baseConfidence + adxConfidence + cmfConfidence));
}

/**
 * Generate trading signal based on prediction and confidence
 * @param {number} predictedChange - Predicted price change percentage
 * @param {number} confidence - Prediction confidence score
 * @returns {string} Trading signal
 */
export function generateSignal(predictedChange, confidence) {
    if (confidence < 60) {
        return 'Low Confidence';
    }
    
    if (predictedChange > 1.5) {
        return 'Strong Buy';
    } else if (predictedChange > 0.5) {
        return 'Weak Buy';
    } else if (predictedChange < -1.5) {
        return 'Strong Sell';
    } else if (predictedChange < -0.5) {
        return 'Weak Sell';
    }
    
    return 'Neutral';
}
