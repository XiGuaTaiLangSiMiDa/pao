import { KlineFields, Intervals } from './types.js';

export class Exchange {
    constructor(name) {
        this.name = name;
        this.endpoints = [];
        this.currentEndpointIndex = 0;
    }

    // Get current endpoint
    getCurrentEndpoint() {
        return this.endpoints[this.currentEndpointIndex];
    }

    // Rotate to next endpoint
    rotateEndpoint() {
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
        return this.getCurrentEndpoint();
    }

    // Convert interval to exchange-specific format
    getExchangeInterval(standardInterval) {
        throw new Error('getExchangeInterval must be implemented by exchange class');
    }

    // Convert exchange kline data to standard format
    standardizeKlineData(exchangeData) {
        throw new Error('standardizeKlineData must be implemented by exchange class');
    }

    // Fetch klines data
    async fetchKlines(symbol, interval, limit, startTime = null, endTime = null) {
        throw new Error('fetchKlines must be implemented by exchange class');
    }

    // Validate kline data
    validateKlineData(kline) {
        const requiredFields = Object.values(KlineFields);
        const isValid = requiredFields.every(field => {
            const value = kline[field];
            return value !== undefined && value !== null && !isNaN(value) && isFinite(value);
        });
        
        if (!isValid) {
            throw new Error(`Invalid kline data from ${this.name}: Missing or invalid required fields`);
        }
        
        return true;
    }

    // Handle API errors
    handleError(error) {
        console.error(`${this.name} API error:`, error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}
