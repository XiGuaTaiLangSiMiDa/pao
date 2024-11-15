export const HYPERPARAMETERS = {
  // Model structure
  lookbackWindow: 20,
  featureSize: 19,  // Price patterns + volume patterns + technical indicators
  
  // Training parameters
  epochs: 50,              
  validationSplit: 0.2,    // Increased validation split for better generalization
  patience: 15,            // Early stopping patience
  
  // Search spaces for hyperparameters
  searchSpace: {
    batchSize: [32, 64],  // Smaller batch sizes for better gradient estimates
    learningRate: [
      0.001,    // Initial learning
      0.0005,   // Medium pace
      0.0001    // Fine tuning
    ],
    lstmUnits: [
      [64, 32],    // Base size
      [96, 48],    // Medium size
      [128, 64]    // Large size
    ],
    dropoutRate: [
      0.2,     // Light regularization
      0.3,     // Medium regularization
      0.4      // Strong regularization
    ],
    l2Regularization: [
      1e-5,    // Light
      5e-5,    // Medium
      1e-4     // Strong
    ]
  },
  
  // Class weights for balanced learning
  classWeights: {
    positive: 1.0,  // Base weight for upward trends
    negative: 1.0   // Equal weight for downward trends
  }
};
