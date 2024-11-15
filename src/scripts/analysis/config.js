export const ANALYSIS_CONFIG = {
    // Reversal detection parameters
    REVERSAL_THRESHOLD: 0.01,
    LOOKBACK_PERIOD: 3,
    FORWARD_PERIOD: 5,
    
    // Indicator parameters
    TREND: {
        ADX_PERIOD: 14,
        MACD: {
            FAST_PERIOD: 12,
            SLOW_PERIOD: 26,
            SIGNAL_PERIOD: 9
        },
        RSI_PERIOD: 14,
        STOCH_RSI_PERIOD: 14
    },
    
    MOMENTUM: {
        MOMENTUM_PERIOD: 10,
        ROC_PERIOD: 10,
        OBV_PERIOD: 20
    },
    
    VOLATILITY: {
        ATR_PERIOD: 14,
        BBANDS: {
            PERIOD: 20,
            STD_DEV: 2
        }
    },
    
    VOLUME: {
        CMF_PERIOD: 20,
        OBV_SMOOTH_PERIOD: 10
    },
    
    // Output configuration
    OUTPUT_FILE: 'models/reversal_analysis.json',
    
    // Feature weights (optimized based on most effective ranges)
    FEATURE_WEIGHTS: {
        trend: {
            adx: 1.65,     // Best performance at range 80 (44.44% effective)
            macd: 1.11,    // Using higher of up/down weights (1.11 for downward)
            rsi: 1.0,      // Baseline weight as not in top performers
            stochRSI: 1.34 // Using higher of up/down weights (1.34 for downward at 30)
        },
        momentum: {
            momentum: 1.79, // Best at range 0 for downward (42.21% effective)
            roc: 1.79,     // Matching momentum as they show identical patterns
            obv: 1.07      // Best at positive for downward reversals
        },
        volatility: {
            atr: 2.42,     // Best at range 100 for downward (57.14% effective)
            bBands: 1.38   // Using higher of up/down weights (1.38 for upward at 100)
        },
        volume: {
            cmf: 1.04,     // Best at positive for downward reversals
            obv: 1.07      // Consistent with momentum OBV weight
        }
    }
};
