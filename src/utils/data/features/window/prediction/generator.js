import { calculateIndicators } from '../../base/indicators.js';
import { validateKlineData } from '../../../patterns.js';
import { WindowConfig } from '../base/types.js';
import { extractPrices, validateWindowSize } from '../base/utils.js';
import { processKlineWindow } from '../processor.js';
import { generateMetadata } from './metadata.js';

export function generatePredictionData(klines, lookback = WindowConfig.DEFAULT_LOOKBACK) {
    // Validate input data
    validateKlineData(klines, lookback);

    // Calculate indicators for the window
    const { closes, volumes } = extractPrices(klines);
    const indicators = calculateIndicators(closes, volumes);
    
    // Generate feature window for current k-bar
    const window = processKlineWindow(
        klines,
        indicators,
        klines.length - lookback,
        klines.length
    );

    // Validate window
    if (!validateWindowSize(window, lookback)) {
        throw new Error('Invalid prediction window generated');
    }

    // Get latest kline and generate metadata
    const latestKline = klines[klines.length - 1];
    if (!latestKline) {
        throw new Error('No latest kline data available');
    }

    // Get latest indicators
    const latestIndicators = {
        rsi: indicators.rsi[indicators.rsi.length - 1],
        stochRSI: {
            k: indicators.stochRSI.k[indicators.stochRSI.k.length - 1],
            d: indicators.stochRSI.d[indicators.stochRSI.d.length - 1]
        },
        obv: indicators.obv[indicators.obv.length - 1],
        macd: indicators.macd.histogram[indicators.macd.histogram.length - 1],
        momentum: indicators.momentum[indicators.momentum.length - 1],
        roc: indicators.roc[indicators.roc.length - 1],
        bBands: indicators.bBands[indicators.bBands.length - 1]
    };

    // Generate metadata with validation
    const metadata = generateMetadata(latestKline, latestIndicators);
    if (!metadata || !metadata.price || !metadata.indicators || !metadata.analysis) {
        throw new Error('Failed to generate valid metadata');
    }

    console.log('Generated metadata:', JSON.stringify(metadata, null, 2));

    return {
        features: [window],
        metadata
    };
}
