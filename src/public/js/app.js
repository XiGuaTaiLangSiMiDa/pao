class PredictionUpdater {
    constructor() {
        this.updateInterval = 5000; // 5 seconds
        this.initializeUpdateLoop();
    }

    async updatePrediction() {
        try {
            const response = await fetch('/predict');
            const data = await response.json();
            this.updateUI(data);
        } catch (error) {
            console.error('Error updating prediction:', error);
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
