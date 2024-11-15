// Store recent predictions in memory
let recentPredictions = [];

// Initialize TradingView chart and start data fetching
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing...');
    
    // Initialize TradingView chart
    initChart();

    // Initial data fetch
    fetchPrediction();
    fetchTrendAnalysis();

    // Set up periodic updates
    setInterval(fetchPrediction, 5000);  // Update every 5 seconds
    setInterval(fetchTrendAnalysis, 5000);

    console.log('Intervals set up successfully');
});

// Calculate risk assessment based on technical indicators
function calculateRiskAssessment(data) {
    const risks = [];
    const indicators = data.metadata.indicators;
    const analysis = data.metadata.analysis;
    
    // Volatility Risk (based on ATR)
    const atrRisk = indicators.atr / data.metadata.price.close * 100;
    if (atrRisk > 5) {
        risks.push({
            level: 'high',
            message: `高波动风险: ATR指标 (${atrRisk.toFixed(2)}%) 显示市场波动性较大`
        });
    }

    // Trend Reversal Risk
    const upwardProb = data.metadata.analysis.upwardReversal?.probability || 0;
    const downwardProb = data.metadata.analysis.downwardReversal?.probability || 0;
    if (upwardProb > 0.7 || downwardProb > 0.7) {
        risks.push({
            level: 'medium',
            message: `趋势反转风险: ${upwardProb > downwardProb ? '上涨' : '下跌'}反转概率 ${(Math.max(upwardProb, downwardProb) * 100).toFixed(2)}%`
        });
    }

    // Overbought/Oversold Risk (RSI)
    if (indicators.rsi > 70) {
        risks.push({
            level: 'high',
            message: `超买风险: RSI (${indicators.rsi.toFixed(2)}) 处于超买区域`
        });
    } else if (indicators.rsi < 30) {
        risks.push({
            level: 'high',
            message: `超卖风险: RSI (${indicators.rsi.toFixed(2)}) 处于超卖区域`
        });
    }

    // Volume Risk (CMF)
    if (indicators.cmf < -0.2) {
        risks.push({
            level: 'high',
            message: `资金流出风险: CMF (${indicators.cmf.toFixed(2)}) 显示大量资金流出`
        });
    }

    // Trend Strength Risk (ADX)
    if (indicators.adx.adx > 40) {
        risks.push({
            level: 'medium',
            message: `趋势过热风险: ADX (${indicators.adx.adx.toFixed(2)}) 显示极强趋势，可能即将耗尽`
        });
    }

    // Model Confidence Risk
    if (data.confidence < 60) {
        risks.push({
            level: 'medium',
            message: `预测不确定性: 模型置信度较低 (${data.confidence}%)`
        });
    }

    return risks;
}

// Update risk assessment display
function updateRiskAssessment(risks) {
    const riskContent = document.getElementById('risk-content');
    if (!riskContent) return;

    if (risks.length === 0) {
        riskContent.innerHTML = '<p class="risk-level low">当前市场风险较低</p>';
        return;
    }

    let html = '';
    const highRisks = risks.filter(r => r.level === 'high');
    const mediumRisks = risks.filter(r => r.level === 'medium');

    if (highRisks.length > 0) {
        html += '<p class="risk-level high">高风险警告</p>';
        html += '<ul class="risk-list high">';
        highRisks.forEach(risk => {
            html += `<li>${risk.message}</li>`;
        });
        html += '</ul>';
    }

    if (mediumRisks.length > 0) {
        html += '<p class="risk-level medium">中等风险提示</p>';
        html += '<ul class="risk-list medium">';
        mediumRisks.forEach(risk => {
            html += `<li>${risk.message}</li>`;
        });
        html += '</ul>';
    }

    riskContent.innerHTML = html;
}

