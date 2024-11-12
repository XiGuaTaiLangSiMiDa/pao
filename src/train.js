import * as tf from '@tensorflow/tfjs-node';
import { fetchKlines, prepareTrainingData } from './utils/dataFetcher.js';

const LOOKBACK_WINDOW = 20;  // 使用过去20个15分钟K线数据点
const FEATURE_SIZE = 8;      // 每个K线包含8个特征
const BATCH_SIZE = 32;
const EPOCHS = 50;

async function createModel() {
  const model = tf.sequential();
  
  // 添加LSTM层
  model.add(tf.layers.lstm({
    units: 50,
    returnSequences: true,
    inputShape: [LOOKBACK_WINDOW, FEATURE_SIZE]
  }));
  
  model.add(tf.layers.dropout(0.2));
  
  model.add(tf.layers.lstm({
    units: 30,
    returnSequences: false
  }));
  
  model.add(tf.layers.dropout(0.2));
  
  // 输出层
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'  // 预测价格变化百分比
  }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });

  return model;
}

async function trainModel() {
  try {
    console.log('Fetching historical data...');
    // 获取足够多的历史数据用于训练
    const klines = await fetchKlines({
      interval: '15m',
      limit: 1500  // 获取最近1500根K线
    });

    console.log('Preparing training data...');
    const { features, labels } = prepareTrainingData(klines, LOOKBACK_WINDOW);

    // 转换为张量
    const xTrain = tf.tensor3d(features);
    const yTrain = tf.tensor2d(labels, [labels.length, 1]);

    // 创建和训练模型
    console.log('Creating model...');
    const model = await createModel();

    console.log('Training model...');
    await model.fit(xTrain, yTrain, {
      batchSize: BATCH_SIZE,
      epochs: EPOCHS,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1} of ${EPOCHS}`);
          console.log(`Loss: ${logs.loss.toFixed(4)}, Val Loss: ${logs.val_loss.toFixed(4)}`);
        }
      }
    });

    // 保存模型
    console.log('Saving model...');
    await model.save('file://./models/sol_predictor');

    // 清理内存
    xTrain.dispose();
    yTrain.dispose();
    
    console.log('Training completed successfully!');
    
    // 进行一些测试预测
    const testData = features.slice(-5);
    const testTensor = tf.tensor3d(testData);
    const predictions = model.predict(testTensor);
    const predictionValues = await predictions.array();
    
    console.log('\nSample Predictions (Expected price change % in next 1h):');
    predictionValues.forEach((pred, i) => {
      console.log(`Prediction ${i + 1}: ${pred[0].toFixed(2)}%`);
    });
    
    testTensor.dispose();
    predictions.dispose();

  } catch (error) {
    console.error('Error during training:', error);
  }
}

trainModel();
