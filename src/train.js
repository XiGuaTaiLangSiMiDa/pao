import * as tf from '@tensorflow/tfjs-node';
import { fetchKlines, prepareTrainingData } from './utils/dataFetcher.js';
import { HYPERPARAMETERS } from './hyperparameters.js';
import fs from 'fs';

// Custom callback class for early stopping with best weights restoration
class CustomEarlyStopping extends tf.Callback {
  constructor() {
    super();
    this.bestValLoss = Infinity;
    this.patience = HYPERPARAMETERS.patience;
    this.wait = 0;
    this.bestWeights = null;
  }

  async onEpochEnd(epoch, logs) {
    const currentValLoss = logs.val_loss;

    console.log(`\nEpoch ${epoch + 1} of ${HYPERPARAMETERS.epochs}`);
    console.log(`Loss: ${logs.loss.toFixed(4)}, Val Loss: ${currentValLoss.toFixed(4)}`);
    
    if (currentValLoss < this.bestValLoss) {
      console.log(`Val loss improved from ${this.bestValLoss.toFixed(4)} to ${currentValLoss.toFixed(4)}`);
      this.bestValLoss = currentValLoss;
      this.wait = 0;
      // Save current weights
      this.bestWeights = this.model.getWeights().map(w => w.clone());
    } else {
      this.wait++;
      console.log(`Val loss did not improve. Patience: ${this.wait}/${this.patience}`);
      
      if (this.wait >= this.patience) {
        this.model.stopTraining = true;
        console.log('Early stopping triggered');
        // Restore best weights
        if (this.bestWeights !== null) {
          console.log('Restoring best weights...');
          this.model.setWeights(this.bestWeights);
        }
      }
    }
  }

  onTrainEnd() {
    // Clean up cloned weights
    if (this.bestWeights) {
      this.bestWeights.forEach(w => w.dispose());
    }
  }
}

function createModel(params) {
  const model = tf.sequential();
  
  // First LSTM layer
  model.add(tf.layers.lstm({
    units: params.lstmUnits[0],
    returnSequences: true,
    inputShape: [HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize],
    recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    recurrentInitializer: 'glorotNormal',
    kernelInitializer: 'glorotNormal'
  }));
  
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout(params.dropoutRate));
  
  // Second LSTM layer
  model.add(tf.layers.lstm({
    units: params.lstmUnits[1],
    returnSequences: false,
    recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    recurrentInitializer: 'glorotNormal',
    kernelInitializer: 'glorotNormal'
  }));
  
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout(params.dropoutRate));
  
  // Dense layer
  model.add(tf.layers.dense({
    units: 8,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelInitializer: 'glorotNormal'
  }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear',
    kernelInitializer: 'glorotNormal'
  }));

  // Use Adam optimizer with gradient clipping
  const optimizer = tf.train.adam(params.learningRate, 0.9, 0.999, 1e-7);
  optimizer.clipNorm = 0.5;

  model.compile({
    optimizer: optimizer,
    loss: 'meanSquaredError',
    metrics: ['mse', 'mae']
  });

  return model;
}

