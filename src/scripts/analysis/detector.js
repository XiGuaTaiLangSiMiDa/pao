import { ANALYSIS_CONFIG } from './config.js';

/**
 * Calculate trend strengths for a series of prices
 */
function calculateTrendStrengths(prices) {
    let downwardStrength = 0;
    let upwardStrength = 0;
    
    for (let i = 1; i < prices.length; i++) {
        const priceChange = (prices[i] - prices[i-1]) / prices[i-1];
        if (priceChange < 0) downwardStrength += Math.abs(priceChange);
        if (priceChange > 0) upwardStrength += priceChange;
    }
    
    return { downwardStrength, upwardStrength };
}

/**
 * Check if price movement meets reversal criteria
 */
function checkReversalCriteria(currentPrice, nextPrices) {
    const maxFuturePrice = Math.max(...nextPrices);
    const minFuturePrice = Math.min(...nextPrices);
    
    return {
        upward: {
            change: (maxFuturePrice - currentPrice) / currentPrice,
            effective: (maxFuturePrice - currentPrice) / currentPrice > ANALYSIS_CONFIG.REVERSAL_THRESHOLD * 2
        },
        downward: {
            change: (currentPrice - minFuturePrice) / currentPrice,
            effective: (currentPrice - minFuturePrice) / currentPrice > ANALYSIS_CONFIG.REVERSAL_THRESHOLD * 2
        }
    };
}

/**
 * Detect reversal points in kline data
 */
export function detectReversalPoints(klines) {
    const reversals = [];
    const { LOOKBACK_PERIOD, FORWARD_PERIOD, REVERSAL_THRESHOLD } = ANALYSIS_CONFIG;
    
    for (let i = LOOKBACK_PERIOD; i < klines.length - FORWARD_PERIOD; i++) {
        const currentPrice = klines[i].close;
        const prevPrices = klines.slice(i - LOOKBACK_PERIOD, i).map(k => k.close);
        const nextPrices = klines.slice(i + 1, i + FORWARD_PERIOD + 1).map(k => k.close);
        
        // Analyze trends
        const { downwardStrength, upwardStrength } = calculateTrendStrengths(prevPrices);
        const criteria = checkReversalCriteria(currentPrice, nextPrices);
        
        // Detect upward reversal (downtrend to uptrend)
        if (downwardStrength > upwardStrength && criteria.upward.change > REVERSAL_THRESHOLD) {
            reversals.push({
                index: i,
                type: 'upward',
                timestamp: klines[i].openTime,
                price: currentPrice,
                strength: downwardStrength,
                effective: criteria.upward.effective
            });
        }
        // Detect downward reversal (uptrend to downtrend)
        else if (upwardStrength > downwardStrength && criteria.downward.change > REVERSAL_THRESHOLD) {
            reversals.push({
                index: i,
                type: 'downward',
                timestamp: klines[i].openTime,
                price: currentPrice,
                strength: upwardStrength,
                effective: criteria.downward.effective
            });
        }
    }
    
    return reversals;
}
