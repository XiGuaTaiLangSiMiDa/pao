import { clipValue } from '../base/utils.js';

// Calculate trend strength based on price movement consistency
function calculateTrendStrength(prices, window = 5) {
    const changes = [];
    for (let i = window; i < prices.length; i++) {
        const windowPrices = prices.slice(i - window, i + 1);
        const firstPrice = windowPrices[0];
        const lastPrice = windowPrices[windowPrices.length - 1];
        
        // Calculate overall direction
        const overallChange = (lastPrice - firstPrice) / firstPrice;
        
        // Calculate consistency of movement
        let consistentMoves = 0;
        for (let j = 1; j < windowPrices.length; j++) {
            if ((windowPrices[j] - windowPrices[j-1]) * overallChange > 0) {
                consistentMoves++;
            }
        }
        
        const consistency = consistentMoves / (window - 1);
        changes.push(overallChange * consistency);
    }
    
    return changes;
}

// Calculate volume trend with price sensitivity
function calculateVolumeTrend(volumes, prices, window = 5) {
    const volumeTrends = [];
    
    for (let i = window; i < volumes.length; i++) {
        const windowVolumes = volumes.slice(i - window, i + 1);
        const windowPrices = prices.slice(i - window, i + 1);
        
        let volumePrice = 0;
        let totalVolume = 0;
        
        for (let j = 1; j < window; j++) {
            const priceChange = windowPrices[j] - windowPrices[j-1];
            const volumeChange = windowVolumes[j];
            volumePrice += priceChange * volumeChange;
            totalVolume += volumeChange;
        }
        
        // Normalize by total volume to prevent large volume bias
        volumeTrends.push(totalVolume > 0 ? volumePrice / totalVolume : 0);
    }
    
    return volumeTrends;
}

export function generateLabels(klines, startIndex) {
    const labels = [];
    const prices = klines.map(k => k.close);
    const volumes = klines.map(k => k.volume);
    
    // Calculate trend strengths for different time windows
    const shortTrend = calculateTrendStrength(prices, 5);
    const mediumTrend = calculateTrendStrength(prices, 10);
    const longTrend = calculateTrendStrength(prices, 20);
    
    // Calculate volume trend
    const volumeTrend = calculateVolumeTrend(volumes, prices);
    
    // Combine different timeframe trends with volume
    for (let i = startIndex; i < klines.length; i++) {
        if (i < 20) {  // Need enough data for all trends
            labels.push(0);
            continue;
        }
        
        const shortIdx = i - 15;
        const mediumIdx = i - 10;
        const longIdx = i - 0;
        const volumeIdx = i - 15;
        
        // More balanced trend weights with increased volume influence
        const weightedTrend = (
            shortTrend[shortIdx] * 0.3 +     // Increased short-term weight
            mediumTrend[mediumIdx] * 0.3 +   // Equal medium-term weight
            longTrend[longIdx] * 0.2 +       // Reduced long-term weight
            Math.sign(volumeTrend[volumeIdx]) * 0.2  // Increased volume influence
        );
        
        // Calculate base price change
        const currentPrice = klines[i].close;
        const referencePrice = klines[i].open;
        let priceChange = calculatePriceChange(currentPrice, referencePrice);
        
        // Apply trend-based dampening instead of amplification
        if (Math.abs(priceChange) > 0.05) {  // For significant price changes
            if (Math.sign(priceChange) !== Math.sign(weightedTrend)) {
                priceChange *= 0.7;  // Stronger dampening against trend
            } else {
                priceChange *= 0.9;  // Slight dampening with trend
            }
        }
        
        labels.push(clipValue(priceChange));
    }

    return labels;
}

export function calculatePriceChange(close, referencePrice) {
    if (!isFinite(close) || !isFinite(referencePrice) || referencePrice === 0) {
        return 0;
    }
    
    // Calculate percentage change (-1 to +1 range)
    const percentageChange = (close - referencePrice) / referencePrice;
    
    // Apply stronger non-linear transformation to reduce extreme values
    const transformedChange = Math.sign(percentageChange) * Math.pow(Math.abs(percentageChange), 0.8);
    
    // Clip to ensure values stay within -1 to +1 range
    return clipValue(transformedChange);
}

export function denormalizeChange(normalizedChange, referencePrice) {
    if (!isFinite(normalizedChange) || !isFinite(referencePrice)) {
        return referencePrice;
    }
    
    // Reverse the non-linear transformation
    const transformedChange = Math.sign(normalizedChange) * Math.pow(Math.abs(normalizedChange), 1/0.8);
    
    // Convert normalized change back to actual price
    return referencePrice * (1 + transformedChange);
}

export function validateLabels(labels) {
    if (!Array.isArray(labels) || labels.length === 0) {
        return false;
    }

    return labels.every(label => 
        isFinite(label) && 
        label >= -1 && 
        label <= 1
    );
}
