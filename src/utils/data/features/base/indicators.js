// Calculate RSI with safety checks
export function calculateRSI(prices, period = 14) {
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

// Calculate Stochastic RSI
export function calculateStochRSI(prices, period = 14, smoothK = 3, smoothD = 3) {
    const rsi = calculateRSI(prices, period);
    const stochRSI = [];
    const k = [];
    const d = [];

    // Calculate raw K values
    for (let i = period - 1; i < rsi.length; i++) {
        const rsiWindow = rsi.slice(i - period + 1, i + 1);
        const highestRSI = Math.max(...rsiWindow);
        const lowestRSI = Math.min(...rsiWindow);
        
        let kValue;
        if (highestRSI === lowestRSI) {
            kValue = 50; // Neutral value when no range
        } else {
            kValue = ((rsi[i] - lowestRSI) / (highestRSI - lowestRSI)) * 100;
        }
        stochRSI.push(kValue);
    }

    // Apply smoothing to K values
    for (let i = smoothK - 1; i < stochRSI.length; i++) {
        const kWindow = stochRSI.slice(i - smoothK + 1, i + 1);
        k.push(kWindow.reduce((a, b) => a + b) / smoothK);
    }

    // Calculate D values (SMA of K)
    for (let i = smoothD - 1; i < k.length; i++) {
        const dWindow = k.slice(i - smoothD + 1, i + 1);
        d.push(dWindow.reduce((a, b) => a + b) / smoothD);
    }

    // Pad arrays to match input length
    const padding = period - 1 + Math.max(smoothK, smoothD) - 1;
    const paddedK = Array(padding).fill(50).concat(k);
    const paddedD = Array(padding).fill(50).concat(d);

    return {
        k: paddedK,
        d: paddedD
    };
}

// Calculate Average True Range (ATR)
export function calculateATR(highs, lows, closes, period = 14) {
    const trueRanges = [];
    const atr = [0];  // Initial value

    // Calculate True Range for first period
    for (let i = 1; i < closes.length; i++) {
        const high = highs[i];
        const low = lows[i];
        const prevClose = closes[i - 1];

        if (!isFinite(high) || !isFinite(low) || !isFinite(prevClose)) {
            trueRanges.push(0);
            continue;
        }

        const tr1 = Math.abs(high - low);
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        
        trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    // Calculate ATR using Wilder's smoothing
    let atrValue = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atr.push(atrValue);

    for (let i = period; i < trueRanges.length; i++) {
        atrValue = ((atrValue * (period - 1)) + trueRanges[i]) / period;
        atr.push(atrValue);
    }

    return atr;
}

// Calculate Average Directional Index (ADX)
export function calculateADX(highs, lows, closes, period = 14) {
    const plusDM = [0];
    const minusDM = [0];
    const tr = [0];
    const adx = Array(period * 2).fill(0);  // Initial values

    // Calculate +DM, -DM and TR
    for (let i = 1; i < closes.length; i++) {
        const highDiff = highs[i] - highs[i - 1];
        const lowDiff = lows[i - 1] - lows[i];

        // +DM
        plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
        // -DM
        minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
        
        // True Range
        const trueHigh = Math.max(highs[i], closes[i - 1]);
        const trueLow = Math.min(lows[i], closes[i - 1]);
        tr.push(trueHigh - trueLow);
    }

    // Smooth the indicators
    const smoothPlusDM = getWilderSmoothing(plusDM, period);
    const smoothMinusDM = getWilderSmoothing(minusDM, period);
    const smoothTR = getWilderSmoothing(tr, period);

    // Calculate +DI and -DI
    const plusDI = smoothPlusDM.map((pdm, i) => (pdm / smoothTR[i]) * 100);
    const minusDI = smoothMinusDM.map((mdm, i) => (mdm / smoothTR[i]) * 100);

    // Calculate DX
    const dx = plusDI.map((pdi, i) => {
        const mdi = minusDI[i];
        return Math.abs(pdi - mdi) / (pdi + mdi) * 100;
    });

    // Calculate ADX
    for (let i = period * 2; i < dx.length; i++) {
        adx.push(
            (adx[adx.length - 1] * (period - 1) + dx[i]) / period
        );
    }

    return {
        adx,
        plusDI,
        minusDI
    };
}

// Calculate Chaikin Money Flow (CMF)
export function calculateCMF(highs, lows, closes, volumes, period = 20) {
    const cmf = Array(period - 1).fill(0);
    
    for (let i = period - 1; i < closes.length; i++) {
        let moneyFlowVolume = 0;
        let volumeSum = 0;
        
        // Calculate money flow volume for the period
        for (let j = i - period + 1; j <= i; j++) {
            const high = highs[j];
            const low = lows[j];
            const close = closes[j];
            const volume = volumes[j];
            
            if (!isFinite(high) || !isFinite(low) || !isFinite(close) || !isFinite(volume)) {
                continue;
            }
            
            const highLowRange = high - low;
            if (highLowRange === 0) continue;
            
            // Money Flow Multiplier
            const multiplier = ((close - low) - (high - close)) / highLowRange;
            
            moneyFlowVolume += multiplier * volume;
            volumeSum += volume;
        }
        
        cmf.push(volumeSum === 0 ? 0 : moneyFlowVolume / volumeSum);
    }
    
    return cmf;
}

// Calculate On Balance Volume (OBV)
export function calculateOBV(prices, volumes) {
    if (!volumes || volumes.length !== prices.length) {
        return Array(prices.length).fill(0);
    }

    const baselineVolume = volumes.reduce((sum, vol) => sum + (isFinite(vol) ? vol : 0), 0) / volumes.length;
    const obv = [0];
    
    for (let i = 1; i < prices.length; i++) {
        const currentPrice = prices[i];
        const previousPrice = prices[i - 1];
        const currentVolume = volumes[i];

        if (!isFinite(currentPrice) || !isFinite(previousPrice) || !isFinite(currentVolume)) {
            obv.push(obv[obv.length - 1]);
            continue;
        }

        let currentOBV = obv[obv.length - 1];
        const normalizedVolume = (currentVolume / baselineVolume) * 100;
        
        if (currentPrice > previousPrice) {
            currentOBV += normalizedVolume;
        } else if (currentPrice < previousPrice) {
            currentOBV -= normalizedVolume;
        }
        
        obv.push(currentOBV);
    }

    const maxAbsOBV = Math.max(...obv.map(Math.abs));
    return obv.map(value => maxAbsOBV === 0 ? 0 : (value / maxAbsOBV) * 100);
}

// Calculate MACD
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
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

// Calculate momentum
export function calculateMomentum(prices, period) {
    return prices.map((price, i) => {
        if (i < period) return 0;
        const pastPrice = prices[i - period];
        if (!isFinite(price) || !isFinite(pastPrice) || pastPrice === 0) return 0;
        return (price / pastPrice - 1) * 100;
    });
}

// Calculate Rate of Change (ROC)
export function calculateROC(prices, period) {
    return prices.map((price, i) => {
        if (i < period) return 0;
        const pastPrice = prices[i - period];
        if (!isFinite(price) || !isFinite(pastPrice) || pastPrice === 0) return 0;
        return ((price - pastPrice) / pastPrice) * 100;
    });
}

// Calculate Bollinger Bands
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
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
    
    return Array(period - 1).fill({
        bandwidth: 0,
        percentB: 50,
        deviation: 0
    }).concat(results);
}

// Helper function for Wilder's Smoothing
function getWilderSmoothing(data, period) {
    const smoothed = [0];
    let sum = data.slice(1, period + 1).reduce((a, b) => a + b, 0);
    
    smoothed.push(sum / period);
    
    for (let i = period + 1; i < data.length; i++) {
        sum = (sum - (sum / period)) + data[i];
        smoothed.push(sum / period);
    }
    
    return smoothed;
}

// Calculate all indicators at once with weights
export function calculateIndicators(prices, volumes, highs, lows) {
    const rsi = calculateRSI(prices);
    const stochRSI = calculateStochRSI(prices);
    const obv = calculateOBV(prices, volumes);
    const macd = calculateMACD(prices);
    const momentum = calculateMomentum(prices, 10);
    const roc = calculateROC(prices, 14);
    const bBands = calculateBollingerBands(prices);
    const atr = calculateATR(highs, lows, prices);
    const adxData = calculateADX(highs, lows, prices);
    const cmf = calculateCMF(highs, lows, prices, volumes);

    // Apply weights to indicators
    const weights = {
        rsi: 0.7,          // Reduced weight due to overlap with StochRSI
        stochRSI: 0.7,     // Reduced weight due to overlap with RSI
        obv: 1.0,
        macd: 1.0,
        momentum: 0.8,
        roc: 0.8,
        bBands: 1.0,
        atr: 1.2,          // Increased weight for volatility
        adx: 1.3,          // Increased weight for trend strength
        cmf: 1.2           // Increased weight for volume analysis
    };

    return {
        rsi: rsi.map(v => v * weights.rsi),
        stochRSI: {
            k: stochRSI.k.map(v => v * weights.stochRSI),
            d: stochRSI.d.map(v => v * weights.stochRSI)
        },
        obv: obv.map(v => v * weights.obv),
        macd: {
            macdLine: macd.macdLine.map(v => v * weights.macd),
            signalLine: macd.signalLine.map(v => v * weights.macd),
            histogram: macd.histogram.map(v => v * weights.macd)
        },
        momentum: momentum.map(v => v * weights.momentum),
        roc: roc.map(v => v * weights.roc),
        bBands: bBands.map(v => ({
            bandwidth: v.bandwidth * weights.bBands,
            percentB: v.percentB * weights.bBands,
            deviation: v.deviation * weights.bBands
        })),
        atr: atr.map(v => v * weights.atr),
        adx: {
            adx: adxData.adx.map(v => v * weights.adx),
            plusDI: adxData.plusDI.map(v => v * weights.adx),
            minusDI: adxData.minusDI.map(v => v * weights.adx)
        },
        cmf: cmf.map(v => v * weights.cmf)
    };
}
