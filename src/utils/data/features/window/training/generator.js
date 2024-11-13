import { calculateIndicators } from '../../base/indicators.js';
import { validateKlineData } from '../../../patterns.js';
import { WindowConfig } from '../base/types.js';
import { extractPrices, validateWindowSize } from '../base/utils.js';
import { processKlineWindow } from '../processor.js';
import { generateLabels, validateLabels } from './labels.js';

export function generateTrainingData(klines, lookback = WindowConfig.DEFAULT_LOOKBACK) {
    // Validate input data
    validateKlineData(klines, lookback);

    // Calculate indicators once for all windows
    const { closes } = extractPrices(klines);
    const indicators = calculateIndicators(closes);
    
    // Generate feature windows
    const features = generateFeatureWindows(klines, indicators, lookback);
    
    // Generate corresponding labels
    const labels = generateLabels(klines, lookback);
    
    // Validate outputs
    validateOutputs(features, labels, lookback);

    return { features, labels };
}

function generateFeatureWindows(klines, indicators, lookback) {
    const features = [];
    
    for (let i = lookback; i < klines.length; i++) {
        const window = processKlineWindow(
            klines,
            indicators,
            i - lookback,
            i
        );

        if (validateWindowSize(window, lookback)) {
            features.push(window);
        }
    }

    return features;
}

function validateOutputs(features, labels, lookback) {
    if (!Array.isArray(features) || features.length === 0) {
        throw new Error('No valid feature windows generated');
    }

    if (features.length !== labels.length) {
        throw new Error(`Feature/label mismatch: ${features.length} windows vs ${labels.length} labels`);
    }

    if (!validateLabels(labels)) {
        throw new Error('Invalid labels generated');
    }

    features.forEach((window, i) => {
        if (!validateWindowSize(window, lookback)) {
            throw new Error(`Invalid window at position ${i}`);
        }
    });
}
