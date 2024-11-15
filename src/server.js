import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { makePrediction } from './predict.js';
import { analyzeTrend } from './scripts/analysis/trendAnalyzer.js';
import { klineCache } from './utils/cache/cache.js';
import { TimeframeAnalyzer } from './scripts/timeframe_analysis/analyzer.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 9999;

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Parse JSON bodies
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Timeframe analysis endpoint
app.get('/api/timeframe-analysis', async (req, res) => {
    try {
        // 获取最新的k线数据
        const klineData = await klineCache.update("SOLUSDT");
        
        if (!klineData || klineData.length === 0) {
            throw new Error('No kline data available for analysis');
        }

        // 验证k线数据
        const validKlines = klineData.filter(k => 
            k && k.openTime && k.open && k.high && k.low && k.close && k.volume &&
            !isNaN(parseFloat(k.high)) && !isNaN(parseFloat(k.low)) && 
            !isNaN(parseFloat(k.close)) && !isNaN(parseFloat(k.volume))
        );

        // 初始化分析器
        const analyzer = new TimeframeAnalyzer(validKlines);

        // 执行分析
        analyzer.calculateIndicators();
        analyzer.detectReversals();
        analyzer.analyzeWarningSequences();

        // 格式化结果
        const results = {
            reversalStatistics: {},
            warningSequences: [],
            trendProbabilities: {}
        };

        // 计算反转统计
        for (const [timeframe, reversals] of Object.entries(analyzer.reversalPoints)) {
            results.reversalStatistics[timeframe] = {
                total: reversals.length,
                bullish: reversals.filter(r => r.type === 'bullish').length,
                bearish: reversals.filter(r => r.type === 'bearish').length,
                averageStockRSI: reversals.length > 0 ?
                    reversals.reduce((sum, r) => sum + r.stockRSI, 0) / reversals.length : 0,
                averageOBVDivergence: reversals.length > 0 ?
                    reversals.reduce((sum, r) => sum + Math.abs(r.obvDivergence), 0) / reversals.length : 0,
                patterns: reversals.reduce((acc, r) => {
                    if (r.pattern !== 'none') {
                        acc[r.pattern] = (acc[r.pattern] || 0) + 1;
                    }
                    return acc;
                }, {})
            };
        }

        // 格式化警告序列
        results.warningSequences = Object.entries(analyzer.warningSequences)
            .map(([timestamp, warnings]) => ({
                timestamp: parseInt(timestamp),
                sequence: warnings
            }));

        // 计算趋势概率
        results.trendProbabilities = analyzer.calculateTrendProbabilities();

        // 保存结果到文件（用于调试和历史记录）
        fs.writeFileSync(
            path.join(__dirname, '../models/timeframe_analysis.json'),
            JSON.stringify(results, null, 2)
        );

        res.json(results);
    } catch (error) {
        console.error('Error in timeframe analysis:', error);
        res.status(500).json({ 
            error: 'Failed to perform timeframe analysis',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Trend analysis endpoint
app.get('/trend', async (req, res) => {
    try {
        const analysis = await analyzeTrend();
        res.json(analysis);
    } catch (error) {
        console.error('Error getting trend analysis:', error);
        res.status(500).json({ 
            error: 'Failed to get trend analysis',
            message: error.message
        });
    }
});

// Prediction endpoint
app.post('/predict', async (req, res) => {
    try {
        let klines;
        
        // If klines not provided in request, fetch them
        if (!req.body.klines || req.body.klines.length === 0) {
            klines = await klineCache.update("SOLUSDT");
            if (!klines || klines.length === 0) {
                throw new Error('Failed to fetch klines data');
            }
        } else {
            klines = req.body.klines;
        }

        // Make prediction using provided or fetched klines
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
            signal: prediction.signal || 'Low Confidence',
            accuracy: prediction.accuracy || prediction.confidence,
            metadata: {
                price: {
                    open: metadata.price.open || 0,
                    high: metadata.price.high || 0,
                    low: metadata.price.low || 0,
                    close: metadata.price.close || 0
                },
                indicators: {
                    stochRSI: metadata.indicators.stochRSI,
                    obv: metadata.indicators.obv,
                    rsi: metadata.indicators.rsi || 50,
                    momentum: metadata.indicators.momentum || 0,
                    macd: metadata.indicators.macd || 0,
                    roc: metadata.indicators.roc || 0,
                    bBands: metadata.indicators.bBands || null,
                    adx: metadata.indicators.adx || {
                        adx: 25,
                        plusDI: 20,
                        minusDI: 20
                    },
                    atr: metadata.indicators.atr || 0,
                    cmf: metadata.indicators.cmf || 0
                },
                analysis: {
                    trend: metadata.analysis.trend || 'neutral',
                    strength: metadata.analysis.strength || 'moderate',
                    volatility: metadata.analysis.volatility || 0,
                    riskLevel: metadata.analysis.riskLevel || 0.5,
                    signals: metadata.analysis.signals || []
                }
            }
        };

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
