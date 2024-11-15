/**
 * Calculate confidence score based on multiple factors and optimized indicator ranges
 * @param {number} predictedChange - Predicted price change percentage
 * @param {number} rsi - Current RSI value
 * @param {number} volatility - Current market volatility
 * @param {number} adx - Current ADX value
 * @param {number} cmf - Current CMF value
 * @returns {number} Confidence score (0-100)
 */
export function calculateConfidence(predictedChange, rsi, volatility, adx, cmf) {
    // Initialize confidence components
    let confidenceComponents = [];
    
    // 1. ADX Component (25%) - Highly effective at ranges 60-80
    if (adx) {
        let adxConfidence;
        if (adx >= 80) {
            adxConfidence = 25;  // 44.44% effectiveness at range 80
        } else if (adx >= 60) {
            adxConfidence = 20;  // ~35% effectiveness at range 60-70
        } else if (adx >= 30) {
            adxConfidence = 15;  // ~25-30% effectiveness at range 30-50
        } else {
            adxConfidence = 10;  // Lower effectiveness at lower ranges
        }
        confidenceComponents.push(adxConfidence);
    }

    // 2. Volatility/ATR Component (25%) - Highest effectiveness at upper ranges
    const atrConfidence = (() => {
        if (volatility >= 0.8) {
            return 25;  // ~57% effectiveness at highest ranges
        } else if (volatility >= 0.6) {
            return 20;  // ~38% effectiveness at range 70-80
        } else if (volatility >= 0.4) {
            return 15;  // ~25% effectiveness at middle ranges
        }
        return 10;     // Lower effectiveness at lower ranges
    })();
    confidenceComponents.push(atrConfidence);

    // 3. Momentum Component (20%) - Most effective at extreme ranges
    const momentumConfidence = (() => {
        const changeMagnitude = Math.abs(predictedChange);
        if (changeMagnitude >= 1.5) {
            return 20;  // ~40% effectiveness at extreme ranges
        } else if (changeMagnitude >= 1.0) {
            return 15;  // ~30% effectiveness at high ranges
        } else if (changeMagnitude >= 0.5) {
            return 10;  // ~25% effectiveness at medium ranges
        }
        return 5;      // Lower effectiveness at small changes
    })();
    confidenceComponents.push(momentumConfidence);

    // 4. Volume Flow Component (15%) - Based on CMF and predicted direction alignment
    if (cmf) {
        const cmfConfidence = (() => {
            const directionAlignment = Math.sign(cmf) === Math.sign(predictedChange);
            if (directionAlignment && Math.abs(cmf) >= 0.2) {
                return 15;  // Strong alignment with high magnitude
            } else if (directionAlignment) {
                return 10;  // Direction alignment but lower magnitude
            }
            return 5;      // Direction misalignment
        })();
        confidenceComponents.push(cmfConfidence);
    }

    // 5. RSI Component (15%) - Based on reversal potential
    const rsiConfidence = (() => {
        if (predictedChange > 0 && rsi <= 30) {
            return 15;  // Strong oversold condition
        } else if (predictedChange < 0 && rsi >= 70) {
            return 15;  // Strong overbought condition
        } else if ((predictedChange > 0 && rsi < 45) || (predictedChange < 0 && rsi > 55)) {
            return 10;  // Moderate reversal potential
        }
        return 5;      // Neutral RSI conditions
    })();
    confidenceComponents.push(rsiConfidence);

    // Calculate total confidence
    const totalConfidence = confidenceComponents.reduce((sum, component) => sum + component, 0);
    
    // Normalize to 0-100 range
    return Math.min(100, Math.max(0, totalConfidence));
}

/**
 * Generate trading signal based on prediction and confidence
 * Thresholds adjusted based on reversal analysis effectiveness
 * @param {number} predictedChange - Predicted price change percentage
 * @param {number} confidence - Prediction confidence score
 * @returns {string} Trading signal
 */
export function generateSignal(predictedChange, confidence) {
    // Require higher confidence for stronger signals based on reversal effectiveness
    if (confidence < 65) {
        return 'Low Confidence';
    }
    
    const changeMagnitude = Math.abs(predictedChange);
    
    if (confidence >= 80) {
        // Very high confidence signals (require strong indicator alignment)
        if (changeMagnitude > 1.5) {
            return predictedChange > 0 ? 'Strong Buy' : 'Strong Sell';
        }
    }
    
    if (confidence >= 70) {
        // High confidence signals
        if (changeMagnitude > 1.0) {
            return predictedChange > 0 ? 'Buy' : 'Sell';
        }
    }
    
    if (confidence >= 65) {
        // Moderate confidence signals
        if (changeMagnitude > 0.5) {
            return predictedChange > 0 ? 'Weak Buy' : 'Weak Sell';
        }
    }
    
    return 'Neutral';
}
