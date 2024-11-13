import { fetchKlines } from './data/fetcher.js';
import { 
    generateTrainingData,
    generatePredictionData,
    WindowConfig,
    generateMetadata
} from './data/features/index.js';

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
        const klines = await fetchKlines({
            symbol,
            interval,
            limit,
            startTime,
            endTime
        });
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
        // Fetch enough klines for the lookback window plus indicators
        const klines = await fetchKlines({
            symbol,
            interval,
            limit: lookback + 5
        });
        console.log(`Fetched ${klines.length} klines`);

        console.log('Generating prediction features...');
        const result = generatePredictionData(klines, lookback);
        console.log('Features generated for current k-bar');

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

    return true;
}
