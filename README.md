# SOL-USDT Price Predictor

This project uses TensorFlow.js to predict SOL-USDT price movements over the next hour based on 15-minute kline data and advanced technical indicators.

## Features

### Data Collection
- Fetches historical SOL-USDT 15m kline data from Binance Futures API
- Processes and normalizes data for training

### Technical Indicators
1. Price Data:
   - Open, High, Low, Close prices
   - Trading volume
   - Quote volume
   - Taker buy volumes

2. Volatility Metrics:
   - High-Low volatility: ((high - low) / low) * 100
   - Open-Close volatility: |close - open| / open * 100
   - Body-to-Wick ratio: |close - open| / (high - low)

3. Bollinger Bands:
   - Band width as percentage of middle band
   - 20-period SMA with 2 standard deviations

### Model Architecture
- Three stacked LSTM layers:
  * First layer: 100 units with sequence return
  * Second layer: 50 units with sequence return
  * Third layer: 30 units
- Dropout layers (0.2) for regularization
- Dense layer with ReLU activation (20 units)
- Output layer for price change prediction
- Adam optimizer with MSE loss function

## Setup

1. Install dependencies:
```bash
npm install
```

2. Train the model:
```bash
npm run train
```

3. Make predictions:
```bash
npm run predict
```

## Trading Signals

The prediction script provides trading signals based on the predicted price movement:
- Strong Buy: > 1.5% predicted increase
- Weak Buy: 0.5% to 1.5% predicted increase
- Neutral: -0.5% to 0.5% predicted change
- Weak Sell: -0.5% to -1.5% predicted decrease
- Strong Sell: < -1.5% predicted decrease

## Project Structure

- `src/train.js` - Model training script
- `src/predict.js` - Real-time prediction script
- `src/utils/dataFetcher.js` - Data fetching and processing utilities
- `models/` - Directory for saved model files (gitignored)

## Notes

- The model uses a comprehensive set of technical indicators to capture market dynamics
- Volatility metrics help identify market conditions and potential trend changes
- Bollinger Band width indicates market volatility and potential breakouts
- The model is trained on historical data and its predictions should not be used as the sole basis for trading decisions
- Always use proper risk management when trading
