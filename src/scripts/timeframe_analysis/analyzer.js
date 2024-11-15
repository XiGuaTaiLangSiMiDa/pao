import { calculateStockRSI, calculateOBV } from './indicators.js';

// Timeframe definitions in minutes
export const TIMEFRAMES = {
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '8h': 480,
  '12h': 720,
  '1d': 1440,
  '1w': 10080,
  '1M': 43200
};

export class TimeframeAnalyzer {
  constructor(klines) {
    this.klines = klines;
    this.indicators = {};
    this.reversalPoints = {};
    this.warningSequences = {};
  }

  calculateIndicators() {
    for (const [timeframe, minutes] of Object.entries(TIMEFRAMES)) {
      console.log(`Aggregating ${timeframe} klines...`);
      const timeframeData = this.aggregateKlines(minutes);
      console.log(`Got ${timeframeData.length} ${timeframe} klines`);
      
      if (timeframeData.length < 2) {
        console.log(`Skipping ${timeframe} due to insufficient data`);
        continue;
      }
      
      const closes = timeframeData.map(k => parseFloat(k.close));
      const volumes = timeframeData.map(k => parseFloat(k.volume));
      const highs = timeframeData.map(k => parseFloat(k.high));
      const lows = timeframeData.map(k => parseFloat(k.low));
      
      console.log(`Calculating indicators for ${timeframe}...`);
      this.indicators[timeframe] = {
        stockRSI: calculateStockRSI(closes),
        obv: calculateOBV(closes, volumes),
        prices: closes,
        highs,
        lows,
        timestamps: timeframeData.map(k => k.openTime)
      };
    }
  }

  aggregateKlines(minutes) {
    const msPerPeriod = minutes * 60 * 1000;
    const aggregated = new Map(); // Use Map to ensure unique periods
    
    // Sort klines by openTime
    const sortedKlines = [...this.klines].sort((a, b) => a.openTime - b.openTime);
    
    for (const kline of sortedKlines) {
      const timestamp = parseInt(kline.openTime);
      const periodStart = Math.floor(timestamp / msPerPeriod) * msPerPeriod;
      
      if (!aggregated.has(periodStart)) {
        aggregated.set(periodStart, {
          openTime: periodStart,
          open: parseFloat(kline.open),
          high: parseFloat(kline.high),
          low: parseFloat(kline.low),
          close: parseFloat(kline.close),
          volume: parseFloat(kline.volume),
          closeTime: periodStart + msPerPeriod - 1,
          klines: [kline]
        });
      } else {
        const period = aggregated.get(periodStart);
        period.high = Math.max(period.high, parseFloat(kline.high));
        period.low = Math.min(period.low, parseFloat(kline.low));
        period.close = parseFloat(kline.close);
        period.volume += parseFloat(kline.volume);
        period.klines.push(kline);
      }
    }

    // Convert Map to array and sort by timestamp
    const result = Array.from(aggregated.values())
      .sort((a, b) => a.openTime - b.openTime)
      .filter(period => {
        // Ensure we have the expected number of klines for the period
        const expectedKlines = minutes / 15;
        const hasExpectedKlines = period.klines.length >= expectedKlines * 0.8; // Allow 20% missing
        if (!hasExpectedKlines) {
          console.log(`Filtering out incomplete period at ${new Date(period.openTime).toISOString()} (${period.klines.length}/${expectedKlines} klines)`);
        }
        return hasExpectedKlines;
      })
      .map(({ klines, ...period }) => period); // Remove klines array from final result

    return result;
  }

  detectReversals() {
    for (const timeframe of Object.keys(TIMEFRAMES)) {
      if (!this.indicators[timeframe]) {
        console.log(`Skipping reversal detection for ${timeframe} - no indicators available`);
        continue;
      }
      
      const { stockRSI, obv, prices, highs, lows, timestamps } = this.indicators[timeframe];
      if (!prices || prices.length < 2) {
        console.log(`Skipping reversal detection for ${timeframe} - insufficient price data`);
        continue;
      }
      
      console.log(`Detecting reversals for ${timeframe} (${prices.length} periods)...`);
      this.reversalPoints[timeframe] = this.findReversalPoints(stockRSI, obv, prices, highs, lows, timestamps);
      console.log(`Found ${this.reversalPoints[timeframe].length} reversals for ${timeframe}`);
    }
  }

