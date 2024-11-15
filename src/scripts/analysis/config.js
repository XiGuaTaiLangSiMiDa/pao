export const ANALYSIS_CONFIG = {
    // Reversal detection parameters
    REVERSAL_THRESHOLD: 0.01, // 1% price change threshold
    LOOKBACK_PERIOD: 3,       // Number of candles to confirm reversal
    FORWARD_PERIOD: 5,        // Number of candles to evaluate effectiveness
    
    // Analysis parameters
    RSI_PERIOD: 14,
    MACD_FAST_PERIOD: 12,
    MACD_SLOW_PERIOD: 26,
    MACD_SIGNAL_PERIOD: 9,
    BB_PERIOD: 20,
    BB_STD_DEV: 2,
    
    // Output configuration
    OUTPUT_FILE: 'models/reversal_analysis.json'
};
