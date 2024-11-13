import axios from 'axios';
import moment from 'moment';

// const BINANCE_API_BASE = 'https://fapi.binance.com/fapi/v1';
const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Data validation function
function validateKlineData(kline) {
  const requiredFields = ['openTime', 'open', 'high', 'low', 'close', 'volume'];
  const isValid = requiredFields.every(field => {
    const value = kline[field];
    return value !== undefined && value !== null && !isNaN(value) && isFinite(value);
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
    console.log(`First line: ${response.data[0]}`);
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
    console.log(`Klines: ${klines.length}`);
    // Validate each kline
    klines.forEach(validateKlineData);

    return klines;
  } catch (error) {
    console.error('Error fetching klines:', error.message);
    throw error;
  }
}

// Calculate price momentum with safety checks
function calculateMomentum(prices, period) {
  return prices.map((price, i) => {
    if (i < period) return 0;
    const pastPrice = prices[i - period];
    if (!isFinite(price) || !isFinite(pastPrice) || pastPrice === 0) return 0;
    return (price / pastPrice - 1) * 100;
  });
}

// Calculate Rate of Change (ROC) with safety checks
function calculateROC(prices, period) {
  return prices.map((price, i) => {
    if (i < period) return 0;
    const pastPrice = prices[i - period];
    if (!isFinite(price) || !isFinite(pastPrice) || pastPrice === 0) return 0;
    return ((price - pastPrice) / pastPrice) * 100;
  });
}

// Calculate RSI with safety checks
function calculateRSI(prices, period = 14) {
  const changes = prices.slice(1).map((price, i) => {
    const prevPrice = prices[i];
    if (!isFinite(price) || !isFinite(prevPrice)) return 0;
    return price - prevPrice;
  });

  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsiValues = [50]; // Initial value

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }

  return rsiValues;
}

// Calculate MACD with safety checks
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema = (values, period) => {
    const k = 2 / (period + 1);
    const emaValues = [values[0]];
    for (let i = 1; i < values.length; i++) {
      if (!isFinite(values[i]) || !isFinite(emaValues[i - 1])) {
        emaValues.push(emaValues[i - 1] || 0);
        continue;
      }
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

// Calculate price patterns with safety checks
function calculatePricePatterns(kline, prevKline) {
  if (!prevKline) return null;

  const { open, high, low, close } = kline;
  const prevClose = prevKline.close;
  
  if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close) || !isFinite(prevClose)) {
    return null;
  }

  // Calculate normalized price movements
  const bodySize = Math.abs(close - open) / (open || 1);
  const upperShadow = (high - Math.max(open, close)) / (open || 1);
  const lowerShadow = (Math.min(open, close) - low) / (open || 1);
  const totalRange = (high - low) / (open || 1);
  
  // Calculate price momentum
  const priceChange = (close - prevClose) / (prevClose || 1);
  const gapUp = (open - prevClose) / (prevClose || 1);
  
  // Calculate volatility patterns
  const avgPrice = (high + low) / 2;
  const volatility = avgPrice !== 0 ? (high - low) / avgPrice : 0;
  const bodyToShadowRatio = totalRange !== 0 ? bodySize / totalRange : 0;
  
  return {
    bodySize,
    upperShadow,
    lowerShadow,
    totalRange,
    priceChange,
    gapUp,
    volatility,
    bodyToShadowRatio
  };
}

// Calculate volume patterns with safety checks
function calculateVolumePatterns(kline, prevKline) {
  if (!prevKline) return null;

  const { volume, close, open } = kline;
  const prevVolume = prevKline.volume;
  
  if (!isFinite(volume) || !isFinite(close) || !isFinite(open) || !isFinite(prevVolume)) {
    return null;
  }

  // Volume momentum
  const volumeChange = prevVolume !== 0 ? (volume - prevVolume) / prevVolume : 0;
  
  // Price-volume relationship
  const volumePriceRatio = volume * Math.abs(close - open);
  const volumeTrend = volume * (close > open ? 1 : -1);
  
  return {
    volumeChange,
    volumePriceRatio,
    volumeTrend
  };
}

