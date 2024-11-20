import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * 确保目录存在
 */
async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

/**
 * 保存分析结果
 */
export async function saveResults(symbol, results) {
    try {
        // 确保models目录存在
        const modelsDir = join(process.cwd(), 'models');
        await ensureDir(modelsDir);
        
        // 生成文件名
        const filename = `${symbol}_analysis.json`;
        const filepath = join(modelsDir, filename);
        
        // 保存结果
        await fs.writeFile(filepath, JSON.stringify(results, null, 2), 'utf8');
        console.log(`结果已保存到: ${filepath}`);
        
        return filepath;
    } catch (error) {
        console.error('保存结果失败:', error);
        throw error;
    }
}

/**
 * 加载之前的分析结果
 */
export async function loadResults(symbol) {
    try {
        const filepath = join(process.cwd(), 'models', `${symbol}_analysis.json`);
        const content = await fs.readFile(filepath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        console.error('加载结果失败:', error);
        throw error;
    }
}

/**
 * 比较新旧结果
 */
export function compareResults(newResults, oldResults) {
    if (!oldResults) return null;

    const comparison = {
        metadata: {
            totalKlinesDiff: newResults.metadata.totalKlines - oldResults.metadata.totalKlines,
            totalReversalsDiff: newResults.metadata.totalReversals - oldResults.metadata.totalReversals,
            processingTimeDiff: newResults.metadata.processingTime - oldResults.metadata.processingTime
        },
        combinations: {
            upward: compareEffectiveness(newResults.combinations.upward, oldResults.combinations.upward),
            downward: compareEffectiveness(newResults.combinations.downward, oldResults.combinations.downward)
        }
    };

    return comparison;
}

/**
 * 比较组合有效性
 */
function compareEffectiveness(newCombos, oldCombos) {
    const improved = [];
    const degraded = [];
    const unchanged = [];

    newCombos.forEach(newCombo => {
        const oldCombo = oldCombos.find(c => c.combination === newCombo.combination);
        if (!oldCombo) {
            improved.push({
                combination: newCombo.combination,
                effectiveness: newCombo.effectiveness,
                isNew: true
            });
            return;
        }

        const diff = newCombo.effectiveness - oldCombo.effectiveness;
        if (Math.abs(diff) < 0.001) {
            unchanged.push(newCombo.combination);
        } else if (diff > 0) {
            improved.push({
                combination: newCombo.combination,
                effectiveness: newCombo.effectiveness,
                improvement: diff
            });
        } else {
            degraded.push({
                combination: newCombo.combination,
                effectiveness: newCombo.effectiveness,
                degradation: -diff
            });
        }
    });

    return { improved, degraded, unchanged };
}
