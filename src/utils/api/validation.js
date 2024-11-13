// Validate required fields in kline data
function validateKlineData(kline) {
    const requiredFields = ['openTime', 'open', 'high', 'low', 'close', 'volume'];
    const isValid = requiredFields.every(field => {
        const value = kline[field];
        return value !== undefined && value !== null && !isNaN(value) && isFinite(value);
    });
    
    if (!isValid) {
        throw new Error('Invalid kline data: Missing or invalid required fields');
    }
    
    return true;
}

// Parse raw kline data into structured format
function parseKlineData(rawKline) {
    return {
        openTime: rawKline[0],
        open: parseFloat(rawKline[1]),
        high: parseFloat(rawKline[2]),
        low: parseFloat(rawKline[3]),
        close: parseFloat(rawKline[4]),
        volume: parseFloat(rawKline[5]),
        closeTime: rawKline[6],
        quoteVolume: parseFloat(rawKline[7]),
        trades: rawKline[8],
        takerBuyBaseVolume: parseFloat(rawKline[9]),
        takerBuyQuoteVolume: parseFloat(rawKline[10])
    };
}

// Validate API response
function validateApiResponse(response) {
    if (!response || !response.data) {
        throw new Error('No data received from API');
    }
    return true;
}

export { validateKlineData, parseKlineData, validateApiResponse };
