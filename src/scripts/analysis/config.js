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
    
    // Feature weights (for reference)
    FEATURE_WEIGHTS: {
        trend: {
            adx: 1.2,
            macd: 1.1,
            rsi: 0.8,
            stochRSI: 0.8
        },
        momentum: {
            momentum: 1.0,
            roc: 1.0,
            obv: 1.0
        },
        volatility: {
            atr: 1.1,
            bBands: 1.0
        },
        volume: {
            cmf: 1.1,
            obv: 1.0
        }
    }
};
