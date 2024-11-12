import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

// Custom Huber loss implementation
function huberLoss(yTrue, yPred, delta = 1.0) {
  const error = tf.sub(yPred, yTrue);
  const absError = tf.abs(error);
  const quadratic = tf.minimum(absError, delta);
  const linear = tf.sub(absError, quadratic);
  const loss = tf.add(
    tf.mul(0.5, tf.square(quadratic)),
    tf.mul(delta, linear)
  );
  return tf.mean(loss);
}

export function createModel(params) {
  const model = tf.sequential();
  
  // Input LSTM layer with gradient clipping
  model.add(tf.layers.lstm({
    units: params.lstmUnits[0],
    returnSequences: true,
    inputShape: [HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize],
    recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    recurrentInitializer: 'glorotUniform',
    kernelInitializer: 'glorotUniform',
    unitForgetBias: true,  // Helps prevent vanishing gradients
    implementation: 2,      // More numerically stable implementation
    recurrentActivation: 'sigmoid',
    activation: 'tanh'
  }));
  
  model.add(tf.layers.layerNormalization());  // More stable than batch normalization
  model.add(tf.layers.dropout(params.dropoutRate));
  
  // Second LSTM layer
  model.add(tf.layers.lstm({
    units: params.lstmUnits[1],
    returnSequences: false,
    recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    recurrentInitializer: 'glorotUniform',
    kernelInitializer: 'glorotUniform',
    unitForgetBias: true,
    implementation: 2,
    recurrentActivation: 'sigmoid',
    activation: 'tanh'
  }));
  
  model.add(tf.layers.layerNormalization());
  model.add(tf.layers.dropout(params.dropoutRate));
  
  // Dense layers with gradient clipping
  model.add(tf.layers.dense({
    units: 8,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
    kernelInitializer: 'glorotUniform',
    kernelConstraint: tf.constraints.maxNorm({ maxValue: 3 })
  }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear',
    kernelInitializer: 'glorotUniform',
    kernelConstraint: tf.constraints.maxNorm({ maxValue: 1 })
  }));

  // Use Adam optimizer with gradient clipping and reduced learning rate
  const optimizer = tf.train.adam(params.learningRate, 0.9, 0.999, 1e-7);
  optimizer.clipNorm = 0.5;  // Global gradient clipping
  optimizer.clipValue = 0.5; // Element-wise gradient clipping

  model.compile({
    optimizer: optimizer,
    loss: huberLoss,  // Custom Huber loss implementation
    metrics: ['mse', 'mae']
  });

  return model;
}