  findReversalPoints(stockRSI, obv, prices, highs, lows, timestamps) {
    const reversals = [];
    const lookback = 10;
    const shortTerm = 5;
    const mediumTerm = 10;
    const longTerm = 20;

    // Ensure we have enough data
    if (prices.length < longTerm + 1) {
      return [];
    }

    for (let i = longTerm; i < prices.length - 1; i++) {
      // Price action analysis
      const priceSwing = (highs[i] - lows[i]) / prices[i] * 100;
      const recentPrices = prices.slice(i - shortTerm, i + 1);
      const priceDirection = Math.sign(recentPrices[recentPrices.length - 1] - recentPrices[0]);

      // RSI analysis
      const rsiValue = stockRSI[i];
      const isOverbought = rsiValue > 65; // Relaxed from 70
      const isOversold = rsiValue < 35;   // Relaxed from 30
      const rsiDirection = Math.sign(stockRSI[i] - stockRSI[i - shortTerm]);

      // Volume analysis
      const recentVolumes = obv.slice(i - shortTerm, i + 1);
      const volumeChange = (recentVolumes[recentVolumes.length - 1] - recentVolumes[0]) / Math.abs(recentVolumes[0]);
      const volumeSpike = volumeChange > 0.3; // Relaxed from 0.5

      // Trend analysis
      const shortTermTrend = this.calculateTrendStrength(prices.slice(i - shortTerm, i + 1));
      const mediumTermTrend = this.calculateTrendStrength(prices.slice(i - mediumTerm, i + 1));
      const longTermTrend = this.calculateTrendStrength(prices.slice(i - longTerm, i + 1));

      // Divergence analysis
      const priceTrend = this.calculateTrendStrength(prices.slice(i - mediumTerm, i + 1));
      const rsiTrend = this.calculateTrendStrength(stockRSI.slice(i - mediumTerm, i + 1));
      const hasDivergence = Math.sign(priceTrend) !== Math.sign(rsiTrend);

      // Enhanced pattern recognition
      const pricePattern = this.detectPricePattern(prices.slice(i - shortTerm, i + 1));
      const hasReversalPattern = pricePattern !== 'none';

      // Detect potential reversal conditions with more flexible criteria
      const isBullishReversal = (
        (isOversold || (rsiValue < 40 && hasDivergence)) &&
        (priceDirection > 0 || hasReversalPattern) &&
        (volumeSpike || volumeChange > 0.2) &&
        (shortTermTrend > -0.3) && // Relaxed condition
        priceSwing > 0.5 // Reduced from 1
      );

      const isBearishReversal = (
        (isOverbought || (rsiValue > 60 && hasDivergence)) &&
        (priceDirection < 0 || hasReversalPattern) &&
        (volumeSpike || volumeChange > 0.2) &&
        (shortTermTrend < 0.3) && // Relaxed condition
        priceSwing > 0.5
      );

      if (isBullishReversal || isBearishReversal) {
        const strength = Math.abs(priceSwing * volumeChange) * (hasReversalPattern ? 1.2 : 1.0);
        reversals.push({
          index: i,
          timestamp: timestamps[i],
          type: isBullishReversal ? 'bullish' : 'bearish',
          stockRSI: rsiValue,
          obvDivergence: volumeChange,
          strength: strength,
          pattern: pricePattern,
          confidence: this.calculateSignalConfidence(
            rsiValue,
            volumeSpike,
            hasDivergence,
            priceSwing,
            Math.abs(shortTermTrend - longTermTrend),
            hasReversalPattern
          )
        });
      }
    }

    return reversals;
  }

  detectPricePattern(prices) {
    if (prices.length < 5) return 'none';
    
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    
    // Detect hammer/shooting star
    const lastReturn = returns[returns.length - 1];
    const prevReturns = returns.slice(0, -1);
    const avgPrevReturn = prevReturns.reduce((a, b) => a + b, 0) / prevReturns.length;
    
    if (Math.abs(lastReturn) > Math.abs(avgPrevReturn) * 2) {
      return lastReturn > 0 ? 'hammer' : 'shooting_star';
    }
    
    // Detect double bottom/top
    const peaks = this.findPeaksTroughs(prices);
    if (peaks.bottoms.length >= 2 && Math.abs(peaks.bottoms[0] - peaks.bottoms[1]) < 0.01) {
      return 'double_bottom';
    }
    if (peaks.tops.length >= 2 && Math.abs(peaks.tops[0] - peaks.tops[1]) < 0.01) {
      return 'double_top';
    }
    
    return 'none';
  }

