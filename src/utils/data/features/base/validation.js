import { ValidationLimits } from '../window/base/types.js';

export function validateKlineData(klines, lookback) {
    if (!Array.isArray(klines) || klines.length < lookback + 1) {
        throw new Error(`Insufficient kline data: need at least ${lookback + 1} klines, got ${klines?.length}`);
    }

    if (klines.length > ValidationLimits.MAX_KLINES) {
        throw new Error(`Too many klines: maximum is ${ValidationLimits.MAX_KLINES}, got ${klines.length}`);
    }

    const requiredFields = ['openTime', 'open', 'high', 'low', 'close', 'volume'];
    
    klines.forEach((kline, i) => {
        requiredFields.forEach(field => {
            if (!isValidKlineField(kline[field])) {
                throw new Error(`Invalid ${field} value in kline at position ${i}: ${kline[field]}`);
            }
        });
    });

    return true;
}

function isValidKlineField(value) {
    return value !== undefined && 
           value !== null && 
           !isNaN(value) && 
           isFinite(value);
}

export function validateFeatures(features, lookback) {
    if (!Array.isArray(features) || features.length === 0) {
        throw new Error('No features generated');
    }

    features.forEach((window, i) => {
        if (!Array.isArray(window) || window.length !== lookback) {
            throw new Error(`Invalid window at position ${i}: expected length ${lookback}, got ${window?.length}`);
        }
    });

    return true;
}
