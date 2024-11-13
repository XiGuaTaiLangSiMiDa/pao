import axios from 'axios';
import { Exchange } from '../common/exchange.js';
import { Intervals } from '../common/types.js';

export class OKXExchange extends Exchange {
    constructor() {
        super('OKX');
        this.endpoints = [
            'https://www.okx.com',
            'https://aws.okx.com'
        ];
    }

    getExchangeInterval(standardInterval) {
        // OKX interval mapping
        const intervalMap = {
            '1m': '1m',
            '3m': '3m',
            '5m': '5m',
            '15m': '15m',
            '30m': '30m',
            '1h': '1H',
            '2h': '2H',
            '4h': '4H',
            '6h': '6H',
            '12h': '12H',
            '1d': '1D',
            '1w': '1W',
            '1M': '1M'
        };
        return intervalMap[standardInterval] || standardInterval;
    }

    convertSymbol(symbol) {
        // Convert from Binance format (e.g., SOLUSDT) to OKX format (e.g., SOL-USDT-SWAP)
        // First try with USDT
        let match = symbol.match(/^([A-Z]+)(USDT)$/);
        if (match) {
            return `${match[1]}-${match[2]}-SWAP`;
        }
        
        // Then try with BUSD
        match = symbol.match(/^([A-Z]+)(BUSD)$/);
        if (match) {
            return `${match[1]}-USDT-SWAP`; // Convert BUSD pairs to USDT
        }
        
        // If no match, try to split at common points
        const parts = symbol.match(/^([A-Z]+)([A-Z]{3,})$/);
        if (parts) {
            return `${parts[1]}-${parts[2]}-SWAP`;
        }
        
        // If still no match, return original with standard format
        return `${symbol}-SWAP`;
    }

    standardizeKlineData(exchangeData) {
        try {
            console.log('Raw OKX data:', exchangeData);
            
            const timestamp = parseInt(exchangeData[0]);
            if (!timestamp) {
                console.error('Invalid timestamp in OKX data');
                throw new Error('Invalid timestamp');
            }

            const standardized = {
                openTime: timestamp,
                open: parseFloat(exchangeData[1]),
                high: parseFloat(exchangeData[2]),
                low: parseFloat(exchangeData[3]),
                close: parseFloat(exchangeData[4]),
                volume: parseFloat(exchangeData[5]),
                closeTime: timestamp + 900000, // 15 minutes in milliseconds
                quoteVolume: parseFloat(exchangeData[6]),
                trades: 0, // OKX doesn't provide trade count
                takerBuyBaseVolume: parseFloat(exchangeData[5]) / 2, // Estimate as half of total volume
                takerBuyQuoteVolume: parseFloat(exchangeData[6]) / 2  // Estimate as half of quote volume
            };

            console.log('Standardized OKX data:', standardized);
            return standardized;
        } catch (error) {
            console.error('Error standardizing OKX data:', error);
            throw error;
        }
    }

    async fetchKlines(symbol, interval, limit, startTime = null, endTime = null) {
        try {
            const okxSymbol = this.convertSymbol(symbol);
            console.log('Original symbol:', symbol);
            console.log('OKX symbol:', okxSymbol);
            
            const params = {
                instId: okxSymbol,
                bar: this.getExchangeInterval(interval),
                limit: Math.min(limit, 100).toString() // OKX has a max limit of 100
            };

            if (startTime) params.after = startTime.toString();
            if (endTime) params.before = endTime.toString();

            console.log('OKX request params:', params);

            let allKlines = [];
            let currentStartTime = startTime;
            const batchSize = 100;

            while (allKlines.length < limit) {
                let retries = this.endpoints.length;
                let lastError = null;
                let batchData = null;

                while (retries > 0 && !batchData) {
                    try {
                        const endpoint = this.getCurrentEndpoint();
                        console.log(`Trying OKX endpoint: ${endpoint}`);
                        
                        // First try SWAP contract
                        let response = await axios.get(`${endpoint}/api/v5/market/history-candles`, {
                            params: {
                                ...params,
                                after: currentStartTime
                            },
                            timeout: 10000,
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });

                        // If SWAP fails, try spot market
                        if (!response.data?.data || response.data.data.length === 0) {
                            console.log('SWAP market failed, trying spot market...');
                            const spotSymbol = okxSymbol.replace('-SWAP', '');
                            response = await axios.get(`${endpoint}/api/v5/market/history-candles`, {
                                params: {
                                    ...params,
                                    instId: spotSymbol,
                                    after: currentStartTime
                                },
                                timeout: 10000,
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json'
                                }
                            });
                        }

                        console.log('OKX API response:', response.data);

                        if (!response.data || !response.data.data || response.data.data.length === 0) {
                            throw new Error('No data received from OKX API');
                        }

                        batchData = response.data.data;
                        console.log(`Received ${batchData.length} klines from OKX`);
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
                    throw lastError || new Error('Failed to fetch data from all OKX endpoints');
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

            console.log(`Successfully fetched ${allKlines.length} klines from OKX`);
            return allKlines;
        } catch (error) {
            console.error('OKX API error:', error);
            throw error;
        }
    }
}
