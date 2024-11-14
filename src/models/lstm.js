import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

// Custom Huber loss with adjusted delta
function huberLoss(yTrue, yPred, delta = 0.3) {
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

// Simplified attention mechanism using basic layers
function createAttentionLayer(inputs, units) {
    // Project input sequence
    const projection = tf.layers.dense({
        units: units,
        activation: 'tanh',
        kernelInitializer: 'glorotUniform'
    }).apply(inputs);
    
    // Compute attention scores
    const scores = tf.layers.dense({
        units: 1,
        use_bias: false,
        activation: 'softmax',
        kernelInitializer: 'glorotUniform'
    }).apply(projection);
    
    // Final context vector
    const context = tf.layers.dense({
        units: units,
        activation: 'tanh',
        kernelInitializer: 'glorotUniform'
    }).apply(projection);
    
    return context;
}

export function createModel(params) {
    const inputs = tf.input({
        shape: [HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize]
    });
    
    // Initial LSTM layer with bidirectional processing
    let x = inputs;
    
    // Forward LSTM
    const forwardInitial = tf.layers.lstm({
        units: params.lstmUnits[0],
        returnSequences: true,
        recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
        recurrentInitializer: 'glorotUniform',
        kernelInitializer: 'glorotUniform',
        unitForgetBias: true
    }).apply(x);
    
    // Backward LSTM (process sequence in reverse)
    const backwardInitial = tf.layers.lstm({
        units: params.lstmUnits[0],
        returnSequences: true,
        recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
        recurrentInitializer: 'glorotUniform',
        kernelInitializer: 'glorotUniform',
        unitForgetBias: true,
        goBackwards: true
    }).apply(inputs);
    
    // Concatenate forward and backward outputs
    x = tf.layers.concatenate().apply([forwardInitial, backwardInitial]);
    
    // Project concatenated output to match original dimension for residual connections
    x = tf.layers.dense({
        units: params.lstmUnits[0],
        activation: 'linear'
    }).apply(x);
    
    // Layer normalization and dropout
    x = tf.layers.layerNormalization().apply(x);
    x = tf.layers.dropout({ rate: Math.min(params.dropoutRate, 0.3) }).apply(x);
    
    // Additional LSTM layers with residual connections
    for (let i = 0; i < 2; i++) {
        const residual = x;
        
        // Forward path
        const lstm = tf.layers.lstm({
            units: params.lstmUnits[0],
            returnSequences: true,
            recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
            kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
            recurrentInitializer: 'glorotUniform',
            kernelInitializer: 'glorotUniform',
            unitForgetBias: true
        }).apply(x);
        
        const normalized = tf.layers.layerNormalization().apply(lstm);
        x = tf.layers.add().apply([residual, normalized]);
        x = tf.layers.dropout({ rate: Math.min(params.dropoutRate, 0.3) }).apply(x);
    }
    
    // Self-attention mechanism if enabled
    if (params.useAttention) {
        const attentionOutput = createAttentionLayer(x, params.lstmUnits[0]);
        x = tf.layers.concatenate().apply([x, attentionOutput]);
        // Project back to original dimension
        x = tf.layers.dense({
            units: params.lstmUnits[0],
            activation: 'linear'
        }).apply(x);
    }
    
    // Final LSTM layer
    x = tf.layers.lstm({
        units: params.lstmUnits[1],
        returnSequences: false,
        recurrentRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 2 }),
        recurrentInitializer: 'glorotUniform',
        kernelInitializer: 'glorotUniform',
        unitForgetBias: true
    }).apply(x);
    
    // Dense layers with skip connections
    const dense1 = tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 4 }),
        kernelInitializer: 'glorotUniform',
        kernelConstraint: tf.constraints.maxNorm({ maxValue: 3 })
    }).apply(x);
    
    const dense2 = tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization / 4 }),
        kernelInitializer: 'glorotUniform',
        kernelConstraint: tf.constraints.maxNorm({ maxValue: 3 })
    }).apply(dense1);
    
    // Output layer
    const outputs = tf.layers.dense({
        units: 1,
        activation: 'linear',
        kernelInitializer: 'glorotUniform',
        kernelConstraint: tf.constraints.maxNorm({ maxValue: 1 })
    }).apply(dense2);
    
    const model = tf.model({ inputs, outputs });
    
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
