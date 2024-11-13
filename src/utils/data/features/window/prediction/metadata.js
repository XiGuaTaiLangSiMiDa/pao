import { clipValue } from '../base/utils.js';

export function generateMetadata(kline, indicators) {
    if (!kline || !indicators) {
        throw new Error('Invalid input for metadata generation');
    }

    return {
        timestamp: kline.closeTime,
        price: {
            open: kline.open || 0,
            high: kline.high || 0,
            low: kline.low || 0,
            close: kline.close || 0
        },
        indicators: formatIndicators(indicators),
        analysis: analyzeMarketConditions(kline, indicators)
    };
}

function formatIndicators(indicators) {
    if (!indicators) {
        return {
            rsi: 50,
            momentum: 0,
            macd: 0,
            roc: 0,
            bBands: null
        };
    }

    return {
        rsi: clipValue(indicators.rsi, 0, 100),
        momentum: clipValue(indicators.momentum, -100, 100),
        macd: clipValue(indicators.macd, -100, 100),
        roc: clipValue(indicators.roc, -100, 100),
        bBands: indicators.bBands ? {
            bandwidth: clipValue(indicators.bBands.bandwidth, 0, 1),
            percentB: clipValue(indicators.bBands.percentB, 0, 100),
            deviation: clipValue(indicators.bBands.deviation, -3, 3)
        } : null
    };
}

function analyzeMarketConditions(kline, indicators) {
    if (!kline || !indicators) {
        return {
            volatility: 0,
            trend: 'neutral',
            strength: 'moderate',
            riskLevel: 0.5
        };
    }

    const volatility = calculateVolatility(kline);
    const trend = analyzeTrend(indicators);
    const strength = analyzeStrength(indicators);

    return {
        volatility,
        trend,
        strength,
        riskLevel: calculateRiskLevel(volatility, indicators)
    };
}

function calculateVolatility(kline) {
    if (!kline || !kline.high || !kline.low || !kline.open) {
        return 0;
    }

    const range = (kline.high - kline.low) / kline.open;
    return clipValue(range, 0, 1);
}

function analyzeTrend(indicators) {
    if (!indicators || !indicators.rsi) {
        return 'neutral';
    }

    if (indicators.rsi > 70) return 'overbought';
    if (indicators.rsi < 30) return 'oversold';
    if (indicators.macd > 0 && indicators.roc > 0) return 'uptrend';
    if (indicators.macd < 0 && indicators.roc < 0) return 'downtrend';
    return 'neutral';
}

function analyzeStrength(indicators) {
    if (!indicators || !indicators.momentum) {
        return 'moderate';
    }

    const momentum = Math.abs(indicators.momentum);
    if (momentum < 0.5) return 'weak';
    if (momentum < 1.5) return 'moderate';
    return 'strong';
}

function calculateRiskLevel(volatility, indicators) {
    if (!indicators) {
        return 0.5;
    }

    let riskScore = 0;
    
    // Volatility contribution
    riskScore += volatility * 40;
    
    // RSI extremes
    if (indicators.rsi > 75 || indicators.rsi < 25) riskScore += 30;
    else if (indicators.rsi > 65 || indicators.rsi < 35) riskScore += 15;
    
    // MACD volatility
    if (Math.abs(indicators.macd) > 1) riskScore += 30;
    
    return clipValue(riskScore / 100, 0, 1);
}
