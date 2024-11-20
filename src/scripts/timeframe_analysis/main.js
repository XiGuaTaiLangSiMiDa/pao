import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { fileURLToPath } from 'url';
import { TimeframeAnalyzer } from './analyzer.js';
import { TIMEFRAMES } from './config.js';
import { klineCache } from '../../utils/cache/cache.js';
import { CacheStorage } from '../../utils/cache/storage.js';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Format analysis results
function formatResults(analyzer) {
  const results = {
    reversalStatistics: {},
    warningSequences: [],
    trendProbabilities: {}
  };

  // Calculate reversal statistics for each timeframe
  for (const [timeframe, reversals] of Object.entries(analyzer.reversalPoints)) {
    results.reversalStatistics[timeframe] = {
      total: reversals.length,
      bullish: reversals.filter(r => r.type === 'bullish').length,
      bearish: reversals.filter(r => r.type === 'bearish').length,
      averageStockRSI: reversals.length > 0 ?
        reversals.reduce((sum, r) => sum + r.stockRSI, 0) / reversals.length : 0,
      averageOBVDivergence: reversals.length > 0 ?
        reversals.reduce((sum, r) => sum + Math.abs(r.obvDivergence), 0) / reversals.length : 0,
      patterns: reversals.reduce((acc, r) => {
        if (r.pattern !== 'none') {
          acc[r.pattern] = (acc[r.pattern] || 0) + 1;
        }
        return acc;
      }, {})
    };
  }

  // Format warning sequences
  results.warningSequences = Object.entries(analyzer.warningSequences)
    .map(([timestamp, warnings]) => ({
      timestamp: parseInt(timestamp),
      date: moment(parseInt(timestamp)).format('YYYY-MM-DD HH:mm:ss'),
      sequence: warnings.sort((a, b) => {
        const timeA = TIMEFRAMES[a.timeframe];
        const timeB = TIMEFRAMES[b.timeframe];
        return timeA - timeB;
      }).map(w => ({
        timeframe: w.timeframe,
        type: w.type,
        pattern: w.pattern,
        indicators: {
          stockRSI: w.stockRSI,
          obvDivergence: w.obvDivergence,
          macdSignal: w.macdSignal
        },
        strength: w.strength,
        confidence: w.confidence,
        confirmationScore: w.confirmationScore,
        // 合约相关信息
        suggestedLeverage: w.suggestedLeverage,
        stopLoss: w.stopLoss,
        profitTarget: w.profitTarget,
        volatility: w.volatility
      }))
    }));

  // Calculate trend probabilities
  results.trendProbabilities = analyzer.calculateTrendProbabilities();

  return results;
}

