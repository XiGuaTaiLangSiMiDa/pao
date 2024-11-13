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
    const { closes } = extractPrices(klines);
    const indicators = calculateIndicators(closes);
    
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

    return {
        features: [window],
        metadata: generateMetadata(klines[klines.length - 1], indicators)
    };
}
