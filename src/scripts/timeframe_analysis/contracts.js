import { getThresholds } from './config.js';

export class ContractAnalyzer {
  static calculateVolatility(highs, lows, prices, period = 20) {
    if (prices.length < period) return 0;
    
    const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // 年化波动率
  }

  static calculateATR(highs, lows, prices, period = 14) {
    if (prices.length < 2) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - prices[i-1]),
        Math.abs(lows[i] - prices[i-1])
      );
      trueRanges.push(tr);
    }
    
    // 计算ATR
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((period - 1) * atr + trueRanges[i]) / period;
    }
    
    return atr / prices[prices.length - 1]; // 返回百分比形式的ATR
  }

  static calculateContractSignals(crossTimeframeSignals, indicators) {
    const signals = {};
    
    for (const timeframe of Object.keys(crossTimeframeSignals)) {
      const confirmedSignals = crossTimeframeSignals[timeframe];
      if (!confirmedSignals.length) continue;

      const { prices, highs, lows } = indicators[timeframe];
      const volatility = this.calculateVolatility(highs, lows, prices);
      const thresholds = getThresholds(timeframe);

      signals[timeframe] = confirmedSignals.map(signal => {
        // 计算建议的杠杆倍数
        const baseLeverage = 3; // 基础杠杆倍数
        const volatilityFactor = Math.max(0.2, 1 - volatility / thresholds.volatilityThreshold);
        const confidenceFactor = signal.adjustedConfidence;
        const suggestedLeverage = Math.min(
          baseLeverage * volatilityFactor * confidenceFactor,
          10 // 最大杠杆限制
        );

        // 计算建议的止损位
        const atr = this.calculateATR(highs, lows, prices);
        const stopLoss = signal.type === 'bullish'
          ? prices[prices.length - 1] * (1 - atr * 2)
          : prices[prices.length - 1] * (1 + atr * 2);

        // 计算建议的止盈位
        const profitTarget = signal.type === 'bullish'
          ? prices[prices.length - 1] * (1 + atr * 3)
          : prices[prices.length - 1] * (1 - atr * 3);

        return {
          ...signal,
          suggestedLeverage: Math.round(suggestedLeverage * 10) / 10,
          stopLoss: Math.round(stopLoss * 100) / 100,
          profitTarget: Math.round(profitTarget * 100) / 100,
          riskReward: 3, // 风险收益比
          volatility: Math.round(volatility * 100) / 100,
          timeframe
        };
      });
    }

    return signals;
  }

  static assessRiskLevel(probability, confidence, volatility) {
    const riskScore = (
      (1 - confidence) * 0.4 +      // 低置信度增加风险
      (1 - probability/100) * 0.3 + // 低概率增加风险
      (volatility) * 0.3            // 高波动增加风险
    );
    
    if (riskScore > 0.7) return 'extreme';
    if (riskScore > 0.5) return 'high';
    if (riskScore > 0.3) return 'medium';
    return 'low';
  }
}
