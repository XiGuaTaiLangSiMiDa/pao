import { ANALYSIS_CONFIG } from './config.js';
import { calculateMACD, calculateBollingerBands, calculateMomentum, calculateROC } from '../../utils/data/indicators.js';
import { calculatePricePatterns, calculateVolumePatterns } from '../../utils/data/patterns.js';
import { calculateADX, calculateStochRSI, calculateOBV, calculateATR, calculateCMF } from './indicators.js';

/**
 * Calculate technical indicators for a specific point
 */
function calculateIndicators(klines, index) {
    try {
        const prices = klines.map(k => k.close);
        const highs = klines.map(k => k.high);
        const lows = klines.map(k => k.low);
        const volumes = klines.map(k => k.volume);
        
        // Trend Indicators
        const adx = calculateADX(highs.slice(0, index + 1), lows.slice(0, index + 1), 
            prices.slice(0, index + 1)).slice(-1)[0];
            
        const macd = calculateMACD(
            prices.slice(0, index + 1),
            ANALYSIS_CONFIG.TREND.MACD.FAST_PERIOD,
            ANALYSIS_CONFIG.TREND.MACD.SLOW_PERIOD,
            ANALYSIS_CONFIG.TREND.MACD.SIGNAL_PERIOD
        );
        
        const stochRSI = calculateStochRSI(prices.slice(0, index + 1), 
            ANALYSIS_CONFIG.TREND.STOCH_RSI_PERIOD).slice(-1)[0];
        
        // Momentum Indicators
        const momentum = calculateMomentum(prices.slice(0, index + 1), 
            ANALYSIS_CONFIG.MOMENTUM.MOMENTUM_PERIOD).slice(-1)[0];
            
        const roc = calculateROC(prices.slice(0, index + 1), 
            ANALYSIS_CONFIG.MOMENTUM.ROC_PERIOD).slice(-1)[0];
            
        const obv = calculateOBV(prices.slice(0, index + 1), 
            volumes.slice(0, index + 1)).slice(-1)[0];
        
        // Volatility Indicators
        const atr = calculateATR(highs.slice(0, index + 1), lows.slice(0, index + 1), 
            prices.slice(0, index + 1)).slice(-1)[0];
            
        const bb = calculateBollingerBands(
            prices.slice(0, index + 1),
            ANALYSIS_CONFIG.VOLATILITY.BBANDS.PERIOD,
            ANALYSIS_CONFIG.VOLATILITY.BBANDS.STD_DEV
        ).slice(-1)[0];
        
        // Volume Indicators
        const cmf = calculateCMF(highs.slice(0, index + 1), lows.slice(0, index + 1), 
            prices.slice(0, index + 1), volumes.slice(0, index + 1)).slice(-1)[0];
        
        // Calculate patterns
        const pricePatterns = calculatePricePatterns(klines[index], klines[index - 1]);
        const volumePatterns = calculateVolumePatterns(klines[index], klines[index - 1]);
        
        return {
            trend: {
                adx: adx || 0,
                macd: {
                    line: macd?.macdLine?.slice(-1)[0] || 0,
                    signal: macd?.signalLine?.slice(-1)[0] || 0,
                    histogram: macd?.histogram?.slice(-1)[0] || 0
                },
                stochRSI: stochRSI || 50
            },
            momentum: {
                momentum: momentum || 0,
                roc: roc || 0,
                obv: obv || 0
            },
            volatility: {
                atr: atr || 0,
                bollingerBands: bb || {
                    bandwidth: 0,
                    percentB: 50,
                    deviation: 0
                }
            },
            volume: {
                cmf: cmf || 0,
                obv: obv || 0
            },
            patterns: {
                price: pricePatterns,
                volume: volumePatterns
            }
        };
    } catch (error) {
        console.warn(`Warning: Error calculating indicators at index ${index}:`, error.message);
        return null;
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
                trend: {
                    adx: {},
                    macd: {},
                    stochRSI: {}
                },
                momentum: {
                    momentum: {},
                    roc: {},
                    obv: {}
                },
                volatility: {
                    atr: {},
                    bBands: {}
                },
                volume: {
                    cmf: {},
                    obv: {}
                }
            }
        },
        downward: { 
            total: 0, 
            effective: 0, 
            indicators: {
                trend: {
                    adx: {},
                    macd: {},
                    stochRSI: {}
                },
                momentum: {
                    momentum: {},
                    roc: {},
                    obv: {}
                },
                volatility: {
                    atr: {},
                    bBands: {}
                },
                volume: {
                    cmf: {},
                    obv: {}
                }
            }
        }
    };
}