  findPeaksTroughs(prices) {
    const tops = [];
    const bottoms = [];
    
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i+1]) {
        tops.push(prices[i]);
      }
      if (prices[i] < prices[i-1] && prices[i] < prices[i+1]) {
        bottoms.push(prices[i]);
      }
    }
    
    return { tops, bottoms };
  }

  calculateSignalConfidence(rsi, volumeSpike, hasDivergence, priceSwing, trendDiff, hasPattern) {
    let confidence = 0;
    
    // RSI extremes increase confidence
    confidence += Math.min(100, Math.abs(rsi - 50)) / 100 * 0.25;
    
    // Volume spike increases confidence
    if (volumeSpike) confidence += 0.15;
    
    // Divergence increases confidence
    if (hasDivergence) confidence += 0.15;
    
    // Price swing impact
    confidence += Math.min(priceSwing / 8, 0.2);
    
    // Trend difference impact
    confidence += Math.min(trendDiff, 0.15);
    
    // Pattern recognition bonus
    if (hasPattern) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  analyzeWarningSequences() {
    const sequences = {};
    
    for (const [timeframe, reversals] of Object.entries(this.reversalPoints)) {
      for (const reversal of reversals) {
        const timestamp = reversal.timestamp;
        if (!sequences[timestamp]) {
          sequences[timestamp] = [];
        }
        sequences[timestamp].push({
          timeframe,
          type: reversal.type,
          stockRSI: reversal.stockRSI,
          obvDivergence: reversal.obvDivergence,
          strength: reversal.strength,
          pattern: reversal.pattern,
          confidence: reversal.confidence
        });
      }
    }

    this.warningSequences = Object.entries(sequences)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }

  calculateTrendProbabilities() {
    const probabilities = {};
    const futureTimeframes = ['15m', '30m', '1h', '4h', '8h', '1d'];

    for (const timeframe of futureTimeframes) {
      if (!this.indicators[timeframe]) {
        probabilities[timeframe] = {
          direction: 'neutral',
          probability: 0,
          confidence: 0
        };
        continue;
      }
      probabilities[timeframe] = this.calculateTimeframeProbability(timeframe);
    }

    return probabilities;
  }

  calculateTimeframeProbability(timeframe) {
    const { stockRSI, obv, prices, highs, lows } = this.indicators[timeframe];
    const lookback = {
      short: 5,
      medium: 10,
      long: 20
    };

    if (prices.length < lookback.long) {
      return {
        direction: 'neutral',
        probability: 0,
        confidence: 0
      };
    }

    // Enhanced trend analysis
    const shortTermTrend = this.calculateEnhancedTrend(prices.slice(-lookback.short));
    const mediumTermTrend = this.calculateEnhancedTrend(prices.slice(-lookback.medium));
    const longTermTrend = this.calculateEnhancedTrend(prices.slice(-lookback.long));

    // Momentum analysis
    const currentRSI = stockRSI[stockRSI.length - 1];
    const rsiTrend = this.calculateEnhancedTrend(stockRSI.slice(-lookback.medium));

    // Volume analysis
    const volumeTrend = this.calculateEnhancedTrend(obv.slice(-lookback.medium));

    // Volatility analysis
    const recentSwings = highs.slice(-lookback.medium).map((high, i) => 
      (high - lows.slice(-lookback.medium)[i]) / prices.slice(-lookback.medium)[i] * 100
    );
    const averageSwing = recentSwings.reduce((sum, swing) => sum + swing, 0) / recentSwings.length;

    // Weight different factors with dynamic adjustment
    const weights = {
      shortTerm: 0.35,
      mediumTerm: 0.25,
      longTerm: 0.15,
      rsi: Math.min(0.15 + Math.abs(currentRSI - 50) / 100 * 0.1, 0.25),
      volume: Math.min(0.1 + Math.abs(volumeTrend) * 0.1, 0.2)
    };

    const trendScore = (
      shortTermTrend * weights.shortTerm +
      mediumTermTrend * weights.mediumTerm +
      longTermTrend * weights.longTerm +
      Math.sign(currentRSI - 50) * weights.rsi +
      Math.sign(volumeTrend) * weights.volume
    );

    // Calculate confidence based on signal strength and consistency
    const trendConsistency = Math.abs(
      Math.sign(shortTermTrend) + 
      Math.sign(mediumTermTrend) + 
      Math.sign(longTermTrend)
    ) / 3;

    const confidence = Math.min(1, (
      trendConsistency * 0.4 +
      Math.min(averageSwing / 4, 1) * 0.3 +
      Math.abs(currentRSI - 50) / 50 * 0.3
    ));

    return {
      direction: Math.abs(trendScore) < 0.1 ? 'neutral' : (trendScore > 0 ? 'bullish' : 'bearish'),
      probability: Math.abs(trendScore) * 100,
      confidence
    };
  }

  calculateTrendStrength(values) {
    if (values.length < 2) return 0;
    
    let strength = 0;
    const changes = values.slice(1).map((v, i) => v - values[i]);
    
    // Weight recent changes more heavily
    changes.forEach((change, i) => {
      const weight = (i + 1) / changes.length;
      strength += Math.sign(change) * weight;
    });
    
    return strength / changes.length;
  }

  calculateEnhancedTrend(values) {
    if (values.length < 2) return 0;
    
    const returns = values.slice(1).map((v, i) => (v - values[i]) / values[i]);
    const weights = returns.map((_, i) => (i + 1) / returns.length);
    
    let trend = 0;
    let totalWeight = 0;
    
    returns.forEach((ret, i) => {
      trend += ret * weights[i];
      totalWeight += weights[i];
    });
    
    return trend / totalWeight;
  }
}
