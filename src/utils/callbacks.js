import * as tf from '@tensorflow/tfjs-node';
import { HYPERPARAMETERS, LR_SCHEDULE } from '../hyperparameters.js';

export class CustomEarlyStopping extends tf.Callback {
    constructor() {
        super();
        this.bestValLoss = Infinity;
        this.patience = HYPERPARAMETERS.earlyStoppingPatience;
        this.wait = 0;
        this.bestWeights = null;
        this.stopped_epoch = 0;
        this.params = {};
    }

    setParams(params) {
        this.params = params;
    }

    onTrainBegin(logs) {
        this.wait = 0;
        this.bestValLoss = Infinity;
        this.stopped_epoch = 0;
        this.bestWeights = null;
    }

    async onEpochEnd(epoch, logs) {
        const currentValLoss = logs.val_loss;

        console.log(`\nEpoch ${epoch + 1} of ${this.params.epochs}`);
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
                this.stopped_epoch = epoch;
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

    onTrainEnd(logs) {
        // Clean up cloned weights
        if (this.bestWeights) {
            this.bestWeights.forEach(w => w.dispose());
            this.bestWeights = null;
        }
        if (this.stopped_epoch > 0) {
            console.log(`Early stopping occurred at epoch ${this.stopped_epoch + 1}`);
        }
    }
}

// Learning rate scheduler callback
export class LearningRateScheduler extends tf.Callback {
    constructor() {
        super();
        const { initialLR, decay, decaySteps, warmupSteps, minLR } = LR_SCHEDULE;
        this.initialLR = initialLR;
        this.decay = decay;
        this.decaySteps = decaySteps;
        this.warmupSteps = warmupSteps;
        this.minLR = minLR;
        this.params = {};
    }

    setParams(params) {
        this.params = params;
    }

    onEpochBegin(epoch, logs) {
        let lr;
        if (epoch < this.warmupSteps) {
            // Linear warmup
            lr = (epoch * this.initialLR) / this.warmupSteps;
        } else {
            // Exponential decay
            const decayedSteps = epoch - this.warmupSteps;
            lr = this.initialLR * Math.pow(this.decay, decayedSteps / this.decaySteps);
        }
        lr = Math.max(lr, this.minLR);
        
        // Set the learning rate
        this.model.optimizer.learningRate = lr;
        console.log(`Learning rate set to: ${lr}`);
    }
}

// Model checkpoint callback
export class ModelCheckpoint extends tf.Callback {
    constructor(filepath, monitor = 'val_loss', mode = 'min') {
        super();
        this.filepath = filepath;
        this.monitor = monitor;
        this.mode = mode;
        this.bestValue = mode === 'min' ? Infinity : -Infinity;
        this.params = {};
    }

    setParams(params) {
        this.params = params;
    }

    async onEpochEnd(epoch, logs) {
        const currentValue = logs[this.monitor];
        const isBetter = this.mode === 'min' ? 
            currentValue < this.bestValue : 
            currentValue > this.bestValue;

        if (isBetter) {
            console.log(`\n${this.monitor} improved from ${this.bestValue} to ${currentValue}, saving model...`);
            this.bestValue = currentValue;
            await this.model.save(this.filepath);
        }
    }
}
