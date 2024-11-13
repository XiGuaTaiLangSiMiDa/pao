import * as tf from '@tensorflow/tfjs-node';
import { fetchKlines, prepareTrainingData } from './utils/dataFetcher.js';
import { preprocessFeatures } from './utils/preprocessing.js';
import fs from 'fs';
import path from 'path';

const LOOKBACK_WINDOW = 20;
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

    console.log('Fetching latest market data...');
    const klines = await fetchKlines({
      interval: '15m',
      limit: LOOKBACK_WINDOW + 5
    });
    console.log('Market data fetched successfully');

    console.log('Preparing training data...');
    const { features } = prepareTrainingData(klines, LOOKBACK_WINDOW);
    
    if (features.length === 0) {
      throw new Error('No features generated from the data');
    }

    const latestFeature = features[features.length - 1];
    const currentPrice = klines[klines.length - 1].close;
    
    // Use all 16 features
    console.log('Processing features...');
    console.log('Feature shape:', [latestFeature.length, latestFeature[0].length]);
    
    // Preprocess features using the same pipeline as training
    console.log('Preprocessing features...');
    const preprocessedFeatures = await preprocessFeatures([latestFeature]);
    console.log('Preprocessed feature shape:', preprocessedFeatures.shape);
    
    // Calculate current market conditions
    const prices = klines.map(k => k.close);
    const priceChanges = prices.slice(1).map((price, i) => price - prices[i]);
    const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length) / currentPrice;
    
    // Calculate RSI for confidence score
    const gains = priceChanges.map(change => change > 0 ? change : 0);
    const losses = priceChanges.map(change => change < 0 ? -change : 0);
    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
    const rsi = 100 - (100 / (1 + (avgGain || 1e-6) / (avgLoss || 1e-6)));

    // Make prediction
    console.log('Making prediction...');
    const prediction = model.predict(preprocessedFeatures);
    const predictedChange = await prediction.data();
    console.log('Prediction completed');
    
    // Calculate confidence score based on prediction magnitude and market conditions
    const confidence = Math.min(100, Math.max(0, (
      // Prediction magnitude (30%)
      (Math.min(Math.abs(predictedChange[0]) / 2, 1) * 30) +
      // RSI not at extremes (30%)
      ((rsi > 30 && rsi < 70) ? 30 : 10) +
      // Low volatility (20%)
      (Math.max(0, 1 - volatility) * 20) +
      // Base confidence (20%)
      20
    )));

    // Clean up tensors
    preprocessedFeatures.dispose();
    prediction.dispose();

    // Calculate predicted price
    const predictedPrice = currentPrice * (1 + predictedChange[0]/100);

    // Calculate market statistics
    const priceChange24h = ((currentPrice - prices[0]) / prices[0] * 100);
    const highPrice = Math.max(...klines.map(k => k.high));
    const lowPrice = Math.min(...klines.map(k => k.low));

    // Save prediction to history
    const predictionRecord = {
      timestamp: Date.now(),
      currentPrice,
      predictedChange: predictedChange[0],
      predictedPrice,
      confidence,
      volatility,
      rsi,
      priceChange24h,
      highPrice,
      lowPrice
    };
    fs.writeFileSync(PREDICTION_HISTORY_FILE, JSON.stringify([predictionRecord], null, 2));

    // Output results
    console.log('\nMarket Analysis:');
    console.log('Current SOL Price:', currentPrice.toFixed(2), 'USDT');
    console.log('Market Volatility:', (volatility * 100).toFixed(2) + '%');
    console.log('RSI:', rsi.toFixed(2));
    
    console.log('\nPrediction Results:');
    console.log('Predicted 1h Price Change:', predictedChange[0].toFixed(2) + '%');
    console.log('Prediction Confidence:', confidence.toFixed(2) + '%');
    console.log('Predicted Price in 1h:', predictedPrice.toFixed(2), 'USDT');
    
    // Market statistics
    console.log('\nMarket Statistics (Last 5h):');
    console.log('Price Change:', priceChange24h.toFixed(2) + '%');
    console.log('Highest Price:', highPrice.toFixed(2), 'USDT');
    console.log('Lowest Price:', lowPrice.toFixed(2), 'USDT');
    
    // Trading signal with confidence consideration
    console.log('\nTrading Signal:');
    if (confidence < 60) {
      console.log('⚠️ Low Confidence - Consider waiting for better conditions');
    } else {
      if (predictedChange[0] > 1.5) {
        console.log('🟢 Strong Buy Signal');
      } else if (predictedChange[0] > 0.5) {
        console.log('🟡 Weak Buy Signal');
      } else if (predictedChange[0] < -1.5) {
        console.log('🔴 Strong Sell Signal');
      } else if (predictedChange[0] < -0.5) {
        console.log('🟠 Weak Sell Signal');
      } else {
        console.log('⚪ Neutral Signal');
      }
    }

    // Risk assessment
    console.log('\nRisk Assessment:');
    if (volatility > 0.02) {
      console.log('⚠️ High market volatility - Exercise caution');
    }
    if (rsi > 70) {
      console.log('⚠️ Overbought conditions - Potential reversal risk');
    } else if (rsi < 30) {
      console.log('⚠️ Oversold conditions - Potential reversal risk');
    }

    return predictionRecord;

  } catch (error) {
    console.error('Error making prediction:', error);
    console.error('Error stack:', error.stack);
    if (error.message.includes('tensor')) {
      console.error('Tensor shape error. Please check the input data format.');
      console.error('Expected shape: [null,20,16]');
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
