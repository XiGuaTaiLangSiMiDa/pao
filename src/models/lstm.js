import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

// Custom Huber loss with adjusted delta
function huberLoss(yTrue, yPred, delta = 0.3) {  // Reduced delta for finer-grained error handling
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
  
  // Bidirectional LSTM layer
  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({
      units: params.lstmUnits[0],
      returnSequences: true,
      recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }), // Reduced L2
      kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
      recurrentInitializer: 'glorotUniform',
      kernelInitializer: 'glorotUniform',
      unitForgetBias: true,
      implementation: 2,
      recurrentActivation: 'sigmoid',
      activation: 'tanh'
    }),
    inputShape: [HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize],
    mergeMode: 'concat'
  }));
  
  model.add(tf.layers.layerNormalization());
  model.add(tf.layers.dropout(Math.min(params.dropoutRate, 0.3))); // Cap dropout rate
  
  // Second Bidirectional LSTM layer
  model.add(tf.layers.bidirectional({
    layer: tf.layers.lstm({
      units: params.lstmUnits[1],
      returnSequences: false,
      recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
      kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
      recurrentInitializer: 'glorotUniform',
      kernelInitializer: 'glorotUniform',
      unitForgetBias: true,
      implementation: 2,
      recurrentActivation: 'sigmoid',
      activation: 'tanh'
    }),
    mergeMode: 'concat'
  }));
  
  model.add(tf.layers.layerNormalization());
  model.add(tf.layers.dropout(Math.min(params.dropoutRate, 0.2))); // Lower dropout for deeper layers
  
  // Attention mechanism
  const attention = tf.layers.dense({
    units: params.lstmUnits[1] * 2, // *2 because of bidirectional
    activation: 'tanh',
    kernelInitializer: 'glorotUniform'
  });
  
  // Dense layers with reduced regularization
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 4 }),
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

  const optimizer = tf.train.adam(params.learningRate, 0.9, 0.999, 1e-7);
  optimizer.clipNorm = 0.5;
  optimizer.clipValue = 0.5;

  model.compile({
    optimizer: optimizer,
    loss: huberLoss,
    metrics: ['mse', 'mae']
  });

  return model;
}
