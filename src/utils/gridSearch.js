import fs from 'fs';
import path from 'path';
import { HYPERPARAMETERS, MODEL_VARIANTS } from '../hyperparameters.js';
import { createModel } from '../models/lstm.js';
import { CustomEarlyStopping, LearningRateScheduler, ModelCheckpoint } from './callbacks.js';
import { evaluateModel, calculateScore } from './evaluation.js';

// Ensure models directory exists
const MODELS_DIR = './models';
if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
}

// Save results safely
function saveResults(filename, data) {
    try {
        const filePath = path.join(MODELS_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully saved results to ${filePath}`);
    } catch (error) {
        console.error(`Error saving results to ${filename}:`, error);
    }
}

// Load previous results if they exist
function loadPreviousResults() {
    try {
        const filePath = path.join(MODELS_DIR, 'hyperparameter_search_results.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading previous results:', error);
    }
    return [];
}

async function trainWithParams(params, xTrain, yTrain, xTest, yTest, variant) {
    console.log('\nTraining with parameters:', params);
    console.log('Model variant:', variant);
    
    // Merge variant configuration with params
    const modelConfig = {
        ...params,
        ...MODEL_VARIANTS[variant]
    };
    
    const model = createModel(modelConfig);
    model.summary();

    // Create callbacks
    const callbacks = [
        new CustomEarlyStopping(),
        new LearningRateScheduler(),
        new ModelCheckpoint('file://./models/checkpoint')
    ];

    // Training configuration
    const trainConfig = {
        batchSize: HYPERPARAMETERS.batchSize,
        epochs: HYPERPARAMETERS.epochs,
        validationSplit: HYPERPARAMETERS.validationSplit,
        shuffle: true,
        verbose: 1,
        callbacks: callbacks
    };

    // Train the model
    const history = await model.fit(xTrain, yTrain, trainConfig);

    const evaluation = await evaluateModel(model, xTest, yTest);
    
    return {
        model,
        evaluation,
        finalValLoss: history.history.val_loss[history.history.val_loss.length - 1]
    };
}

export async function gridSearch(xTrain, yTrain, xTest, yTest, modelVariant = 'full') {
    // Ensure modelVariant is a string
    const variantName = typeof modelVariant === 'string' ? modelVariant : 'full';
    
    const { modelParams } = HYPERPARAMETERS;
    let bestParams = null;
    let bestModel = null;
    let bestScore = Infinity;
    let allResults = loadPreviousResults();

    // Generate all combinations of hyperparameters
    for (const lstmUnits of modelParams.lstmUnits) {
        for (const dropoutRate of modelParams.dropoutRate) {
            for (const l2Regularization of modelParams.l2Regularization) {
                for (const learningRate of modelParams.learningRate) {
                    const params = {
                        lstmUnits,
                        dropoutRate,
                        l2Regularization,
                        learningRate
                    };

                    // Check if we've already tried these parameters
                    const existingResult = allResults.find(r => 
                        r.params.learningRate === params.learningRate &&
                        r.params.lstmUnits[0] === params.lstmUnits[0] &&
                        r.params.lstmUnits[1] === params.lstmUnits[1] &&
                        r.params.dropoutRate === params.dropoutRate &&
                        r.params.l2Regularization === params.l2Regularization &&
                        r.variant === variantName
                    );

                    if (existingResult) {
                        console.log('\nSkipping previously tested parameters:', params);
                        continue;
                    }

                    console.log('\nTrying parameters:', params);
                    
                    const result = await trainWithParams(params, xTrain, yTrain, xTest, yTest, variantName);
                    const score = calculateScore(result.evaluation);

                    const resultData = {
                        params,
                        variant: variantName,
                        score,
                        evaluation: result.evaluation,
                        timestamp: new Date().toISOString()
                    };

                    allResults.push(resultData);

                    if (score < bestScore) {
                        console.log('\nNew best score:', score);
                        bestScore = score;
                        bestParams = params;
                        bestModel = result.model;

                        // Save best model with proper variant name
                        const modelPath = `file://./models/best_model${variantName === 'full' ? '' : '_' + variantName}`;
                        
                        await bestModel.save(modelPath);
                        saveResults('best_parameters.json', {
                            parameters: bestParams,
                            variant: variantName,
                            score: bestScore,
                            hyperparameters: HYPERPARAMETERS,
                            timestamp: new Date().toISOString()
                        });
                    }

                    // Save intermediate results
                    saveResults('hyperparameter_search_results.json', allResults);
                }
            }
        }
    }

    return { bestParams, bestModel, bestScore, allResults };
}
