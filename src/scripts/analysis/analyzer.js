import { ANALYSIS_CONFIG } from './config.js';
import { calculateRSI, calculateMACD, calculateBollingerBands } from '../../utils/data/indicators.js';
import { calculatePricePatterns, calculateVolumePatterns } from '../../utils/data/patterns.js';

/**
 * Calculate technical indicators for a specific point
 */
function calculateIndicators(klines, index) {
    const prices = klines.map(k => k.close);
    
    try {
        // Calculate RSI
        const rsi = calculateRSI(prices.slice(0, index + 1), ANALYSIS_CONFIG.RSI_PERIOD).slice(-1)[0];
        
        // Calculate MACD
        const macd = calculateMACD(
            prices.slice(0, index + 1),
            ANALYSIS_CONFIG.MACD_FAST_PERIOD,
            ANALYSIS_CONFIG.MACD_SLOW_PERIOD,
            ANALYSIS_CONFIG.MACD_SIGNAL_PERIOD
        );
        
        // Calculate Bollinger Bands
        const bb = calculateBollingerBands(
            prices.slice(0, index + 1),
            ANALYSIS_CONFIG.BB_PERIOD,
            ANALYSIS_CONFIG.BB_STD_DEV
        ).slice(-1)[0];
        
        // Calculate patterns
        const pricePatterns = calculatePricePatterns(klines[index], klines[index - 1]);
        const volumePatterns = calculateVolumePatterns(klines[index], klines[index - 1]);
        
        return {
            rsi: rsi || 50, // Default to neutral RSI if calculation fails
            macd: {
                line: macd?.macdLine?.slice(-1)[0] || 0,
                signal: macd?.signalLine?.slice(-1)[0] || 0,
                histogram: macd?.histogram?.slice(-1)[0] || 0
            },
            bollingerBands: bb || {
                bandwidth: 0,
                percentB: 50,
                deviation: 0
            },
            pricePatterns,
            volumePatterns
        };
    } catch (error) {
        console.warn(`Warning: Error calculating indicators at index ${index}:`, error.message);
        // Return default neutral values if calculation fails
        return {
            rsi: 50,
            macd: {
                line: 0,
                signal: 0,
                histogram: 0
            },
            bollingerBands: {
                bandwidth: 0,
                percentB: 50,
                deviation: 0
            },
            pricePatterns: null,
            volumePatterns: null
        };
    }
}

/**
 * Initialize analysis structure
 */
function initializeAnalysis() {
    return {
        upward: { 
            total: 0, 
            effective: 0, 
            indicators: { 
                rsi: {}, 
                macd: {}, 
                bb: {} 
            } 
        },
        downward: { 
            total: 0, 
            effective: 0, 
            indicators: { 
                rsi: {}, 
                macd: {}, 
                bb: {} 
            } 
        }
    };
}

/**
 * Update indicator statistics
 */
function updateIndicatorStats(stats, value, isEffective) {
    stats.total++;
    if (isEffective) {
        stats.effective++;
    }
}

/**
 * Analyze indicators at reversal points
 */
export function analyzeReversals(reversals, klines) {
    const analysis = initializeAnalysis();
    
    reversals.forEach(reversal => {
        const type = reversal.type;
        const indicators = calculateIndicators(klines, reversal.index);
        
        if (!indicators) return; // Skip if indicator calculation failed
        
        // Update total counts
        analysis[type].total++;
        if (reversal.effective) {
            analysis[type].effective++;
        }
        
        // Analyze RSI
        const rsiRange = Math.floor(indicators.rsi / 10) * 10;
        analysis[type].indicators.rsi[rsiRange] = analysis[type].indicators.rsi[rsiRange] || 
            { total: 0, effective: 0 };
        updateIndicatorStats(analysis[type].indicators.rsi[rsiRange], indicators.rsi, reversal.effective);
        
        // Analyze MACD
        const macdState = indicators.macd.histogram > 0 ? 'positive' : 'negative';
        analysis[type].indicators.macd[macdState] = analysis[type].indicators.macd[macdState] || 
            { total: 0, effective: 0 };
        updateIndicatorStats(analysis[type].indicators.macd[macdState], macdState, reversal.effective);
        
        // Analyze Bollinger Bands
        const bbState = indicators.bollingerBands.percentB > 50 ? 'above' : 'below';
        analysis[type].indicators.bb[bbState] = analysis[type].indicators.bb[bbState] || 
            { total: 0, effective: 0 };
        updateIndicatorStats(analysis[type].indicators.bb[bbState], bbState, reversal.effective);
    });
    
    return analysis;
}

/**
 * Calculate indicator weights based on effectiveness
 */
export function calculateWeights(analysis) {
    const weights = {
        upward: { rsi: {}, macd: {}, bb: {} },
        downward: { rsi: {}, macd: {}, bb: {} }
    };
    
    ['upward', 'downward'].forEach(type => {
        if (analysis[type].total === 0) return;
        
        const baseEffectiveness = analysis[type].effective / analysis[type].total;
        if (baseEffectiveness === 0) return; // Skip if no effective reversals
        
        // Calculate weights for each indicator
        Object.entries(analysis[type].indicators).forEach(([indicator, ranges]) => {
            Object.entries(ranges).forEach(([range, stats]) => {
                if (stats.total === 0) return; // Skip if no data points
                const effectiveness = stats.effective / stats.total;
                weights[type][indicator][range] = effectiveness / baseEffectiveness;
            });
        });
    });
    
    return weights;
}
