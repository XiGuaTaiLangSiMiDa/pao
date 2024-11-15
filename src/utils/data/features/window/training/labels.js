import { clipValue } from '../base/utils.js';

export function generateLabels(klines, startIndex) {
    const labels = [];
    
    for (let i = startIndex; i < klines.length; i++) {
        const normalizedChange = calculatePriceChange(klines[i].close, klines[i].open);
        labels.push(normalizedChange);
    }

    return labels;
}

export function calculatePriceChange(close, referencePrice) {
    if (!isFinite(close) || !isFinite(referencePrice) || referencePrice === 0) {
        return 0;
    }
    
    // Calculate percentage change (-1 to +1 range)
    // Negative values indicate price decrease
    // Positive values indicate price increase
    const percentageChange = (close - referencePrice) / referencePrice;
    
    // Clip to ensure values stay within -1 to +1 range
    return clipValue(percentageChange);
}

export function denormalizeChange(normalizedChange, referencePrice) {
    if (!isFinite(normalizedChange) || !isFinite(referencePrice)) {
        return referencePrice;
    }
    
    // Convert normalized change back to actual price
    return referencePrice * (1 + normalizedChange);
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
