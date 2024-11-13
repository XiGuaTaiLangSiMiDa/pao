// Standard kline data structure that all exchanges should conform to
export const KlineFields = {
    openTime: 'openTime',      // Open time in milliseconds
    open: 'open',              // Open price
    high: 'high',              // High price
    low: 'low',                // Low price
    close: 'close',            // Close price
    volume: 'volume',          // Volume
    closeTime: 'closeTime',    // Close time in milliseconds
    quoteVolume: 'quoteVolume',// Quote asset volume
    trades: 'trades',          // Number of trades
    takerBuyBaseVolume: 'takerBuyBaseVolume',   // Taker buy base asset volume
    takerBuyQuoteVolume: 'takerBuyQuoteVolume'  // Taker buy quote asset volume
};

// Standard interval mapping
export const Intervals = {
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '2h',
    '4h': '4h',
    '6h': '6h',
    '8h': '8h',
    '12h': '12h',
    '1d': '1d',
    '3d': '3d',
    '1w': '1w',
    '1M': '1M'
};
