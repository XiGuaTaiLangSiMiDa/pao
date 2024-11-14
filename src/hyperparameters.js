export const HYPERPARAMETERS = {
    // Data parameters
    lookbackWindow: 20,
    featureSize: 16,
    batchSize: 32,
    validationSplit: 0.2,

    // Model architecture search space
    modelParams: {
        lstmUnits: [
            [64, 32],
            [128, 64],
            [256, 128]
        ],
        dropoutRate: [0.2, 0.3, 0.4],
        l2Regularization: [1e-6, 1e-5, 1e-4],
        learningRate: [1e-4, 3e-4, 1e-3]
    },

    // Training parameters
    epochs: 1,
    earlyStoppingPatience: 15,
    reduceLRPatience: 8,
    reduceLRFactor: 0.5,
    minLR: 1e-6,

    // Learning rate schedule
    LR_SCHEDULE: {
        initialLR: 1e-3,
        decay: 0.1,
        decaySteps: 1000,
        warmupSteps: 5,
        minLR: 1e-6
    },

    // Model variants configuration
    MODEL_VARIANTS: {
        simple: {
            useBidirectional: true,
            useAttention: false,
            useResidual: false
        },
        attention: {
            useBidirectional: true,
            useAttention: true,
            useResidual: false
        },
        full: {
            useBidirectional: true,
            useAttention: true,
            useResidual: true
        }
    },

    // Attention mechanism parameters
    attention: {
        numHeads: 4,
        keyDim: 32,
        valueDim: 32,
        dropout: 0.1
    },

    // Residual block parameters
    residual: {
        numBlocks: 2,
        dropoutRate: 0.2,
        useLayerNorm: true
    },

    // Advanced training options
    training: {
        useAMP: true,  // Automatic Mixed Precision
        gradientClipping: 0.5,
        warmupEpochs: 5,
        labelSmoothing: 0.1,
        weightDecay: 0.01
    },

    // Evaluation metrics
    metrics: {
        primary: 'mae',  // Mean Absolute Error
        secondary: ['mse', 'huber'],  // Additional metrics to track
        threshold: 0.02  // Threshold for acceptable prediction error
    }
};

// Export model variants separately for easier access
export const MODEL_VARIANTS = HYPERPARAMETERS.MODEL_VARIANTS;

// Export learning rate schedule separately
export const LR_SCHEDULE = HYPERPARAMETERS.LR_SCHEDULE;

// Hyperparameter search configuration
export const SEARCH_CONFIG = {
    maxTrials: 10,
    epochs: 50,
    earlyStoppingPatience: 10,
    objective: 'val_mae',
    direction: 'min'
};

// Data preprocessing configuration
export const PREPROCESSING = {
    normalization: 'standard',  // 'standard' or 'minmax'
    featureSelection: 'all',    // 'all' or 'important'
    augmentation: {
        enabled: true,
        methods: ['jitter', 'scaling'],
        probability: 0.5
    }
};

// Model ensemble configuration
export const ENSEMBLE = {
    enabled: true,
    numModels: 3,
    aggregation: 'weighted_average',
    weights: [0.4, 0.3, 0.3]
};
