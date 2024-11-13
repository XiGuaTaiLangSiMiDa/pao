function initChart() {
    new TradingView.widget({
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
        }
    });
}
