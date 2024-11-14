import * as tf from '@tensorflow/tfjs-node';

// Preprocess features
export async function preprocessFeatures(features) {
    return tf.tidy(() => {
        const tensor = tf.tensor3d(features);
        return normalizeFeatures(tensor);
    });
}

// Preprocess labels
export async function preprocessLabels(labels) {
    return tf.tidy(() => {
        const tensor = tf.tensor1d(labels);
        return tensor;
    });
}

// Normalize features using standardization
function normalizeFeatures(tensor) {
    return tf.tidy(() => {
        const mean = tensor.mean(0, true);
        const std = tensor.sub(mean).square().mean(0, true).sqrt();
        // Add small epsilon to avoid division by zero
        return tensor.sub(mean).div(std.add(1e-8));
    });
}

// Data augmentation techniques for time series
export async function augmentData(features, labels, config) {
    const augmentedFeatures = [...features];
    const augmentedLabels = [...labels];

    for (let i = 0; i < features.length; i++) {
        if (Math.random() < config.probability) {
            for (const method of config.methods) {
                switch (method) {
                    case 'jitter':
                        const jittered = addJitter(features[i]);
                        augmentedFeatures.push(jittered);
                        augmentedLabels.push(labels[i]);
                        break;
                    case 'scaling':
                        const scaled = applyScaling(features[i]);
                        augmentedFeatures.push(scaled);
                        augmentedLabels.push(labels[i]);
                        break;
                    case 'timeWarp':
                        const warped = applyTimeWarp(features[i]);
                        augmentedFeatures.push(warped);
                        augmentedLabels.push(labels[i]);
                        break;
                }
            }
        }
    }

    return {
        features: augmentedFeatures,
        labels: augmentedLabels
    };
}

// Add random noise to the time series
function addJitter(window, sigma = 0.05) {
    return window.map(timestep => 
        timestep.map(feature => {
            const noise = (Math.random() - 0.5) * 2 * sigma;
            return feature * (1 + noise);
        })
    );
}

// Apply random scaling to the time series
function applyScaling(window, scalingFactor = 0.2) {
    const scale = 1 + (Math.random() - 0.5) * 2 * scalingFactor;
    return window.map(timestep =>
        timestep.map(feature => feature * scale)
    );
}

// Apply time warping to the time series
function applyTimeWarp(window, warpingFactor = 0.2) {
    const warped = [];
    const length = window.length;
    
    for (let i = 0; i < length; i++) {
        // Calculate warped index
        const warp = Math.sin(i / length * Math.PI * 2) * warpingFactor;
        const warpedIndex = Math.min(
            Math.max(
                Math.round(i + warp * length),
                0
            ),
            length - 1
        );
        warped.push([...window[warpedIndex]]);
    }
    
    return warped;
}

// Magnitude warping
function applyMagnitudeWarp(window, sigma = 0.2) {
    const length = window.length;
    const numFeatures = window[0].length;
    const warped = Array(length).fill().map(() => Array(numFeatures).fill(0));
    
    // Generate smooth noise using sine waves
    for (let feature = 0; feature < numFeatures; feature++) {
        const amplitude = (Math.random() - 0.5) * 2 * sigma;
        const phase = Math.random() * Math.PI * 2;
        const frequency = 1 + Math.random();
        
        for (let i = 0; i < length; i++) {
            const noise = 1 + amplitude * Math.sin(frequency * i / length * Math.PI * 2 + phase);
            warped[i][feature] = window[i][feature] * noise;
        }
    }
    
    return warped;
}

// Window slicing
function applyWindowSlicing(window, sliceRatio = 0.9) {
    const length = window.length;
    const sliceLength = Math.floor(length * sliceRatio);
    const start = Math.floor(Math.random() * (length - sliceLength));
    
    return window.slice(start, start + sliceLength).map(timestep => [...timestep]);
}

// Window mixing
function mixWindows(window1, window2, mixingRatio = 0.5) {
    return window1.map((timestep, i) =>
        timestep.map((feature, j) =>
            feature * mixingRatio + window2[i][j] * (1 - mixingRatio)
        )
    );
}

// Validate augmented data
function validateAugmentedData(original, augmented) {
    // Check shapes
    if (augmented.length < original.length) {
        throw new Error('Augmented data size is smaller than original data');
    }
    
    // Check feature dimensions
    const originalShape = original[0].length;
    for (const window of augmented) {
        if (window.length !== originalShape) {
            throw new Error('Augmented data has inconsistent feature dimensions');
        }
    }
    
    // Check for NaN or Infinity values
    for (const window of augmented) {
        for (const timestep of window) {
            for (const feature of timestep) {
                if (!isFinite(feature)) {
                    throw new Error('Augmented data contains invalid values');
                }
            }
        }
    }
    
    return true;
}
