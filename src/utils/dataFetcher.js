import axios from 'axios';
import moment from 'moment';

const BINANCE_API_BASE = 'https://fapi.binance.com/fapi/v1';

// Data validation function
function validateKlineData(kline) {
  const requiredFields = ['openTime', 'open', 'high', 'low', 'close', 'volume'];
  const isValid = requiredFields.every(field => {
    const value = kline[field];
    return value !== undefined && value !== null && !isNaN(value);
  });
  
  if (!isValid) {
    throw new Error('Invalid kline data: Missing or invalid required fields');
  }
  
  return true;
}

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
    
    // Add retry logic for API failures
    let retries = 3;
    while (retries > 0 && !response.data) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await axios.get(`${BINANCE_API_BASE}/klines`, { params });
      retries--;
    }

    if (!response.data) {
      throw new Error('Failed to fetch kline data after retries');
    }

    const klines = response.data.map(kline => ({
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

    // Validate each kline
    klines.forEach(validateKlineData);

    return klines;
  } catch (error) {
    console.error('Error fetching klines:', error.message);
    throw error;
  }
}

// Calculate RSI
function calculateRSI(prices, period = 14) {
  const changes = prices.slice(1).map((price, i) => price - prices[i]);
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

  const rsiValues = [100 - (100 / (1 + avgGain / avgLoss))];

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsiValues.push(100 - (100 / (1 + avgGain / avgLoss)));
  }

  return rsiValues;
}

// Calculate MACD
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema = (values, period) => {
    const k = 2 / (period + 1);
    const emaValues = [values[0]];
    for (let i = 1; i < values.length; i++) {
      emaValues.push(values[i] * k + emaValues[i - 1] * (1 - k));
    }
    return emaValues;
  };

  const fastEMA = ema(prices, fastPeriod);
  const slowEMA = ema(prices, slowPeriod);
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

  return { macdLine, signalLine, histogram };
}

// 计算价格波动率指标
function calculateVolatilityMetrics(kline) {
  const { high, low, open, close } = kline;
  const avgPrice = (high + low + open + close) / 4;
  
  const highLowVolatility = (high - low) / avgPrice * 100;
  const openCloseVolatility = Math.abs(close - open) / avgPrice * 100;
  const upperShadowVolatility = (high - Math.max(open, close)) / avgPrice * 100;
  const lowerShadowVolatility = (Math.min(open, close) - low) / avgPrice * 100;
  const bodyToShadowRatio = Math.abs(close - open) / (high - low);
  const openPositionInRange = (open - low) / (high - low);
  const closePositionInRange = (close - low) / (high - low);
  
  return {
    highLowVolatility,
    openCloseVolatility,
    upperShadowVolatility,
    lowerShadowVolatility,
    bodyToShadowRatio,
    openPositionInRange,
    closePositionInRange
  };
}

// 计算布林带指标
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const sma = prices.reduce((a, b) => a + b, 0) / period;
  const variance = prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = sma + (stdDev * std);
  const lower = sma - (stdDev * std);
  const width = (upper - lower) / sma * 100;
  
  const currentPrice = prices[prices.length - 1];
  const upperBandDistance = ((upper - currentPrice) / (upper - lower)) * 100;
  const lowerBandDistance = ((currentPrice - lower) / (upper - lower)) * 100;
  const middleBandDeviation = ((currentPrice - sma) / currentPrice) * 100;
  
  return {
    width,
    upperBandDistance,
    lowerBandDistance,
    middleBandDeviation,
    sma
  };
}

// Calculate ATR (Average True Range)
function calculateATR(klines, period = 14) {
  const trueRanges = klines.map((kline, i) => {
    if (i === 0) return kline.high - kline.low;
    const previousClose = klines[i - 1].close;
    return Math.max(
      kline.high - kline.low,
      Math.abs(kline.high - previousClose),
      Math.abs(kline.low - previousClose)
    );
  });

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b) / period;
  const atrValues = [atr];

  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    atrValues.push(atr);
  }

  return atrValues;
}

export function calculateFutureReturns(klines, futureSteps = 4) {
  const returns = [];
  
  for (let i = 0; i < klines.length - futureSteps; i++) {
    const currentPrice = klines[i].close;
    const futurePrice = klines[i + futureSteps].close;
    const returnPercentage = ((futurePrice - currentPrice) / currentPrice) * 100;
    returns.push(returnPercentage);
  }
  
  return returns;
}

export function prepareTrainingData(klines, lookback = 20) {
  if (klines.length < lookback + 4) {
    throw new Error('Insufficient data points for feature extraction');
  }

  const features = [];
  const returns = calculateFutureReturns(klines);
  const closePrices = klines.map(k => k.close);
  
  // Calculate indicators that need the full price history
  const rsi = calculateRSI(closePrices);
  const macd = calculateMACD(closePrices);
  const atr = calculateATR(klines);
  
  for (let i = lookback; i < klines.length - 4; i++) {
    const window = klines.slice(i - lookback, i);
    const windowFeatures = [];
    
    for (let j = 0; j < window.length; j++) {
      const kline = window[j];
      const volatility = calculateVolatilityMetrics(kline);
      
      const priceWindow = klines.slice(Math.max(0, i - lookback + j - 19), i - lookback + j + 1)
        .map(k => k.close);
      const bb = calculateBollingerBands(priceWindow);
      
      const timeStepFeatures = [
        // Price & Volume
        kline.close / kline.open - 1, // Normalized price change
        Math.log(kline.volume), // Log volume
        
        // Volatility Metrics
        volatility.highLowVolatility,
        volatility.openCloseVolatility,
        volatility.bodyToShadowRatio,
        
        // Technical Indicators
        rsi[i - lookback + j] / 100, // Normalized RSI
        macd.macdLine[i - lookback + j],
        macd.histogram[i - lookback + j],
        bb.width / 100, // Normalized BB width
        bb.middleBandDeviation / 100,
        
        // Trend & Momentum
        atr[i - lookback + j] / kline.close, // Normalized ATR
        (kline.close - bb.sma) / bb.sma // Price deviation from SMA
      ];
      
      windowFeatures.push(timeStepFeatures);
    }
    
    features.push(windowFeatures);
  }

  // Normalize features
  const normalizedFeatures = features.map(window => {
    const transposed = Array(window[0].length).fill().map(() => []);
    
    for (let i = 0; i < window.length; i++) {
      for (let j = 0; j < window[i].length; j++) {
        transposed[j].push(window[i][j]);
      }
    }
    
    const normalized = transposed.map(feature => {
      const mean = feature.reduce((a, b) => a + b, 0) / feature.length;
      const std = Math.sqrt(feature.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / feature.length) || 1;
      return feature.map(value => (value - mean) / std);
    });
    
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
