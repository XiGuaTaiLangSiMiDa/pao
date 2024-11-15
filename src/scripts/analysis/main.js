import fs from 'fs';
import path from 'path';
import { ANALYSIS_CONFIG } from './config.js';
import { detectReversalPoints } from './detector.js';
import { analyzeReversals, calculateWeights } from './analyzer.js';
import { CacheStorage } from '../../utils/cache/storage.js';

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
 * Print analysis summary
 */
function printSummary(results) {
    console.log('\nAnalysis Summary:');
    console.log(`Total reversals analyzed: ${results.metadata.reversalPoints}`);
    console.log(`Upward reversals: ${results.metadata.upwardReversals} (${(results.metadata.upwardEffectiveness * 100).toFixed(2)}% effective)`);
    console.log(`Downward reversals: ${results.metadata.downwardReversals} (${(results.metadata.downwardEffectiveness * 100).toFixed(2)}% effective)`);
}

/**
 * Main analysis process
 */
async function main() {
    try {
        // Load cached data
        const storage = new CacheStorage();
        const klines = storage.getKlines('SOLUSDT');
        
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

main();
