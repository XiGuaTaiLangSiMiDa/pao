import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS } from '../hyperparameters.js';

export class CustomEarlyStopping extends tf.Callback {
  constructor() {
    super();
    this.bestValLoss = Infinity;
    this.patience = HYPERPARAMETERS.patience;
    this.wait = 0;
    this.bestWeights = null;
  }

  async onEpochEnd(epoch, logs) {
    const currentValLoss = logs.val_loss;

    console.log(`\nEpoch ${epoch + 1} of ${HYPERPARAMETERS.epochs}`);
    console.log(`Loss: ${logs.loss.toFixed(4)}, Val Loss: ${currentValLoss.toFixed(4)}`);
    
    if (currentValLoss < this.bestValLoss) {
      console.log(`Val loss improved from ${this.bestValLoss.toFixed(4)} to ${currentValLoss.toFixed(4)}`);
      this.bestValLoss = currentValLoss;
      this.wait = 0;
      // Save current weights
      this.bestWeights = this.model.getWeights().map(w => w.clone());
    } else {
      this.wait++;
      console.log(`Val loss did not improve. Patience: ${this.wait}/${this.patience}`);
      
      if (this.wait >= this.patience) {
        this.model.stopTraining = true;
        console.log('Early stopping triggered');
        // Restore best weights
        if (this.bestWeights !== null) {
          console.log('Restoring best weights...');
          this.model.setWeights(this.bestWeights);
        }
      }
    }
  }

  onTrainEnd() {
    // Clean up cloned weights
    if (this.bestWeights) {
      this.bestWeights.forEach(w => w.dispose());
    }
  }
}
