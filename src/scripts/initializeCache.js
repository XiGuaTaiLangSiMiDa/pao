import moment from 'moment';
import { klineCache } from '../utils/cache/cache.js';

const symbol = 'SOLUSDT';
const startTime = moment().subtract(1, 'year').valueOf();
const endTime = moment().valueOf();

console.log('Initializing klines cache...');
console.log(`Fetching data for ${symbol} from ${moment(startTime).format()} to ${moment(endTime).format()}`);

klineCache.fetchWithCache(symbol, startTime, endTime)
    .then(klines => {
        console.log(`Successfully cached ${klines.length} klines`);
        console.log('First kline:', moment(klines[0].openTime).format());
        console.log('Last kline:', moment(klines[klines.length - 1].openTime).format());
        console.log('Cache initialization complete');
    })
    .catch(error => {
        console.error('Error initializing cache:', error);
        process.exit(1);
    });
