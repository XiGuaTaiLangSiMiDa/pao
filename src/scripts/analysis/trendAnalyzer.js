import { ANALYSIS_CONFIG } from './config.js';
import { CacheStorage } from '../../utils/cache/storage.js';
import { klineCache } from '../../utils/cache/cache.js';
import { calculateMACD, calculateBollingerBands, calculateMomentum, calculateROC } from '../../utils/data/indicators.js';
import { calculateADX, calculateStochRSI, calculateOBV, calculateATR, calculateCMF } from './indicators.js';

/**
 * Calculate current indicator values
 */
async function calculateCurrentIndicators(klines) {
    const prices = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);
    
    // Calculate all indicators
    const adx = calculateADX(highs, lows, prices).slice(-1)[0];
    const macd = calculateMACD(
        prices,
        ANALYSIS_CONFIG.TREND.MACD.FAST_PERIOD,
        ANALYSIS_CONFIG.TREND.MACD.SLOW_PERIOD,
        ANALYSIS_CONFIG.TREND.MACD.SIGNAL_PERIOD
    );
    const stochRSI = calculateStochRSI(prices, ANALYSIS_CONFIG.TREND.STOCH_RSI_PERIOD).slice(-1)[0];
    const momentum = calculateMomentum(prices, ANALYSIS_CONFIG.MOMENTUM.MOMENTUM_PERIOD).slice(-1)[0];
    const roc = calculateROC(prices, ANALYSIS_CONFIG.MOMENTUM.ROC_PERIOD).slice(-1)[0];
    const obv = calculateOBV(prices, volumes).slice(-1)[0];
    const atr = calculateATR(highs, lows, prices).slice(-1)[0];
    const bb = calculateBollingerBands(
        prices,
        ANALYSIS_CONFIG.VOLATILITY.BBANDS.PERIOD,
        ANALYSIS_CONFIG.VOLATILITY.BBANDS.STD_DEV
    ).slice(-1)[0];
    const cmf = calculateCMF(highs, lows, prices, volumes).slice(-1)[0];

    return {
        adx,
        macd: macd?.histogram?.slice(-1)[0] || 0,
        stochRSI,
        momentum,
        roc,
        obv,
        atr,
        bbandsB: bb?.percentB || 50,
        cmf
    };
}

/**
 * Calculate similarity score between current conditions and pattern
 */
function calculatePatternSimilarity(current, pattern) {
    const scores = {
        adx: 1 - Math.min(Math.abs(current.adx - pattern.adx) / 50, 1),
        macd: (current.macd > 0) === (pattern.macd > 0) ? 1 : 0,
        stochRSI: 1 - Math.min(Math.abs(current.stochRSI - pattern.stochRSI) / 100, 1),
        momentum: 1 - Math.min(Math.abs(current.momentum - pattern.momentum) / 5, 1),
        roc: 1 - Math.min(Math.abs(current.roc - pattern.roc) / 5, 1),
        atr: 1 - Math.min(Math.abs(current.atr - pattern.atr) / 2, 1),
        bbandsB: 1 - Math.min(Math.abs(current.bbandsB - pattern.bbandsB) / 100, 1),
        cmf: (current.cmf > 0) === (pattern.cmf > 0) ? 1 : 0,
        obv: (current.obv > 0) === (pattern.obv > 0) ? 1 : 0
    };

    const weights = {
        adx: 1.5,
        macd: 1.5,
        stochRSI: 1.2,
        momentum: 1.0,
        roc: 1.0,
        atr: 1.0,
        bbandsB: 1.2,
        cmf: 1.3,
        obv: 1.3
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [indicator, score] of Object.entries(scores)) {
        const weight = weights[indicator];
        weightedSum += score * weight;
        totalWeight += weight;
    }

    return weightedSum / totalWeight;
}

/**
 * Analyze current market conditions
 */
export async function analyzeTrend() {
    try {
        // Load patterns
        const fs = await import('fs');
        const patterns = JSON.parse(
            fs.readFileSync('models/reversal_combinations.json', 'utf8')
        );

        // Get current market data
        const klines = await klineCache.update("SOLUSDT");
        if (!klines || klines.length === 0) {
            throw new Error('No market data available');
        }

        // Calculate current indicators
        const currentIndicators = await calculateCurrentIndicators(klines);
        
        // Compare with upward reversal pattern
        const upwardPattern = patterns.combinations.upward[0].indicators;
        const upwardSimilarity = calculatePatternSimilarity(currentIndicators, {
            adx: upwardPattern.adx,
            macd: upwardPattern.macd,
            stochRSI: upwardPattern.stochRSI,
            momentum: upwardPattern.momentum,
            roc: upwardPattern.roc,
            atr: upwardPattern.atr,
            bbandsB: upwardPattern.bbandsB,
            cmf: upwardPattern.cmf,
            obv: upwardPattern.obv
        });

        // Compare with downward reversal pattern
        const downwardPattern = patterns.combinations.downward[0].indicators;
        const downwardSimilarity = calculatePatternSimilarity(currentIndicators, {
            adx: downwardPattern.adx,
            macd: downwardPattern.macd,
            stochRSI: downwardPattern.stochRSI,
            momentum: downwardPattern.momentum,
            roc: downwardPattern.roc,
            atr: downwardPattern.atr,
            bbandsB: downwardPattern.bbandsB,
            cmf: downwardPattern.cmf,
            obv: downwardPattern.obv
        });

        // Calculate probabilities
        const upwardProbability = upwardSimilarity * patterns.combinations.upward[0].effectiveness;
        const downwardProbability = downwardSimilarity * patterns.combinations.downward[0].effectiveness;

        // Prepare analysis results
        return {
            timestamp: new Date().toISOString(),
            currentPrice: klines[klines.length - 1].close,
            indicators: currentIndicators,
            analysis: {
                upwardReversal: {
                    similarity: upwardSimilarity,
                    probability: upwardProbability,
                    baseAccuracy: patterns.combinations.upward[0].effectiveness
                },
                downwardReversal: {
                    similarity: downwardSimilarity,
                    probability: downwardProbability,
                    baseAccuracy: patterns.combinations.downward[0].effectiveness
                }
            }
        };

    } catch (error) {
        console.error('Error during analysis:', error);
        throw error;
    }
}

// Only run standalone analysis if script is run directly
if (process.argv[1].endsWith('trendAnalyzer.js')) {
    analyzeTrend().then(results => {
        console.log('\nCurrent Market Analysis:');
        console.log('=======================');
        console.log(`Current Price: ${results.currentPrice}`);
        
        console.log('\nIndicator Values:');
        console.log('----------------');
        Object.entries(results.indicators).forEach(([indicator, value]) => {
            console.log(`${indicator.toUpperCase()}: ${value.toFixed(4)}`);
        });
        
        console.log('\nReversal Probabilities:');
        console.log('----------------------');
        console.log(`Upward Reversal: ${(results.analysis.upwardReversal.probability * 100).toFixed(2)}%`);
        console.log(` - Pattern Similarity: ${(results.analysis.upwardReversal.similarity * 100).toFixed(2)}%`);
        console.log(` - Base Pattern Accuracy: ${(results.analysis.upwardReversal.baseAccuracy * 100).toFixed(2)}%`);
        
        console.log(`\nDownward Reversal: ${(results.analysis.downwardReversal.probability * 100).toFixed(2)}%`);
        console.log(` - Pattern Similarity: ${(results.analysis.downwardReversal.similarity * 100).toFixed(2)}%`);
        console.log(` - Base Pattern Accuracy: ${(results.analysis.downwardReversal.baseAccuracy * 100).toFixed(2)}%`);
    });
}