// Save analysis results
function saveResults(results) {
  try {
    const outputPath = path.join(__dirname, '../../../models/timeframe_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Analysis results saved to ${outputPath}`);

    // Generate statistics summary
    const summary = generateSummary(results);
    const summaryPath = path.join(__dirname, '../../../models/timeframe_analysis_summary.txt');
    fs.writeFileSync(summaryPath, summary);
    console.log(`Analysis summary saved to ${summaryPath}`);
  } catch (error) {
    console.error('Error saving results:', error);
    throw error;
  }
}

// Generate readable summary
function generateSummary(results) {
  let summary = 'Timeframe Analysis Summary\n';
  summary += '========================\n\n';

  // Reversal Statistics
  summary += 'Reversal Statistics by Timeframe:\n';
  summary += '--------------------------------\n';
  for (const [timeframe, stats] of Object.entries(results.reversalStatistics)) {
    summary += `\n${timeframe}:\n`;
    summary += `  Total Reversals: ${stats.total}\n`;
    if (stats.total > 0) {
      summary += `  Bullish: ${stats.bullish} (${((stats.bullish / stats.total) * 100).toFixed(1)}%)\n`;
      summary += `  Bearish: ${stats.bearish} (${((stats.bearish / stats.total) * 100).toFixed(1)}%)\n`;
      summary += `  Avg Stock RSI: ${stats.averageStockRSI.toFixed(2)}\n`;
      summary += `  Avg OBV Divergence: ${stats.averageOBVDivergence.toFixed(2)}\n`;
      
      // Add pattern statistics if any
      if (Object.keys(stats.patterns).length > 0) {
        summary += '  Patterns:\n';
        for (const [pattern, count] of Object.entries(stats.patterns)) {
          summary += `    ${pattern}: ${count}\n`;
        }
      }
    }
  }

  // Warning Sequence Analysis
  summary += '\nWarning Sequence Analysis:\n';
  summary += '------------------------\n';
  const sequences = results.warningSequences;
  summary += `Total Sequences Found: ${sequences.length}\n`;

  if (sequences.length > 0) {
    // Most Common Patterns
    const patterns = sequences.map(s => s.sequence.map(w => `${w.timeframe}:${w.type}`).join(' -> '));
    const patternCounts = patterns.reduce((acc, pattern) => {
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {});

    summary += '\nMost Common Warning Sequences:\n';
    Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([pattern, count]) => {
        summary += `  ${pattern}: ${count} occurrences\n`;
      });

    // Recent Warning Sequences
    summary += '\nMost Recent Warning Sequences:\n';
    sequences
      .slice(-5)
      .forEach(s => {
        summary += `\n  ${s.date}:\n`;
        s.sequence.forEach(w => {
          summary += `    ${w.timeframe}: ${w.type} (RSI: ${w.indicators.stockRSI.toFixed(2)}, Confidence: ${(w.confidence * 100).toFixed(1)}%)\n`;
          if (w.suggestedLeverage) {
            summary += `      Leverage: ${w.suggestedLeverage}x, Stop Loss: ${w.stopLoss}, Target: ${w.profitTarget}\n`;
          }
        });
      });
  }

  // Future Trend Probabilities
  summary += '\nFuture Trend Probabilities:\n';
  summary += '-------------------------\n';
  for (const [timeframe, prob] of Object.entries(results.trendProbabilities)) {
    summary += `\n${timeframe}:\n`;
    summary += `  Direction: ${prob.direction}\n`;
    summary += `  Probability: ${prob.probability.toFixed(1)}%\n`;
    summary += `  Confidence: ${(prob.confidence * 100).toFixed(1)}%\n`;
    if (prob.recommendedLeverage) {
      summary += `  Recommended Leverage: ${prob.recommendedLeverage}x\n`;
      summary += `  Risk Level: ${prob.risk}\n`;
      summary += `  Volatility: ${(prob.volatility * 100).toFixed(1)}%\n`;
    }
  }

  return summary;
}

// Main execution
async function main() {
  console.log('Starting timeframe analysis...');

  try {
    console.log('Loading historical data...');
    const startTime = moment().subtract(9, 'year');
    const endTime = moment();
    
    // First fetch recent data
    await klineCache.update("SOLUSDT");
    
    // Then fetch historical data
    const kstorage = new CacheStorage();
    const klineData = await kstorage.getKlines("SOLUSDT");

    if (!klineData || klineData.length === 0) {
      throw new Error('No kline data available for analysis');
    }

    console.log(`Fetched ${klineData.length} klines`);
    console.log(`First kline timestamp: ${moment(klineData[0].openTime).format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`Last kline timestamp: ${moment(klineData[klineData.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')}`);

    // Validate kline data
    const validKlines = klineData.filter(k => 
      k && k.openTime && k.open && k.high && k.low && k.close && k.volume &&
      !isNaN(parseFloat(k.high)) && !isNaN(parseFloat(k.low)) && 
      !isNaN(parseFloat(k.close)) && !isNaN(parseFloat(k.volume))
    );

    if (validKlines.length < klineData.length) {
      console.log(`Filtered out ${klineData.length - validKlines.length} invalid klines`);
    }

    console.log('Initializing analyzer...');
    const analyzer = new TimeframeAnalyzer(validKlines);

    console.log('Calculating indicators...');
    analyzer.calculateIndicators();

    console.log('Detecting reversals...');
    analyzer.detectReversals();

    console.log('Analyzing warning sequences...');
    analyzer.analyzeWarningSequences();

    console.log('Formatting results...');
    const results = formatResults(analyzer);

    console.log('Saving analysis results...');
    saveResults(results);

    console.log('Analysis complete!');
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}

// Run analysis
main();
