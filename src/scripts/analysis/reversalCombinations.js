import { ANALYSIS_CONFIG } from './config.js';
import { detectReversalPoints } from './detector.js';
import { CacheStorage } from '../../utils/cache/storage.js';
import { klineCache } from '../../utils/cache/cache.js';
import { calculateMACD, calculateBollingerBands, calculateMomentum, calculateROC } from '../../utils/data/indicators.js';
import { calculateADX, calculateStochRSI, calculateOBV, calculateATR, calculateCMF } from './indicators.js';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import moment from 'moment';

// Import new modular components directly
import { progressTracker } from './progress/tracker.js';
import { findEffectiveCombinations } from './combinations/analyzer.js';
import { formatAnalysisSummary } from './combinations/formatter.js';
import { saveResults, loadResults, compareResults } from './combinations/storage.js';
import { processInParallel } from './worker.js';

// 优化参数
const NUM_WORKERS = Math.max(1, Math.floor(cpus().length * 0.75)); // 使用75%的CPU核心
const CHUNK_SIZE = 2000; // 增加块大小以减少通信开销
const BATCH_SIZE = 100; // 指标计算的批处理大小

/**
 * 分析单年的数据
 */
async function analyzeYear(symbol, year) {
    try {
        console.log(`\n分析 ${year} 年的数据...`);
        
        // 获取该年数据
        const startTime = moment([year]).startOf('year');
        const endTime = moment([year]).endOf('year');
        
        console.log(`获取时间范围: ${startTime.format('YYYY-MM-DD HH:mm')} 到 ${endTime.format('YYYY-MM-DD HH:mm')}`);
        
        const klines = await klineCache.fetchWithCache(symbol, startTime, endTime);
        
        if (!klines || klines.length === 0) {
            console.log(`${year} 年没有数据`);
            return null;
        }

        console.log(`获取到 ${klines.length} 根K线数据`);
        console.log(`实际范围: ${moment(klines[0].openTime).format('YYYY-MM-DD HH:mm')} 到 ${moment(klines[klines.length - 1].openTime).format('YYYY-MM-DD HH:mm')}`);

        // 检测反转点
        progressTracker.startPhase('检测反转点', klines.length);
        const reversals = detectReversalPoints(klines);
        progressTracker.completePhase();

        console.log(`发现 ${reversals.length} 个反转点`);

        if (reversals.length === 0) {
            console.log('没有发现反转点，跳过分析');
            return null;
        }

        // 创建数据块
        const chunks = [];
        for (let i = 0; i < reversals.length; i += CHUNK_SIZE) {
            chunks.push(reversals.slice(i, Math.min(i + CHUNK_SIZE, reversals.length)));
        }

        // 处理数据块
        console.log(`处理 ${chunks.length} 个数据块（每块 ${CHUNK_SIZE} 个反转点）...`);
        console.log(`使用 ${NUM_WORKERS} 个工作线程并行处理...`);
        
        const combinations = await processInParallel(chunks, klines, 
            (phase, current, total, extra) => {
                const actualExtra = {
                    ...extra,
                    '年度进度': `${((current / total) * 100).toFixed(2)}%`,
                    '处理块数': `${current}/${total}`,
                    '工作线程': NUM_WORKERS,
                    '块大小': CHUNK_SIZE,
                    '批处理大小': BATCH_SIZE
                };
                progressTracker.update(current, actualExtra);
            }
        );
        
        // 查找有效组合
        progressTracker.startPhase('查找有效组合', 1);
        const effectiveCombinations = findEffectiveCombinations(combinations);
        progressTracker.completePhase();

        const totalTime = progressTracker.getElapsedTime();

        // 准备结果
        const result = {
            metadata: {
                year: year.toString(),
                timeRange: {
                    start: klines[0].openTime,
                    end: klines[klines.length - 1].openTime
                },
                totalKlines: klines.length,
                totalReversals: reversals.length,
                upwardReversals: reversals.filter(r => r.type === 'upward').length,
                downwardReversals: reversals.filter(r => r.type === 'downward').length,
                processingTime: totalTime / 1000,
                averageTimePerReversal: (totalTime / reversals.length).toFixed(2),
                chunksProcessed: chunks.length,
                workersUsed: NUM_WORKERS,
                chunkSize: CHUNK_SIZE,
                batchSize: BATCH_SIZE
            },
            combinations: effectiveCombinations
        };

        // 保存年度结果
        await saveResults(`${symbol}_${year}`, result);
        
        return result;

    } catch (error) {
        console.error(`分析 ${year} 年出错:`, error);
        return null;
    }
}

/**
 * 合并年度分析结果
 */
