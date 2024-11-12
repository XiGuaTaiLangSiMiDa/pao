import * as tf from '@tensorflow/tfjs-node';
import { fetchKlines, prepareTrainingData } from './utils/dataFetcher.js';

const LOOKBACK_WINDOW = 20;

async function loadModel() {
  try {
    const model = await tf.loadLayersModel('file://./models/sol_predictor/model.json');
    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
}

async function makePrediction() {
  try {
    // 加载模型
    console.log('Loading model...');
    const model = await loadModel();

    // 获取最新的市场数据
    console.log('Fetching latest market data...');
    const klines = await fetchKlines({
      interval: '15m',
      limit: LOOKBACK_WINDOW + 5  // 多获取一些数据以确保有足够的样本
    });

    // 准备预测数据
    const { features } = prepareTrainingData(klines, LOOKBACK_WINDOW);
    
    // 确保我们有数据
    if (features.length === 0) {
      throw new Error('No features generated from the data');
    }

    // 获取最新的特征数据
    const latestFeature = features[features.length - 1];
    
    // 当前价格
    const currentPrice = klines[klines.length - 1].close;

    // 检查特征数据的形状
    console.log('Feature shape:', [latestFeature.length, latestFeature[0].length]);

    // 转换为张量并进行预测
    const inputTensor = tf.tensor3d([latestFeature]);
    const prediction = model.predict(inputTensor);
    const predictedChange = await prediction.data();

    // 清理张量
    inputTensor.dispose();
    prediction.dispose();

    // 输出预测结果
    console.log('\nPrediction Results:');
    console.log('Current SOL Price:', currentPrice.toFixed(2), 'USDT');
    console.log('Predicted 1h Price Change:', predictedChange[0].toFixed(2) + '%');
    console.log('Predicted Price in 1h:', (currentPrice * (1 + predictedChange[0]/100)).toFixed(2), 'USDT');
    
    // 添加一些市场指标
    const recentPrices = klines.map(k => k.close);
    const priceChange24h = ((currentPrice - recentPrices[0]) / recentPrices[0] * 100).toFixed(2);
    const highPrice = Math.max(...klines.map(k => k.high));
    const lowPrice = Math.min(...klines.map(k => k.low));
    
    console.log('\nMarket Statistics (Last 5h):');
    console.log('Price Change:', priceChange24h + '%');
    console.log('Highest Price:', highPrice.toFixed(2), 'USDT');
    console.log('Lowest Price:', lowPrice.toFixed(2), 'USDT');
    
    // 简单的交易建议
    console.log('\nTrading Signal:');
    if (predictedChange[0] > 1.5) {
      console.log('🟢 Strong Buy Signal');
    } else if (predictedChange[0] > 0.5) {
      console.log('🟡 Weak Buy Signal');
    } else if (predictedChange[0] < -1.5) {
      console.log('🔴 Strong Sell Signal');
    } else if (predictedChange[0] < -0.5) {
      console.log('🟠 Weak Sell Signal');
    } else {
      console.log('⚪ Neutral Signal');
    }

  } catch (error) {
    console.error('Error making prediction:', error);
    if (error.message.includes('tensor')) {
      console.error('Tensor shape error. Please check the input data format.');
    }
  }
}

// 如果直接运行此文件，执行预测
if (process.argv[1] === new URL(import.meta.url).pathname) {
  makePrediction();
}

export { makePrediction };
