export const DEFAULT_LOOKBACK = 20;
export const FEATURE_COUNT = 19;  // Updated to include StochRSI K/D and OBV

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
    STOCH_RSI_K: 10,  // Added StochRSI K
    STOCH_RSI_D: 11,  // Added StochRSI D
    OBV: 12,          // Added OBV
    MACD: 13,
    MOMENTUM: 14,
    ROC: 15,
    BB_BANDWIDTH: 16,
    BB_PERCENT_B: 17,
    BB_DEVIATION: 18
};

export const ValidationLimits = {
    MIN_VALUE: -1,
    MAX_VALUE: 1,
    MIN_KLINES: 21, // lookback + 1
    MAX_KLINES: 5000
};
