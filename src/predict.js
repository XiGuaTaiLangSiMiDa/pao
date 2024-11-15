import { fetchPredictionData } from './utils/dataFetcher.js';
import { preprocessFeatures } from './utils/preprocessing.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import { loadModel } from './utils/model/modelLoader.js';
import { analyzeTechnicalIndicators } from './utils/analysis/technicalAnalysis.js';
import { calculateConfidence, generateSignal } from './utils/prediction/confidenceCalculator.js';
import fs from 'fs';

const PREDICTION_HISTORY_FILE = './models/prediction_history.json';

export async function makePrediction() {
    try {
        const { model, parameters } = await loadModel();

        // Fetch data and generate features
        console.log('Fetching latest market data...');
        const { features, metadata } = await fetchPredictionData({
            interval: '15m',
            lookback: WindowConfig.DEFAULT_LOOKBACK
        });
        
        if (!features || features.length === 0 || !features[0]) {
            throw new Error('No features generated from the data');
        }

        if (!metadata || !metadata.price || !metadata.indicators || !metadata.analysis) {
            throw new Error('Invalid metadata structure from prediction data');
        }

        // Analyze technical indicators
        const analysis = analyzeTechnicalIndicators(metadata.indicators);
        console.log('\nTechnical Analysis:', analysis.signals.join('\n'));

        const latestFeature = features[0];
        const currentPrice = metadata.price.close;
        
        // Preprocess features using the same pipeline as training
        console.log('\nPreprocessing features...');
        const preprocessedFeatures = await preprocessFeatures(features);
        console.log('Preprocessed feature shape:', preprocessedFeatures.shape);
        
        // Make prediction
        console.log('\nMaking prediction...');
        const prediction = model.predict(preprocessedFeatures);
        const predictedChange = await prediction.data();
        console.log('Prediction completed');
        
        // Calculate confidence score
        const confidence = calculateConfidence(
            predictedChange[0],
            metadata.indicators.rsi,
            metadata.analysis.volatility,
            metadata.indicators.adx?.adx,
            metadata.indicators.cmf
        );

        // Clean up tensors
        preprocessedFeatures.dispose();
        prediction.dispose();

        // Calculate predicted price
        const predictedPrice = currentPrice * (1 + predictedChange[0]/100);
        
        // Determine prediction direction and signal
        const direction = predictedChange[0] > 0 ? 'UP' : predictedChange[0] < 0 ? 'DOWN' : 'NEUTRAL';
        const signal = generateSignal(predictedChange[0], confidence);

        // Create prediction record
        const predictionRecord = {
            timestamp: Date.now(),
            predictedChange: predictedChange[0],
            predictedPrice,
            direction,
            confidence,
            signal,
            modelInfo: {
                trainedAt: parameters.timestamp,
                hyperparameters: parameters.hyperparameters
            },
            metadata: {
                price: {
                    open: metadata.price.open,
                    high: metadata.price.high,
                    low: metadata.price.low,
                    close: metadata.price.close
                },
                indicators: {
                    rsi: metadata.indicators.rsi,
                    stochRSI: metadata.indicators.stochRSI,
                    obv: metadata.indicators.obv,
                    macd: metadata.indicators.macd,
                    momentum: metadata.indicators.momentum,
                    roc: metadata.indicators.roc,
                    bBands: metadata.indicators.bBands,
                    adx: metadata.indicators.adx,
                    atr: metadata.indicators.atr,
                    cmf: metadata.indicators.cmf
                },
                analysis: {
                    signals: analysis.signals,
                    trend: analysis.trend,
                    strength: analysis.strength,
                    volatility: metadata.analysis.volatility,
                    riskLevel: metadata.analysis.riskLevel
                }
            }
        };

        // Save prediction to history
        fs.writeFileSync(PREDICTION_HISTORY_FILE, JSON.stringify([predictionRecord], null, 2));

        // Log prediction details
        console.log('\nPrediction Record:', JSON.stringify(predictionRecord, null, 2));

        return predictionRecord;

    } catch (error) {
        console.error('Error making prediction:', error);
        console.error('Error stack:', error.stack);
        if (error.message.includes('tensor')) {
            console.error('Tensor shape error. Please check the input data format.');
            console.error(`Expected shape: [null,${WindowConfig.DEFAULT_LOOKBACK},16]`);
        }
        throw error;
    }
}

// If directly run this file, execute prediction
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('Starting prediction process...');
    makePrediction().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
