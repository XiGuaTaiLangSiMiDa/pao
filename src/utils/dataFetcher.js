import axios from 'axios';
import moment from 'moment';

const BINANCE_API_BASE = 'https://fapi.binance.com/fapi/v1';

export async function fetchKlines({
  symbol = 'SOLUSDT',
  interval = '15m',
  limit = 1500,
  startTime = null,
  endTime = null
}) {
  try {
    const params = {
      symbol,
      interval,
      limit
    };

    if (startTime) {
      params.startTime = moment(startTime).valueOf();
    }
    if (endTime) {
      params.endTime = moment(endTime).valueOf();
    }

    const response = await axios.get(`${BINANCE_API_BASE}/klines`, { params });
    return response.data.map(kline => ({
      openTime: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      closeTime: kline[6],
      quoteVolume: parseFloat(kline[7]),
      trades: kline[8],
      takerBuyBaseVolume: parseFloat(kline[9]),
      takerBuyQuoteVolume: parseFloat(kline[10])
    }));
  } catch (error) {
    console.error('Error fetching klines:', error.message);
    throw error;
  }
}

// 计算未来1小时的价格变化百分比
export function calculateFutureReturns(klines, futureSteps = 4) { // 4个15分钟 = 1小时
  const returns = [];
  
  for (let i = 0; i < klines.length - futureSteps; i++) {
    const currentPrice = klines[i].close;
    const futurePrice = klines[i + futureSteps].close;
    const returnPercentage = ((futurePrice - currentPrice) / currentPrice) * 100;
    returns.push(returnPercentage);
  }
  
  return returns;
}

// 标准化数据
function normalizeFeatures(features) {
  const normalized = [];
  for (let i = 0; i < features.length; i++) {
    const window = features[i];
    const normalizedWindow = [];
    
    // 对每个特征进行标准化
    for (let j = 0; j < window.length; j++) {
      const feature = window[j];
      const mean = feature.reduce((a, b) => a + b, 0) / feature.length;
      const std = Math.sqrt(feature.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / feature.length);
      const normalizedFeature = feature.map(value => (value - mean) / (std || 1));
      normalizedWindow.push(normalizedFeature);
    }
    
    normalized.push(normalizedWindow);
  }
  return normalized;
}

// 准备训练数据
export function prepareTrainingData(klines, lookback = 20) {
  const features = [];
  const returns = calculateFutureReturns(klines);
  
  for (let i = lookback; i < klines.length - 4; i++) {
    const window = klines.slice(i - lookback, i);
    const windowFeatures = [
      window.map(k => k.open),
      window.map(k => k.high),
      window.map(k => k.low),
      window.map(k => k.close),
      window.map(k => k.volume),
      window.map(k => k.quoteVolume),
      window.map(k => k.takerBuyBaseVolume),
      window.map(k => k.takerBuyQuoteVolume)
    ];
    features.push(windowFeatures);
  }
  
  // 标准化特征
  const normalizedFeatures = normalizeFeatures(features);
  
  // 转换为正确的形状 [samples, timesteps, features]
  const reshapedFeatures = normalizedFeatures.map(window => {
    const timesteps = [];
    for (let t = 0; t < lookback; t++) {
      const timestep = [];
      for (let f = 0; f < 8; f++) {
        timestep.push(window[f][t]);
      }
      timesteps.push(timestep);
    }
    return timesteps;
  });

  return {
    features: reshapedFeatures,
    labels: returns.slice(lookback)
  };
}
