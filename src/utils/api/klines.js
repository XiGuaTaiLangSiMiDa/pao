import moment from 'moment';
import { fetchWithRetry } from './client.js';
import { validateKlineData, parseKlineData, validateApiResponse } from './validation.js';

async function fetchKlines({
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

        const response = await fetchWithRetry('/api/v3/klines', params);
        validateApiResponse(response);

        const klines = response.data.map(rawKline => {
            const kline = parseKlineData(rawKline);
            validateKlineData(kline);
            return kline;
        });

        return klines;
    } catch (error) {
        console.error('Error fetching klines:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

export { fetchKlines };
