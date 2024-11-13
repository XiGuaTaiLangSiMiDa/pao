import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { makePrediction } from './utils/webPredict.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 80;

// Parse JSON bodies
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Prediction endpoint
app.post('/predict', async (req, res) => {
    try {
        // Validate request body
        const { klines } = req.body;
        if (!klines || !Array.isArray(klines) || klines.length === 0) {
            throw new Error('Invalid request: klines data is required');
        }

        // Make prediction using provided klines
        const prediction = await makePrediction(klines);
        
        // Validate prediction data
        if (!prediction || !prediction.metadata) {
            throw new Error('Invalid prediction data: missing metadata');
        }

        // Ensure all required metadata exists
        const { metadata } = prediction;
        if (!metadata.price || !metadata.indicators || !metadata.analysis) {
            console.error('Invalid metadata structure:', metadata);
            throw new Error('Invalid metadata structure');
        }

        // Format the prediction data for the frontend
        const response = {
            predictedChange: prediction.predictedChange,
            predictedPrice: prediction.predictedPrice,
            confidence: prediction.confidence,
            metadata: {
                price: {
                    open: metadata.price.open || 0,
                    high: metadata.price.high || 0,
                    low: metadata.price.low || 0,
                    close: metadata.price.close || 0
                },
                indicators: {
                    rsi: metadata.indicators.rsi || 50,
                    momentum: metadata.indicators.momentum || 0,
                    macd: metadata.indicators.macd || 0,
                    roc: metadata.indicators.roc || 0,
                    bBands: metadata.indicators.bBands || null
                },
                analysis: {
                    trend: metadata.analysis.trend || 'neutral',
                    strength: metadata.analysis.strength || 'moderate',
                    volatility: metadata.analysis.volatility || 0,
                    riskLevel: metadata.analysis.riskLevel || 0.5
                }
            }
        };

        // Log the response for debugging
        console.log('Sending prediction response:', JSON.stringify(response, null, 2));

        res.json(response);
    } catch (error) {
        console.error('Error making prediction:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to make prediction',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

app.listen(port, () => {
    console.log(`
Server is running at http://localhost:${port}
    
TradingView chart with real-time predictions is now available.
Press Ctrl+C to stop the server.
`);
});
