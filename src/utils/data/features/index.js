// Base components
export { 
    DEFAULT_LOOKBACK,
    FEATURE_COUNT,
    WindowConfig,
    FeatureIndices,
    ValidationLimits 
} from './window/base/types.js';

export {
    extractPrices,
    createEmptyWindow,
    validateWindowSize,
    clipValue,
    calculateWindowStats
} from './window/base/utils.js';

// Training components
export { 
    generateTrainingData 
} from './window/training/generator.js';

export {
    generateLabels,
    calculatePriceChange,
    denormalizeChange,
    validateLabels
} from './window/training/labels.js';

// Prediction components
export { 
    generatePredictionData 
} from './window/prediction/generator.js';

export { 
    generateMetadata 
} from './window/prediction/metadata.js';

// Processing components
export { 
    processKlineWindow 
} from './window/processor.js';

// Re-export base components
export { 
    calculateIndicators,
    getLatestIndicators 
} from './base/indicators.js';

export { 
    validateKlineData 
} from './base/validation.js';
