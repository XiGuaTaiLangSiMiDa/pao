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
    
    if (features.length === 0 || !features[0]) {
      throw new Error('No features generated from the data');
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

    // Save prediction to history
    const predictionRecord = {
      timestamp: Date.now(),
      currentPrice,
      predictedChange: predictedChange[0],
      predictedPrice,
      confidence,
      ...metadata
    };
    fs.writeFileSync(PREDICTION_HISTORY_FILE, JSON.stringify([predictionRecord], null, 2));

    // Output results
    console.log('\nMarket Analysis:');
    console.log('Current SOL Price:', currentPrice.toFixed(2), 'USDT');
    console.log('Market Volatility:', (metadata.analysis.volatility * 100).toFixed(2) + '%');
    console.log('RSI:', metadata.indicators.rsi.toFixed(2));
    console.log('Trend:', metadata.analysis.trend);
    console.log('Strength:', metadata.analysis.strength);
    
    console.log('\nPrediction Results:');
    console.log('Predicted 1h Price Change:', predictedChange[0].toFixed(2) + '%');
    console.log('Prediction Confidence:', confidence.toFixed(2) + '%');
    console.log('Predicted Price in 1h:', predictedPrice.toFixed(2), 'USDT');
    
    // Market statistics
    console.log('\nMarket Statistics:');
    console.log('High:', metadata.price.high.toFixed(2), 'USDT');
    console.log('Low:', metadata.price.low.toFixed(2), 'USDT');
    
    // Trading signal with confidence consideration
    console.log('\nTrading Signal:');
    const signal = generateSignal(predictedChange[0], confidence);
    console.log(signal);

    // Risk assessment
    console.log('\nRisk Assessment:');
    if (metadata.analysis.riskLevel > 0.7) {
      console.log('⚠️ High risk conditions - Exercise extreme caution');
    } else if (metadata.analysis.riskLevel > 0.5) {
      console.log('⚠️ Moderate risk conditions - Trade with caution');
    }
    
    if (metadata.analysis.trend === 'overbought') {
      console.log('⚠️ Overbought conditions - Potential reversal risk');
    } else if (metadata.analysis.trend === 'oversold') {
      console.log('⚠️ Oversold conditions - Potential reversal risk');
    }

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

function generateSignal(predictedChange, confidence) {
  if (confidence < 60) {
    return '⚠️ Low Confidence - Consider waiting for better conditions';
  }
  
  if (predictedChange > 1.5) {
    return '🟢 Strong Buy Signal';
  } else if (predictedChange > 0.5) {
    return '🟡 Weak Buy Signal';
  } else if (predictedChange < -1.5) {
    return '🔴 Strong Sell Signal';
  } else if (predictedChange < -0.5) {
    return '🟠 Weak Sell Signal';
  }
  
  return '⚪ Neutral Signal';
}

// If directly run this file, execute prediction
if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('Starting prediction process...');
  makePrediction().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
