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

// Calculate MACD with safety checks
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

// Calculate momentum with safety checks
export function calculateMomentum(prices, period) {
    return prices.map((price, i) => {
        if (i < period) return 0;
        const pastPrice = prices[i - period];
        if (!isFinite(price) || !isFinite(pastPrice) || pastPrice === 0) return 0;
        return (price / pastPrice - 1) * 100;
    });
}

// Calculate Rate of Change (ROC) with safety checks
export function calculateROC(prices, period) {
    return prices.map((price, i) => {
        if (i < period) return 0;
        const pastPrice = prices[i - period];
        if (!isFinite(price) || !isFinite(pastPrice) || pastPrice === 0) return 0;
        return ((price - pastPrice) / pastPrice) * 100;
    });
}

// Calculate Bollinger Bands with safety checks
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
    
    return Array(period - 1).fill(null).concat(results);
}

// Helper function to get latest indicator values
export function getLatestIndicators(indicators) {
    return {
        rsi: indicators.rsi[indicators.rsi.length - 1],
        macd: indicators.macd.histogram[indicators.macd.histogram.length - 1],
        momentum: indicators.momentum[indicators.momentum.length - 1],
        roc: indicators.roc[indicators.roc.length - 1],
        bBands: indicators.bBands[indicators.bBands.length - 1]
    };
}

// Calculate all indicators at once
export function calculateIndicators(prices) {
    return {
        rsi: calculateRSI(prices),
        macd: calculateMACD(prices),
        momentum: calculateMomentum(prices, 10),
        roc: calculateROC(prices, 14),
        bBands: calculateBollingerBands(prices)
    };
}
