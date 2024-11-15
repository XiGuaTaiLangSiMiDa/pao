export const DEFAULT_LOOKBACK = 30;  // Updated from 20 to 30
export const FEATURE_COUNT = 22;  // Updated to include ADX, ATR, and CMF

export const WindowConfig = {
    MIN_LOOKBACK: 10,
    MAX_LOOKBACK: 50,
    DEFAULT_LOOKBACK: 30  // Updated to match new default
};

export const FeatureIndices = {
    // Price pattern features
    BODY_SIZE: 0,
    UPPER_SHADOW: 1,
    LOWER_SHADOW: 2,
    TOTAL_RANGE: 3,
    PRICE_CHANGE: 4,
    VOLATILITY: 5,
    BODY_SHADOW_RATIO: 6,
    
    // Volume features
    VOLUME_CHANGE: 7,
    VOLUME_PRICE_RATIO: 8,
    
    // Technical indicators
    RSI: 9,
    STOCH_RSI_K: 10,
    STOCH_RSI_D: 11,
    OBV: 12,
    MACD: 13,
    MOMENTUM: 14,
    ROC: 15,
    BB_BANDWIDTH: 16,
    BB_PERCENT_B: 17,
    BB_DEVIATION: 18,
    
    // New indicators
    ADX: 19,          // Added Average Directional Index
    ATR: 20,          // Added Average True Range
    CMF: 21           // Added Chaikin Money Flow
};

export const ValidationLimits = {
    MIN_VALUE: -1,
    MAX_VALUE: 1,
    MIN_KLINES: 31,   // Updated: lookback + 1
    MAX_KLINES: 5000
};
