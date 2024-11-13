import axios from 'axios';
import moment from 'moment';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Data validation function
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

export async function fetchKlines({
  symbol = 'SOLUSDT',
  interval = '15m',
  limit = 1500,
  startTime = null,
  endTime = null
}) {
  try {
    const params = {
      symbol,
      interval,
      limit
    };

    if (startTime) {
      params.startTime = moment(startTime).valueOf();
    }
    if (endTime) {
      params.endTime = moment(endTime).valueOf();
    }

    const response = await axios.get(`${BINANCE_API_BASE}/klines`, { params });
    
    let retries = 3;
    while (retries > 0 && !response.data) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await axios.get(`${BINANCE_API_BASE}/klines`, { params });
      retries--;
    }

    if (!response.data) {
      throw new Error('Failed to fetch kline data after retries');
    }
    console.log(`First line: ${response.data[0]}`);
    console.log(`Last line: ${response.data[response.data.length - 1]}`);
    
    const klines = response.data.map(kline => ({
      openTime: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      closeTime: kline[6],
      quoteVolume: parseFloat(kline[7]),
      trades: kline[8],
      takerBuyBaseVolume: parseFloat(kline[9]),
      takerBuyQuoteVolume: parseFloat(kline[10])
    }));
    console.log(`Klines: ${klines.length}`);
    klines.forEach(validateKlineData);

    return klines;
  } catch (error) {
    console.error('Error fetching klines:', error.message);
    throw error;
  }
}
