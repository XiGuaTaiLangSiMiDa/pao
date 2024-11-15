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
                stochRSI: {
                    k: indicators.stochRSI.k[i],
                    d: indicators.stochRSI.d[i]
                },
                obv: indicators.obv[i],
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
            return new Array(19).fill(0);
        }
        
        const featureSet = normalizeFeatures(pricePatterns, volumePatterns, indicators);
        validateFeatureSet(featureSet, 0);
        
        return featureSet;
    } catch (error) {
        console.error('Error processing kline:', error);
        console.error('Input data:', { currentKline, previousKline, indicators });
        return new Array(19).fill(0);
    }
}

function normalizeFeatures(pricePatterns, volumePatterns, indicators) {
    // Ensure indicators exist with default values
    const safeIndicators = {
        rsi: indicators?.rsi ?? 50,
        stochRSI: {
            k: indicators?.stochRSI?.k ?? 50,
            d: indicators?.stochRSI?.d ?? 50
        },
        obv: indicators?.obv ?? 0,
        macd: indicators?.macd ?? 0,
        momentum: indicators?.momentum ?? 0,
        roc: indicators?.roc ?? 0,
        bBands: indicators?.bBands ?? { bandwidth: 0, percentB: 50, deviation: 0 }
    };

    return [
        // Price patterns - Allow negative values for directional features
        pricePatterns.bodySize || 0,                    // Can be negative for bearish candles
        pricePatterns.upperShadow || 0,                 // Always positive
        pricePatterns.lowerShadow || 0,                 // Always positive
        pricePatterns.totalRange || 0,                  // Always positive
        pricePatterns.priceChange || 0,                 // Can be negative for price drops
        Math.min(Math.max(pricePatterns.volatility || 0, 0), 1),  // Always positive, normalized 0-1
        pricePatterns.bodyToShadowRatio || 0,          // Can be negative for bearish candles
        
        // Volume patterns
        volumePatterns.volumeChange || 0,               // Can be negative for volume drops
        volumePatterns.volumePriceRatio || 0,          // Can be negative for inverse relationships
        
        // Technical indicators
        (safeIndicators.rsi - 50) / 50,                // Normalized to [-1, 1] centered at 0
        (safeIndicators.stochRSI.k - 50) / 50,         // Normalized to [-1, 1]
        (safeIndicators.stochRSI.d - 50) / 50,         // Normalized to [-1, 1]
        Math.log1p(Math.abs(safeIndicators.obv)) * Math.sign(safeIndicators.obv) / 20,  // Allows negative
        safeIndicators.macd / 100,                     // Allows negative
        safeIndicators.momentum / 100,                 // Allows negative
        safeIndicators.roc / 100,                      // Allows negative
        
        // Bollinger Bands features
        (safeIndicators.bBands?.bandwidth || 0) / 100,           // Normalized positive
        ((safeIndicators.bBands?.percentB || 50) - 50) / 50,    // Centered at 0, range [-1, 1]
        (safeIndicators.bBands?.deviation || 0) / 2              // Allows negative
    ].map(value => Math.min(Math.max(value, -1), 1));  // Final clipping to ensure [-1, 1] range
}
