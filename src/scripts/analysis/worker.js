import { Worker, isMainThread, parentPort } from 'worker_threads';
import { cpus } from 'os';
import { ANALYSIS_CONFIG } from './config.js';
import { calculateMACD, calculateBollingerBands, calculateMomentum, calculateROC } from '../../utils/data/indicators.js';
import { calculateADX, calculateStochRSI, calculateOBV, calculateATR, calculateCMF } from './indicators.js';

const NUM_WORKERS = Math.max(1, Math.floor(cpus().length * 0.75));
const CHUNK_SIZE = 2000;
const BATCH_SIZE = 100;

/**
 * 批量计算指标
 */
async function calculateIndicatorsBatch(klines, indices) {
    const results = new Map();
    
    // 按批次处理
    for (let i = 0; i < indices.length; i += BATCH_SIZE) {
        const batchIndices = indices.slice(i, i + BATCH_SIZE);
        await Promise.all(batchIndices.map(async (index) => {
            try {
                const slicedData = {
                    prices: klines.slice(0, index + 1).map(k => k.close),
                    highs: klines.slice(0, index + 1).map(k => k.high),
                    lows: klines.slice(0, index + 1).map(k => k.low),
                    volumes: klines.slice(0, index + 1).map(k => k.volume)
                };

                const [trend, momentum, volatility, volume] = await Promise.all([
                    calculateTrendIndicators(slicedData),
                    calculateMomentumIndicators(slicedData),
                    calculateVolatilityIndicators(slicedData),
                    calculateVolumeIndicators(slicedData)
                ]);

                results.set(index, {
                    trend,
                    momentum,
                    volatility,
                    volume
                });
            } catch (error) {
                console.warn(`Warning: Error calculating indicators at index ${index}:`, error.message);
            }
        }));
    }

    return results;
}

/**
 * 计算趋势指标
 */
async function calculateTrendIndicators({ prices, highs, lows }) {
    return {
        adx: calculateADX(highs, lows, prices).slice(-1)[0] || 0,
        macd: calculateMACD(
            prices,
            ANALYSIS_CONFIG.TREND.MACD.FAST_PERIOD,
            ANALYSIS_CONFIG.TREND.MACD.SLOW_PERIOD,
            ANALYSIS_CONFIG.TREND.MACD.SIGNAL_PERIOD
        ),
        stochRSI: calculateStochRSI(prices, ANALYSIS_CONFIG.TREND.STOCH_RSI_PERIOD).slice(-1)[0] || 50
    };
}

/**
 * 计算动量指标
 */
async function calculateMomentumIndicators({ prices, volumes }) {
    return {
        momentum: calculateMomentum(prices, ANALYSIS_CONFIG.MOMENTUM.MOMENTUM_PERIOD).slice(-1)[0] || 0,
        roc: calculateROC(prices, ANALYSIS_CONFIG.MOMENTUM.ROC_PERIOD).slice(-1)[0] || 0,
        obv: calculateOBV(prices, volumes).slice(-1)[0] || 0
    };
}

/**
 * 计算波动性指标
 */
async function calculateVolatilityIndicators({ prices, highs, lows }) {
    return {
        atr: calculateATR(highs, lows, prices).slice(-1)[0] || 0,
        bb: calculateBollingerBands(
            prices,
            ANALYSIS_CONFIG.VOLATILITY.BBANDS.PERIOD,
            ANALYSIS_CONFIG.VOLATILITY.BBANDS.STD_DEV
        ).slice(-1)[0] || { bandwidth: 0, percentB: 50, deviation: 0 }
    };
}

/**
 * 计算成交量指标
 */
async function calculateVolumeIndicators({ prices, highs, lows, volumes }) {
    return {
        cmf: calculateCMF(highs, lows, prices, volumes).slice(-1)[0] || 0
    };
}

/**
 * 处理数据块
 */
