export const HYPERPARAMETERS = {
  // Model structure
  lookbackWindow: 20,
  featureSize: 16,  // Updated to match new feature set (price patterns + volume patterns + technical indicators)
  
  // Training parameters
  epochs: 100,
  validationSplit: 0.2,
  patience: 15,
  
  // Search spaces for hyperparameters
  searchSpace: {
    batchSize: [32, 64, 128],
    learningRate: [0.001, 0.0005, 0.0001],
    lstmUnits: [
      [32, 16],  // [first_layer, second_layer]
      [64, 32],
      [128, 64]
    ],
    dropoutRate: [0.2, 0.3, 0.4],
    l2Regularization: [1e-4, 1e-3, 1e-2]
  }
};
