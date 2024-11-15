import { TIMEFRAME_WEIGHTS, getThresholds } from './config.js';
import { TimeframeProcessor } from './timeframes.js';

export class SignalAnalyzer {
  static findReversalPoints(timeframe, stockRSI, obv, macd, prices, highs, lows, timestamps) {
    const reversals = [];
    const lookback = 10;
    const shortTerm = 5;
    const mediumTerm = 10;
    const longTerm = 20;

    // Get dynamic thresholds for this timeframe
    const thresholds = getThresholds(timeframe);

    // Ensure we have enough data
    if (prices.length < longTerm + 1) {
      return [];
    }

    for (let i = longTerm; i < prices.length - 1; i++) {
      const signal = this.analyzeSignalPoint(
        i, timeframe, stockRSI, obv, macd, prices, highs, lows, 
        timestamps, thresholds, shortTerm, mediumTerm, longTerm
      );

      if (signal) {
        reversals.push(signal);
      }
    }

    return reversals;
  }

  static analyzeSignalPoint(i, timeframe, stockRSI, obv, macd, prices, highs, lows, timestamps, thresholds, shortTerm, mediumTerm, longTerm) {
    // Price action analysis
    const priceSwing = (highs[i] - lows[i]) / prices[i] * 100;
    const recentPrices = prices.slice(i - shortTerm, i + 1);
    const priceDirection = Math.sign(recentPrices[recentPrices.length - 1] - recentPrices[0]);

    // RSI analysis
    const rsiValue = stockRSI[i];
    const isOverbought = rsiValue > thresholds.rsiOverbought;
    const isOversold = rsiValue < thresholds.rsiOversold;
    const rsiDirection = Math.sign(stockRSI[i] - stockRSI[i - shortTerm]);

    // Volume analysis
    const recentVolumes = obv.slice(i - shortTerm, i + 1);
    const volumeChange = (recentVolumes[recentVolumes.length - 1] - recentVolumes[0]) / Math.abs(recentVolumes[0]);
    const volumeSpike = volumeChange > thresholds.volumeThreshold;

    // MACD analysis
    const macdCrossover = Math.sign(macd.histogram[i]) !== Math.sign(macd.histogram[i - 1]);
    const macdDivergence = Math.sign(macd.macdLine[i] - macd.macdLine[i - 1]) !== Math.sign(prices[i] - prices[i - 1]);

    // Trend analysis
    const shortTermTrend = TimeframeProcessor.calculateTrendStrength(prices.slice(i - shortTerm, i + 1));
    const mediumTermTrend = TimeframeProcessor.calculateTrendStrength(prices.slice(i - mediumTerm, i + 1));
    const longTermTrend = TimeframeProcessor.calculateTrendStrength(prices.slice(i - longTerm, i + 1));

    // Divergence analysis
    const priceTrend = TimeframeProcessor.calculateTrendStrength(prices.slice(i - mediumTerm, i + 1));
    const rsiTrend = TimeframeProcessor.calculateTrendStrength(stockRSI.slice(i - mediumTerm, i + 1));
    const hasDivergence = Math.sign(priceTrend) !== Math.sign(rsiTrend);

    // Enhanced pattern recognition
    const pricePattern = TimeframeProcessor.detectPricePattern(prices.slice(i - shortTerm, i + 1));
    const hasReversalPattern = pricePattern !== 'none';

    // Detect potential reversal conditions with dynamic thresholds
    const isBullishReversal = (
      (isOversold || (rsiValue < thresholds.rsiOversold + 5 && hasDivergence)) &&
      (priceDirection > 0 || hasReversalPattern) &&
      (volumeSpike || volumeChange > thresholds.volumeThreshold * 0.8) &&
      (shortTermTrend > -0.3) &&
      (macdCrossover || macdDivergence) &&
      priceSwing > thresholds.priceSwingThreshold
    );

    const isBearishReversal = (
      (isOverbought || (rsiValue > thresholds.rsiOverbought - 5 && hasDivergence)) &&
      (priceDirection < 0 || hasReversalPattern) &&
      (volumeSpike || volumeChange > thresholds.volumeThreshold * 0.8) &&
      (shortTermTrend < 0.3) &&
      (macdCrossover || macdDivergence) &&
      priceSwing > thresholds.priceSwingThreshold
    );

    if (isBullishReversal || isBearishReversal) {
      const strength = Math.abs(priceSwing * volumeChange) * (hasReversalPattern ? 1.2 : 1.0);
      return {
        index: i,
        timestamp: timestamps[i],
        type: isBullishReversal ? 'bullish' : 'bearish',
        stockRSI: rsiValue,
        obvDivergence: volumeChange,
        macdSignal: macdCrossover ? 'crossover' : (macdDivergence ? 'divergence' : 'none'),
        strength: strength,
        pattern: pricePattern,
        confidence: this.calculateSignalConfidence(
          rsiValue,
          volumeSpike,
          hasDivergence,
          priceSwing,
          Math.abs(shortTermTrend - longTermTrend),
          hasReversalPattern,
          macdCrossover || macdDivergence
        )
      };
    }

    return null;
  }

