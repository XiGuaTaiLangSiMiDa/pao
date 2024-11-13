export const DEFAULT_LOOKBACK = 20;
export const FEATURE_COUNT = 16;

export const WindowConfig = {
    MIN_LOOKBACK: 10,
    MAX_LOOKBACK: 50,
    DEFAULT_LOOKBACK: 20
};

export const FeatureIndices = {
    BODY_SIZE: 0,
    UPPER_SHADOW: 1,
    LOWER_SHADOW: 2,
    TOTAL_RANGE: 3,
    PRICE_CHANGE: 4,
    VOLATILITY: 5,
    BODY_SHADOW_RATIO: 6,
    VOLUME_CHANGE: 7,
    VOLUME_PRICE_RATIO: 8,
    RSI: 9,
    MACD: 10,
    MOMENTUM: 11,
    ROC: 12,
    BB_BANDWIDTH: 13,
    BB_PERCENT_B: 14,
    BB_DEVIATION: 15
};

export const ValidationLimits = {
    MIN_VALUE: -1,
    MAX_VALUE: 1,
    MIN_KLINES: 21, // lookback + 1
    MAX_KLINES: 5000
};
