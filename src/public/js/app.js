class PredictionUpdater {
    constructor() {
        this.updateInterval = 5000; // 5 seconds
        this.predictionHistory = [];
        this.historyLimit = 1080; // 2 hours worth of 5-minute predictions
        this.initializeUpdateLoop();
    }

    async updatePrediction() {
        try {
            const response = await fetch('/predict');
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
            signal: this.generateSignal(data)
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
        this.updateElement('rsi', metadata.indicators.rsi.toFixed(1));
        
        // Update market statistics
        const priceChange = ((metadata.price.close - metadata.price.open) / metadata.price.open) * 100;
        const priceChangeEl = document.getElementById('price-change');
        if (priceChangeEl) {
            priceChangeEl.textContent = `${priceChange.toFixed(2)}%`;
            priceChangeEl.className = `prediction-value ${priceChange >= 0 ? 'change-positive' : 'change-negative'}`;
        }
        
        this.updateElement('high-price', `$${metadata.price.high.toFixed(2)}`);
        this.updateElement('low-price', `$${metadata.price.low.toFixed(2)}`);
        
        // Update signal
        const signal = this.generateSignal(data);
        this.updateSignal(signal);

        // Update risk assessment
        this.updateRiskAssessment(metadata);

        // Update timestamp
        this.updateElement('last-update', new Date().toLocaleTimeString());
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
        if (!riskItems) return;

        riskItems.innerHTML = '';
        
        if (!metadata.analysis) return;

        // Add risk items based on analysis
        if (metadata.analysis.riskLevel > 0.7) {
            this.addRiskItem(riskItems, 'High risk conditions - Exercise extreme caution');
        } else if (metadata.analysis.riskLevel > 0.5) {
            this.addRiskItem(riskItems, 'Moderate risk conditions - Trade with caution');
        }

        if (metadata.analysis.trend === 'overbought') {
            this.addRiskItem(riskItems,
                `Overbought conditions (RSI: ${metadata.indicators.rsi.toFixed(1)}) - Potential reversal risk`
            );
        } else if (metadata.analysis.trend === 'oversold') {
            this.addRiskItem(riskItems,
                `Oversold conditions (RSI: ${metadata.indicators.rsi.toFixed(1)}) - Potential reversal risk`
            );
        }

        if (metadata.analysis.volatility > 0.02) {
            this.addRiskItem(riskItems, 
                `High market volatility (${(metadata.analysis.volatility * 100).toFixed(1)}%) - Exercise caution`
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
    new PredictionUpdater();
});
