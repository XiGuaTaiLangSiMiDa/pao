import * as tf from '@tensorflow/tfjs-node';
import { fetchTrainingData } from './utils/dataFetcher.js';
import { HYPERPARAMETERS } from './hyperparameters.js';
import { gridSearch } from './utils/gridSearch.js';
import { preprocessFeatures, preprocessLabels } from './utils/preprocessing.js';
import { klineCache } from './utils/cache/cache.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import moment from 'moment';
import fs from 'fs';

// Analyze label distribution
function analyzeLabelDistribution(labels) {
  const positive = labels.filter(l => l > 0).length;
  const negative = labels.filter(l => l < 0).length;
  const neutral = labels.filter(l => l === 0).length;
  const total = labels.length;
  
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
    total
  };
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

    // Analyze and log label distribution
    const distribution = analyzeLabelDistribution(labels);
    console.log('\nLabel Distribution:');
    console.log(`Positive changes: ${distribution.positive.count} (${distribution.positive.percentage}%)`);
    console.log(`Negative changes: ${distribution.negative.count} (${distribution.negative.percentage}%)`);
    console.log(`Neutral changes: ${distribution.neutral.count} (${distribution.neutral.percentage}%)`);

    // Adjust class weights based on distribution if needed
    const positiveWeight = 1.0;
    const negativeWeight = distribution.positive.count / distribution.negative.count;
    console.log('\nUsing class weights:', { positive: positiveWeight, negative: negativeWeight });

    // Update hyperparameters with calculated weights
    HYPERPARAMETERS.classWeights = {
      positive: positiveWeight,
      negative: negativeWeight
    };

    // Preprocess data
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

    // Save training results
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
