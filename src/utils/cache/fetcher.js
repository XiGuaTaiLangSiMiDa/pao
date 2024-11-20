import { fetchKlines } from '../data/fetcher.js';
import { CACHE_CONFIG } from './config.js';

export class KlineFetcher {
    async fetchKlinesInChunks(symbol, startTime, endTime) {
        const allKlines = [];
        let currentStartTime = startTime;

        while (currentStartTime < endTime) {
            try {
                const klines = await fetchKlines({
                    symbol,
                    interval: CACHE_CONFIG.INTERVAL,
                    limit: CACHE_CONFIG.CHUNK_SIZE,
                    startTime: currentStartTime,
                    endTime: Math.min(
                        currentStartTime + CACHE_CONFIG.CHUNK_SIZE * 15 * 60 * 1000, 
                        endTime
                    )
                });

                if (klines.length === 0) {
                    currentStartTime += CACHE_CONFIG.CHUNK_SIZE * 15 * 60 * 1000;
                    console.log(new Date(currentStartTime));
                    continue;
                }

                allKlines.push(...klines);
                
                // Update start time for next chunk
                currentStartTime = klines[klines.length - 1].openTime + 15 * 60 * 1000;
                
                // Add delay to avoid rate limits
                await new Promise(resolve => 
                    setTimeout(resolve, CACHE_CONFIG.RATE_LIMIT_DELAY)
                );
            } catch (error) {
                console.error('Error fetching chunk:', error);
                // Add delay before retry
                await new Promise(resolve => 
                    setTimeout(resolve, CACHE_CONFIG.RETRY_DELAY)
                );
            }
        }

        return this.sortKlines(allKlines);
    }

    sortKlines(klines) {
        return klines.sort((a, b) => a.openTime - b.openTime);
    }

    removeDuplicates(klines) {
        const timeMap = new Map(klines.map(k => [k.openTime, k]));
        return Array.from(timeMap.values());
    }

    mergeKlines(existingKlines, newKlines) {
        const allKlines = [...existingKlines, ...newKlines];
        const uniqueKlines = this.removeDuplicates(allKlines);
        return this.sortKlines(uniqueKlines);
    }
}
