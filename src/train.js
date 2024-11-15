import * as tf from '@tensorflow/tfjs-node';
import { fetchTrainingData } from './utils/dataFetcher.js';
import { HYPERPARAMETERS } from './hyperparameters.js';
import { gridSearch } from './utils/gridSearch.js';
import { preprocessFeatures, preprocessLabels } from './utils/preprocessing.js';
import { klineCache } from './utils/cache/cache.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import moment from 'moment';
import fs from 'fs';

// Analyze label distribution with reversal focus
function analyzeLabelDistribution(labels, features) {
  const positive = labels.filter(l => l > 0).length;
  const negative = labels.filter(l => l < 0).length;
  const neutral = labels.filter(l => l === 0).length;
  const total = labels.length;
  
  // Analyze potential reversals
  const reversals = features.reduce((acc, feature, idx) => {
    if (idx === 0) return acc;
    const prevLabel = labels[idx - 1];
    const currLabel = labels[idx];
    
    // Check for trend reversal
    if (Math.sign(prevLabel) !== Math.sign(currLabel) && Math.abs(currLabel) > HYPERPARAMETERS.trendThresholds.medium) {
      if (currLabel > 0) acc.upward++;
      else if (currLabel < 0) acc.downward++;
    }
    return acc;
  }, { upward: 0, downward: 0 });
  
  return {
    positive: {
      count: positive,
      percentage: (positive / total * 100).toFixed(2)
    },
    negative: {
      count: negative,
      percentage: (negative / total * 100).toFixed(2)
    },
    neutral: {
      count: neutral,
      percentage: (neutral / total * 100).toFixed(2)
    },
    reversals: {
      upward: {
        count: reversals.upward,
        percentage: (reversals.upward / total * 100).toFixed(2)
      },
      downward: {
        count: reversals.downward,
        percentage: (reversals.downward / total * 100).toFixed(2)
      }
    },
    total
  };
}

// Validate feature effectiveness based on reversal analysis
function validateFeatureEffectiveness(features, labels) {
  const effectiveness = {
    trend: { positive: 0, negative: 0 },
    momentum: { positive: 0, negative: 0 },
    volatility: { positive: 0, negative: 0 },
    volume: { positive: 0, negative: 0 }
  };

  features.forEach((windowFeatures, idx) => {
    const label = labels[idx];
    if (label === 0) return;

    // Get the latest feature set from the window
    const feature = windowFeatures[windowFeatures.length - 1];
    const isPositive = label > 0;
    
    // Check each feature group's effectiveness
    Object.keys(effectiveness).forEach(group => {
      const aligned = isFeatureAligned(feature, group, isPositive);
      if (aligned) {
        effectiveness[group][isPositive ? 'positive' : 'negative']++;
      }
    });
  });

  return effectiveness;
}

// Helper to check feature alignment with price movement
function isFeatureAligned(feature, group, isPositive) {
  if (!feature) return false;

  // Feature indices based on processKline normalization
  const FEATURE_INDICES = {
    RSI: 9,
    STOCH_RSI_K: 10,
    MACD: 13,
    MOMENTUM: 14,
    ROC: 15,
    BBANDS_BANDWIDTH: 16,
    BBANDS_PERCENT_B: 17,
    ADX: 19,
    ATR: 20,
    CMF: 21
  };

  switch (group) {
    case 'trend':
      // ADX > 25 and MACD alignment
      return (
        feature[FEATURE_INDICES.ADX] > 0.25 && 
        Math.sign(feature[FEATURE_INDICES.MACD]) === (isPositive ? 1 : -1)
      );

    case 'momentum':
      // Momentum and ROC alignment
      return (
        Math.abs(feature[FEATURE_INDICES.MOMENTUM]) > 0.2 &&
        Math.sign(feature[FEATURE_INDICES.MOMENTUM]) === (isPositive ? 1 : -1) &&
        Math.sign(feature[FEATURE_INDICES.ROC]) === (isPositive ? 1 : -1)
      );

    case 'volatility':
      // ATR expansion and Bollinger Band width
      return (
        feature[FEATURE_INDICES.ATR] > 0.3 ||
        feature[FEATURE_INDICES.BBANDS_BANDWIDTH] > 0.5
      );

    case 'volume':
      // CMF direction alignment
      return Math.sign(feature[FEATURE_INDICES.CMF]) === (isPositive ? 1 : -1);

    default:
      return false;
  }
}

