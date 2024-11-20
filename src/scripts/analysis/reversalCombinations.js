import { ANALYSIS_CONFIG } from './config.js';
import { detectReversalPoints } from './detector.js';
import { CacheStorage } from '../../utils/cache/storage.js';
import { klineCache } from '../../utils/cache/cache.js';
import { calculateMACD, calculateBollingerBands, calculateMomentum, calculateROC } from '../../utils/data/indicators.js';
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
            }
        };
    } catch (error) {
        console.warn(`Warning: Error calculating indicators at index ${index}:`, error.message);
        return null;
    }
}

/**
 * Analyze indicator combinations at reversal points
 */
function analyzeIndicatorCombinations(reversals, klines) {
    const combinations = {
        upward: new Map(),
        downward: new Map()
    };

    reversals.forEach(reversal => {
        const indicators = calculateIndicators(klines, reversal.index);
        if (!indicators) return;

        const type = reversal.type;
        const key = generateCombinationKey(indicators);
        
        if (!combinations[type].has(key)) {
            combinations[type].set(key, {
                total: 0,
                effective: 0,
                indicators: {
                    adx: indicators.trend.adx,
                    macd: indicators.trend.macd.histogram,
                    stochRSI: indicators.trend.stochRSI,
                    momentum: indicators.momentum.momentum,
                    roc: indicators.momentum.roc,
                    atr: indicators.volatility.atr,
                    bbandsB: indicators.volatility.bollingerBands.percentB,
                    cmf: indicators.volume.cmf,
                    obv: indicators.momentum.obv
                }
            });
        }

        const stats = combinations[type].get(key);
        stats.total++;
        if (reversal.effective) {
            stats.effective++;
        }
    });

    return combinations;
}

/**
 * Generate a key for indicator combination based on their ranges
 */
function generateCombinationKey(indicators) {
    return [
        `ADX:${Math.floor(indicators.trend.adx / 10) * 10}`,
        `MACD:${indicators.trend.macd.histogram > 0 ? 'pos' : 'neg'}`,
        `StochRSI:${Math.floor(indicators.trend.stochRSI / 10) * 10}`,
        `MOM:${Math.floor(normalizeValue(indicators.momentum.momentum) / 10) * 10}`,
        `ROC:${Math.floor(normalizeValue(indicators.momentum.roc) / 10) * 10}`,
        `ATR:${Math.floor(normalizeValue(indicators.volatility.atr) / 10) * 10}`,
        `BBB:${Math.floor(indicators.volatility.bollingerBands.percentB / 10) * 10}`,
        `CMF:${indicators.volume.cmf > 0 ? 'pos' : 'neg'}`,
        `OBV:${indicators.momentum.obv > 0 ? 'pos' : 'neg'}`
    ].join('|');
}

/**
 * Normalize indicator values to 0-100 range
 */
function normalizeValue(value) {
    return Math.min(Math.max((value + 3) / 6 * 100, 0), 100);
}

/**
 * Find most effective indicator combinations
 */
function findEffectiveCombinations(combinations, minSamples = 5, minEffectiveness = 0.6) {
    const results = {
        upward: [],
        downward: []
    };

    ['upward', 'downward'].forEach(type => {
        for (const [key, stats] of combinations[type].entries()) {
            if (stats.total >= minSamples) {
                const effectiveness = stats.effective / stats.total;
                if (effectiveness >= minEffectiveness) {
                    results[type].push({
                        combination: key,
                        effectiveness: effectiveness,
                        total: stats.total,
                        effective: stats.effective,
                        indicators: stats.indicators
                    });
                }
            }
        }

        // Sort by effectiveness
        results[type].sort((a, b) => b.effectiveness - a.effectiveness);
    });

    return results;
}

/**
 * Format combination details for output
 */
function formatCombinationDetails(combination) {
    const parts = combination.split('|');
    return parts.map(part => {
        const [indicator, value] = part.split(':');
        return `${indicator}: ${value}`;
    }).join(', ');
}

/**
 * Main analysis function
 */
async function analyzeReversalCombinations(symbal="SOLUSDT") {
    try {
        // Load data
        const klines = await klineCache.update(symbal);
        if (!klines || klines.length === 0) {
            throw new Error('No cached data found');
        }

        console.log(`Analyzing ${klines.length} klines for reversal patterns...`);

        // Detect reversals
        const reversals = detectReversalPoints(klines);
        console.log(`Found ${reversals.length} reversal points`);

        // Analyze combinations
        const combinations = analyzeIndicatorCombinations(reversals, klines);
        const effectiveCombinations = findEffectiveCombinations(combinations);

        // Format results
        const results = {
            metadata: {
                totalKlines: klines.length,
                totalReversals: reversals.length,
                upwardReversals: reversals.filter(r => r.type === 'upward').length,
                downwardReversals: reversals.filter(r => r.type === 'downward').length
            },
            combinations: effectiveCombinations
        };

        if(results.combinations.upward.length == 0 && results.combinations.downward.length == 0) {
            console.log(`\nCombinations is empty! ${JSON.stringify(results)}`);
            return;
        }

        // Save results
        const fs = await import('fs');
        fs.writeFileSync(
            `models/reversal_combinations_${symbal}.json`,
            JSON.stringify(results, null, 2)
        );

        // Print summary
        console.log('\nMost Effective Indicator Combinations:');
        
        ['upward', 'downward'].forEach(type => {
            console.log(`\n${type.toUpperCase()} REVERSALS:`);
            effectiveCombinations[type].slice(0, 10).forEach((combo, i) => {
                console.log(`\n${i + 1}. Effectiveness: ${(combo.effectiveness * 100).toFixed(2)}% (${combo.effective}/${combo.total} samples)`);
                console.log(`   Indicators: ${formatCombinationDetails(combo.combination)}`);
            });
        });

    } catch (error) {
        console.error('Error during analysis:', error);
        process.exit(1);
    }
}

// Run analysis
if (process.argv[1].endsWith('reversalCombinations.js')) {
    const l3 = process.argv.length == 3;
    analyzeReversalCombinations(l3 ? `${process.argv[2]}USDT` : "SOLUSDT");
}
