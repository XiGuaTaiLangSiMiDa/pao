import { TIMEFRAMES } from './config.js';

export class TimeframeProcessor {
  static aggregateKlines(klines, minutes) {
    const msPerPeriod = minutes * 60 * 1000;
    const aggregated = new Map(); // Use Map to ensure unique periods
    
    // Sort klines by openTime
    const sortedKlines = [...klines].sort((a, b) => a.openTime - b.openTime);
    
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

  static calculateTrendStrength(values) {
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

  static calculateEnhancedTrend(values) {
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

  static detectPricePattern(prices) {
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

  static findPeaksTroughs(prices) {
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
}
