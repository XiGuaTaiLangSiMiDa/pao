import * as tf from '@tensorflow/tfjs-node';

export async function evaluateModel(model, xTest, yTest) {
  try {
    console.log('\nStarting model evaluation...');
    
    // Evaluate model
    console.log('Running model.evaluate()...');
    const evaluation = await model.evaluate(xTest, yTest);
    
    // Make predictions
    console.log('Running model predictions...');
    const predictions = model.predict(xTest);
    
    // Get values safely with error checking
    console.log('Converting tensors to arrays...');
    const predArray = await predictions.array();
    const actualArray = await yTest.array();
    
    // Calculate metrics
    console.log('Calculating evaluation metrics...');
    let validPredictions = 0;
    let correctDirection = 0;
    let sumSquaredError = 0;
    let sumAbsoluteError = 0;
    let validCount = 0;
    
    for (let i = 0; i < predArray.length; i++) {
      const pred = predArray[i][0];
      const actual = actualArray[i];
      
      if (!isNaN(pred) && !isNaN(actual) && isFinite(pred) && isFinite(actual)) {
        validCount++;
        sumSquaredError += Math.pow(pred - actual, 2);
        sumAbsoluteError += Math.abs(pred - actual);
        
        if ((pred > 0 && actual > 0) || (pred < 0 && actual < 0)) {
          correctDirection++;
        }
        validPredictions++;
      }
    }
    
    // Calculate final metrics
    const mse = validCount > 0 ? sumSquaredError / validCount : NaN;
    const mae = validCount > 0 ? sumAbsoluteError / validCount : NaN;
    const directionalAccuracy = validPredictions > 0 ? 
      (correctDirection / validPredictions) * 100 : 0;
    
    // Print results
    console.log('\nModel Evaluation Results:');
    console.log('MSE:', mse.toFixed(4));
    console.log('MAE:', mae.toFixed(4));
    console.log('Directional Accuracy:', directionalAccuracy.toFixed(2) + '%');
    console.log('Valid Predictions:', validPredictions, 'out of', predArray.length);
    
    // Sample predictions
    console.log('\nSample Predictions vs Actuals:');
    for (let i = 0; i < Math.min(5, predArray.length); i++) {
      console.log(`Prediction: ${predArray[i][0].toFixed(4)}, Actual: ${actualArray[i].toFixed(4)}`);
    }
    
    // Clean up tensors
    predictions.dispose();
    evaluation.forEach(tensor => tensor.dispose());
    
    return {
      mse,
      mae,
      directionalAccuracy,
      validPredictions,
      totalPredictions: predArray.length
    };
  } catch (error) {
    console.error('Error during evaluation:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
}

export function calculateScore(evaluation) {
  if (!evaluation) return Infinity;
  
  return (
    0.4 * evaluation.mse + 
    0.3 * evaluation.mae + 
    0.3 * (100 - evaluation.directionalAccuracy)
  );
}
