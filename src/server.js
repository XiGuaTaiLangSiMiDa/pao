import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { makePrediction } from './predict.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Prediction endpoint
app.get('/predict', async (req, res) => {
    try {
        const prediction = await makePrediction();
        
        // Format the prediction data for the frontend
        const response = {
            currentPrice: prediction.currentPrice,
            predictedChange: prediction.predictedChange,
            predictedPrice: prediction.predictedPrice,
            confidence: prediction.confidence,
            rsi: prediction.rsi,
            volatility: prediction.volatility * 100, // Convert to percentage
            priceChange24h: prediction.priceChange24h,
            highPrice: prediction.highPrice,
            lowPrice: prediction.lowPrice,
            signal: getSignal(prediction.predictedChange, prediction.confidence)
        };

        res.json(response);
    } catch (error) {
        console.error('Error making prediction:', error);
        res.status(500).json({ 
            error: 'Failed to make prediction',
            message: error.message 
        });
    }
});

// Helper function to determine trading signal
function getSignal(predictedChange, confidence) {
    if (confidence < 60) return 'Low Confidence';
    if (predictedChange > 1.5) return 'Strong Buy';
    if (predictedChange > 0.5) return 'Buy';
    if (predictedChange < -1.5) return 'Strong Sell';
    if (predictedChange < -0.5) return 'Sell';
    return 'Neutral';
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

app.listen(port, () => {
    console.log(`
Server is running at http://localhost:${port}
    
TradingView chart with real-time predictions is now available.
Press Ctrl+C to stop the server.
`);
});
