import * as tf from '@tensorflow/tfjs-node';
import { fetchPredictionData } from './utils/dataFetcher.js';
import { preprocessFeatures } from './utils/preprocessing.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import fs from 'fs';

const PREDICTION_HISTORY_FILE = './models/prediction_history.json';

async function loadModel() {
  try {
    console.log('Loading best model...');
    const model = await tf.loadLayersModel('file://./models/best_model/model.json');
    console.log('Model loaded successfully');
    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
}

export async function makePrediction() {
  try {
    const model = await loadModel();

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

    const latestFeature = features[0];
    const currentPrice = metadata.price.close;
    
    // Preprocess features using the same pipeline as training
    console.log('Preprocessing features...');
    const preprocessedFeatures = await preprocessFeatures(features);
    console.log('Preprocessed feature shape:', preprocessedFeatures.shape);
    
    // Make prediction
    console.log('Making prediction...');
    const prediction = model.predict(preprocessedFeatures);
    const predictedChange = await prediction.data();
    console.log('Prediction completed');
    
    // Calculate confidence score based on prediction magnitude and market conditions
    const confidence = calculateConfidence(
      predictedChange[0],
      metadata.indicators.rsi,
      metadata.analysis.volatility
    );

    // Clean up tensors
    preprocessedFeatures.dispose();
    prediction.dispose();

    // Calculate predicted price
    const predictedPrice = currentPrice * (1 + predictedChange[0]/100);

    // Create prediction record with complete metadata
    const predictionRecord = {
      timestamp: Date.now(),
      predictedChange: predictedChange[0],
      predictedPrice,
      confidence,
      metadata: {
        price: {
          open: metadata.price.open,
          high: metadata.price.high,
          low: metadata.price.low,
          close: metadata.price.close
        },
        indicators: {
          rsi: metadata.indicators.rsi,
          momentum: metadata.indicators.momentum,
          macd: metadata.indicators.macd,
          roc: metadata.indicators.roc,
          bBands: metadata.indicators.bBands
        },
        analysis: {
          trend: metadata.analysis.trend,
          strength: metadata.analysis.strength,
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

function calculateConfidence(predictedChange, rsi, volatility) {
  return Math.min(100, Math.max(0, (
    // Prediction magnitude (30%)
    (Math.min(Math.abs(predictedChange) / 2, 1) * 30) +
    // RSI not at extremes (30%)
    ((rsi > 30 && rsi < 70) ? 30 : 10) +
    // Low volatility (20%)
    (Math.max(0, 1 - volatility) * 20) +
    // Base confidence (20%)
    20
  )));
}

// If directly run this file, execute prediction
if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('Starting prediction process...');
  makePrediction().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
