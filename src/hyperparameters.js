export const HYPERPARAMETERS = {
  // Model structure
  lookbackWindow: 20,
  featureSize: 16,  // Price patterns + volume patterns + technical indicators
  
  // Training parameters
  epochs: 50,
  validationSplit: 0.2,
  patience: 15,
  
  // Search spaces for hyperparameters
  searchSpace: {
    batchSize: [32, 64, 128],
    learningRate: [0.001, 0.0005, 0.0001],
    lstmUnits: [
      [64, 32],   // Increased base size for bidirectional layers
      [96, 48],
      [128, 64]
    ],
    dropoutRate: [0.1, 0.15, 0.2],  // Reduced dropout rates
    l2Regularization: [1e-5, 5e-5, 1e-4]  // Reduced L2 regularization strength
  }
};
