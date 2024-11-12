import * as tf from '@tensorflow/tfjs-node';
import { fetchKlines, prepareTrainingData } from './utils/dataFetcher.js';

const LOOKBACK_WINDOW = 20;  // 使用过去20个15分钟K线数据点
const FEATURE_SIZE = 12;     // 7个波动率特征 + 4个布林带特征 + 1个成交量特征
const BATCH_SIZE = 32;
const EPOCHS = 50;

async function createModel() {
  const model = tf.sequential();
  
  // 第一个LSTM层，返回序列
  model.add(tf.layers.lstm({
    units: 128,
    returnSequences: true,
    inputShape: [LOOKBACK_WINDOW, FEATURE_SIZE],
    recurrentRegularizer: tf.regularizers.l2({ l2: 1e-5 })
  }));
  
  model.add(tf.layers.dropout(0.2));
  
  // 第二个LSTM层
  model.add(tf.layers.lstm({
    units: 64,
    returnSequences: true,
    recurrentRegularizer: tf.regularizers.l2({ l2: 1e-5 })
  }));
  
  model.add(tf.layers.dropout(0.2));
  
  // 第三个LSTM层
  model.add(tf.layers.lstm({
    units: 32,
    returnSequences: false,
    recurrentRegularizer: tf.regularizers.l2({ l2: 1e-5 })
  }));
  
  model.add(tf.layers.dropout(0.2));
  
  // 全连接层
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 1e-5 })
  }));
  
  // 输出层
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'  // 预测价格变化百分比
  }));

  // 使用Adam优化器和均方误差损失函数
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

    // 检查特征形状
    console.log('Feature shape:', [features.length, features[0].length, features[0][0].length]);
    console.log('Expected shape:', [null, LOOKBACK_WINDOW, FEATURE_SIZE]);

    // 转换为张量
    const xTrain = tf.tensor3d(features);
    const yTrain = tf.tensor2d(labels, [labels.length, 1]);

    // 创建和训练模型
    console.log('Creating model...');
    const model = await createModel();

    // 输出模型结构
    model.summary();

    console.log('Training model...');
    await model.fit(xTrain, yTrain, {
      batchSize: BATCH_SIZE,
      epochs: EPOCHS,
      validationSplit: 0.2,
      shuffle: true,
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
    if (error.message.includes('tensor')) {
      console.error('Tensor shape error. Please check the input data format.');
      console.error('Expected shape:', [null, LOOKBACK_WINDOW, FEATURE_SIZE]);
    }
  }
}

trainModel();
