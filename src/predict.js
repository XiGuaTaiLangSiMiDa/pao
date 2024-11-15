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

function analyzeTechnicalIndicators(indicators) {
  const { rsi, stochRSI, obv, macd, momentum, roc, bBands } = indicators;
  const { k, d } = stochRSI;
  
  // Analyze momentum signals
  const momentumSignals = [];
  if (k > d) {
    momentumSignals.push(`随机RSI金叉形成(K:${k.toFixed(1)}, D:${d.toFixed(1)})，表明短期买盘力量正在增强`);
  } else if (k < d) {
    momentumSignals.push(`随机RSI死叉形成(K:${k.toFixed(1)}, D:${d.toFixed(1)})，表明短期卖盘力量正在增强`);
  }

  // Analyze volume trend
  const volumeSignals = [];
  if (obv < 0) {
    volumeSignals.push(`OBV为负值(${obv.toFixed(2)})，表明近期大多数成交量都集中在下跌时段，卖盘比较活跃`);
  } else {
    volumeSignals.push(`OBV为正值(${obv.toFixed(2)})，表明近期大多数成交量都集中在上涨时段，买盘比较活跃`);
  }

  // Analyze trend signals
  const trendSignals = [];
  if (macd > 0) {
    trendSignals.push(`MACD为正值(${macd.toFixed(4)})，表明当前上涨趋势占优`);
  } else {
    trendSignals.push(`MACD为负值(${macd.toFixed(4)})，表明当前下跌趋势占优`);
  }

  // Analyze RSI conditions
  if (rsi > 70) {
    trendSignals.push(`RSI超过70(${rsi.toFixed(1)})，市场可能已经过热，存在回调风险`);
  } else if (rsi < 30) {
    trendSignals.push(`RSI低于30(${rsi.toFixed(1)})，市场可能已经超卖，存在反弹机会`);
  }

  // Analyze Bollinger Bands position
  const { percentB } = bBands;
  if (percentB > 80) {
    trendSignals.push('价格已经接近布林带上轨，涨幅可能过大，注意回调风险');
  } else if (percentB < 20) {
    trendSignals.push('价格已经接近布林带下轨，跌幅可能过大，关注反弹机会');
  }

  // Determine overall trend
  let trend = 'neutral';
  let strength = 'weak';
  
  // Count positive and negative signals
  const positiveSignals = (macd > 0 ? 1 : 0) + (momentum > 0 ? 1 : 0) + (k > d ? 1 : 0);
  const negativeSignals = (macd < 0 ? 1 : 0) + (momentum < 0 ? 1 : 0) + (k < d ? 1 : 0);

  if (positiveSignals >= 2) {
    trend = 'uptrend';
    strength = positiveSignals === 3 ? 'strong' : 'moderate';
  } else if (negativeSignals >= 2) {
    trend = 'downtrend';
    strength = negativeSignals === 3 ? 'strong' : 'moderate';
  }

  // Adjust for extreme conditions
  if (rsi > 70) {
    trend = 'overbought';
  } else if (rsi < 30) {
    trend = 'oversold';
  }

  return {
    signals: [...momentumSignals, ...volumeSignals, ...trendSignals],
    trend,
    strength
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
    
    // Calculate confidence score based on prediction magnitude and market conditions
    const confidence = calculateConfidence(
      predictedChange[0],
      metadata.indicators.rsi,
      metadata.analysis.volatility
    );

    // Clean up tensors
    preprocessedFeatures.dispose();
    prediction.dispose();

    // Calculate predicted price (treating predictedChange as percentage)
    const predictedPrice = currentPrice * (1 + predictedChange[0]/100);
    
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

function calculateConfidence(predictedChange, rsi, volatility) {
  // Adjust confidence calculation for percentage change values
  const changeMagnitude = Math.abs(predictedChange);
  return Math.min(100, Math.max(0, (
    // Prediction magnitude (30%)
    (Math.min(changeMagnitude/2, 1) * 60) +
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
