import * as tf from '@tensorflow/tfjs-node';
import { fetchTrainingData } from './utils/dataFetcher.js';
import { HYPERPARAMETERS, MODEL_VARIANTS, LR_SCHEDULE, PREPROCESSING, ENSEMBLE } from './hyperparameters.js';
import { gridSearch } from './utils/gridSearch.js';
import { preprocessFeatures, preprocessLabels, augmentData } from './utils/preprocessing.js';
import { klineCache } from './utils/cache/cache.js';
import { WindowConfig } from './utils/data/features/window/base/types.js';
import moment from 'moment';
import fs from 'fs';

// Learning rate scheduler
function createLRSchedule() {
    const { initialLR, decay, decaySteps, warmupSteps, minLR } = LR_SCHEDULE;
    return {
        onEpochBegin: async (epoch) => {
            let lr;
            if (epoch < warmupSteps) {
                // Linear warmup
                lr = (epoch * initialLR) / warmupSteps;
            } else {
                // Exponential decay
                const decayedSteps = epoch - warmupSteps;
                lr = initialLR * Math.pow(decay, decayedSteps / decaySteps);
            }
            lr = Math.max(lr, minLR);
            tf.backend().setLearningRate(lr);
        }
    };
}

// Train individual model
async function trainSingleModel(xTrain, yTrain, xTest, yTest, params, variant) {
    console.log(`Training model with variant: ${variant}`);
    
    // Create model with specified variant configuration
    const modelConfig = MODEL_VARIANTS[variant];
    params = { ...params, ...modelConfig };
    
    const { bestModel, bestScore } = await gridSearch(xTrain, yTrain, xTest, yTest, params);
    
    return { model: bestModel, score: bestScore };
}

// Train ensemble of models
async function trainEnsemble(xTrain, yTrain, xTest, yTest, params) {
    const models = [];
    const scores = [];
    
    for (let i = 0; i < ENSEMBLE.numModels; i++) {
        console.log(`Training ensemble model ${i + 1}/${ENSEMBLE.numModels}`);
        
        // Use different model variants for diversity
        const variant = Object.keys(MODEL_VARIANTS)[i % Object.keys(MODEL_VARIANTS).length];
        const { model, score } = await trainSingleModel(xTrain, yTrain, xTest, yTest, params, variant);
        
        models.push(model);
        scores.push(score);
    }
    
    return { models, scores };
}

async function trainModel() {
    try {
        const symbol = 'SOLUSDT';

        // Update cache before training
        console.log('Updating kline cache...');
        const klines = await klineCache.update(symbol);
        console.log(`Using ${klines.length} klines from cache for training`);
        console.log('Data range:', 
            moment(klines[0].openTime).format('YYYY-MM-DD HH:mm:ss'),
            'to',
            moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')
        );

        // Generate training data using new feature system
        console.log('Generating training features...');
        const { features, labels } = await fetchTrainingData({
            symbol,
            interval: '15m',
            lookback: WindowConfig.DEFAULT_LOOKBACK,
            limit: klines.length
        });

        console.log(`Generated ${features.length} feature windows`);

        // Data augmentation if enabled
        let augmentedFeatures = features;
        let augmentedLabels = labels;
        if (PREPROCESSING.augmentation.enabled) {
            console.log('Performing data augmentation...');
            const augmentation = await augmentData(features, labels, PREPROCESSING.augmentation);
            augmentedFeatures = augmentation.features;
            augmentedLabels = augmentation.labels;
            console.log(`Data augmented to ${augmentedFeatures.length} samples`);
        }

        // Preprocess data
        console.log('Preprocessing data...');
        const featuresTensor = await preprocessFeatures(augmentedFeatures);
        const labelsTensor = await preprocessLabels(augmentedLabels);

        // Split data into training and testing sets
        const splitIndex = Math.floor(augmentedFeatures.length * 0.8);
        const xTrain = featuresTensor.slice([0, 0, 0], [splitIndex, -1, -1]);
        const yTrain = labelsTensor.slice(0, splitIndex);
        const xTest = featuresTensor.slice([splitIndex, 0, 0], [-1, -1, -1]);
        const yTest = labelsTensor.slice(splitIndex);

        console.log('\nData Split Information:');
        console.log(`Training samples: ${splitIndex}`);
        console.log(`Testing samples: ${augmentedFeatures.length - splitIndex}`);
        console.log(`Feature shape: [${featuresTensor.shape}]`);

        let trainedModels, modelScores;
        if (ENSEMBLE.enabled) {
            // Train ensemble of models
            console.log('\nTraining ensemble models...');
            const ensemble = await trainEnsemble(xTrain, yTrain, xTest, yTest, HYPERPARAMETERS.modelParams);
            trainedModels = ensemble.models;
            modelScores = ensemble.scores;
            
            // Save ensemble models
            for (let i = 0; i < trainedModels.length; i++) {
                await trainedModels[i].save(`file://./models/ensemble_${i}`);
            }
        } else {
            // Train single model
            console.log('\nTraining single model...');
            const { model, score } = await trainSingleModel(
                xTrain, yTrain, xTest, yTest,
                HYPERPARAMETERS.modelParams,
                'full'
            );
            trainedModels = [model];
            modelScores = [score];
            
            // Save single model
            await model.save('file://./models/best_model');
        }

        // Save training results
        console.log('\nSaving final results...');
        const results = {
            modelScores,
            ensemble: ENSEMBLE.enabled,
            dataInfo: {
                totalSamples: augmentedFeatures.length,
                originalSamples: features.length,
                augmentedSamples: augmentedFeatures.length - features.length,
                trainingSamples: splitIndex,
                testingSamples: augmentedFeatures.length - splitIndex,
                featureShape: featuresTensor.shape,
                dateRange: {
                    start: moment(klines[0].openTime).format('YYYY-MM-DD HH:mm:ss'),
                    end: moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm:ss')
                }
            },
            hyperparameters: {
                ...HYPERPARAMETERS,
                lookbackWindow: WindowConfig.DEFAULT_LOOKBACK
            },
            preprocessing: PREPROCESSING,
            lrSchedule: LR_SCHEDULE,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
            'models/final_results.json',
            JSON.stringify(results, null, 2)
        );

        // Clean up tensors
        featuresTensor.dispose();
        labelsTensor.dispose();
        xTrain.dispose();
        yTrain.dispose();
        xTest.dispose();
        yTest.dispose();
        
        console.log('\nTraining completed successfully!');
        if (ENSEMBLE.enabled) {
            console.log('Ensemble model scores:', modelScores);
            console.log('Average ensemble score:', modelScores.reduce((a, b) => a + b, 0) / modelScores.length);
        } else {
            console.log('Model score:', modelScores[0]);
        }
        console.log('Models and results saved successfully');

    } catch (error) {
        console.error('Error during training:', error);
        console.error('Error stack:', error.stack);
        if (error.message.includes('tensor')) {
            console.error('Tensor shape error. Please check the input data format.');
            console.error('Expected shape:', [null, WindowConfig.DEFAULT_LOOKBACK, HYPERPARAMETERS.featureSize]);
        }
        process.exit(1);
    }
}

trainModel();