function mergeYearlyResults(results) {
    const merged = {
        metadata: {
            totalKlines: 0,
            totalReversals: 0,
            upwardReversals: 0,
            downwardReversals: 0,
            processingTime: 0,
            analyzedYears: [],
            performance: {
                averageTimePerReversal: 0,
                totalChunksProcessed: 0,
                workersUsed: NUM_WORKERS,
                chunkSize: CHUNK_SIZE,
                batchSize: BATCH_SIZE
            }
        },
        combinations: {
            upward: [],
            downward: []
        }
    };

    // 合并元数据
    let totalReversals = 0;
    let totalTime = 0;
    let totalChunks = 0;

    results.forEach(result => {
        if (!result) return;
        
        merged.metadata.totalKlines += result.metadata.totalKlines;
        merged.metadata.totalReversals += result.metadata.totalReversals;
        merged.metadata.upwardReversals += result.metadata.upwardReversals;
        merged.metadata.downwardReversals += result.metadata.downwardReversals;
        merged.metadata.processingTime += result.metadata.processingTime;
        merged.metadata.analyzedYears.push(result.metadata.year);

        totalReversals += result.metadata.totalReversals;
        totalTime += result.metadata.processingTime;
        totalChunks += result.metadata.chunksProcessed;
    });

    merged.metadata.performance.averageTimePerReversal = (totalTime / totalReversals).toFixed(2);
    merged.metadata.performance.totalChunksProcessed = totalChunks;

    // 合并组合结果
    const combinationMap = {
        upward: new Map(),
        downward: new Map()
    };

    results.forEach(result => {
        if (!result) return;
        
        ['upward', 'downward'].forEach(type => {
            result.combinations[type].forEach(combo => {
                const key = combo.combination;
                if (!combinationMap[type].has(key)) {
                    combinationMap[type].set(key, {
                        combination: key,
                        effectiveness: 0,
                        total: 0,
                        effective: 0,
                        indicators: combo.indicators,
                        yearsFound: 0,
                        yearlyStats: []
                    });
                }

                const existing = combinationMap[type].get(key);
                existing.total += combo.total;
                existing.effective += combo.effective;
                existing.yearsFound++;
                existing.yearlyStats.push({
                    year: result.metadata.year,
                    effectiveness: combo.effectiveness,
                    total: combo.total,
                    effective: combo.effective
                });
            });
        });
    });

    // 计算平均有效性并排序
    ['upward', 'downward'].forEach(type => {
        combinationMap[type].forEach(combo => {
            combo.effectiveness = combo.effective / combo.total;
            // 计算年度统计
            combo.yearlyStats.sort((a, b) => b.effectiveness - a.effectiveness);
            combo.bestYear = combo.yearlyStats[0];
            combo.worstYear = combo.yearlyStats[combo.yearlyStats.length - 1];
        });
        
        merged.combinations[type] = Array.from(combinationMap[type].values())
            .sort((a, b) => b.effectiveness - a.effectiveness);
    });

    return merged;
}

/**
 * Main analysis function
 */
async function analyzeReversalCombinations(symbol = "SOLUSDT", startYear = 2020) {
    try {
        progressTracker.init();
        console.log(`开始分析 ${symbol} 从 ${startYear}年至今的数据...`);
        console.log(`配置: ${NUM_WORKERS}个工作线程, 块大小=${CHUNK_SIZE}, 批处理大小=${BATCH_SIZE}`);
        
        const currentYear = new Date().getFullYear();
        
        // 按年分析
        const yearlyResults = [];
        
        for (let year = startYear; year <= currentYear; year++) {
            const result = await analyzeYear(symbol, year);
            if (result) {
                yearlyResults.push(result);
                // 手动触发垃圾回收
                if (global.gc) {
                    global.gc();
                }
            }
        }

        // 合并所有年份的结果
        const mergedResults = mergeYearlyResults(yearlyResults);
        
        // 保存最终结果
        await saveResults(symbol, mergedResults);
        
        // 打印汇总
        console.log('\n=== 分析完成 ===');
        console.log(`分析了 ${mergedResults.metadata.analyzedYears.length} 年的数据`);
        console.log(`总计处理 ${mergedResults.metadata.totalKlines} 根K线`);
        console.log(`发现 ${mergedResults.metadata.totalReversals} 个反转点`);
        console.log(`上升反转: ${mergedResults.metadata.upwardReversals}`);
        console.log(`下降反转: ${mergedResults.metadata.downwardReversals}`);
        console.log(`总处理时间: ${mergedResults.metadata.processingTime}秒`);
        console.log(`平均每个反转点处理时间: ${mergedResults.metadata.performance.averageTimePerReversal}ms`);
        console.log(`处理的数据块总数: ${mergedResults.metadata.performance.totalChunksProcessed}`);
        console.log('\n组合分析结果:');
        console.log(formatAnalysisSummary(mergedResults));

    } catch (error) {
        progressTracker.handleError('分析出错:', error);
        process.exit(1);
    }
}

// Run analysis if this is the main thread
if (isMainThread && process.argv[1].endsWith('reversalCombinations.js')) {
    const startYear = process.argv.length >= 3 ? parseInt(process.argv[2], 10) : 2020;
    const symbol = process.argv.length >= 4 ? process.argv[3] : "SOLUSDT";
    analyzeReversalCombinations(symbol, startYear);
} else if (!isMainThread) {
    // Worker thread code
    parentPort.on('message', async ({ chunk, klines }) => {
        try {
            const results = await processChunk(chunk, klines);
            parentPort.postMessage(results);
        } catch (error) {
            parentPort.emit('error', error);
        }
    });
}
