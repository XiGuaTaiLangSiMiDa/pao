import { fetchPredictionData } from './utils/dataFetcher.js';
import { preprocessFeatures } from './utils/preprocessing.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import { loadModel } from './utils/model/modelLoader.js';
import { analyzeTechnicalIndicators } from './utils/analysis/technicalAnalysis.js';
import { calculateConfidence, generateSignal } from './utils/prediction/confidenceCalculator.js';
import { HYPERPARAMETERS } from './hyperparameters.js';
import fs from 'fs';

const PREDICTION_HISTORY_FILE = './models/prediction_history.json';

// Analyze indicator effectiveness based on ranges
function analyzeIndicatorRanges(indicators) {
    const analysis = {
        trend: 0,
        momentum: 0,
        volatility: 0,
        volume: 0
    };

    // Trend indicators
    if (indicators.adx) {
        // ADX effectiveness increases at higher ranges
        if (indicators.adx.adx >= 80) analysis.trend += 1.65;  // 44.44% effective
        else if (indicators.adx.adx >= 60) analysis.trend += 1.59;  // ~35% effective
        else if (indicators.adx.adx >= 30) analysis.trend += 1.09;  // ~25% effective
    }

    // MACD effectiveness
    if (indicators.macd) {
        const macdValue = indicators.macd.histogram;
        analysis.trend += (macdValue < 0) ? 1.11 : 0.93;  // More effective for negative values
    }

    // Momentum indicators
    if (indicators.momentum) {
        const momValue = Math.abs(indicators.momentum);
        if (momValue <= 10) analysis.momentum += 1.79;  // Most effective at range 0-10
        else if (momValue >= 90) analysis.momentum += 1.23;  // Also effective at high ranges
    }

    // Volatility/ATR effectiveness
    if (indicators.atr) {
        const normalizedATR = indicators.atr / indicators.price;
        if (normalizedATR >= 0.02) analysis.volatility += 2.42;  // 57.14% effective at highest range
        else if (normalizedATR >= 0.015) analysis.volatility += 1.62;  // ~38% effective
        else if (normalizedATR >= 0.01) analysis.volatility += 1.09;  // ~25% effective
    }

    // Volume indicators
    if (indicators.cmf) {
        analysis.volume += indicators.cmf > 0 ? 1.04 : 0.93;
    }
    if (indicators.obv) {
        analysis.volume += indicators.obv > 0 ? 1.07 : 0.82;
    }

    return analysis;
}

// Detect potential reversal patterns
function detectReversalPattern(metadata) {
    const { indicators, analysis } = metadata;
    let reversalScore = 0;
    let reversalType = null;

    // Check RSI extremes
    if (indicators.rsi <= 30) {
        reversalScore += 1;
        reversalType = 'upward';
    } else if (indicators.rsi >= 70) {
        reversalScore += 1;
        reversalType = 'downward';
    }

    // Check ADX strength
    if (indicators.adx?.adx >= 60) {
        reversalScore += 1;
    }

    // Check volume confirmation
    if (Math.abs(indicators.cmf) >= 0.15) {
        reversalScore += 1;
    }

    // Check volatility expansion
    if (analysis.volatility >= 1.5) {
        reversalScore += 1;
    }

    return {
        score: reversalScore,
        type: reversalType,
        strength: reversalScore / 4  // Normalize to 0-1 range
    };
}

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

        // Analyze technical indicators with optimized weights
        const analysis = analyzeTechnicalIndicators(metadata.indicators);
        console.log('\nTechnical Analysis:', analysis.signals.join('\n'));

        // Analyze indicator ranges effectiveness
        const rangeEffectiveness = analyzeIndicatorRanges(metadata.indicators);
        console.log('\nIndicator Range Effectiveness:', rangeEffectiveness);

        // Detect potential reversal patterns
        const reversalAnalysis = detectReversalPattern(metadata);
        console.log('\nReversal Analysis:', reversalAnalysis);

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
        
        // Calculate confidence score with enhanced indicators
        const confidence = calculateConfidence(
            predictedChange[0],
            metadata.indicators.rsi,
            metadata.analysis.volatility,
            metadata.indicators.adx?.adx,
            metadata.indicators.cmf
        );

        // Adjust confidence based on reversal pattern strength
        const adjustedConfidence = confidence * (1 + reversalAnalysis.strength * 0.2);

        // Clean up tensors
        preprocessedFeatures.dispose();
        prediction.dispose();

        // Calculate predicted price
        const predictedPrice = currentPrice * (1 + predictedChange[0]/100);
        
        // Generate signal with enhanced confidence
        const signal = generateSignal(predictedChange[0], adjustedConfidence);

        // Create prediction record with enhanced metadata
        const predictionRecord = {
            timestamp: Date.now(),
            predictedChange: predictedChange[0],
            predictedPrice,
            confidence: adjustedConfidence,
            signal,
            reversal: reversalAnalysis,
            rangeEffectiveness,
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
            console.error(`Expected shape: [null,${WindowConfig.DEFAULT_LOOKBACK},${HYPERPARAMETERS.featureSize}]`);
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
