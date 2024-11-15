import fs from 'fs';
import path from 'path';
import { ANALYSIS_CONFIG } from './config.js';
import { detectReversalPoints } from './detector.js';
import { analyzeReversals, calculateWeights } from './analyzer.js';
import { CacheStorage } from '../../utils/cache/storage.js';
import { klineCache } from '../../utils/cache/cache.js';

/**
 * Ensure output directory exists
 */
function ensureOutputDirectory() {
    const outputDir = path.dirname(ANALYSIS_CONFIG.OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
}

/**
 * Save analysis results to file
 */
function saveResults(results) {
    ensureOutputDirectory();
    fs.writeFileSync(
        ANALYSIS_CONFIG.OUTPUT_FILE,
        JSON.stringify(results, null, 2)
    );
}

/**
 * Calculate effectiveness for a range
 */
function calculateEffectiveness(stats) {
    return stats.total > 0 ? (stats.effective / stats.total * 100).toFixed(2) : '0.00';
}

/**
 * Print indicator range analysis
 */
function printIndicatorAnalysis(name, ranges, baseEffectiveness) {
    console.log(`    ${name}:`);
    Object.entries(ranges).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([range, stats]) => {
        const effectiveness = calculateEffectiveness(stats);
        const weight = (stats.effective / stats.total) / baseEffectiveness;
        const weightStr = weight ? weight.toFixed(2) : '0.00';
        console.log(`      ${range.padStart(3)}: ${effectiveness}% effective (${stats.effective}/${stats.total}) [weight: ${weightStr}]`);
    });
}

/**
 * Print analysis summary
 */
function printSummary(results) {
    console.log('\nAnalysis Summary:');
    console.log(`Total reversals analyzed: ${results.metadata.reversalPoints}`);
    console.log(`Upward reversals: ${results.metadata.upwardReversals} (${(results.metadata.upwardEffectiveness * 100).toFixed(2)}% effective)`);
    console.log(`Downward reversals: ${results.metadata.downwardReversals} (${(results.metadata.downwardEffectiveness * 100).toFixed(2)}% effective)`);
    
    ['upward', 'downward'].forEach(type => {
        const analysis = results.analysis[type];
        const baseEffectiveness = analysis.effective / analysis.total;
        
        console.log(`\n${type.toUpperCase()} REVERSAL ANALYSIS:`);
        
        // Trend Indicators
        console.log('\n  Trend Indicators:');
        printIndicatorAnalysis('ADX', analysis.indicators.trend.adx, baseEffectiveness);
        printIndicatorAnalysis('MACD', analysis.indicators.trend.macd, baseEffectiveness);
        printIndicatorAnalysis('StochRSI', analysis.indicators.trend.stochRSI, baseEffectiveness);
        
        // Momentum Indicators
        console.log('\n  Momentum Indicators:');
        printIndicatorAnalysis('Momentum', analysis.indicators.momentum.momentum, baseEffectiveness);
        printIndicatorAnalysis('ROC', analysis.indicators.momentum.roc, baseEffectiveness);
        printIndicatorAnalysis('OBV', analysis.indicators.momentum.obv, baseEffectiveness);
        
        // Volatility Indicators
        console.log('\n  Volatility Indicators:');
        printIndicatorAnalysis('ATR', analysis.indicators.volatility.atr, baseEffectiveness);
        printIndicatorAnalysis('Bollinger Bands', analysis.indicators.volatility.bBands, baseEffectiveness);
        
        // Volume Indicators
        console.log('\n  Volume Indicators:');
        printIndicatorAnalysis('CMF', analysis.indicators.volume.cmf, baseEffectiveness);
        printIndicatorAnalysis('OBV', analysis.indicators.volume.obv, baseEffectiveness);
    });
    
    // Print most effective ranges for each indicator
    console.log('\nMOST EFFECTIVE RANGES:');
    ['upward', 'downward'].forEach(type => {
        console.log(`\n${type.toUpperCase()} REVERSALS:`);
        const weights = results.weights[type];
        
        Object.entries(weights).forEach(([category, indicators]) => {
            console.log(`\n  ${category.toUpperCase()}:`);
            Object.entries(indicators).forEach(([indicator, ranges]) => {
                const bestRange = Object.entries(ranges)
                    .reduce((best, [range, weight]) => 
                        weight > (best.weight || 0) ? {range, weight} : best, {});
                console.log(`    ${indicator}: Best at ${bestRange.range} (weight: ${bestRange.weight.toFixed(2)})`);
            });
        });
    });
}

/**
 * Main analysis process
 */
async function main() {
    try {
        // Load cached data
        const storage = new CacheStorage();
        //const klines = storage.getKlines('SOLUSDT');
        const klines = await klineCache.update("SOLUSDT");
        
        if (!klines || klines.length === 0) {
            throw new Error('No cached data found');
        }
        
        console.log(`Analyzing ${klines.length} klines...`);
        
        // Detect reversal points
        const reversals = detectReversalPoints(klines);
        console.log(`Found ${reversals.length} reversal points`);
        
        if (reversals.length === 0) {
            console.log('No reversal points found with current criteria. Try adjusting thresholds.');
            process.exit(0);
        }
        
        // Analyze indicators at reversal points
        const analysis = analyzeReversals(reversals, klines);
        
        // Calculate weights
        const weights = calculateWeights(analysis);
        
        // Prepare results
        const results = {
            analysis,
            weights,
            metadata: {
                totalKlines: klines.length,
                reversalPoints: reversals.length,
                upwardReversals: analysis.upward.total,
                downwardReversals: analysis.downward.total,
                upwardEffectiveness: analysis.upward.effective / analysis.upward.total,
                downwardEffectiveness: analysis.downward.effective / analysis.downward.total,
                parameters: ANALYSIS_CONFIG
            }
        };
        
        // Save and display results
        saveResults(results);
        console.log(`Analysis complete. Results saved to ${ANALYSIS_CONFIG.OUTPUT_FILE}`);
        printSummary(results);
        
    } catch (error) {
        console.error('Error during analysis:', error);
        process.exit(1);
    }
}

// Run analysis
main();