// Calculate Bollinger Bands with safety checks
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const results = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + (isFinite(b) ? b : 0), 0) / period;
    
    const squaredDiffs = slice.map(price => {
      if (!isFinite(price)) return 0;
      const diff = price - sma;
      return diff * diff;
    });
    
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(variance);
    
    const upper = sma + (stdDev * std);
    const lower = sma - (stdDev * std);
    const bandwidth = sma !== 0 ? (upper - lower) / sma : 0;
    const currentPrice = prices[i];
    const percentB = upper !== lower ? ((currentPrice - lower) / (upper - lower)) * 100 : 50;
    
    results.push({
      bandwidth,
      percentB,
      deviation: std !== 0 ? (currentPrice - sma) / std : 0
    });
  }
  
  // Pad beginning with null values
  return Array(period - 1).fill(null).concat(results);
}

export function prepareTrainingData(klines, lookback = 20) {
  if (klines.length < lookback + 4) {
    throw new Error('Insufficient data points for feature extraction');
  }

  const features = [];
  const returns = [];
  
  // Calculate base price series
  const closePrices = klines.map(k => k.close);
  
  // Calculate technical indicators
  const rsi = calculateRSI(closePrices);
  const macd = calculateMACD(closePrices);
  const momentum = calculateMomentum(closePrices, 10);
  const roc = calculateROC(closePrices, 14);
  const bBands = calculateBollingerBands(closePrices);
  
  // Calculate future returns (target variable)
  for (let i = 0; i < klines.length - 4; i++) {
    const currentPrice = klines[i].close;
    const futurePrice = klines[i + 4].close;
    if (!isFinite(currentPrice) || !isFinite(futurePrice) || currentPrice === 0) {
      returns.push(0);
    } else {
      returns.push((futurePrice - currentPrice) / currentPrice * 100);
    }
  }
  
  // Create feature windows
  for (let i = lookback; i < klines.length - 4; i++) {
    const window = [];
    
    for (let j = i - lookback; j < i; j++) {
      const pricePatterns = calculatePricePatterns(klines[j], klines[j - 1]);
      const volumePatterns = calculateVolumePatterns(klines[j], klines[j - 1]);
      
      if (!pricePatterns || !volumePatterns) {
        // Use zero values for missing patterns
        window.push(new Array(16).fill(0));
        continue;
      }
      
      const features = [
        // Price patterns (clipped to reasonable ranges)
        Math.min(Math.max(pricePatterns.bodySize, -1), 1),
        Math.min(Math.max(pricePatterns.upperShadow, -1), 1),
        Math.min(Math.max(pricePatterns.lowerShadow, -1), 1),
        Math.min(Math.max(pricePatterns.totalRange, -1), 1),
        Math.min(Math.max(pricePatterns.priceChange, -1), 1),
        Math.min(Math.max(pricePatterns.volatility, -1), 1),
        Math.min(Math.max(pricePatterns.bodyToShadowRatio, -1), 1),
        
        // Volume patterns (clipped to reasonable ranges)
        Math.min(Math.max(volumePatterns.volumeChange, -1), 1),
        Math.min(Math.max(Math.log1p(Math.abs(volumePatterns.volumePriceRatio)) * Math.sign(volumePatterns.volumePriceRatio), -1), 1),
        
        // Technical indicators (normalized)
        Math.min(Math.max(rsi[j] / 100, 0), 1),
        Math.min(Math.max(macd.histogram[j] / 100, -1), 1),
        Math.min(Math.max(momentum[j] / 100, -1), 1),
        Math.min(Math.max(roc[j] / 100, -1), 1),
        
        // Bollinger Bands features (normalized)
        bBands[j] ? Math.min(Math.max(bBands[j].bandwidth, 0), 1) : 0,
        bBands[j] ? Math.min(Math.max(bBands[j].percentB / 100, 0), 1) : 0.5,
        bBands[j] ? Math.min(Math.max(bBands[j].deviation, -1), 1) : 0
      ];
      
      window.push(features);
    }
    
    if (window.length === lookback) {
      features.push(window);
    }
  }

  return {
    features,
    labels: returns.slice(lookback)
  };
}
