export const HYPERPARAMETERS = {
  // Model structure
  lookbackWindow: 30,     // Maintained for longer trends
  featureSize: 22,       // Maintained for current indicators
  
  // Training parameters
  epochs: 50,
  validationSplit: 0.2,
  patience: 15,
  
  // Search spaces for hyperparameters
  searchSpace: {
    batchSize: [32, 64, 128],
    learningRate: [
      0.0005,   // Initial learning rate
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
  
  // Feature weights optimized from reversal analysis
  featureWeights: {
    trend: {
      adx: 1.65,     // Optimized: Best at range 80 (44.44% effective)
      macd: 1.11,    // Optimized: Best for downward at negative
      rsi: 1.0,      // Baseline weight
      stochRSI: 1.34 // Optimized: Strong at range 30 for downward
    },
    momentum: {
      momentum: 1.79, // Optimized: Best at range 0 (42.21% effective)
      roc: 1.79,     // Optimized: Matching momentum pattern
      obv: 1.07      // Optimized: Best at positive direction
    },
    volatility: {
      atr: 2.42,     // Optimized: Exceptional at range 100 (57.14% effective)
      bBands: 1.38   // Optimized: Best at range 100 for upward
    },
    volume: {
      cmf: 1.04,     // Optimized: Best at positive direction
      obv: 1.07      // Optimized: Consistent with momentum OBV
    }
  },
  
  // Trend detection thresholds (adjusted based on reversal analysis)
  trendThresholds: {
    strong: 0.015,   // Aligned with reversal threshold
    medium: 0.01,    // Matches REVERSAL_THRESHOLD
    weak: 0.005      // Half of medium threshold
  },
  
  // Class weights for balanced learning
  classWeights: {
    positive: 1.0,
    negative: 1.0,
    neutral: 1.0
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
    initialLearningRate: 0.0005,
    decaySteps: 2000,
    decayRate: 0.97,
    staircase: false
  },
  
  // Gradient clipping
  gradientClipping: {
    clipNorm: 0.5,
    clipValue: 0.3
  },
  
  // Validation configuration
  validationConfig: {
    validationSplit: 0.2,
    validationFrequency: 1,
    validationBatchSize: 32
  },
  
  // Prediction configuration (adjusted based on reversal effectiveness)
  predictionConfig: {
    ensembleSize: 5,
    confidenceThreshold: 0.75,  // Increased based on high-effectiveness ranges
    minTrendStrength: 0.01     // Aligned with REVERSAL_THRESHOLD
  }
};
