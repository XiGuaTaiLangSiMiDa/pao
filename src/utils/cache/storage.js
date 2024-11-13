import fs from 'fs';
import path from 'path';
import { CACHE_CONFIG } from './config.js';

export class CacheStorage {
    constructor() {
        if (!fs.existsSync(CACHE_CONFIG.CACHE_DIR)) {
            fs.mkdirSync(CACHE_CONFIG.CACHE_DIR, { recursive: true });
        }
        this.cachePath = path.join(CACHE_CONFIG.CACHE_DIR, CACHE_CONFIG.CACHE_FILE);
    }

    read() {
        if (fs.existsSync(this.cachePath)) {
            return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        }
        return {};
    }

    write(data) {
        fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2));
    }

    getCacheKey(symbol) {
        return `${symbol}_${CACHE_CONFIG.INTERVAL}`;
    }

    getKlines(symbol) {
        const cache = this.read();
        const cacheKey = this.getCacheKey(symbol);
        return cache[cacheKey] || [];
    }

    saveKlines(symbol, klines) {
        const cache = this.read();
        const cacheKey = this.getCacheKey(symbol);
        cache[cacheKey] = klines;
        this.write(cache);
    }
}
