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
        
        // Add debug logging
        console.log('Normalized features:', featureSet);
        console.log('Input indicators:', indicators);
        
        validateFeatureSet(featureSet, 0);
        
        return featureSet;
    } catch (error) {
        console.error('Error processing kline:', error);
        console.error('Input data:', { currentKline, previousKline, indicators });
        return new Array(16).fill(0);
    }
}

function normalizeFeatures(pricePatterns, volumePatterns, indicators) {
    // Ensure indicators exist with default values
    const safeIndicators = {
        rsi: indicators?.rsi ?? 50,
        macd: indicators?.macd ?? 0,
        momentum: indicators?.momentum ?? 0,
        roc: indicators?.roc ?? 0,
        bBands: indicators?.bBands ?? { bandwidth: 0, percentB: 50, deviation: 0 }
    };

    return [
        // Price patterns
        Math.min(Math.max(pricePatterns.bodySize || 0, -1), 1),
        Math.min(Math.max(pricePatterns.upperShadow || 0, -1), 1),
        Math.min(Math.max(pricePatterns.lowerShadow || 0, -1), 1),
        Math.min(Math.max(pricePatterns.totalRange || 0, -1), 1),
        Math.min(Math.max(pricePatterns.priceChange || 0, -1), 1),
        Math.min(Math.max(pricePatterns.volatility || 0, -1), 1),
        Math.min(Math.max(pricePatterns.bodyToShadowRatio || 0, -1), 1),
        
        // Volume patterns
        Math.min(Math.max(volumePatterns.volumeChange || 0, -1), 1),
        Math.min(Math.max(Math.log1p(Math.abs(volumePatterns.volumePriceRatio || 0)) * Math.sign(volumePatterns.volumePriceRatio || 0), -1), 1),
        
        // Technical indicators
        Math.min(Math.max((safeIndicators.rsi || 50) / 100, 0), 1),
        Math.min(Math.max((safeIndicators.macd || 0) / 100, -1), 1),
        Math.min(Math.max((safeIndicators.momentum || 0) / 100, -1), 1),
        Math.min(Math.max((safeIndicators.roc || 0) / 100, -1), 1),
        
        // Bollinger Bands features
        Math.min(Math.max(safeIndicators.bBands?.bandwidth || 0, 0), 1),
        Math.min(Math.max((safeIndicators.bBands?.percentB || 50) / 100, 0), 1),
        Math.min(Math.max(safeIndicators.bBands?.deviation || 0, -1), 1)
    ];
}
