import * as tf from '@tensorflow/tfjs-node';
import { prepareTrainingData } from './utils/dataFetcher.js';
import { HYPERPARAMETERS } from './hyperparameters.js';
import { gridSearch } from './utils/gridSearch.js';
import { preprocessFeatures, preprocessLabels } from './utils/preprocessing.js';
import { klineCache } from './utils/cache/cache.js';
import moment from 'moment';
import fs from 'fs';

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

    console.log(`Preparing training data... ${klines.length}`);
    const { features, labels } = prepareTrainingData(klines, HYPERPARAMETERS.lookbackWindow);

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

    console.log('Starting hyperparameter search...');
    const { bestParams, bestModel, bestScore, allResults } = await gridSearch(xTrain, yTrain, xTest, yTest);

    // Final save of best model and parameters
    console.log('\nSaving final results...');
    fs.writeFileSync(
      'models/final_results.json',
      JSON.stringify({
        bestParameters: bestParams,
        bestScore,
        allResults,
        dataInfo: {
          totalKlines: klines.length,
          dateRange: {
            start: moment(klines[0].openTime).format('YYYY-MM-DD HH:mm:ss'),
            end: moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')
          }
        },
        timestamp: new Date().toISOString()
      }, null, 2)
    );

    // Clean up
    featuresTensor.dispose();
    labelsTensor.dispose();
    xTrain.dispose();
    yTrain.dispose();
    xTest.dispose();
    yTest.dispose();
    
    console.log('\nTraining completed successfully!');
    console.log('Best parameters:', bestParams);
    console.log('Best score:', bestScore);
    console.log('Data range used:', 
      moment(klines[0].openTime).format('YYYY-MM-DD HH:mm:ss'),
      'to',
      moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')
    );

  } catch (error) {
    console.error('Error during training:', error);
    console.error('Error stack:', error.stack);
    if (error.message.includes('tensor')) {
      console.error('Tensor shape error. Please check the input data format.');
      console.error('Expected shape:', [null, HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize]);
    }
  }
}

trainModel();
