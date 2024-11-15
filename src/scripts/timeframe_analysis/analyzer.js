import { TIMEFRAMES } from './config.js';
import { TimeframeProcessor } from './timeframes.js';
import { SignalAnalyzer } from './signals.js';
import { ContractAnalyzer } from './contracts.js';
import { calculateStockRSI, calculateOBV, calculateMACD } from './indicators.js';

export class TimeframeAnalyzer {
  constructor(klines) {
    this.klines = klines;
    this.indicators = {};
    this.reversalPoints = {};
    this.warningSequences = {};
    this.crossTimeframeSignals = {};
  }

  calculateIndicators() {
    for (const [timeframe, minutes] of Object.entries(TIMEFRAMES)) {
      console.log(`Aggregating ${timeframe} klines...`);
      const timeframeData = TimeframeProcessor.aggregateKlines(this.klines, minutes);
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
      const macd = calculateMACD(closes);
      
      this.indicators[timeframe] = {
        stockRSI: calculateStockRSI(closes),
        obv: calculateOBV(closes, volumes),
        macd: macd,
        prices: closes,
        highs,
        lows,
        timestamps: timeframeData.map(k => k.openTime)
      };
    }
  }

  detectReversals() {
    // 首先检测各个时间维度的反转点
    for (const timeframe of Object.keys(TIMEFRAMES)) {
      if (!this.indicators[timeframe]) {
        console.log(`Skipping reversal detection for ${timeframe} - no indicators available`);
        continue;
      }
      
      const { stockRSI, obv, macd, prices, highs, lows, timestamps } = this.indicators[timeframe];
      if (!prices || prices.length < 2) {
        console.log(`Skipping reversal detection for ${timeframe} - insufficient price data`);
        continue;
      }
      
      console.log(`Detecting reversals for ${timeframe} (${prices.length} periods)...`);
      this.reversalPoints[timeframe] = SignalAnalyzer.findReversalPoints(
        timeframe, stockRSI, obv, macd, prices, highs, lows, timestamps
      );
      console.log(`Found ${this.reversalPoints[timeframe].length} reversals for ${timeframe}`);
    }

    // 然后进行跨时间维度信号确认
    this.crossTimeframeSignals = SignalAnalyzer.confirmCrossTimeframeSignals(this.reversalPoints);
  }

  analyzeWarningSequences() {
    const sequences = {};
    const contractSignals = ContractAnalyzer.calculateContractSignals(this.crossTimeframeSignals, this.indicators);
    
    // 处理跨时间维度确认的信号
    for (const [timeframe, signals] of Object.entries(this.crossTimeframeSignals)) {
      for (const signal of signals) {
        const timestamp = signal.timestamp;
        if (!sequences[timestamp]) {
          sequences[timestamp] = [];
        }
        
        const contractInfo = contractSignals[timeframe]?.find(s => s.timestamp === timestamp) || {};
        
        sequences[timestamp].push({
          timeframe,
          type: signal.type,
          stockRSI: signal.stockRSI,
          obvDivergence: signal.obvDivergence,
          macdSignal: signal.macdSignal,
          strength: signal.strength,
          pattern: signal.pattern,
          confidence: signal.adjustedConfidence,
          confirmationScore: signal.confirmationScore,
          // 合约相关信息
          suggestedLeverage: contractInfo.suggestedLeverage,
          stopLoss: contractInfo.stopLoss,
          profitTarget: contractInfo.profitTarget,
          volatility: contractInfo.volatility
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
    const contractSignals = ContractAnalyzer.calculateContractSignals(this.crossTimeframeSignals, this.indicators);

    for (const timeframe of futureTimeframes) {
      if (!this.indicators[timeframe]) {
        probabilities[timeframe] = {
          direction: 'neutral',
          probability: 0,
          confidence: 0,
          leverage: 0,
          risk: 'high'
        };
        continue;
      }
      
      const result = this.calculateTimeframeProbability(timeframe);
      const signals = contractSignals[timeframe] || [];
      const latestSignal = signals[signals.length - 1];
      
      probabilities[timeframe] = {
        ...result,
        recommendedLeverage: latestSignal?.suggestedLeverage || 0,
        stopLoss: latestSignal?.stopLoss || 0,
        profitTarget: latestSignal?.profitTarget || 0,
        volatility: latestSignal?.volatility || 0,
        risk: ContractAnalyzer.assessRiskLevel(result.probability, result.confidence, latestSignal?.volatility || 0)
      };
    }

    return probabilities;
  }

  calculateTimeframeProbability(timeframe) {
    const { stockRSI, obv, macd, prices, highs, lows } = this.indicators[timeframe];
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
    const shortTermTrend = TimeframeProcessor.calculateEnhancedTrend(prices.slice(-lookback.short));
    const mediumTermTrend = TimeframeProcessor.calculateEnhancedTrend(prices.slice(-lookback.medium));
    const longTermTrend = TimeframeProcessor.calculateEnhancedTrend(prices.slice(-lookback.long));

    // Momentum analysis
    const currentRSI = stockRSI[stockRSI.length - 1];
    const rsiTrend = TimeframeProcessor.calculateEnhancedTrend(stockRSI.slice(-lookback.medium));

    // Volume analysis
    const volumeTrend = TimeframeProcessor.calculateEnhancedTrend(obv.slice(-lookback.medium));

    // MACD analysis
    const macdTrend = TimeframeProcessor.calculateEnhancedTrend(macd.macdLine.slice(-lookback.medium));
    const recentHistogram = macd.histogram.slice(-lookback.short);
    const macdMomentum = Math.sign(recentHistogram[recentHistogram.length - 1]);

    // Weight different factors with dynamic adjustment
    const weights = {
      shortTerm: 0.25,
      mediumTerm: 0.20,
      longTerm: 0.15,
      rsi: Math.min(0.15 + Math.abs(currentRSI - 50) / 100 * 0.1, 0.20),
      volume: Math.min(0.1 + Math.abs(volumeTrend) * 0.1, 0.15),
      macd: 0.15
    };

    const trendScore = (
      shortTermTrend * weights.shortTerm +
      mediumTermTrend * weights.mediumTerm +
      longTermTrend * weights.longTerm +
      Math.sign(currentRSI - 50) * weights.rsi +
      Math.sign(volumeTrend) * weights.volume +
      (macdTrend + macdMomentum) * weights.macd
    );

    // Calculate confidence based on signal strength and consistency
    const trendConsistency = Math.abs(
      Math.sign(shortTermTrend) + 
      Math.sign(mediumTermTrend) + 
      Math.sign(longTermTrend) +
      Math.sign(macdTrend)
    ) / 4;

    const volatility = ContractAnalyzer.calculateVolatility(highs, lows, prices);
    const confidence = Math.min(1, (
      trendConsistency * 0.4 +
      Math.min(volatility, 1) * 0.3 +
      Math.abs(currentRSI - 50) / 50 * 0.3
    ));

    return {
      direction: Math.abs(trendScore) < 0.1 ? 'neutral' : (trendScore > 0 ? 'bullish' : 'bearish'),
      probability: Math.abs(trendScore) * 100,
      confidence
    };
  }
}
