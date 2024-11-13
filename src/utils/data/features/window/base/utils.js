import { ValidationLimits, FEATURE_COUNT } from './types.js';

export function extractPrices(klines) {
    return {
        closes: klines.map(k => k.close),
        opens: klines.map(k => k.open),
        highs: klines.map(k => k.high),
        lows: klines.map(k => k.low)
    };
}

export function createEmptyWindow(lookback) {
    return Array(lookback).fill(Array(FEATURE_COUNT).fill(0));
}

export function validateWindowSize(window, lookback) {
    return Array.isArray(window) && 
           window.length === lookback && 
           window.every(features => 
               Array.isArray(features) && 
               features.length === FEATURE_COUNT
           );
}

export function clipValue(value, min = ValidationLimits.MIN_VALUE, max = ValidationLimits.MAX_VALUE) {
    if (!isFinite(value)) return 0;
    return Math.min(Math.max(value, min), max);
}

export function calculateWindowStats(window) {
    const flatValues = window.flat().filter(v => isFinite(v));
    if (flatValues.length === 0) return { mean: 0, std: 0 };

    const mean = flatValues.reduce((a, b) => a + b, 0) / flatValues.length;
    const variance = flatValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / flatValues.length;
    
    return {
        mean,
        std: Math.sqrt(variance)
    };
}