// Update prediction history table
function updatePredictionHistory(newPrediction) {
    // Add new prediction to history
    recentPredictions.push(newPrediction);
    
    // Keep only predictions from the last 2 hours
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    recentPredictions = recentPredictions.filter(p => p.timestamp > twoHoursAgo);
    
    // Sort by timestamp descending (most recent first)
    recentPredictions.sort((a, b) => b.timestamp - a.timestamp);

    // Update table
    const tbody = document.getElementById('prediction-history-body');
    tbody.innerHTML = '';
    
    recentPredictions.forEach(prediction => {
        const row = document.createElement('tr');
        
        // Time
        const timeCell = document.createElement('td');
        timeCell.textContent = new Date(prediction.timestamp).toLocaleTimeString();
        row.appendChild(timeCell);
        
        // Price
        const priceCell = document.createElement('td');
        priceCell.textContent = prediction.metadata.price.close.toFixed(2);
        row.appendChild(priceCell);
        
        // Predicted Change
        const changeCell = document.createElement('td');
        changeCell.textContent = `${prediction.predictedChange.toFixed(2)}%`;
        row.appendChild(changeCell);
        
        // Predicted Price
        const predictedPriceCell = document.createElement('td');
        predictedPriceCell.textContent = prediction.predictedPrice.toFixed(2);
        row.appendChild(predictedPriceCell);
        
        // Signal
        const signalCell = document.createElement('td');
        signalCell.textContent = prediction.signal;
        row.appendChild(signalCell);
        
        // Accuracy
        const accuracyCell = document.createElement('td');
        accuracyCell.textContent = `${prediction.accuracy}%`;
        row.appendChild(accuracyCell);
        
        tbody.appendChild(row);
    });
}

// Fetch prediction data
async function fetchPrediction() {
    try {
        console.log('Fetching prediction data...');
        const response = await fetch('/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                klines: [] // Server will fetch latest klines
            })
        });
        const data = await response.json();
        
        // Add timestamp to prediction data
        data.timestamp = Date.now();
        
        // Update prediction history
        updatePredictionHistory(data);
        
        // Calculate and update risk assessment
        const risks = calculateRiskAssessment(data);
        updateRiskAssessment(risks);
        
        // Update prediction values
        document.getElementById('current-price').textContent = 
            data.metadata.price.close.toFixed(2);
        document.getElementById('predicted-change').textContent = 
            `${(data.predictedChange).toFixed(2)}%`;  // Display actual percentage without multiplying
        document.getElementById('predicted-price').textContent = 
            data.predictedPrice.toFixed(2);
        document.getElementById('confidence').textContent = 
            `${data.confidence}%`;

        // Update technical indicators
        document.getElementById('rsi').textContent = 
            data.metadata.indicators.rsi.toFixed(2);
        document.getElementById('stoch-rsi-k').textContent = 
            data.metadata.indicators.stochRSI.k.toFixed(2);
        document.getElementById('stoch-rsi-d').textContent = 
            data.metadata.indicators.stochRSI.d.toFixed(2);
        document.getElementById('obv').textContent = 
            data.metadata.indicators.obv.toFixed(2);
        document.getElementById('adx').textContent = 
            data.metadata.indicators.adx.adx.toFixed(2);
        document.getElementById('plus-di').textContent = 
            data.metadata.indicators.adx.plusDI.toFixed(2);
        document.getElementById('minus-di').textContent = 
            data.metadata.indicators.adx.minusDI.toFixed(2);
        document.getElementById('atr').textContent = 
            data.metadata.indicators.atr.toFixed(2);
        document.getElementById('cmf').textContent = 
            data.metadata.indicators.cmf.toFixed(2);

        // Update trend and signal
        document.getElementById('trend').textContent = 
            `${data.metadata.analysis.trend} (${data.metadata.analysis.strength})`;
        const signal = document.getElementById('signal');
        const signalText = data.metadata.analysis.trend === 'uptrend' ? 'Buy' : 
                          data.metadata.analysis.trend === 'downtrend' ? 'Sell' : 'Neutral';
        signal.textContent = signalText;
        signal.className = `signal ${signalText.toLowerCase()}`;

        // Update last update time
        document.getElementById('last-update').textContent = 
            new Date().toLocaleString();

        // Update analysis summary
        const summary = data.metadata.analysis.signals.join('\n');
        document.getElementById('analysis-summary').innerHTML = 
            `<div class="analysis-summary">${summary.replace(/\n/g, '<br>')}</div>`;

        console.log('Prediction data updated successfully');
    } catch (error) {
        console.error('Error fetching prediction:', error);
    }
}

