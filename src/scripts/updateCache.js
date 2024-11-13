import moment from 'moment';
import { klineCache } from '../utils/cache/cache.js';

const symbol = 'SOLUSDT';

console.log('Updating klines cache...');

klineCache.update(symbol)
    .then(klines => {
        console.log(`Successfully updated cache with ${klines.length} klines`);
        console.log('First kline:', moment(klines[0].openTime).format());
        console.log('Last kline:', moment(klines[klines.length - 1].openTime).format());
        console.log('Cache update complete');
    })
    .catch(error => {
        console.error('Error updating cache:', error);
        process.exit(1);
    });
