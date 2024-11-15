import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

// Enhanced loss function that considers trend and volatility
function enhancedDirectionalLoss(yTrue, yPred) {
    const error = tf.sub(yPred, yTrue);
    const absError = tf.abs(error);
    
    // Calculate directional agreement using smooth approximation
    const trueDirection = tf.tanh(tf.mul(yTrue, 5)); // Reduced sensitivity
    const predDirection = tf.tanh(tf.mul(yPred, 5)); // Reduced sensitivity
    const directionAgreement = tf.mul(trueDirection, predDirection);
    
    // Balanced direction penalty
    const directionPenalty = tf.add(
        tf.scalar(1.0),
        tf.mul(
            tf.sub(tf.scalar(1.0), directionAgreement),
            tf.scalar(1.5) // Reduced penalty factor
        )
    );
    
    // Symmetric magnitude penalty
    const magnitudePenalty = tf.add(
        tf.scalar(1.0),
        tf.mul(
            tf.abs(tf.sub(tf.abs(yPred), tf.abs(yTrue))),
            tf.scalar(1.0) // Balanced penalty
        )
    );
    
    // Combine penalties with base loss
    const l1Loss = tf.mul(absError, directionPenalty);
    const l2Loss = tf.mul(tf.square(error), magnitudePenalty);
    
    // Balanced magnitude weighting
    const predMagnitude = tf.abs(yPred);
    const trueMagnitude = tf.abs(yTrue);
    const magnitudeWeight = tf.add(
        tf.scalar(1.0),
        tf.mul(
            tf.maximum(predMagnitude, trueMagnitude),
            tf.scalar(0.3) // Reduced magnitude influence
        )
    );
    
    const combinedLoss = tf.add(
        tf.mul(l1Loss, tf.scalar(0.5)), // Equal weighting
        tf.mul(l2Loss, tf.scalar(0.5))  // Equal weighting
    );
    
    return tf.mean(tf.mul(combinedLoss, magnitudeWeight));
}

export function createModel(params) {
    const model = tf.sequential();
    
    // Input normalization layer
    model.add(tf.layers.layerNormalization({
        inputShape: [HYPERPARAMETERS.lookbackWindow, HYPERPARAMETERS.featureSize]
    }));
    
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
        mergeMode: 'ave'
    }));
    
    model.add(tf.layers.layerNormalization());
    model.add(tf.layers.dropout(params.dropoutRate));
    
    // Dense layers with skip connections
    const denseUnits = [64, 32, 16];
    
    for (let units of denseUnits) {
        model.add(tf.layers.dense({
            units: units,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: params.l2Regularization }),
            kernelInitializer: 'heNormal',
            kernelConstraint: tf.constraints.maxNorm({ maxValue: 2 })
        }));
        
        model.add(tf.layers.layerNormalization());
        model.add(tf.layers.dropout(params.dropoutRate / 2));
    }
    
    // Modified output layer for balanced predictions
    model.add(tf.layers.dense({
        units: 1,
        activation: 'linear',
        kernelInitializer: {
            className: 'RandomUniform',
            config: {
                minval: -0.05,
                maxval: 0.05
            }
        },
        biasInitializer: 'zeros',
        kernelConstraint: tf.constraints.minMaxNorm({
            minValue: -0.5,
            maxValue: 0.5,
            rate: 1.0
        })
    }));
    
    // Add final activation as separate layer
    model.add(tf.layers.activation({
        activation: 'tanh'
    }));

    // Configure optimizer with modified parameters
    const initialLearningRate = params.learningRate / 5;
    const optimizer = tf.train.adam(initialLearningRate, 0.9, 0.999, 1e-7);
    optimizer.clipNorm = 0.5;
    optimizer.clipValue = 0.3;

    // Compile with enhanced loss
    model.compile({
        optimizer: optimizer,
        loss: enhancedDirectionalLoss,
        metrics: ['mse', 'mae']
    });

    return model;
}
