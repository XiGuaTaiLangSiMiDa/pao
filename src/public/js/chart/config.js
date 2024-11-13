const chartConfig = {
    "autosize": true,
    "symbol": "BINANCE:SOLUSDT",
    "interval": "15",
    "timezone": "local",
    "theme": "dark",
    "style": "1",
    "locale": "en",
    "enable_publishing": false,
    "hide_side_toolbar": false,
    "allow_symbol_change": false,
    "save_image": false,
    "container_id": "tradingview-widget",
    "studies": [
        {
            "id": "BB@tv-basicstudies",
            "inputs": {
                "length": 20,
                "stdDev": 2
            }
        }
    ],
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
    "overrides": {
        "paneProperties.background": "#1e222d",
        "paneProperties.vertGridProperties.color": "#363c4e",
        "paneProperties.horzGridProperties.color": "#363c4e",
    },
    "loading_screen": {
        "backgroundColor": "#1e222d",
        "foregroundColor": "#2962FF"
    },
    "custom_css_url": "./styles.css"
};
