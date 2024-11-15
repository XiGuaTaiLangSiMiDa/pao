import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';

const MODEL_PATH = './models/best_model/model.json';
const PARAMETERS_PATH = './models/best_parameters.json';

export async function validateModel() {
    // Check if model files exist
    if (!fs.existsSync(MODEL_PATH)) {
        throw new Error('Model file not found. Please train the model first.');
    }
    
    if (!fs.existsSync(PARAMETERS_PATH)) {
        throw new Error('Model parameters file not found. Please train the model first.');
    }

    // Load and validate parameters
    const parameters = JSON.parse(fs.readFileSync(PARAMETERS_PATH, 'utf8'));
    
    if (!parameters.timestamp || !parameters.hyperparameters) {
        throw new Error('Invalid model parameters file structure');
    }

    // Log model information
    console.log('Using model trained at:', parameters.timestamp);
    console.log('Model hyperparameters:', JSON.stringify(parameters.hyperparameters, null, 2));
    
    return parameters;
}

export async function loadModel() {
    try {
        console.log('Validating model...');
        const parameters = await validateModel();

        console.log('Loading best model...');
        const model = await tf.loadLayersModel('file://./models/best_model/model.json');
        console.log('Model loaded successfully');
        
        return { model, parameters };
    } catch (error) {
        console.error('Error loading model:', error);
        throw error;
    }
}
