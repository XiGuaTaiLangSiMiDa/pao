import * as tf from '@tensorflow/tfjs-node';

export class MinMaxScaler {
  constructor() {
    this.min = null;
    this.max = null;
  }

  fit(data) {
    // Calculate min and max for each feature
    this.min = tf.min(data, 0);
    this.max = tf.max(data, 0);
    
    // Log statistics
    console.log('Data statistics:');
    console.log('Min values:', this.min.arraySync());
    console.log('Max values:', this.max.arraySync());
  }

  transform(data) {
    if (!this.min || !this.max) {
      throw new Error('Scaler must be fitted before transform');
    }
    
    // Add larger epsilon to avoid numerical instability
    const epsilon = 1e-6;
    const denominator = tf.add(tf.sub(this.max, this.min), epsilon);
    
    // Check for very small denominators
    const smallDenominators = tf.less(denominator, epsilon);
    const safeDenominator = tf.where(smallDenominators, tf.onesLike(denominator), denominator);
    
    const normalized = tf.div(tf.sub(data, this.min), safeDenominator);
    
    // Clip values to [0, 1] range
    const clipped = tf.clipByValue(normalized, 0, 1);
    
    return clipped;
  }

  fitTransform(data) {
    this.fit(data);
    return this.transform(data);
  }

  dispose() {
    if (this.min) this.min.dispose();
    if (this.max) this.max.dispose();
  }
}

function cleanData(tensor) {
  // Replace NaN and Inf values with 0
  const cleaned = tf.where(
    tf.logicalOr(tf.isNaN(tensor), tf.isInf(tensor)),
    tf.zerosLike(tensor),
    tensor
  );
  
  // Clip extreme values to reasonable range
  return tf.clipByValue(cleaned, -1e6, 1e6);
}

function validateData(tensor, name) {
  // Clean data first
  const cleanedTensor = cleanData(tensor);
  
  const stats = {
    min: tf.min(cleanedTensor).arraySync(),
    max: tf.max(cleanedTensor).arraySync(),
    mean: tf.mean(cleanedTensor).arraySync(),
    variance: tf.moments(cleanedTensor).variance.arraySync()
  };
  
  console.log(`\n${name} statistics:`);
  console.log(stats);
  
  // Check remaining invalid values after cleaning
  const nanCount = tf.sum(tf.isNaN(cleanedTensor)).arraySync();
  const infCount = tf.sum(tf.isInf(cleanedTensor)).arraySync();
  
  if (nanCount > 0 || infCount > 0) {
    console.error(`Warning: Found ${nanCount} NaN and ${infCount} Inf values after cleaning`);
  }
  
  return { cleanedTensor, stats };
}

export function preprocessFeatures(features) {
  try {
    console.log('\nPreprocessing features...');
    const featuresTensor = tf.tensor3d(features);
    
    // Validate and clean raw features
    const { cleanedTensor: cleanedFeatures } = validateData(featuresTensor, 'Raw features');
    
    // Reshape to 2D for normalization
    const shape = cleanedFeatures.shape;
    const flattenedFeatures = cleanedFeatures.reshape([
      shape[0] * shape[1],
      shape[2]
    ]);
    
    // Normalize features
    const scaler = new MinMaxScaler();
    const normalizedFeatures = scaler.fitTransform(flattenedFeatures);
    validateData(normalizedFeatures, 'Normalized features');

    // Reshape back to 3D
    const preprocessedFeatures = normalizedFeatures.reshape(shape);
    validateData(preprocessedFeatures, 'Final features');

    // Clean up
    featuresTensor.dispose();
    cleanedFeatures.dispose();
    flattenedFeatures.dispose();
    scaler.dispose();

    return preprocessedFeatures;
  } catch (error) {
    console.error('Error in preprocessing features:', error);
    throw error;
  }
}

export function preprocessLabels(labels) {
  try {
    console.log('\nPreprocessing labels...');
    const labelsTensor = tf.tensor1d(labels);
    
    // Validate and clean raw labels
    const { cleanedTensor: cleanedLabels } = validateData(labelsTensor, 'Raw labels');
    
    // Normalize labels using min-max scaling
    const scaler = new MinMaxScaler();
    const normalizedLabels = scaler.fitTransform(cleanedLabels.expandDims(1)).squeeze();
    validateData(normalizedLabels, 'Normalized labels');

    // Clean up
    labelsTensor.dispose();
    cleanedLabels.dispose();
    scaler.dispose();

    return normalizedLabels;
  } catch (error) {
    console.error('Error in preprocessing labels:', error);
    throw error;
  }
}
