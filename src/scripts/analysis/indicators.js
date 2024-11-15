import { ANALYSIS_CONFIG } from './config.js';

/**
 * Calculate ADX (Average Directional Index)
 */
export function calculateADX(high, low, close, period = ANALYSIS_CONFIG.TREND.ADX_PERIOD) {
    const tr = [];  // True Range
    const dmPlus = [];  // Plus Directional Movement
    const dmMinus = []; // Minus Directional Movement
    
    // Calculate TR and DM
    for (let i = 1; i < close.length; i++) {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i-1]);
        const lc = Math.abs(low[i] - close[i-1]);
        tr.push(Math.max(hl, hc, lc));
        
        dmPlus.push(high[i] - high[i-1] > low[i-1] - low[i] ? 
            Math.max(high[i] - high[i-1], 0) : 0);
        dmMinus.push(low[i-1] - low[i] > high[i] - high[i-1] ? 
            Math.max(low[i-1] - low[i], 0) : 0);
    }
    
    // Calculate smoothed values
    const atr = calculateEMA(tr, period);
    const plusDI = calculateEMA(dmPlus, period).map((dm, i) => (dm / atr[i]) * 100);
    const minusDI = calculateEMA(dmMinus, period).map((dm, i) => (dm / atr[i]) * 100);
    
    // Calculate ADX
    const dx = plusDI.map((plus, i) => {
        const sum = plus + minusDI[i];
        return sum === 0 ? 0 : (Math.abs(plus - minusDI[i]) / sum) * 100;
    });
    
    return calculateEMA(dx, period);
}

/**
 * Calculate Stochastic RSI
 */
export function calculateStochRSI(prices, period = ANALYSIS_CONFIG.TREND.STOCH_RSI_PERIOD) {
    const rsi = calculateRSI(prices, period);
    const stochRSI = [];
    
    for (let i = period; i < rsi.length; i++) {
        const rsiWindow = rsi.slice(i - period, i);
        const max = Math.max(...rsiWindow);
        const min = Math.min(...rsiWindow);
        
        if (max === min) {
            stochRSI.push(50);
        } else {
            stochRSI.push(((rsi[i] - min) / (max - min)) * 100);
        }
    }
    
    return Array(period).fill(50).concat(stochRSI);
}

/**
 * Calculate On Balance Volume (OBV)
 */
export function calculateOBV(close, volume) {
    const obv = [0];
    
    for (let i = 1; i < close.length; i++) {
        if (close[i] > close[i-1]) {
            obv.push(obv[i-1] + volume[i]);
        } else if (close[i] < close[i-1]) {
            obv.push(obv[i-1] - volume[i]);
        } else {
            obv.push(obv[i-1]);
        }
    }
    
    return obv;
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(high, low, close, period = ANALYSIS_CONFIG.VOLATILITY.ATR_PERIOD) {
    const tr = [high[0] - low[0]];  // True Range
    
    for (let i = 1; i < close.length; i++) {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i-1]);
        const lc = Math.abs(low[i] - close[i-1]);
        tr.push(Math.max(hl, hc, lc));
    }
    
    return calculateEMA(tr, period);
}

/**
 * Calculate Chaikin Money Flow (CMF)
 */
export function calculateCMF(high, low, close, volume, period = ANALYSIS_CONFIG.VOLUME.CMF_PERIOD) {
    const mfv = []; // Money Flow Volume
    
    for (let i = 0; i < close.length; i++) {
        const hl = high[i] - low[i];
        const mf = hl === 0 ? 0 : ((close[i] - low[i]) - (high[i] - close[i])) / hl;
        mfv.push(mf * volume[i]);
    }
    
    const cmf = [];
    for (let i = period - 1; i < mfv.length; i++) {
        const sumMFV = mfv.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        const sumVol = volume.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        cmf.push(sumVol === 0 ? 0 : sumMFV / sumVol);
    }
    
    return Array(period - 1).fill(0).concat(cmf);
}

/**
 * Helper: Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(values, period) {
    const k = 2 / (period + 1);
    const ema = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
        ema.push(values[i] * k + ema[i-1] * (1 - k));
    }
    
    return ema;
}

/**
 * Helper: Calculate RSI (Relative Strength Index)
 */
function calculateRSI(prices, period) {
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    const rsi = [50];
    
    for (let i = period; i < changes.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
}
