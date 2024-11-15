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
                bBands: indicators.bBands[i],
                adx: {
                    adx: indicators.adx?.adx?.[i],
                    plusDI: indicators.adx?.plusDI?.[i],
                    minusDI: indicators.adx?.minusDI?.[i]
                },
                atr: indicators.atr[i],
                cmf: indicators.cmf[i]
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
            return new Array(22).fill(0);
        }
        
        const featureSet = normalizeFeatures(pricePatterns, volumePatterns, indicators);
        validateFeatureSet(featureSet, 0);
        
        return featureSet;
    } catch (error) {
        console.error('Error processing kline:', error);
        console.error('Input data:', { currentKline, previousKline, indicators });
        return new Array(22).fill(0);
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
        bBands: indicators?.bBands ?? { bandwidth: 0, percentB: 50, deviation: 0 },
        adx: {
            adx: indicators?.adx?.adx ?? 25,
            plusDI: indicators?.adx?.plusDI ?? 20,
            minusDI: indicators?.adx?.minusDI ?? 20
        },
        atr: indicators?.atr ?? (pricePatterns.totalRange * 0.5), // Default to half the total range
        cmf: indicators?.cmf ?? 0
    };

    // Normalize features with safety checks
    const features = [
        // Price patterns
        pricePatterns.bodySize || 0,
        pricePatterns.upperShadow || 0,
        pricePatterns.lowerShadow || 0,
        pricePatterns.totalRange || 0,
        pricePatterns.priceChange || 0,
        Math.min(Math.max(pricePatterns.volatility || 0, 0), 1),
        pricePatterns.bodyToShadowRatio || 0,
        
        // Volume patterns
        volumePatterns.volumeChange || 0,
        volumePatterns.volumePriceRatio || 0,
        
        // Technical indicators
        (safeIndicators.rsi - 50) / 50,
        (safeIndicators.stochRSI.k - 50) / 50,
        (safeIndicators.stochRSI.d - 50) / 50,
        Math.log1p(Math.abs(safeIndicators.obv)) * Math.sign(safeIndicators.obv) / 20,
        safeIndicators.macd / Math.max(Math.abs(safeIndicators.macd), 0.01),
        safeIndicators.momentum / Math.max(Math.abs(safeIndicators.momentum), 0.01),
        safeIndicators.roc / Math.max(Math.abs(safeIndicators.roc), 0.01),
        
        // Bollinger Bands features
        Math.min(safeIndicators.bBands.bandwidth / 100, 1),
        ((safeIndicators.bBands.percentB || 50) - 50) / 50,
        safeIndicators.bBands.deviation / Math.max(Math.abs(safeIndicators.bBands.deviation), 0.01),
        
        // New indicators with safer normalization
        Math.min(safeIndicators.adx.adx / 100, 1),
        Math.min((safeIndicators.atr / (pricePatterns.totalRange || 1)) * 2 - 1, 1),
        Math.min(Math.max(safeIndicators.cmf, -1), 1)
    ];

    // Final safety check and clipping
    return features.map(value => {
        if (isNaN(value) || !isFinite(value)) {
            return 0;
        }
        return Math.min(Math.max(value, -1), 1);
    });
}
