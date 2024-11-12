import * as tf from '@tensorflow/tfjs-node';
import { fetchKlines, prepareTrainingData } from './utils/dataFetcher.js';
import fs from 'fs';
import path from 'path';

const LOOKBACK_WINDOW = 20;
const PREDICTION_HISTORY_FILE = './models/prediction_history.json';

// Load prediction history
function loadPredictionHistory() {
  try {
    if (fs.existsSync(PREDICTION_HISTORY_FILE)) {
      const history = JSON.parse(fs.readFileSync(PREDICTION_HISTORY_FILE, 'utf8'));
      return history;
    }
    return [];
  } catch (error) {
    console.error('Error loading prediction history:', error);
    return [];
  }
}

// Save prediction history
function savePredictionHistory(prediction) {
  try {
    let history = loadPredictionHistory();
    history.push(prediction);
    
    // Keep only last 1000 predictions
    if (history.length > 1000) {
      history = history.slice(-1000);
    }
    
    // Ensure directory exists
    const dir = path.dirname(PREDICTION_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(PREDICTION_HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving prediction history:', error);
  }
}

// Calculate prediction accuracy based on history
function calculateHistoricalAccuracy() {
  const history = loadPredictionHistory();
  if (history.length === 0) return null;

  const recentHistory = history.slice(-100); // Use last 100 predictions
  let correctDirections = 0;
  let totalPredictions = 0;

  recentHistory.forEach(pred => {
    if (pred.actualChange !== undefined) {
      if ((pred.predictedChange > 0 && pred.actualChange > 0) ||
          (pred.predictedChange < 0 && pred.actualChange < 0)) {
        correctDirections++;
      }
      totalPredictions++;
    }
  });

  return totalPredictions > 0 ? (correctDirections / totalPredictions) * 100 : null;
}

// Calculate confidence score
function calculateConfidenceScore(prediction, volatility, rsi) {
  let confidence = 0;
  
  // Factor 1: Prediction magnitude (stronger predictions = higher confidence)
  const magnitudeScore = Math.min(Math.abs(prediction) / 2, 1) * 0.3;
  
  // Factor 2: RSI extremes reduce confidence
  const rsiScore = (rsi > 30 && rsi < 70) ? 0.3 : 0.1;
  
  // Factor 3: Volatility (high volatility = lower confidence)
  const volatilityScore = Math.max(0, 1 - volatility) * 0.2;
  
  // Factor 4: Historical accuracy
  const histAccuracy = calculateHistoricalAccuracy();
  const historyScore = histAccuracy ? (histAccuracy / 100) * 0.2 : 0.1;
  
  confidence = magnitudeScore + rsiScore + volatilityScore + historyScore;
  return Math.min(confidence * 100, 100);
}

async function loadModel() {
  try {
    const model = await tf.loadLayersModel('file://./models/sol_predictor/model.json');
    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
}

async function makePrediction() {
  try {
    console.log('Loading model...');
    const model = await loadModel();

    console.log('Fetching latest market data...');
    const klines = await fetchKlines({
      interval: '15m',
      limit: LOOKBACK_WINDOW + 5
    });

    const { features } = prepareTrainingData(klines, LOOKBACK_WINDOW);
    
    if (features.length === 0) {
      throw new Error('No features generated from the data');
    }

    const latestFeature = features[features.length - 1];
    const currentPrice = klines[klines.length - 1].close;
    
    // Calculate current market conditions
    const prices = klines.map(k => k.close);
    const priceChanges = prices.slice(1).map((price, i) => price - prices[i]);
    const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length) / currentPrice;
    
    // Calculate RSI for confidence score
    const gains = priceChanges.map(change => change > 0 ? change : 0);
    const losses = priceChanges.map(change => change < 0 ? -change : 0);
    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
    const rsi = 100 - (100 / (1 + avgGain / avgLoss));

    // Make prediction
    const inputTensor = tf.tensor3d([latestFeature]);
    const prediction = model.predict(inputTensor);
    const predictedChange = await prediction.data();
    
    // Calculate confidence score
    const confidence = calculateConfidenceScore(predictedChange[0], volatility, rsi);

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    // Save prediction to history
    const predictionRecord = {
      timestamp: Date.now(),
      currentPrice,
      predictedChange: predictedChange[0],
      confidence,
      volatility,
      rsi
    };
    savePredictionHistory(predictionRecord);

    // Calculate historical accuracy
    const histAccuracy = calculateHistoricalAccuracy();

    // Output results
    console.log('\nMarket Analysis:');
    console.log('Current SOL Price:', currentPrice.toFixed(2), 'USDT');
    console.log('Market Volatility:', (volatility * 100).toFixed(2) + '%');
    console.log('RSI:', rsi.toFixed(2));
    
    console.log('\nPrediction Results:');
    console.log('Predicted 1h Price Change:', predictedChange[0].toFixed(2) + '%');
    console.log('Prediction Confidence:', confidence.toFixed(2) + '%');
    console.log('Historical Accuracy:', histAccuracy ? histAccuracy.toFixed(2) + '%' : 'Insufficient data');
    console.log('Predicted Price in 1h:', (currentPrice * (1 + predictedChange[0]/100)).toFixed(2), 'USDT');
    
    // Market statistics
    const recentPrices = klines.map(k => k.close);
    const priceChange24h = ((currentPrice - recentPrices[0]) / recentPrices[0] * 100).toFixed(2);
    const highPrice = Math.max(...klines.map(k => k.high));
    const lowPrice = Math.min(...klines.map(k => k.low));
    
    console.log('\nMarket Statistics (Last 5h):');
    console.log('Price Change:', priceChange24h + '%');
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

  } catch (error) {
    console.error('Error making prediction:', error);
    if (error.message.includes('tensor')) {
      console.error('Tensor shape error. Please check the input data format.');
    }
  }
}

// If directly run this file, execute prediction
if (process.argv[1] === new URL(import.meta.url).pathname) {
  makePrediction();
}

export { makePrediction };
