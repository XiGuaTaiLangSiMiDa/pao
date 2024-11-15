import * as tf from '@tensorflow/tfjs-node';
import { fetchPredictionData } from './utils/dataFetcher.js';
import { preprocessFeatures } from './utils/preprocessing.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import fs from 'fs';

const PREDICTION_HISTORY_FILE = './models/prediction_history.json';
const MODEL_PATH = './models/best_model/model.json';
const PARAMETERS_PATH = './models/best_parameters.json';

async function validateModel() {
  // Check if model files exist
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error('Model file not found. Please train the model first.');
  }
  
  if (!fs.existsSync(PARAMETERS_PATH)) {
    throw new Error('Model parameters file not found. Please train the model first.');
  }

  // Load and validate parameters
  const parameters = JSON.parse(fs.readFileSync(PARAMETERS_PATH, 'utf8'));
  
  if (!parameters.timestamp || !parameters.hyperparameters) {
    throw new Error('Invalid model parameters file structure');
  }

  // Log model information
  console.log('Using model trained at:', parameters.timestamp);
  console.log('Model hyperparameters:', JSON.stringify(parameters.hyperparameters, null, 2));
  
  return parameters;
}

async function loadModel() {
  try {
    console.log('Validating model...');
    const parameters = await validateModel();

    console.log('Loading best model...');
    const model = await tf.loadLayersModel('file://./models/best_model/model.json');
    console.log('Model loaded successfully');
    
    return { model, parameters };
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
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

    // Log raw indicators for debugging
    console.log('\nRaw Indicator Values:');
    console.log(JSON.stringify({
      rsi: metadata.indicators.rsi,
      stochRSI: metadata.indicators.stochRSI,
      obv: metadata.indicators.obv,
      macd: metadata.indicators.macd,
      momentum: metadata.indicators.momentum,
      roc: metadata.indicators.roc,
      bBands: metadata.indicators.bBands
    }, null, 2));

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
    const predictedPrice = currentPrice * (1 + predictedChange[0]);
    
    // Determine prediction direction
    const direction = predictedChange[0] > 0 ? 'UP' : predictedChange[0] < 0 ? 'DOWN' : 'NEUTRAL';

    // Create prediction record with complete metadata
    const predictionRecord = {
      timestamp: Date.now(),
      predictedChange: predictedChange[0],
      predictedPrice,
      direction,
      confidence,
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
  // Adjust confidence calculation to account for directional predictions
  const changeMagnitude = Math.abs(predictedChange);
  return Math.min(100, Math.max(0, (
    // Prediction magnitude (30%)
    (Math.min(changeMagnitude, 0.5) * 60) +
    // RSI alignment with prediction (30%)
    ((predictedChange > 0 && rsi < 70) || (predictedChange < 0 && rsi > 30) ? 30 : 10) +
    // Low volatility (20%)
    (Math.max(0, 1 - volatility) * 20) +
    // Base confidence (10%)
    10
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
