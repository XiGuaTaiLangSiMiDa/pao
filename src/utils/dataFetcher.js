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

// 计算波动率指标
function calculateVolatilityMetrics(kline) {
  const { high, low, open, close } = kline;
  
  // 高低波动率
  const highLowVolatility = ((high - low) / low) * 100;
  
  // 开盘收盘波动率
  const openCloseVolatility = Math.abs((close - open) / open) * 100;
  
  // 蜡烛实体比例
  const bodyToWickRatio = Math.abs(close - open) / (high - low);
  
  return {
    highLowVolatility,
    openCloseVolatility,
    bodyToWickRatio
  };
}

// 计算布林带指标
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const sma = prices.reduce((a, b) => a + b, 0) / period;
  const variance = prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    middle: sma,
    upper: sma + (stdDev * std),
    lower: sma - (stdDev * std),
    width: ((sma + (stdDev * std)) - (sma - (stdDev * std))) / sma * 100
  };
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

// 准备训练数据
export function prepareTrainingData(klines, lookback = 20) {
  const features = [];
  const returns = calculateFutureReturns(klines);
  
  for (let i = lookback; i < klines.length - 4; i++) {
    const window = klines.slice(i - lookback, i);
    const windowFeatures = [];
    
    // 为每个时间步提取特征
    for (let j = 0; j < window.length; j++) {
      const kline = window[j];
      const volatility = calculateVolatilityMetrics(kline);
      
      // 计算布林带 (使用前20个收盘价)
      const priceWindow = klines.slice(Math.max(0, i - lookback + j - 19), i - lookback + j + 1)
        .map(k => k.close);
      const bb = calculateBollingerBands(priceWindow);
      
      // 组合所有特征
      const timeStepFeatures = [
        kline.open,
        kline.high,
        kline.low,
        kline.close,
        kline.volume,
        kline.quoteVolume,
        kline.takerBuyBaseVolume,
        kline.takerBuyQuoteVolume,
        volatility.highLowVolatility,
        volatility.openCloseVolatility,
        volatility.bodyToWickRatio,
        bb.width
      ];
      
      windowFeatures.push(timeStepFeatures);
    }
    
    features.push(windowFeatures);
  }

  // 标准化特征
  const normalizedFeatures = features.map(window => {
    const transposed = Array(window[0].length).fill().map(() => []);
    
    // 转置数据以便按特征标准化
    for (let i = 0; i < window.length; i++) {
      for (let j = 0; j < window[i].length; j++) {
        transposed[j].push(window[i][j]);
      }
    }
    
    // 标准化每个特征
    const normalized = transposed.map(feature => {
      const mean = feature.reduce((a, b) => a + b, 0) / feature.length;
      const std = Math.sqrt(feature.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / feature.length) || 1;
      return feature.map(value => (value - mean) / std);
    });
    
    // 转置回原始形状
    const result = Array(window.length).fill().map(() => []);
    for (let i = 0; i < normalized.length; i++) {
      for (let j = 0; j < normalized[i].length; j++) {
        result[j].push(normalized[i][j]);
      }
    }
    
    return result;
  });

  return {
    features: normalizedFeatures,
    labels: returns.slice(lookback)
  };
}
