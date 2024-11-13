import { ExchangeManager } from './exchanges/exchangeManager.js';
import { prepareTrainingData } from './api/data.js';
import {
    calculateMomentum,
    calculateROC,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands
} from './api/indicators.js';

const exchangeManager = new ExchangeManager();

export async function fetchKlines({
    symbol = 'SOLUSDT',
    interval = '15m',
    limit = 1500,
    startTime = null,
    endTime = null
}) {
    return await exchangeManager.fetchKlinesWithFallback(
        symbol,
        interval,
        limit,
        startTime,
        endTime
    );
}

// Re-export data preparation and technical indicators
export {
    prepareTrainingData,
    calculateMomentum,
    calculateROC,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands
};
