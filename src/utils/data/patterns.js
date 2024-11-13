// Calculate price patterns with safety checks
export function calculatePricePatterns(kline, prevKline) {
    if (!prevKline) return null;

    const { open, high, low, close } = kline;
    const prevClose = prevKline.close;
    
    if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close) || !isFinite(prevClose)) {
        return null;
    }

    // Calculate normalized price movements
    const bodySize = Math.abs(close - open) / (open || 1);
    const upperShadow = (high - Math.max(open, close)) / (open || 1);
    const lowerShadow = (Math.min(open, close) - low) / (open || 1);
    const totalRange = (high - low) / (open || 1);
    
    // Calculate price momentum
    const priceChange = (close - prevClose) / (prevClose || 1);
    const gapUp = (open - prevClose) / (prevClose || 1);
    
    // Calculate volatility patterns
    const avgPrice = (high + low) / 2;
    const volatility = avgPrice !== 0 ? (high - low) / avgPrice : 0;
    const bodyToShadowRatio = totalRange !== 0 ? bodySize / totalRange : 0;
    
    return {
        bodySize,
        upperShadow,
        lowerShadow,
        totalRange,
        priceChange,
        gapUp,
        volatility,
        bodyToShadowRatio
    };
}

// Calculate volume patterns with safety checks
export function calculateVolumePatterns(kline, prevKline) {
    if (!prevKline) return null;

    const { volume, close, open } = kline;
    const prevVolume = prevKline.volume;
    
    if (!isFinite(volume) || !isFinite(close) || !isFinite(open) || !isFinite(prevVolume)) {
        return null;
    }

    // Volume momentum
    const volumeChange = prevVolume !== 0 ? (volume - prevVolume) / prevVolume : 0;
    
    // Price-volume relationship
    const volumePriceRatio = volume * Math.abs(close - open);
    const volumeTrend = volume * (close > open ? 1 : -1);
    
    return {
        volumeChange,
        volumePriceRatio,
        volumeTrend
    };
}

// Validate feature set
export function validateFeatureSet(features, index) {
    if (!Array.isArray(features) || features.length !== 16) {
        throw new Error(`Invalid features at position ${index}: expected 16 features, got ${features?.length}`);
    }
    
    features.forEach((value, j) => {
        if (!isValidFeatureValue(value)) {
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
           value >= -1 && 
           value <= 1;
}

function isValidKlineField(value) {
    return value !== undefined && 
           value !== null && 
           !isNaN(value) && 
           isFinite(value);
}
