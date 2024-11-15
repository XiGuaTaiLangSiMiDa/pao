class PredictionUpdater {
    constructor() {
        this.updateInterval = 5000; // 5 seconds
        this.predictionHistory = [];
        this.historyLimit = 1080; // 2 hours worth of 5-minute predictions
        this.waitForChartReady();
    }

    waitForChartReady() {
        const widget = window.getTVWidget();
        if (!widget) {
            console.log('Waiting for TradingView widget...');
            setTimeout(() => this.waitForChartReady(), 1000);
            return;
        }

        console.log('TradingView widget ready, starting prediction updates');
        this.initializeUpdateLoop();
    }

    async updatePrediction() {
        try {
            // Get klines from TradingView widget
            const klines = await window.getChartData();
            if (!klines || klines.length === 0) {
                console.log('Waiting for kline data...');
                return;
            }
            
            console.log('Got klines:', klines.length);
            
            // Send klines to server for prediction
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ klines })
            });
            
            const data = await response.json();
            
            if (data.error) {
                console.error('Prediction error:', data.error);
                return;
            }
            
            this.updateUI(data);
            this.updatePredictionHistory(data);
        } catch (error) {
            console.error('Error updating prediction:', error);
        }
    }

    updatePredictionHistory(data) {
        if (!data || !data.metadata || !data.metadata.price) return;

        // Add new prediction to history
        const prediction = {
            time: new Date(),
            currentPrice: data.metadata.price.close,
            predictedChange: data.predictedChange,
            predictedPrice: data.predictedPrice,
            confidence: data.confidence,
            signal: this.generateSignal(data),
            accuracy: data.metadata.accuracy || '-'
        };

        this.predictionHistory.unshift(prediction);

        // Remove old predictions (keep last 2 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        this.predictionHistory = this.predictionHistory.filter(p => p.time > twoHoursAgo);

        // Limit total number of entries
        if (this.predictionHistory.length > this.historyLimit) {
            this.predictionHistory = this.predictionHistory.slice(0, this.historyLimit);
        }

        this.updateHistoryTable();
    }

    updateHistoryTable() {
        const tbody = document.getElementById('prediction-history-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        this.predictionHistory.forEach(prediction => {
            const row = document.createElement('tr');
            
            // Add signal class for coloring
            row.className = this.getSignalClass(prediction.signal);
            
            row.innerHTML = `
                <td>${prediction.time.toLocaleTimeString()}</td>
                <td>$${prediction.currentPrice.toFixed(2)}</td>
                <td>${prediction.predictedChange.toFixed(2)}%</td>
                <td>$${prediction.predictedPrice.toFixed(2)}</td>
                <td>${prediction.confidence.toFixed(1)}%</td>
                <td>${prediction.signal}</td>
                <td>${prediction.accuracy}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    getSignalClass(signal) {
        switch(signal) {
            case 'Strong Buy': return 'strong-buy-row';
            case 'Weak Buy': return 'buy-row';
            case 'Strong Sell': return 'strong-sell-row';
            case 'Weak Sell': return 'sell-row';
            case 'Low Confidence': return 'low-confidence-row';
            default: return 'neutral-row';
        }
    }

    generateSignal(data) {
        if (data.confidence < 60) {
            return 'Low Confidence';
        }
        
        if (data.predictedChange > 1.5) {
            return 'Strong Buy';
        } else if (data.predictedChange > 0.5) {
            return 'Weak Buy';
        } else if (data.predictedChange < -1.5) {
            return 'Strong Sell';
        } else if (data.predictedChange < -0.5) {
            return 'Weak Sell';
        }
        
        return 'Neutral';
    }

    updateUI(data) {
        if (!data || !data.metadata || !data.metadata.price) {
            console.error('Invalid prediction data structure');
            return;
        }

        const { metadata } = data;
        
        // Update price information
        this.updateElement('current-price', `$${metadata.price.close.toFixed(2)}`);
        this.updateElement('predicted-change', `${data.predictedChange.toFixed(2)}%`);
        this.updateElement('predicted-price', `$${data.predictedPrice.toFixed(2)}`);
        this.updateElement('confidence', `${data.confidence.toFixed(1)}%`);

        // Update technical indicators
        this.updateTechnicalIndicators(metadata);
        
        // Update market statistics
        const priceChange = ((metadata.price.close - metadata.price.open) / metadata.price.open) * 100;
        const priceChangeEl = document.getElementById('price-change');
        if (priceChangeEl) {
            priceChangeEl.textContent = `${priceChange.toFixed(2)}%`;
            priceChangeEl.className = `prediction-value ${priceChange >= 0 ? 'change-positive' : 'change-negative'}`;
        }
        
        this.updateElement('high-price', `$${metadata.price.high.toFixed(2)}`);
        this.updateElement('low-price', `$${metadata.price.low.toFixed(2)}`);
        
        // Update volume trend
        if (metadata.indicators && metadata.indicators.obv !== undefined) {
            const volumeTrend = metadata.indicators.obv >= 0 ? '上升' : '下降';
            this.updateElement('volume-trend', volumeTrend);
        }

        // Update signal
        const signal = this.generateSignal(data);
        this.updateSignal(signal);

        // Update trend
        if (metadata.analysis) {
            const trendEl = document.getElementById('trend');
            if (trendEl) {
                trendEl.textContent = this.getTrendText(metadata.analysis.trend);
                trendEl.setAttribute('data-value', metadata.analysis.trend || '');
            }
        }

        // Update technical analysis summary
        this.updateAnalysisSummary(metadata);

        // Update risk assessment
        this.updateRiskAssessment(metadata);

        // Update timestamp
        this.updateElement('last-update', new Date().toLocaleTimeString());
    }

    getTrendText(trend) {
        const trendMap = {
            'uptrend': '上升趋势',
            'downtrend': '下降趋势',
            'neutral': '横盘整理',
            'overbought': '超买',
            'oversold': '超卖'
        };
        return trendMap[trend] || trend || '-';
    }

    updateTechnicalIndicators(metadata) {
        if (!metadata.indicators) return;

        const { indicators } = metadata;

        // Update RSI
        const rsi = indicators.rsi;
        const rsiEl = document.getElementById('rsi');
        if (rsiEl) {
            rsiEl.textContent = rsi.toFixed(1);
            rsiEl.setAttribute('data-value', rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral');
        }

        // Update StochRSI
        if (indicators.stochRSI) {
            const stochK = indicators.stochRSI.k;
            const stochD = indicators.stochRSI.d;

            const kEl = document.getElementById('stoch-rsi-k');
            if (kEl) {
                kEl.textContent = stochK.toFixed(1);
                kEl.setAttribute('data-value', stochK > 80 ? 'overbought' : stochK < 20 ? 'oversold' : 'neutral');
            }

            const dEl = document.getElementById('stoch-rsi-d');
            if (dEl) {
                dEl.textContent = stochD.toFixed(1);
                dEl.setAttribute('data-value', stochD > 80 ? 'overbought' : stochD < 20 ? 'oversold' : 'neutral');
            }
        }

        // Update OBV
        if (indicators.obv !== undefined) {
            const obvEl = document.getElementById('obv');
            if (obvEl) {
                obvEl.textContent = indicators.obv.toFixed(2);
                obvEl.setAttribute('data-value', indicators.obv >= 0 ? 'positive' : 'negative');
            }
        }
    }

    updateAnalysisSummary(metadata) {
        const summaryEl = document.getElementById('analysis-summary');
        if (!summaryEl || !metadata.indicators) return;

        const { indicators } = metadata;
        const analysis = [];

        // RSI Analysis
        if (indicators.rsi > 70) {
            analysis.push(`RSI处于超买区间(${indicators.rsi.toFixed(1)})，可能面临回调风险`);
        } else if (indicators.rsi < 30) {
            analysis.push(`RSI处于超卖区间(${indicators.rsi.toFixed(1)})，可能出现反弹机会`);
        }

        // StochRSI Analysis
        if (indicators.stochRSI) {
            const { k, d } = indicators.stochRSI;
            if (k > d) {
                analysis.push(`随机RSI金叉形成(K:${k.toFixed(1)}, D:${d.toFixed(1)})，显示上升动能`);
            } else if (k < d) {
                analysis.push(`随机RSI死叉形成(K:${k.toFixed(1)}, D:${d.toFixed(1)})，显示下降压力`);
            }
        }

        // OBV Analysis
        if (indicators.obv !== undefined) {
            if (indicators.obv > 0) {
                analysis.push(`OBV为正值(${indicators.obv.toFixed(2)})，表明买方力量占优`);
            } else {
                analysis.push(`OBV为负值(${indicators.obv.toFixed(2)})，表明卖方压力较大`);
            }
        }

        // MACD Analysis
        if (indicators.macd !== undefined) {
            if (indicators.macd > 0) {
                analysis.push(`MACD为正值(${indicators.macd.toFixed(4)})，趋势向上`);
            } else {
                analysis.push(`MACD为负值(${indicators.macd.toFixed(4)})，趋势向下`);
            }
        }

        // Bollinger Bands Analysis
        if (indicators.bBands) {
            const { percentB } = indicators.bBands;
            if (percentB > 80) {
                analysis.push('价格接近布林带上轨，可能存在超买风险');
            } else if (percentB < 20) {
                analysis.push('价格接近布林带下轨，可能存在超卖机会');
            }
        }

        // Combine all analyses
        summaryEl.innerHTML = analysis.length > 0 
            ? analysis.join('<br>')
            : '市场处于中性状态，无明显信号';
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateSignal(signal) {
        const signalElement = document.getElementById('signal');
        if (!signalElement) return;

        signalElement.className = 'signal';
        signalElement.textContent = signal;
        signalElement.classList.add(signal.toLowerCase().replace(' ', '-'));
    }

    updateRiskAssessment(metadata) {
        const riskItems = document.getElementById('risk-items');
        if (!riskItems || !metadata.analysis) return;

        riskItems.innerHTML = '';
        
        const { analysis, indicators } = metadata;

        // Add risk items based on analysis
        if (analysis.riskLevel > 0.7) {
            this.addRiskItem(riskItems, '高风险条件 - 建议谨慎操作');
        } else if (analysis.riskLevel > 0.5) {
            this.addRiskItem(riskItems, '中等风险条件 - 注意风险控制');
        }

        if (indicators) {
            if (indicators.rsi > 70) {
                this.addRiskItem(riskItems,
                    `超买条件 (RSI: ${indicators.rsi.toFixed(1)}) - 注意回调风险`
                );
            } else if (indicators.rsi < 30) {
                this.addRiskItem(riskItems,
                    `超卖条件 (RSI: ${indicators.rsi.toFixed(1)}) - 关注反弹机会`
                );
            }

            if (indicators.stochRSI && indicators.stochRSI.k > 80 && indicators.stochRSI.d > 80) {
                this.addRiskItem(riskItems, 'StochRSI双线超买 - 可能出现回调');
            }
        }

        if (analysis.volatility > 0.02) {
            this.addRiskItem(riskItems, 
                `市场波动性较高 (${(analysis.volatility * 100).toFixed(1)}%) - 建议谨慎`
            );
        }
    }

    addRiskItem(container, message) {
        container.innerHTML += `
            <div class="risk-item">
                <span class="risk-icon">⚠️</span>
                <span>${message}</span>
            </div>
        `;
    }

    initializeUpdateLoop() {
        // Update immediately
        this.updatePrediction();
        // Then update every 5 seconds
        setInterval(() => this.updatePrediction(), this.updateInterval);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    // Wait a bit for TradingView to initialize
    setTimeout(() => new PredictionUpdater(), 2000);
});