async function evaluateModel(model, xTest, yTest) {
  try {
    console.log('\nStarting model evaluation...');
    
    // Evaluate model
    console.log('Running model.evaluate()...');
    const evaluation = await model.evaluate(xTest, yTest);
    
    // Make predictions
    console.log('Running model predictions...');
    const predictions = model.predict(xTest);
    
    // Get values safely with error checking
    console.log('Converting tensors to arrays...');
    const predArray = await predictions.array();
    const actualArray = await yTest.array();
    
    // Calculate metrics
    console.log('Calculating evaluation metrics...');
    let validPredictions = 0;
    let correctDirection = 0;
    let sumSquaredError = 0;
    let sumAbsoluteError = 0;
    let validCount = 0;
    
    for (let i = 0; i < predArray.length; i++) {
      const pred = predArray[i][0];
      const actual = actualArray[i];
      
      if (!isNaN(pred) && !isNaN(actual) && isFinite(pred) && isFinite(actual)) {
        validCount++;
        sumSquaredError += Math.pow(pred - actual, 2);
        sumAbsoluteError += Math.abs(pred - actual);
        
        if ((pred > 0 && actual > 0) || (pred < 0 && actual < 0)) {
          correctDirection++;
        }
        validPredictions++;
      }
    }
    
    // Calculate final metrics
    const mse = validCount > 0 ? sumSquaredError / validCount : NaN;
    const mae = validCount > 0 ? sumAbsoluteError / validCount : NaN;
    const directionalAccuracy = validPredictions > 0 ? 
      (correctDirection / validPredictions) * 100 : 0;
    
    // Print results
    console.log('\nModel Evaluation Results:');
    console.log('MSE:', mse.toFixed(4));
    console.log('MAE:', mae.toFixed(4));
    console.log('Directional Accuracy:', directionalAccuracy.toFixed(2) + '%');
    console.log('Valid Predictions:', validPredictions, 'out of', predArray.length);
    
    // Sample predictions
    console.log('\nSample Predictions vs Actuals:');
    for (let i = 0; i < Math.min(5, predArray.length); i++) {
      console.log(`Prediction: ${predArray[i][0].toFixed(4)}, Actual: ${actualArray[i].toFixed(4)}`);
    }
    
    // Clean up tensors
    predictions.dispose();
    evaluation.forEach(tensor => tensor.dispose());
    
    return {
      mse,
      mae,
      directionalAccuracy,
      validPredictions,
      totalPredictions: predArray.length
    };
  } catch (error) {
    console.error('Error during evaluation:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
}

async function trainWithParams(params, xTrain, yTrain, xTest, yTest) {
  console.log('\nTraining with parameters:', params);
  
  const model = createModel(params);
  model.summary();

  const history = await model.fit(xTrain, yTrain, {
    batchSize: params.batchSize,
    epochs: HYPERPARAMETERS.epochs,
    validationSplit: HYPERPARAMETERS.validationSplit,
    shuffle: true,
    verbose: 1,
    callbacks: [new CustomEarlyStopping()]
  });

  const evaluation = await evaluateModel(model, xTest, yTest);
  
  return {
    model,
    evaluation,
    finalValLoss: history.history.val_loss[history.history.val_loss.length - 1]
  };
}

async function gridSearch(xTrain, yTrain, xTest, yTest) {
  const { searchSpace } = HYPERPARAMETERS;
  let bestParams = null;
  let bestModel = null;
  let bestScore = Infinity;
  let allResults = [];

  // Generate all combinations of hyperparameters
  for (const batchSize of searchSpace.batchSize) {
    for (const learningRate of searchSpace.learningRate) {
      for (const lstmUnits of searchSpace.lstmUnits) {
        for (const dropoutRate of searchSpace.dropoutRate) {
          for (const l2Regularization of searchSpace.l2Regularization) {
            const params = {
              batchSize,
              learningRate,
              lstmUnits,
              dropoutRate,
              l2Regularization
            };

            console.log('\nTrying parameters:', params);
            
            const result = await trainWithParams(params, xTrain, yTrain, xTest, yTest);
            
            // Calculate combined score (weighted average of metrics)
            const score = result.evaluation ? 
              (0.4 * result.evaluation.mse + 
               0.3 * result.evaluation.mae + 
               0.3 * (100 - result.evaluation.directionalAccuracy)) : Infinity;

            allResults.push({
              params,
              score,
              evaluation: result.evaluation
            });

            if (score < bestScore) {
              console.log('\nNew best score:', score);
              bestScore = score;
              bestParams = params;
              bestModel = result.model;
            }

            // Save intermediate results
            fs.writeFileSync(
              'models/hyperparameter_search_results.json',
              JSON.stringify(allResults, null, 2)
            );
          }
        }
      }
    }
  }

  return { bestParams, bestModel, bestScore, allResults };
}

async function trainModel() {
  try {
    console.log('Fetching historical data...');
    const klines = await fetchKlines({
      interval: '15m',
      limit: 1500
    });

    console.log('Preparing training data...');
    const { features, labels } = prepareTrainingData(klines, HYPERPARAMETERS.lookbackWindow);

    // Create tensors with proper shapes
    const featuresTensor = tf.tensor3d(features);
    const labelsTensor = tf.tensor1d(labels);

    // Split data into training and testing sets
    const splitIndex = Math.floor(features.length * 0.8);
    const xTrain = featuresTensor.slice([0, 0, 0], [splitIndex, -1, -1]);
    const yTrain = labelsTensor.slice(0, splitIndex);
    const xTest = featuresTensor.slice([splitIndex, 0, 0], [-1, -1, -1]);
    const yTest = labelsTensor.slice(splitIndex);

    console.log('Starting hyperparameter search...');
    const { bestParams, bestModel, bestScore, allResults } = await gridSearch(xTrain, yTrain, xTest, yTest);

    // Save best model and parameters
    console.log('\nSaving best model and parameters...');
    await bestModel.save('file://./models/best_model');
    
    fs.writeFileSync(
      'models/best_parameters.json',
      JSON.stringify({
        parameters: bestParams,
        score: bestScore,
        hyperparameters: HYPERPARAMETERS,
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
