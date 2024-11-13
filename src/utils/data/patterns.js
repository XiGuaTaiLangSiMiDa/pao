// Calculate price patterns with safety checks
export function calculatePricePatterns(kline, prevKline) {
    if (!prevKline || !kline) return null;

    const { open, high, low, close } = kline;
    const prevClose = prevKline.close;
    
    if (!isValidNumber(open) || !isValidNumber(high) || 
        !isValidNumber(low) || !isValidNumber(close) || 
        !isValidNumber(prevClose)) {
        return null;
    }

    // Calculate normalized price movements
    const bodySize = open !== 0 ? Math.abs(close - open) / open : 0;
    const upperShadow = open !== 0 ? (high - Math.max(open, close)) / open : 0;
    const lowerShadow = open !== 0 ? (Math.min(open, close) - low) / open : 0;
    const totalRange = open !== 0 ? (high - low) / open : 0;
    
    // Calculate price momentum
    const priceChange = prevClose !== 0 ? (close - prevClose) / prevClose : 0;
    const gapUp = prevClose !== 0 ? (open - prevClose) / prevClose : 0;
    
    // Calculate volatility patterns
    const avgPrice = (high + low) / 2;
    const volatility = avgPrice !== 0 ? (high - low) / avgPrice : 0;
    const bodyToShadowRatio = totalRange !== 0 ? bodySize / totalRange : 0;
    
    return {
        bodySize: clipValue(bodySize),
        upperShadow: clipValue(upperShadow),
        lowerShadow: clipValue(lowerShadow),
        totalRange: clipValue(totalRange),
        priceChange: clipValue(priceChange),
        gapUp: clipValue(gapUp),
        volatility: clipValue(volatility),
        bodyToShadowRatio: clipValue(bodyToShadowRatio)
    };
}

// Calculate volume patterns with safety checks
export function calculateVolumePatterns(kline, prevKline) {
    if (!prevKline || !kline) return null;

    const { volume, close, open } = kline;
    const prevVolume = prevKline.volume;
    
    if (!isValidNumber(volume) || !isValidNumber(close) || 
        !isValidNumber(open) || !isValidNumber(prevVolume)) {
        return null;
    }

    // Volume momentum
    const volumeChange = prevVolume !== 0 ? (volume - prevVolume) / prevVolume : 0;
    
    // Price-volume relationship
    const volumePriceRatio = volume * Math.abs(close - open);
    const volumeTrend = volume * (close > open ? 1 : -1);
    
    return {
        volumeChange: clipValue(volumeChange),
        volumePriceRatio: clipValue(volumePriceRatio / (prevVolume || 1)),
        volumeTrend: clipValue(volumeTrend / (prevVolume || 1))
    };
}

// Validate feature set
export function validateFeatureSet(features, index) {
    if (!Array.isArray(features) || features.length !== 16) {
        throw new Error(`Invalid features at position ${index}: expected 16 features, got ${features?.length}`);
    }
    
    features.forEach((value, j) => {
        if (!isValidFeatureValue(value)) {
            console.error(`Invalid feature at position ${index},${j}:`, value);
            throw new Error(`Invalid feature value at position ${index},${j}: ${value}`);
        }
    });

    return true;
}

// Validate kline data
export function validateKlineData(klines, lookback) {
    if (!Array.isArray(klines) || klines.length < lookback + 1) {
        throw new Error(`Insufficient kline data: need at least ${lookback + 1} klines, got ${klines?.length}`);
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

function isValidFeatureValue(value) {
    return typeof value === 'number' && 
           isFinite(value) && 
           !isNaN(value) &&
           value >= -1 && 
           value <= 1;
}

function isValidKlineField(value) {
    return value !== undefined && 
           value !== null && 
           !isNaN(value) && 
           isFinite(value);
}

function isValidNumber(value) {
    return typeof value === 'number' && 
           !isNaN(value) && 
           isFinite(value);
}

function clipValue(value, min = -1, max = 1) {
    if (!isValidNumber(value)) return 0;
    return Math.min(Math.max(value, min), max);
}
