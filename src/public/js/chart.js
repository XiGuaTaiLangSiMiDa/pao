let tvWidget = null;

function initChart() {
    tvWidget = new TradingView.widget({
        "width": "100%",
        "height": "600",
        "symbol": "BINANCE:SOLUSDT",
        "interval": "15",
        "timezone": "local",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": false,
        "studies": [
            {
                "id": "BB@tv-basicstudies",
                "inputs": {
                    "length": 20,
                    "stdDev": 2
                }
            }
        ],
        "container_id": "tradingview-widget",
        "studies_overrides": {
            "bollinger bands.median.color": "#606060",
            "bollinger bands.upper.color": "#26a69a",
            "bollinger bands.lower.color": "#ef5350",
            "bollinger bands.median.linewidth": 2,
            "bollinger bands.upper.linewidth": 2,
            "bollinger bands.lower.linewidth": 2,
            "bollinger bands.median.linestyle": 0,
            "bollinger bands.upper.linestyle": 2,
            "bollinger bands.lower.linestyle": 2
        },
        // Add ready callback
        datafeed: {
            onReady: cb => {
                console.log('Datafeed ready');
                cb({
                    supported_resolutions: ["15"]
                });
            },
            getBars: async (symbolInfo, resolution, from, to, onHistoryCallback) => {
                console.log('Getting bars:', { symbolInfo, resolution, from, to });
                // This will be called by TradingView to get historical data
                const bars = await getBinanceBars(from, to);
                onHistoryCallback(bars);
            },
            subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscribeUID, onResetCacheNeededCallback) => {
                console.log('Subscribing to bars:', symbolInfo);
                // Handle real-time updates here if needed
            },
            unsubscribeBars: (subscribeUID) => {
                console.log('Unsubscribing from bars:', subscribeUID);
            }
        }
    });

    // Store widget reference in container for access by app.js
    const container = document.getElementById('tradingview-widget');
    if (container) {
        container._widget = tvWidget;
    }
}

// Function to get chart data
async function getChartData() {
    try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - (25 * 15 * 60); // 25 candles * 15 minutes
        const bars = await getBinanceBars(from, now);
        
        if (!bars || bars.length < 25) {
            console.log('Not enough bars:', bars?.length);
            return null;
        }

        // Convert to kline format
        const klines = bars.map(bar => ({
            openTime: bar.time * 1000,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            closeTime: (bar.time + 900) * 1000 // 15 minutes in seconds
        }));

        return klines;
    } catch (error) {
        console.error('Error getting chart data:', error);
        return null;
    }
}

async function getBinanceBars(from, to) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=15m&startTime=${from * 1000}&endTime=${to * 1000}&limit=25`);
        const data = await response.json();
        
        return data.map(d => ({
            time: Math.floor(d[0] / 1000),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        }));
    } catch (error) {
        console.error('Error fetching Binance data:', error);
        return [];
    }
}

// Export for use in app.js
window.initChart = initChart;
window.getChartData = getChartData;
window.getTVWidget = () => tvWidget;