async function processChunk(chunk, klines) {
    try {
        const indices = chunk.map(reversal => reversal.index);
        const indicators = await calculateIndicatorsBatch(klines, indices);

        const results = {
            upward: new Map(),
            downward: new Map()
        };

        chunk.forEach((reversal, i) => {
            const indicator = indicators.get(reversal.index);
            if (!indicator) return;

            const type = reversal.type;
            const key = generateCombinationKey(indicator);

            if (!results[type].has(key)) {
                results[type].set(key, {
                    total: 0,
                    effective: 0,
                    indicators: {
                        adx: indicator.trend.adx,
                        macd: indicator.trend.macd.histogram?.slice(-1)[0] || 0,
                        stochRSI: indicator.trend.stochRSI,
                        momentum: indicator.momentum.momentum,
                        roc: indicator.momentum.roc,
                        atr: indicator.volatility.atr,
                        bbandsB: indicator.volatility.bb.percentB,
                        cmf: indicator.volume.cmf,
                        obv: indicator.momentum.obv
                    }
                });
            }

            const stats = results[type].get(key);
            stats.total++;
            if (reversal.effective) {
                stats.effective++;
            }
        });

        return results;
    } catch (error) {
        console.error('Error processing chunk:', error);
        throw error;
    }
}

/**
 * 生成组合键
 */
function generateCombinationKey(indicators) {
    const ranges = [
        Math.floor(indicators.trend.adx / 10) * 10,
        indicators.trend.macd.histogram > 0 ? 1 : 0,
        Math.floor(indicators.trend.stochRSI / 10) * 10,
        Math.floor(normalizeValue(indicators.momentum.momentum) / 10) * 10,
        Math.floor(normalizeValue(indicators.momentum.roc) / 10) * 10,
        Math.floor(normalizeValue(indicators.volatility.atr) / 10) * 10,
        Math.floor(indicators.volatility.bb.percentB / 10) * 10,
        indicators.volume.cmf > 0 ? 1 : 0,
        indicators.momentum.obv > 0 ? 1 : 0
    ];

    return ranges.join('|');
}

/**
 * 标准化指标值
 */
function normalizeValue(value) {
    return Math.min(Math.max((value + 3) / 6 * 100, 0), 100);
}

/**
 * 并行处理数据块
 */
export async function processInParallel(chunks, klines, updateProgress) {
    const workers = Array(NUM_WORKERS).fill(null).map(() => {
        const worker = new Worker(new URL(import.meta.url));
        worker.setMaxListeners(0);
        return worker;
    });

    const results = [];
    let currentChunkIndex = 0;
    const totalChunks = chunks.length;

    return new Promise((resolve, reject) => {
        workers.forEach(worker => {
            async function processNextChunk() {
                if (currentChunkIndex >= totalChunks) {
                    worker.terminate();
                    if (workers.every(w => w.listenerCount('message') === 0)) {
                        process.stdout.write('\n');
                        resolve(results);
                    }
                    return;
                }

                const chunk = chunks[currentChunkIndex++];
                updateProgress?.('处理数据块', currentChunkIndex, totalChunks, {
                    '工作线程': NUM_WORKERS,
                    '块大小': CHUNK_SIZE,
                    '批处理大小': BATCH_SIZE,
                    '已处理': results.length
                });
                worker.postMessage({ chunk, klines });
            }

            worker.on('message', (result) => {
                if (result && Object.keys(result).length > 0) {
                    results.push(result);
                }
                processNextChunk();
            });

            worker.on('error', (error) => {
                workers.forEach(w => w.terminate());
                reject(error);
            });

            processNextChunk();
        });
    });
}

// Worker thread code
if (!isMainThread) {
    parentPort.on('message', async ({ chunk, klines }) => {
        try {
            const results = await processChunk(chunk, klines);
            parentPort.postMessage(results);
        } catch (error) {
            parentPort.emit('error', error);
        }
    });
}
