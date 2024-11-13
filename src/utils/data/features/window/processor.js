import { 
    calculatePricePatterns, 
    calculateVolumePatterns,
    validateFeatureSet 
} from '../../patterns.js';

export function processKlineWindow(klines, indicators, startIndex, endIndex) {
    const window = [];
    
    for (let i = startIndex; i < endIndex; i++) {
        const featureSet = processKline(
            klines[i], 
            klines[i - 1], 
            {
                rsi: indicators.rsi[i],
                macd: indicators.macd.histogram[i],
                momentum: indicators.momentum[i],
                roc: indicators.roc[i],
                bBands: indicators.bBands[i]
            }
        );
        window.push(featureSet);
    }

    return window;
}

export function processKline(currentKline, previousKline, indicators) {
    try {
        const pricePatterns = calculatePricePatterns(currentKline, previousKline);
        const volumePatterns = calculateVolumePatterns(currentKline, previousKline);
        
        if (!pricePatterns || !volumePatterns) {
            return new Array(16).fill(0);
        }
        
        const featureSet = normalizeFeatures(pricePatterns, volumePatterns, indicators);
        validateFeatureSet(featureSet, 0);
        
        return featureSet;
    } catch (error) {
        console.error('Error processing kline:', error);
        return new Array(16).fill(0);
    }
}

function normalizeFeatures(pricePatterns, volumePatterns, indicators) {
    return [
        // Price patterns
        Math.min(Math.max(pricePatterns.bodySize, -1), 1),
        Math.min(Math.max(pricePatterns.upperShadow, -1), 1),
        Math.min(Math.max(pricePatterns.lowerShadow, -1), 1),
        Math.min(Math.max(pricePatterns.totalRange, -1), 1),
        Math.min(Math.max(pricePatterns.priceChange, -1), 1),
        Math.min(Math.max(pricePatterns.volatility, -1), 1),
        Math.min(Math.max(pricePatterns.bodyToShadowRatio, -1), 1),
        
        // Volume patterns
        Math.min(Math.max(volumePatterns.volumeChange, -1), 1),
        Math.min(Math.max(Math.log1p(Math.abs(volumePatterns.volumePriceRatio)) * Math.sign(volumePatterns.volumePriceRatio), -1), 1),
        
        // Technical indicators
        Math.min(Math.max(indicators.rsi / 100, 0), 1),
        Math.min(Math.max(indicators.macd / 100, -1), 1),
        Math.min(Math.max(indicators.momentum / 100, -1), 1),
        Math.min(Math.max(indicators.roc / 100, -1), 1),
        
        // Bollinger Bands features
        indicators.bBands ? Math.min(Math.max(indicators.bBands.bandwidth, 0), 1) : 0,
        indicators.bBands ? Math.min(Math.max(indicators.bBands.percentB / 100, 0), 1) : 0.5,
        indicators.bBands ? Math.min(Math.max(indicators.bBands.deviation, -1), 1) : 0
    ];
}
