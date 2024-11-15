export const HYPERPARAMETERS = {
  // Model structure
  lookbackWindow: 30,     // Increased from 20 to capture longer trends
  featureSize: 22,       // Updated for new indicators
  
  // Training parameters
  epochs: 100,
  validationSplit: 0.2,
  patience: 20,
  
  // Search spaces for hyperparameters
  searchSpace: {
    batchSize: [32, 64, 128],
    learningRate: [
      0.0005,   // Reduced initial learning rate
      0.0002,   // Medium pace
      0.0001,   // Fine tuning
      0.00005   // Very fine tuning
    ],
    lstmUnits: [
      [64, 32],     // Base size
      [96, 48],     // Medium size
      [128, 64],    // Large size
      [192, 96]     // Extra large size
    ],
    dropoutRate: [
      0.3,     // Medium regularization
      0.4,     // Strong regularization
      0.5      // Very strong regularization
    ],
    l2Regularization: [
      5e-5,    // Medium
      1e-4,    // Strong
      2e-4     // Very strong
    ]
  },
  
  // Feature weights for different market conditions
  featureWeights: {
    trend: {
      adx: 1.2,        // Reduced from 1.3
      macd: 1.1,       // Reduced from 1.2
      rsi: 0.8,        // Increased from 0.7
      stochRSI: 0.8    // Increased from 0.7
    },
    momentum: {
      momentum: 1.0,   // Reduced from 1.1
      roc: 1.0,        // Reduced from 1.1
      obv: 1.0
    },
    volatility: {
      atr: 1.1,        // Reduced from 1.2
      bBands: 1.0      // Reduced from 1.1
    },
    volume: {
      cmf: 1.1,        // Reduced from 1.2
      obv: 1.0
    }
  },
  
  // Trend detection thresholds
  trendThresholds: {
    strong: 0.02,      // Reduced from 0.03
    medium: 0.01,      // Reduced from 0.015
    weak: 0.005
  },
  
  // Class weights for balanced learning
  classWeights: {
    positive: 1.0,     // Equal weighting
    negative: 1.0,     // Equal weighting
    neutral: 1.0       // Equal weighting
  },
  
  // Early stopping configuration
  earlyStoppingConfig: {
    monitor: 'val_loss',
    minDelta: 0.0001,
    patience: 20,
    mode: 'min',
    restoreBestWeights: true
  },
  
  // Learning rate schedule
  learningRateSchedule: {
    initialLearningRate: 0.0005,  // Reduced from 0.001
    decaySteps: 2000,            // Increased from 1000
    decayRate: 0.97,             // Increased from 0.95
    staircase: false
  },
  
  // Gradient clipping
  gradientClipping: {
    clipNorm: 0.5,     // Reduced from 1.0
    clipValue: 0.3     // Reduced from 0.5
  },
  
  // Validation configuration
  validationConfig: {
    validationSplit: 0.2,
    validationFrequency: 1,
    validationBatchSize: 32
  },
  
  // Prediction configuration
  predictionConfig: {
    ensembleSize: 5,
    confidenceThreshold: 0.7,
    minTrendStrength: 0.015    // Reduced from 0.02
  }
};