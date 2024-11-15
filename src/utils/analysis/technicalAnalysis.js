export function analyzeTechnicalIndicators(indicators) {
    const { rsi, stochRSI, obv, macd, momentum, roc, bBands, adx, atr, cmf } = indicators;
    const { k, d } = stochRSI;
    
    const momentumSignals = analyzeStochRSI(k, d);
    const volumeSignals = analyzeVolume(obv, cmf);
    const trendSignals = analyzeTrends(macd, adx, atr, rsi, bBands);

    const { trend, strength } = determineTrendAndStrength({
        macd, momentum, k, d, adx, cmf, rsi
    });

    return {
        signals: [...momentumSignals, ...volumeSignals, ...trendSignals],
        trend,
        strength
    };
}

function analyzeStochRSI(k, d) {
    const signals = [];
    if (k > d) {
        signals.push(`随机RSI金叉形成(K:${k.toFixed(1)}, D:${d.toFixed(1)})，这是一个短期看涨信号。简单来说，K线（快线）超过D线（慢线）表示买盘力量正在增强，市场可能开始转向上涨`);
    } else if (k < d) {
        signals.push(`随机RSI死叉形成(K:${k.toFixed(1)}, D:${d.toFixed(1)})，这是一个短期看跌信号。简单来说，K线（快线）跌破D线（慢线）表示卖盘力量正在增强，市场可能开始转向下跌`);
    }
    return signals;
}

function analyzeVolume(obv, cmf) {
    const signals = [];
    
    // OBV Analysis
    if (obv < 0) {
        signals.push(`OBV为负值(${obv.toFixed(2)})，这表示最近的交易量主要出现在价格下跌时。用大白话说，就是当价格下跌时，交易更活跃，说明卖盘比较强势`);
    } else {
        signals.push(`OBV为正值(${obv.toFixed(2)})，这表示最近的交易量主要出现在价格上涨时。用大白话说，就是当价格上涨时，交易更活跃，说明买盘比较强势`);
    }

    // CMF Analysis
    if (cmf > 0.1) {
        signals.push(`CMF显示较强买入压力(${cmf.toFixed(3)})，这表示资金正在流入市场。简单来说，就是有大量资金在买入，市场看涨情绪较强`);
    } else if (cmf < -0.1) {
        signals.push(`CMF显示较强卖出压力(${cmf.toFixed(3)})，这表示资金正在流出市场。简单来说，就是有大量资金在卖出，市场看跌情绪较强`);
    }

    return signals;
}

function analyzeTrends(macd, adx, atr, rsi, bBands) {
    const signals = [];

    // MACD Analysis
    if (macd > 0) {
        signals.push(`MACD为正值(${macd.toFixed(4)})，这是一个中期看涨信号。简单来说，正的MACD值表示市场整体趋势向上，买方力量占优`);
    } else {
        signals.push(`MACD为负值(${macd.toFixed(4)})，这是一个中期看跌信号。简单来说，负的MACD值表示市场整体趋势向下，卖方力量占优`);
    }

    // ADX Analysis
    if (adx && adx.adx > 25) {
        if (adx.plusDI > adx.minusDI) {
            signals.push(`ADX显示强劲上涨趋势(${adx.adx.toFixed(1)})，+DI(${adx.plusDI.toFixed(1)}) > -DI(${adx.minusDI.toFixed(1)})。用大白话说，ADX大于25表示趋势强烈，而+DI大于-DI说明这个强趋势是向上的`);
        } else {
            signals.push(`ADX显示强劲下跌趋势(${adx.adx.toFixed(1)})，-DI(${adx.minusDI.toFixed(1)}) > +DI(${adx.plusDI.toFixed(1)})。用大白话说，ADX大于25表示趋势强烈，而-DI大于+DI说明这个强趋势是向下的`);
        }
    }

    // ATR Analysis
    if (atr) {
        const atrPercent = (atr / bBands.percentB) * 100;
        if (atrPercent > 2) {
            signals.push(`ATR显示高波动性(${atrPercent.toFixed(1)}%)，这表示市场波动幅度较大。用大白话说，就是价格上下波动比较剧烈，风险较高，建议谨慎操作或降低交易规模`);
        }
    }

    // RSI Analysis
    if (rsi > 70) {
        signals.push(`RSI超过70(${rsi.toFixed(1)})，这表示市场可能已经超买。用大白话说，就是价格可能涨得太多太快，有回调风险`);
    } else if (rsi < 30) {
        signals.push(`RSI低于30(${rsi.toFixed(1)})，这表示市场可能已经超卖。用大白话说，就是价格可能跌得太多太快，有反弹机会`);
    }

    // Bollinger Bands Analysis
    const { percentB } = bBands;
    if (percentB > 80) {
        signals.push('价格已经接近布林带上轨，这表示价格处于相对高位。用大白话说，就是价格已经涨到较高位置，需要注意回调风险');
    } else if (percentB < 20) {
        signals.push('价格已经接近布林带下轨，这表示价格处于相对低位。用大白话说，就是价格已经跌到较低位置，可以关注反弹机会');
    }

    return signals;
}

function determineTrendAndStrength({ macd, momentum, k, d, adx, cmf, rsi }) {
    let trend = 'neutral';
    let strength = 'weak';
    
    // Count positive and negative signals
    const positiveSignals = (macd > 0 ? 1 : 0) + 
                         (momentum > 0 ? 1 : 0) + 
                         (k > d ? 1 : 0) +
                         (adx?.plusDI > adx?.minusDI ? 1 : 0) +
                         (cmf > 0 ? 1 : 0);
                         
    const negativeSignals = (macd < 0 ? 1 : 0) + 
                         (momentum < 0 ? 1 : 0) + 
                         (k < d ? 1 : 0) +
                         (adx?.plusDI < adx?.minusDI ? 1 : 0) +
                         (cmf < 0 ? 1 : 0);

    if (positiveSignals >= 3) {
        trend = 'uptrend';
        strength = positiveSignals >= 4 ? 'strong' : 'moderate';
    } else if (negativeSignals >= 3) {
        trend = 'downtrend';
        strength = negativeSignals >= 4 ? 'strong' : 'moderate';
    }

    // Adjust for extreme conditions
    if (rsi > 70) {
        trend = 'overbought';
    } else if (rsi < 30) {
        trend = 'oversold';
    }

    return { trend, strength };
}