async function trainModel() {
  try {
    const symbol = 'SOLUSDT';

    // Update cache before training
    console.log('Updating kline cache...');
    const klines = await klineCache.update(symbol);
    console.log(`Using ${klines.length} klines from cache for training`);
    console.log('Data range:', 
      moment(klines[0].openTime).format('YYYY-MM-DD HH:mm:ss'),
      'to',
      moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')
    );

    // Generate training data using new feature system
    console.log('Generating training features...');
    const { features, labels } = await fetchTrainingData({
      symbol,
      interval: '15m',
      lookback: WindowConfig.DEFAULT_LOOKBACK,
      limit: klines.length
    });

    console.log(`Generated ${features.length} feature windows`);

    // Analyze and log label distribution with reversal focus
    const distribution = analyzeLabelDistribution(labels, features);
    console.log('\nLabel Distribution:');
    console.log(`Positive changes: ${distribution.positive.count} (${distribution.positive.percentage}%)`);
    console.log(`Negative changes: ${distribution.negative.count} (${distribution.negative.percentage}%)`);
    console.log(`Neutral changes: ${distribution.neutral.count} (${distribution.neutral.percentage}%)`);
    console.log('\nReversal Distribution:');
    console.log(`Upward reversals: ${distribution.reversals.upward.count} (${distribution.reversals.upward.percentage}%)`);
    console.log(`Downward reversals: ${distribution.reversals.downward.count} (${distribution.reversals.downward.percentage}%)`);

    // Validate feature effectiveness
    console.log('\nAnalyzing feature effectiveness...');
    const effectiveness = validateFeatureEffectiveness(features, labels);
    console.log('Feature group effectiveness:', effectiveness);

    // Adjust class weights based on distribution and reversal patterns
    const positiveWeight = 1.0;
    const negativeWeight = distribution.positive.count / distribution.negative.count;
    const reversalBoost = 1.2; // Increase weight for reversal patterns
    console.log('\nUsing class weights:', { 
      positive: positiveWeight, 
      negative: negativeWeight,
      reversalBoost 
    });

    // Update hyperparameters with calculated weights
    HYPERPARAMETERS.classWeights = {
      positive: positiveWeight,
      negative: negativeWeight,
      reversalBoost
    };

    // Preprocess data with optimized weights
    console.log('Preprocessing data...');
    const featuresTensor = await preprocessFeatures(features);
    const labelsTensor = await preprocessLabels(labels);

    // Split data into training and testing sets
    const splitIndex = Math.floor(features.length * 0.8);
    const xTrain = featuresTensor.slice([0, 0, 0], [splitIndex, -1, -1]);
    const yTrain = labelsTensor.slice(0, splitIndex);
    const xTest = featuresTensor.slice([splitIndex, 0, 0], [-1, -1, -1]);
    const yTest = labelsTensor.slice(splitIndex);

    console.log('\nData Split Information:');
    console.log(`Training samples: ${splitIndex}`);
    console.log(`Testing samples: ${features.length - splitIndex}`);
    console.log(`Feature shape: [${featuresTensor.shape}]`);

    console.log('\nStarting hyperparameter search...');
    const { bestParams, bestModel, bestScore, allResults } = await gridSearch(xTrain, yTrain, xTest, yTest);

    // Save training results with enhanced metadata
    console.log('\nSaving final results...');
    const results = {
      bestParameters: bestParams,
      bestScore,
      allResults,
      dataInfo: {
        totalSamples: features.length,
        trainingSamples: splitIndex,
        testingSamples: features.length - splitIndex,
        featureShape: featuresTensor.shape,
        labelDistribution: distribution,
        featureEffectiveness: effectiveness,
        classWeights: HYPERPARAMETERS.classWeights,
        dateRange: {
          start: moment(klines[0].openTime).format('YYYY-MM-DD HH:mm:ss'),
          end: moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')
        }
      },
      hyperparameters: {
        ...HYPERPARAMETERS,
        lookbackWindow: WindowConfig.DEFAULT_LOOKBACK
      },
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      'models/final_results.json',
      JSON.stringify(results, null, 2)
    );

    // Clean up tensors
    featuresTensor.dispose();
    labelsTensor.dispose();
    xTrain.dispose();
    yTrain.dispose();
    xTest.dispose();
    yTest.dispose();
    
    console.log('\nTraining completed successfully!');
    console.log('Best parameters:', bestParams);
    console.log('Best score:', bestScore);
    console.log('Model saved with complete training history and metadata');

  } catch (error) {
    console.error('Error during training:', error);
    console.error('Error stack:', error.stack);
    if (error.message.includes('tensor')) {
      console.error('Tensor shape error. Please check the input data format.');
      console.error('Expected shape:', [null, WindowConfig.DEFAULT_LOOKBACK, HYPERPARAMETERS.featureSize]);
    }
    process.exit(1);
  }
}

trainModel();
