import { BinanceExchange } from './binance/binance.js';
import { OKXExchange } from './okx/okx.js';

export class ExchangeManager {
    constructor() {
        this.exchanges = [
            new BinanceExchange(),
            new OKXExchange()
        ];
        this.currentExchangeIndex = 0;
        this.lastSuccessfulExchange = null;
    }

    getCurrentExchange() {
        // If we have a last successful exchange, try it first
        if (this.lastSuccessfulExchange) {
            return this.lastSuccessfulExchange;
        }
        return this.exchanges[this.currentExchangeIndex];
    }

    rotateExchange() {
        this.lastSuccessfulExchange = null; // Reset last successful exchange
        this.currentExchangeIndex = (this.currentExchangeIndex + 1) % this.exchanges.length;
        const exchange = this.getCurrentExchange();
        console.log(`Switching to ${exchange.name} exchange`);
        return exchange;
    }

    async fetchKlinesWithFallback(symbol, interval, limit, startTime = null, endTime = null) {
        console.log('\n=== Starting data fetch ===');
        console.log('Parameters:', {
            symbol,
            interval,
            limit,
            startTime: startTime ? new Date(startTime).toISOString() : null,
            endTime: endTime ? new Date(endTime).toISOString() : null
        });

        let attempts = this.exchanges.length * 2; // Give each exchange two tries
        let lastError = null;
        let klines = null;
        const errors = new Map(); // Track errors by exchange

        while (attempts > 0 && !klines) {
            const exchange = this.getCurrentExchange();
            console.log(`\n[Attempt ${this.exchanges.length * 2 - attempts + 1}] Using ${exchange.name}`);
            console.log(`Remaining attempts: ${attempts}`);
            
            try {
                console.log(`Fetching data from ${exchange.name}...`);
                
                klines = await exchange.fetchKlines(
                    symbol,
                    interval,
                    limit,
                    startTime,
                    endTime
                );

                if (!klines || klines.length === 0) {
                    throw new Error(`${exchange.name} returned empty data`);
                }

                if (klines.length < limit) {
                    console.warn(`Warning: Received fewer klines than requested: ${klines.length}/${limit}`);
                }

                // Store successful exchange
                this.lastSuccessfulExchange = exchange;
                console.log(`Successfully fetched ${klines.length} klines from ${exchange.name}`);

                // Validate data completeness with more lenient time gap check
                const timeGaps = this.checkTimeGaps(klines, interval);
                if (timeGaps.length > 0) {
                    console.warn('Found time gaps in data:', timeGaps);
                    // Only fail if gaps are more than 2x the interval
                    const bigGaps = timeGaps.filter(gap => Math.abs(gap.gapMinutes) > this.getIntervalMinutes(interval) * 2);
                    if (bigGaps.length > 0) {
                        throw new Error('Data contains large time gaps');
                    }
                }

                return klines;
            } catch (error) {
                console.error(`\n[${exchange.name} Error] ${error.message}`);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                    console.error('Response data:', error.response.data);
                }
                
                // Track error for this exchange
                errors.set(exchange.name, error.message);
                lastError = error;
                
                if (attempts > 1) {
                    console.log('\nTrying next exchange...');
                    this.rotateExchange();
                }
                
                attempts--;
            }
        }

        // If all exchanges fail, provide detailed error report
        console.error('\n=== All exchanges failed ===');
        errors.forEach((error, exchangeName) => {
            console.error(`${exchangeName}: ${error}`);
        });
        
        throw new Error('Failed to fetch data from all exchanges');
    }

    checkTimeGaps(klines, interval) {
        const gaps = [];
        const intervalMs = this.getIntervalMilliseconds(interval);

        for (let i = 1; i < klines.length; i++) {
            const expectedTime = klines[i - 1].openTime + intervalMs;
            const actualTime = klines[i].openTime;
            const gapMs = actualTime - expectedTime;
            const gapMinutes = gapMs / 1000 / 60;
            
            // Only report gaps larger than half the interval
            if (Math.abs(gapMs) > intervalMs / 2) {
                gaps.push({
                    previous: new Date(klines[i - 1].openTime).toISOString(),
                    current: new Date(actualTime).toISOString(),
                    expected: new Date(expectedTime).toISOString(),
                    gapMinutes: gapMinutes
                });
            }
        }

        return gaps;
    }

    getIntervalMilliseconds(interval) {
        return this.getIntervalMinutes(interval) * 60 * 1000;
    }

    getIntervalMinutes(interval) {
        const timeMap = {
            '1m': 1,
            '3m': 3,
            '5m': 5,
            '15m': 15,
            '30m': 30,
            '1h': 60,
            '2h': 120,
            '4h': 240,
            '6h': 360,
            '12h': 720,
            '1d': 1440,
            '1w': 10080,
            '1M': 43200
        };
        return timeMap[interval] || 15;
    }
}