// Fetch trend analysis data
async function fetchTrendAnalysis() {
    try {
        console.log('Fetching trend analysis...');
        const response = await fetch('/trend');
        const data = await response.json();
        
        // Update trend values
        document.getElementById('upward-probability').textContent = 
            `${(data.analysis.upwardReversal.probability * 100).toFixed(2)}%`;
        document.getElementById('upward-similarity').textContent = 
            `${(data.analysis.upwardReversal.similarity * 100).toFixed(2)}%`;
        document.getElementById('upward-accuracy').textContent = 
            `${(data.analysis.upwardReversal.baseAccuracy * 100).toFixed(2)}%`;
        
        document.getElementById('downward-probability').textContent = 
            `${(data.analysis.downwardReversal.probability * 100).toFixed(2)}%`;
        document.getElementById('downward-similarity').textContent = 
            `${(data.analysis.downwardReversal.similarity * 100).toFixed(2)}%`;
        document.getElementById('downward-accuracy').textContent = 
            `${(data.analysis.downwardReversal.baseAccuracy * 100).toFixed(2)}%`;

        // Update indicator values if not already updated by prediction
        if (!document.getElementById('adx').textContent || 
            document.getElementById('adx').textContent === '-') {
            document.getElementById('adx').textContent = data.indicators.adx.toFixed(2);
            document.getElementById('stoch-rsi-k').textContent = data.indicators.stochRSI.toFixed(2);
            document.getElementById('obv').textContent = data.indicators.obv.toFixed(2);
            document.getElementById('atr').textContent = data.indicators.atr.toFixed(2);
            document.getElementById('cmf').textContent = data.indicators.cmf.toFixed(2);
        }

        // Update analysis summary with trend information
        const summary = generateTrendSummary(data);
        const existingSummary = document.getElementById('analysis-summary').innerHTML;
        document.getElementById('analysis-summary').innerHTML = 
            `${existingSummary}<hr>${summary}`;

        console.log('Trend analysis updated successfully');
    } catch (error) {
        console.error('Error fetching trend analysis:', error);
    }
}

// Generate trend analysis summary
function generateTrendSummary(data) {
    const { upwardReversal, downwardReversal } = data.analysis;
    const indicators = data.indicators;
    
    let summary = '<div class="analysis-summary">';
    
    // Add trend probabilities
    summary += '<p><strong>反转概率分析:</strong></p>';
    summary += `<p>上涨反转: ${(upwardReversal.probability * 100).toFixed(2)}% `;
    summary += `(相似度: ${(upwardReversal.similarity * 100).toFixed(2)}%)</p>`;
    summary += `<p>下跌反转: ${(downwardReversal.probability * 100).toFixed(2)}% `;
    summary += `(相似度: ${(downwardReversal.similarity * 100).toFixed(2)}%)</p>`;
    
    // Add indicator analysis
    summary += '<p><strong>指标分析:</strong></p>';
    summary += '<ul>';
    
    // ADX analysis
    if (indicators.adx > 25) {
        summary += `<li>ADX (${indicators.adx.toFixed(2)}) 显示强趋势</li>`;
    } else {
        summary += `<li>ADX (${indicators.adx.toFixed(2)}) 显示弱趋势</li>`;
    }
    
    // StochRSI analysis
    if (indicators.stochRSI > 80) {
        summary += `<li>StochRSI (${indicators.stochRSI.toFixed(2)}) 显示超买</li>`;
    } else if (indicators.stochRSI < 20) {
        summary += `<li>StochRSI (${indicators.stochRSI.toFixed(2)}) 显示超卖</li>`;
    }
    
    // MACD analysis
    if (indicators.macd > 0) {
        summary += '<li>MACD 显示上升动能</li>';
    } else {
        summary += '<li>MACD 显示下降动能</li>';
    }
    
    // Volume analysis
    if (indicators.cmf > 0) {
        summary += `<li>CMF (${indicators.cmf.toFixed(2)}) 显示资金流入</li>`;
    } else {
        summary += `<li>CMF (${indicators.cmf.toFixed(2)}) 显示资金流出</li>`;
    }
    
    summary += '</ul>';
    
    // Add overall assessment
    summary += '<p><strong>综合评估:</strong></p>';
    if (upwardReversal.probability > downwardReversal.probability) {
        summary += `<p>当前市场更倾向于上涨反转 (${(upwardReversal.probability * 100).toFixed(2)}% 概率)</p>`;
    } else {
        summary += `<p>当前市场更倾向于下跌反转 (${(downwardReversal.probability * 100).toFixed(2)}% 概率)</p>`;
    }
    
    summary += '</div>';
    return summary;
}