/**
 * Update indicator statistics based on value ranges
 */
function updateIndicatorStats(stats, value, isEffective, type) {
    let range;
    
    switch(type) {
        case 'binary': // For MACD, OBV, CMF
            range = value > 0 ? 'positive' : 'negative';
            break;
            
        case 'percentage': // For RSI, StochRSI, BB percentB
            range = Math.floor(value / 10) * 10;
            if (range < 0) range = 0;
            if (range > 100) range = 100;
            break;
            
        case 'normalized': // For ATR, Momentum, ROC
            // Normalize to 0-100 range based on standard deviations
            const normalizedValue = Math.min(Math.max((value + 3) / 6 * 100, 0), 100);
            range = Math.floor(normalizedValue / 10) * 10;
            break;
            
        default:
            range = Math.floor(value / 10) * 10;
    }
    
    stats[range] = stats[range] || { total: 0, effective: 0 };
    stats[range].total++;
    if (isEffective) {
        stats[range].effective++;
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
        
        if (!indicators) return;
        
        // Update total counts
        analysis[type].total++;
        if (reversal.effective) {
            analysis[type].effective++;
        }
        
        // Analyze Trend indicators
        updateIndicatorStats(analysis[type].indicators.trend.adx, 
            indicators.trend.adx, reversal.effective, 'percentage');
        updateIndicatorStats(analysis[type].indicators.trend.macd, 
            indicators.trend.macd.histogram, reversal.effective, 'binary');
        updateIndicatorStats(analysis[type].indicators.trend.stochRSI, 
            indicators.trend.stochRSI, reversal.effective, 'percentage');
        
        // Analyze Momentum indicators
        updateIndicatorStats(analysis[type].indicators.momentum.momentum, 
            indicators.momentum.momentum, reversal.effective, 'normalized');
        updateIndicatorStats(analysis[type].indicators.momentum.roc, 
            indicators.momentum.roc, reversal.effective, 'normalized');
        updateIndicatorStats(analysis[type].indicators.momentum.obv, 
            indicators.momentum.obv, reversal.effective, 'binary');
        
        // Analyze Volatility indicators
        updateIndicatorStats(analysis[type].indicators.volatility.atr, 
            indicators.volatility.atr, reversal.effective, 'normalized');
        updateIndicatorStats(analysis[type].indicators.volatility.bBands, 
            indicators.volatility.bollingerBands.percentB, reversal.effective, 'percentage');
        
        // Analyze Volume indicators
        updateIndicatorStats(analysis[type].indicators.volume.cmf, 
            indicators.volume.cmf, reversal.effective, 'binary');
        updateIndicatorStats(analysis[type].indicators.volume.obv, 
            indicators.volume.obv, reversal.effective, 'binary');
    });
    
    return analysis;
}

/**
 * Calculate indicator weights based on effectiveness
 */
export function calculateWeights(analysis) {
    const weights = {
        upward: {
            trend: { adx: {}, macd: {}, stochRSI: {} },
            momentum: { momentum: {}, roc: {}, obv: {} },
            volatility: { atr: {}, bBands: {} },
            volume: { cmf: {}, obv: {} }
        },
        downward: {
            trend: { adx: {}, macd: {}, stochRSI: {} },
            momentum: { momentum: {}, roc: {}, obv: {} },
            volatility: { atr: {}, bBands: {} },
            volume: { cmf: {}, obv: {} }
        }
    };
    
    ['upward', 'downward'].forEach(type => {
        if (analysis[type].total === 0) return;
        
        const baseEffectiveness = analysis[type].effective / analysis[type].total;
        if (baseEffectiveness === 0) return;
        
        // Calculate weights for each indicator category
        Object.entries(analysis[type].indicators).forEach(([category, indicators]) => {
            Object.entries(indicators).forEach(([indicator, ranges]) => {
                Object.entries(ranges).forEach(([range, stats]) => {
                    if (stats.total === 0) return;
                    const effectiveness = stats.effective / stats.total;
                    weights[type][category][indicator][range] = effectiveness / baseEffectiveness;
                });
            });
        });
    });
    
    return weights;
}
