import { calculateMomentum, calculateROC, calculateRSI, calculateMACD, calculateBollingerBands } from './indicators.js';

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
