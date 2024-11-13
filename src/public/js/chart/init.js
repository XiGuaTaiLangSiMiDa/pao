import { chartConfig } from './config.js';

let widget = null;

function initChart() {
    return new Promise((resolve) => {
        const container = document.getElementById('tradingview-widget');
        
        // Create widget
        widget = new TradingView.widget({
            ...chartConfig,
            container: container,
            onChartReady: () => {
                console.log('Chart is ready');
                window.tvWidget = widget;
                resolve(widget);
            }
        });
    });
}

function getWidget() {
    return widget;
}

export { initChart, getWidget };