  static calculateSignalConfidence(rsi, volumeSpike, hasDivergence, priceSwing, trendDiff, hasPattern, hasMacdSignal) {
    let confidence = 0;
    
    // RSI extremes increase confidence
    confidence += Math.min(100, Math.abs(rsi - 50)) / 100 * 0.2;
    
    // Volume spike increases confidence
    if (volumeSpike) confidence += 0.15;
    
    // Divergence increases confidence
    if (hasDivergence) confidence += 0.15;
    
    // Price swing impact
    confidence += Math.min(priceSwing / 8, 0.15);
    
    // Trend difference impact
    confidence += Math.min(trendDiff, 0.15);
    
    // Pattern recognition bonus
    if (hasPattern) confidence += 0.1;
    
    // MACD signal bonus
    if (hasMacdSignal) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  static confirmCrossTimeframeSignals(reversalPoints) {
    const crossTimeframeSignals = {};
    const timeframes = Object.keys(reversalPoints).sort((a, b) => TIMEFRAME_WEIGHTS[a] - TIMEFRAME_WEIGHTS[b]);
    
    for (const timeframe of timeframes) {
      if (!reversalPoints[timeframe]) continue;

      crossTimeframeSignals[timeframe] = [];

      for (const reversal of reversalPoints[timeframe]) {
        const timestamp = reversal.timestamp;
        const type = reversal.type;
        
        // 检查更大时间维度的确认
        let confirmationScore = 0;
        let totalWeight = 0;
        
        for (const higherTimeframe of timeframes) {
          if (TIMEFRAME_WEIGHTS[higherTimeframe] <= TIMEFRAME_WEIGHTS[timeframe]) continue;
          
          const weight = TIMEFRAME_WEIGHTS[higherTimeframe] || 0;
          totalWeight += weight;
          
          // 检查该时间维度是否有相同方向的信号
          const confirmedByHigherTimeframe = reversalPoints[higherTimeframe]?.some(r => 
            Math.abs(r.timestamp - timestamp) < parseInt(higherTimeframe) * 60 * 1000 &&
            r.type === type
          );
          
          if (confirmedByHigherTimeframe) {
            confirmationScore += weight;
          }
        }

        // 计算确认分数
        const normalizedScore = totalWeight > 0 ? confirmationScore / totalWeight : 0;
        
        if (normalizedScore > 0.3) { // 至少30%的更高时间维度确认
          crossTimeframeSignals[timeframe].push({
            ...reversal,
            confirmationScore: normalizedScore,
            adjustedConfidence: reversal.confidence * (1 + normalizedScore)
          });
        }
      }
    }

    return crossTimeframeSignals;
  }
}
