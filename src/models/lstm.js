import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

// Custom loss function that penalizes directional errors more heavily
function directionalLoss(yTrue, yPred) {
  const error = tf.sub(yPred, yTrue);
  const absError = tf.abs(error);
  
  // Calculate directional agreement using smooth approximation
  const trueDirection = tf.tanh(tf.mul(yTrue, 10)); // Smooth sign function
  const predDirection = tf.tanh(tf.mul(yPred, 10)); // Smooth sign function
  const directionAgreement = tf.mul(trueDirection, predDirection);
  
  // Higher penalty for wrong direction (1 - agreement ranges from 0 to 2)
  const directionPenalty = tf.add(
    tf.scalar(1.0),
    tf.sub(tf.scalar(1.0), directionAgreement)
  );
  
  // Combine L1 and L2 losses with direction penalty
  const l1Loss = tf.mul(absError, directionPenalty);
  const l2Loss = tf.mul(tf.square(error), directionPenalty);
  
  return tf.mean(tf.add(l1Loss, l2Loss));
}

export function createModel(params) {
  const model = tf.sequential();
  
  // First Bidirectional LSTM layer
  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({
      units: params.lstmUnits[0],
      returnSequences: true,
      recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
      kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
      recurrentInitializer: 'glorotNormal',
      kernelInitializer: 'glorotNormal',
      unitForgetBias: true,
      implementation: 2,
      recurrentActivation: 'sigmoid',
      activation: 'tanh'
    }),
    inputShape: [HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize],
    mergeMode: 'concat'
  }));
  
  model.add(tf.layers.layerNormalization());
  model.add(tf.layers.dropout(params.dropoutRate));
  
  // Second Bidirectional LSTM layer
  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({
      units: params.lstmUnits[1],
      returnSequences: false,
      recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
      kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
      recurrentInitializer: 'glorotNormal',
      kernelInitializer: 'glorotNormal',
      unitForgetBias: true,
      implementation: 2,
      recurrentActivation: 'sigmoid',
      activation: 'tanh'
    }),
    mergeMode: 'concat'
  }));
  
  model.add(tf.layers.layerNormalization());
  model.add(tf.layers.dropout(params.dropoutRate));
  
  // Dense layers with balanced initialization
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelInitializer: 'heNormal',
    kernelConstraint: tf.constraints.maxNorm({ maxValue: 3 })
  }));
  
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelInitializer: 'heNormal',
    kernelConstraint: tf.constraints.maxNorm({ maxValue: 2 })
  }));
  
  // Output layer with symmetric initialization
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear',  // Linear activation to allow both positive and negative predictions
    kernelInitializer: {
      className: 'RandomNormal',
      config: {
        mean: 0,
        stddev: 0.05
      }
    },
    useBias: true,
    biasInitializer: 'zeros',  // Start with no bias to avoid directional preference
    kernelConstraint: tf.constraints.maxNorm({ maxValue: 1 })
  }));

  // Configure optimizer with gradient clipping
  const optimizer = tf.train.adam(params.learningRate, 0.9, 0.999, 1e-7);
  optimizer.clipNorm = 1.0;  // Global norm clipping
  optimizer.clipValue = 0.5; // Element-wise clipping

  // Compile with directional loss
  model.compile({
    optimizer: optimizer,
    loss: directionalLoss,
    metrics: ['mse', 'mae']
  });

  return model;
}
