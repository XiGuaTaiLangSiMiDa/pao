// Technical indicators calculation
export const calculateStockRSI = (prices, rsiPeriod = 14, stochPeriod = 14) => {
  if (prices.length < rsiPeriod + stochPeriod) {
    return Array(prices.length).fill(50);
  }

  // Calculate price changes
  const changes = prices.slice(1).map((price, i) => {
    const prevPrice = prices[i];
    return isFinite(price) && isFinite(prevPrice) ? price - prevPrice : 0;
  });

  // Calculate gains and losses
  const gains = changes.map(change => Math.max(change, 0));
  const losses = changes.map(change => Math.max(-change, 0));

  // Calculate initial averages
  let avgGain = gains.slice(0, rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
  let avgLoss = losses.slice(0, rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;

  // Calculate RSI values
  const rsiValues = [];
  
  // Initial RSI
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(100 - (100 / (1 + rs)));

  // Calculate subsequent RSI values
  for (let i = rsiPeriod; i < changes.length; i++) {
    avgGain = ((avgGain * (rsiPeriod - 1)) + gains[i]) / rsiPeriod;
    avgLoss = ((avgLoss * (rsiPeriod - 1)) + losses[i]) / rsiPeriod;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }

  // Calculate Stochastic RSI
  const stockRSI = [];
  
  // Fill initial values that can't be calculated
  for (let i = 0; i < stochPeriod - 1; i++) {
    stockRSI.push(50);
  }

  // Calculate StockRSI values
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const rsiSlice = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const highestRSI = Math.max(...rsiSlice);
    const lowestRSI = Math.min(...rsiSlice);
    
    let currentStockRSI;
    if (highestRSI === lowestRSI) {
      // If RSI is flat, use the RSI value itself normalized to 0-100
      currentStockRSI = rsiValues[i];
    } else {
      currentStockRSI = ((rsiValues[i] - lowestRSI) / (highestRSI - lowestRSI)) * 100;
    }
    
    // Ensure value is within bounds
    currentStockRSI = Math.max(0, Math.min(100, currentStockRSI));
    stockRSI.push(currentStockRSI);
  }

  // Fill any remaining positions
  while (stockRSI.length < prices.length) {
    stockRSI.push(stockRSI[stockRSI.length - 1] || 50);
  }

  return stockRSI;
};

export const calculateOBV = (closes, volumes) => {
  if (!closes.length || !volumes.length) {
    return [0];
  }

  // Normalize volumes to reduce extreme values
  const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  const normalizedVolumes = volumes.map(vol => vol / avgVolume);
  
  const obv = [0];
  let cumulativeOBV = 0;
  
  for (let i = 1; i < closes.length; i++) {
    const currentClose = closes[i];
    const previousClose = closes[i - 1];
    const currentVolume = normalizedVolumes[i];
    
    if (!isFinite(currentClose) || !isFinite(previousClose) || !isFinite(currentVolume)) {
      obv.push(obv[i - 1]);
      continue;
    }

    if (currentClose > previousClose) {
      cumulativeOBV += currentVolume;
    } else if (currentClose < previousClose) {
      cumulativeOBV -= currentVolume;
    }
    // Equal prices don't change OBV
    
    obv.push(cumulativeOBV);
  }
  
  return obv;
};

export const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  // Calculate EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // Calculate MACD line
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  
  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
  
  return {
    macdLine,
    signalLine,
    histogram
  };
};

const calculateEMA = (prices, period) => {
  const multiplier = 2 / (period + 1);
  const ema = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  
  return ema;
};
