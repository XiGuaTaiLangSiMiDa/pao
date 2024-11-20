import { fetchKlines } from './data/fetcher.js';
import { 
    generateTrainingData,
    generatePredictionData,
    WindowConfig
} from './data/features/index.js';
import { klineCache } from './cache/cache.js';

export async function fetchTrainingData({
    symbol = 'SOLUSDT',
    interval = '15m',
    limit = 1500,
    lookback = WindowConfig.DEFAULT_LOOKBACK,
    startTime = null,
    endTime = null
}) {
    try {
        console.log('Fetching training data...');
        /**
        const klines = await fetchKlines({
            symbol,
            interval,
            limit,
            startTime,
            endTime
        });
         */
        const klines = await klineCache.update(symbol);
        console.log(`Fetched ${klines.length} klines`);

        console.log('Generating training features...');
        const result = generateTrainingData(klines, lookback);
        console.log(`Generated ${result.features.length} feature windows`);

        return result;
    } catch (error) {
        console.error('Error fetching training data:', error);
        throw error;
    }
}

export async function fetchPredictionData({
    symbol = 'SOLUSDT',
    interval = '15m',
    lookback = WindowConfig.DEFAULT_LOOKBACK
}) {
    try {
        console.log('Fetching prediction data...');
        // Calculate required periods for indicators
        const rsiPeriod = 14;
        const stochPeriod = 14;
        const smoothK = 3;
        const smoothD = 3;
        const extraPeriodsNeeded = rsiPeriod + stochPeriod + smoothK + smoothD;
        
        // Fetch enough klines for indicators plus lookback window
        const klines = await fetchKlines({
            symbol,
            interval,
            limit: lookback + extraPeriodsNeeded
        });
        console.log(`Fetched ${klines.length} klines`);

        if (!klines || klines.length < lookback + extraPeriodsNeeded) {
            throw new Error(`Insufficient kline data: need at least ${lookback + extraPeriodsNeeded} klines, got ${klines?.length}`);
        }

        console.log('Generating prediction features...');
        const result = generatePredictionData(klines, lookback);
        
        // Validate prediction data
        if (!result || !result.features || !result.metadata) {
            throw new Error('Invalid prediction data generated');
        }

        if (!result.metadata.price || !result.metadata.indicators || !result.metadata.analysis) {
            throw new Error('Invalid metadata structure in prediction data');
        }

        // Log indicator calculation details
        console.log('Indicator calculation details:', {
            dataPoints: klines.length,
            requiredPeriods: {
                lookback,
                rsi: rsiPeriod,
                stochastic: stochPeriod,
                smoothK,
                smoothD,
                total: lookback + extraPeriodsNeeded
            }
        });

        return {
            ...result,
            symbol,
            interval,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error fetching prediction data:', error);
        throw error;
    }
}

export function validatePredictionResult(result) {
    if (!result || !result.features || !result.features[0]) {
        throw new Error('Invalid prediction result: missing features');
    }

    if (!result.metadata) {
        throw new Error('Invalid prediction result: missing metadata');
    }

    const { features, metadata } = result;
    
    if (!Array.isArray(features[0]) || features[0].length !== WindowConfig.DEFAULT_LOOKBACK) {
        throw new Error(`Invalid feature window size: ${features[0]?.length}`);
    }

    if (!metadata.price || !metadata.indicators || !metadata.analysis) {
        throw new Error('Invalid metadata structure in prediction result');
    }

    return true;
}
