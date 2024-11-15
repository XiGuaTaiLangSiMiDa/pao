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

// Timeframe weights for trend confirmation
export const TIMEFRAME_WEIGHTS = {
  '15m': 0.05,  // 最短期，权重最小
  '30m': 0.10,
  '1h': 0.15,
  '2h': 0.15,
  '4h': 0.20,   // 中期时间框架权重最大
  '8h': 0.15,
  '12h': 0.10,
  '1d': 0.10
};

// Dynamic thresholds based on timeframe
export const getThresholds = (timeframe) => {
  const minutes = TIMEFRAMES[timeframe];
  const factor = Math.log10(minutes) / Math.log10(TIMEFRAMES['1M']);
  
  return {
    rsiOverbought: 60 + factor * 10,
    rsiOversold: 40 - factor * 10,
    volumeThreshold: 0.2 + factor * 0.3,
    priceSwingThreshold: 0.3 + factor * 0.7,
    // 合约相关阈值
    volatilityThreshold: 0.5 + factor * 1.5,  // 波动率阈值
    leverageRiskFactor: 1 + factor * 2,       // 杠杆风险因子
    momentumThreshold: 0.2 + factor * 0.3     // 动量阈值
  };
};
