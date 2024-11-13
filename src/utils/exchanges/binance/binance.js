import axios from 'axios';
import { Exchange } from '../common/exchange.js';
import { Intervals } from '../common/types.js';

export class BinanceExchange extends Exchange {
    constructor() {
        super('Binance');
        this.endpoints = [
            'https://fapi.binance.com',
            'https://fapi1.binance.com',
            'https://fapi2.binance.com',
            'https://fapi3.binance.com',
            'https://dapi.binance.com',
            'https://api.binance.com',
            'https://api-gcp.binance.com',
            'https://api1.binance.com',
            'https://api2.binance.com',
            'https://api3.binance.com',
            'https://api4.binance.com'
        ];
    }

    getExchangeInterval(standardInterval) {
        // Binance uses the same interval format as our standard
        return standardInterval;
    }

    standardizeKlineData(exchangeData) {
        try {
            console.log('Raw Binance data:', exchangeData);
            
            const standardized = {
                openTime: exchangeData[0],
                open: parseFloat(exchangeData[1]),
                high: parseFloat(exchangeData[2]),
                low: parseFloat(exchangeData[3]),
                close: parseFloat(exchangeData[4]),
                volume: parseFloat(exchangeData[5]),
                closeTime: exchangeData[6],
                quoteVolume: parseFloat(exchangeData[7]),
                trades: exchangeData[8],
                takerBuyBaseVolume: parseFloat(exchangeData[9]),
                takerBuyQuoteVolume: parseFloat(exchangeData[10])
            };

            console.log('Standardized Binance data:', standardized);
            return standardized;
        } catch (error) {
            console.error('Error standardizing Binance data:', error);
            throw error;
        }
    }

    async tryFuturesAPI(endpoint, params, currentStartTime) {
        try {
            console.log('Trying Binance Futures API...');
            const response = await axios.get(`${endpoint}/fapi/v1/klines`, {
                params: {
                    ...params,
                    startTime: currentStartTime
                },
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            return response;
        } catch (error) {
            console.log('Futures API failed:', error.message);
            throw error;
        }
    }

    async trySpotAPI(endpoint, params, currentStartTime) {
        try {
            console.log('Trying Binance Spot API...');
            const response = await axios.get(`${endpoint}/api/v3/klines`, {
                params: {
                    ...params,
                    startTime: currentStartTime
                },
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            return response;
        } catch (error) {
            console.log('Spot API failed:', error.message);
            throw error;
        }
    }

    async fetchKlines(symbol, interval, limit, startTime = null, endTime = null) {
        try {
            console.log('Binance fetch params:', { symbol, interval, limit, startTime, endTime });

            const params = {
                symbol: symbol.toUpperCase(),
                interval: this.getExchangeInterval(interval),
                limit: Math.min(limit, 1500) // Binance has a max limit of 1500
            };

            if (startTime) params.startTime = startTime;
            if (endTime) params.endTime = endTime;

            let allKlines = [];
            let currentStartTime = startTime;
            const batchSize = 1500;

            while (allKlines.length < limit) {
                let retries = this.endpoints.length;
                let lastError = null;
                let batchData = null;

                while (retries > 0 && !batchData) {
                    try {
                        const endpoint = this.getCurrentEndpoint();
                        console.log(`\nTrying Binance endpoint: ${endpoint}`);
                        
                        let response;
                        try {
                            // Try futures API first
                            response = await this.tryFuturesAPI(endpoint, params, currentStartTime);
                        } catch (futuresError) {
                            console.log('Falling back to spot API...');
                            // If futures fails, try spot API
                            response = await this.trySpotAPI(endpoint, params, currentStartTime);
                        }

                        console.log('Binance API response status:', response.status);

                        if (!response.data) {
                            throw new Error('No data received from Binance API');
                        }

                        batchData = response.data;
                        console.log(`Received ${batchData.length} klines from Binance`);
                    } catch (error) {
                        lastError = error;
                        console.log(`Failed with endpoint ${this.getCurrentEndpoint()}:`, error.message);
                        if (error.response) {
                            console.log('Response status:', error.response.status);
                            console.log('Response data:', error.response.data);
                        }
                        this.rotateEndpoint();
                        retries--;
                    }
                }

                if (!batchData) {
                    throw lastError || new Error('Failed to fetch data from all Binance endpoints');
                }

                const klines = batchData.map(kline => {
                    const standardizedKline = this.standardizeKlineData(kline);
                    this.validateKlineData(standardizedKline);
                    return standardizedKline;
                });

                allKlines = allKlines.concat(klines);

                if (batchData.length < batchSize) {
                    break; // No more data available
                }

                currentStartTime = allKlines[allKlines.length - 1].openTime;
            }

            // Trim to requested limit
            allKlines = allKlines.slice(0, limit);

            console.log(`Successfully fetched ${allKlines.length} klines from Binance`);
            return allKlines;
        } catch (error) {
            console.error('Binance API error:', error);
            throw error;
        }
    }
}
