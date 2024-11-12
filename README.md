# SOL-USDT Price Predictor

This project uses TensorFlow.js to predict SOL-USDT price movements over the next hour based on 15-minute kline data.

## Features

- Fetches historical SOL-USDT 15m kline data from Binance Futures API
- Processes and normalizes data for training
- Uses LSTM neural network for time series prediction
- Predicts price movement percentage for the next hour
- Provides trading signals based on prediction strength

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

## Project Structure

- `src/train.js` - Model training script
- `src/predict.js` - Real-time prediction script
- `src/utils/dataFetcher.js` - Data fetching and processing utilities

## Model Architecture

The model uses a stacked LSTM architecture:
- Input: 20 timesteps of 15m kline data (5 hours of historical data)
- Features per timestep: Open, High, Low, Close, Volume, Quote Volume, Taker Buy Base Volume, Taker Buy Quote Volume
- First LSTM layer: 50 units with return sequences
- Second LSTM layer: 30 units
- Output: Single value predicting price change percentage in next hour

## Trading Signals

The prediction script provides trading signals based on the predicted price movement:
- Strong Buy: > 1.5% predicted increase
- Weak Buy: 0.5% to 1.5% predicted increase
- Neutral: -0.5% to 0.5% predicted change
- Weak Sell: -0.5% to -1.5% predicted decrease
- Strong Sell: < -1.5% predicted decrease

## Notes

- The model is trained on historical data and its predictions should not be used as the sole basis for trading decisions
- Market conditions can change rapidly and past performance doesn't guarantee future results
- Always use proper risk management when trading
