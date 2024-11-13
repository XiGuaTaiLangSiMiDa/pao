import { clipValue } from '../base/utils.js';

export function generateLabels(klines, startIndex) {
    const labels = [];
    
    for (let i = startIndex; i < klines.length; i++) {
        const normalizedClose = normalizeClose(klines[i].close, klines[i].open);
        labels.push(normalizedClose);
    }

    return labels;
}

export function normalizeClose(close, referencePrice) {
    if (!isFinite(close) || !isFinite(referencePrice) || referencePrice === 0) {
        return 0;
    }
    
    // Normalize close price relative to reference price
    const normalizedValue = (close - referencePrice) / referencePrice;
    return clipValue(normalizedValue);
}

export function denormalizeClose(normalizedClose, referencePrice) {
    if (!isFinite(normalizedClose) || !isFinite(referencePrice)) {
        return referencePrice;
    }
    
    // Convert normalized close back to actual price
    return referencePrice * (1 + normalizedClose);
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
