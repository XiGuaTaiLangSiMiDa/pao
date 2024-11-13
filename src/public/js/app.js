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
            this.updateUI(data);
            this.updatePredictionHistory(data);
        } catch (error) {
            console.error('Error updating prediction:', error);
        }
    }

    updatePredictionHistory(data) {
        // Add new prediction to history
        const prediction = {
            time: new Date(),
            currentPrice: data.currentPrice,
            predictedChange: data.predictedChange,
            predictedPrice: data.predictedPrice,
            confidence: data.confidence,
            signal: data.signal
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
            case 'Buy': return 'buy-row';
            case 'Strong Sell': return 'strong-sell-row';
            case 'Sell': return 'sell-row';
            case 'Low Confidence': return 'low-confidence-row';
            default: return 'neutral-row';
        }
    }

    updateUI(data) {
        // Update price information
        this.updateElement('current-price', `$${data.currentPrice.toFixed(2)}`);
        this.updateElement('predicted-change', `${data.predictedChange.toFixed(2)}%`);
        this.updateElement('predicted-price', `$${data.predictedPrice.toFixed(2)}`);
        this.updateElement('confidence', `${data.confidence.toFixed(1)}%`);
        this.updateElement('rsi', data.rsi.toFixed(1));
        
        // Update market statistics
        const priceChangeEl = document.getElementById('price-change');
        priceChangeEl.textContent = `${data.priceChange24h.toFixed(2)}%`;
        priceChangeEl.className = `prediction-value ${data.priceChange24h >= 0 ? 'change-positive' : 'change-negative'}`;
        
        this.updateElement('high-price', `$${data.highPrice.toFixed(2)}`);
        this.updateElement('low-price', `$${data.lowPrice.toFixed(2)}`);
        
        // Update signal
        this.updateSignal(data.signal);

        // Update risk assessment
        this.updateRiskAssessment(data);

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
        switch(signal) {
            case 'Strong Buy':
                signalElement.textContent = 'Strong Buy';
                signalElement.classList.add('strong-buy');
                break;
            case 'Buy':
                signalElement.textContent = 'Buy';
                signalElement.classList.add('buy');
                break;
            case 'Strong Sell':
                signalElement.textContent = 'Strong Sell';
                signalElement.classList.add('strong-sell');
                break;
            case 'Sell':
                signalElement.textContent = 'Sell';
                signalElement.classList.add('sell');
                break;
            case 'Low Confidence':
                signalElement.textContent = 'Low Confidence';
                signalElement.classList.add('low-confidence');
                break;
            default:
                signalElement.textContent = 'Neutral';
                signalElement.classList.add('neutral');
        }
    }

    updateRiskAssessment(data) {
        const riskItems = document.getElementById('risk-items');
        if (!riskItems) return;

        riskItems.innerHTML = '';
        
        if (data.volatility > 2) {
            this.addRiskItem(riskItems, 
                `High market volatility (${data.volatility.toFixed(1)}%) - Exercise caution`
            );
        }
        if (data.rsi > 70) {
            this.addRiskItem(riskItems,
                `Overbought conditions (RSI: ${data.rsi.toFixed(1)}) - Potential reversal risk`
            );
        } else if (data.rsi < 30) {
            this.addRiskItem(riskItems,
                `Oversold conditions (RSI: ${data.rsi.toFixed(1)}) - Potential reversal risk`
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
