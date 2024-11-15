import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

export class CustomEarlyStopping extends tf.Callback {
  constructor() {
    super();
    this.bestValLoss = Infinity;
    this.patience = HYPERPARAMETERS.patience;
    this.minDelta = 1e-4;  // Minimum change to qualify as an improvement
    this.wait = 0;
    this.bestWeights = null;
    this.bestMetrics = null;
  }

  async onEpochEnd(epoch, logs) {
    const currentValLoss = logs.val_loss;
    const currentLoss = logs.loss;
    const valMAE = logs.val_mae || 0;
    const valMSE = logs.val_mse || 0;

    console.log(`\nEpoch ${epoch + 1} of ${HYPERPARAMETERS.epochs}`);
    console.log(`Loss: ${currentLoss.toFixed(4)} Val Loss: ${currentValLoss.toFixed(4)}`);
    
    // Check if current validation loss is better than best, considering minDelta
    if (currentValLoss < this.bestValLoss - this.minDelta) {
      console.log(`Val loss improved from ${this.bestValLoss.toFixed(4)} to ${currentValLoss.toFixed(4)}`);
      this.bestValLoss = currentValLoss;
      this.wait = 0;

      // Save current weights and metrics
      this.bestWeights = this.model.getWeights().map(w => w.clone());
      this.bestMetrics = {
        epoch: epoch + 1,
        valLoss: currentValLoss,
        loss: currentLoss,
        valMAE,
        valMSE
      };

      // Save model to disk
      await this.model.save('file://./models/best_model');

    } else {
      this.wait++;
      console.log(`Val loss did not improve. Patience: ${this.wait}/${this.patience}`);
      
      if (this.wait >= this.patience) {
        this.model.stopTraining = true;
        console.log('\nEarly stopping triggered');
        
        // Log best performance
        console.log('\nBest model performance:');
        console.log(`Epoch: ${this.bestMetrics.epoch}`);
        console.log(`Val Loss: ${this.bestMetrics.valLoss.toFixed(4)}`);
        console.log(`Training Loss: ${this.bestMetrics.loss.toFixed(4)}`);
        console.log(`Val MAE: ${this.bestMetrics.valMAE.toFixed(4)}`);
        console.log(`Val MSE: ${this.bestMetrics.valMSE.toFixed(4)}`);

        // Restore best weights
        if (this.bestWeights !== null) {
          console.log('Restoring best weights...');
          this.model.setWeights(this.bestWeights);
        }
      }
    }
  }

  onTrainEnd() {
    // Log final best performance if training completes normally
    if (!this.model.stopTraining && this.bestMetrics) {
      console.log('\nTraining completed. Best model performance:');
      console.log(`Epoch: ${this.bestMetrics.epoch}`);
      console.log(`Val Loss: ${this.bestMetrics.valLoss.toFixed(4)}`);
      console.log(`Training Loss: ${this.bestMetrics.loss.toFixed(4)}`);
      console.log(`Val MAE: ${this.bestMetrics.valMAE.toFixed(4)}`);
      console.log(`Val MSE: ${this.bestMetrics.valMSE.toFixed(4)}`);
    }

    // Clean up cloned weights
    if (this.bestWeights) {
      this.bestWeights.forEach(w => w.dispose());
    }
  }
}
