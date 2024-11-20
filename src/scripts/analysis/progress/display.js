import { formatDuration, formatMemory, formatPercentage } from './formatter.js';

/**
 * Clear the terminal screen
 */
function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
}

/**
 * Format speed and throughput information
 * @param {number} current - Current items processed
 * @param {number} elapsed - Time elapsed in ms
 * @returns {string} Formatted speed info
 */
function formatSpeed(current, elapsed) {
    const speed = (current / (elapsed / 1000)).toFixed(2);
    return `${speed} items/s`;
}

/**
 * Display progress header section
 */
function displayHeader(phase, current, total, elapsed, remaining) {
    const percent = formatPercentage(current, total);
    const speed = formatSpeed(current, elapsed);
    
    console.log(`\n=== ${phase} ===`);
    console.log(`Progress: ${percent} (${current}/${total})`);
    console.log(`Processing Speed: ${speed}`);
    console.log(`Time elapsed: ${formatDuration(elapsed)}`);
    if (remaining && remaining !== Infinity) {
        console.log(`Estimated remaining: ${formatDuration(remaining)}`);
    }
}

/**
 * Display memory usage section
 */
function displayMemoryUsage() {
    const memory = process.memoryUsage();
    console.log('\n=== Memory Usage ===');
    console.log(`Heap used: ${formatMemory(memory.heapUsed)}`);
    console.log(`Heap total: ${formatMemory(memory.heapTotal)}`);
    console.log(`RSS: ${formatMemory(memory.rss)}`);
}

/**
 * Display additional information section
 */
function displayExtraInfo(extraInfo) {
    if (Object.keys(extraInfo).length > 0) {
        console.log('\n=== Additional Info ===');
        Object.entries(extraInfo).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
        });
    }
}

/**
 * Display full progress information
 */
export function displayProgress(phase, current, total, elapsed, remaining, extraInfo = {}) {
    clearScreen();
    displayHeader(phase, current, total, elapsed, remaining);
    displayMemoryUsage();
    displayExtraInfo(extraInfo);
    console.log('\n' + '='.repeat(50));
}

/**
 * Display error message
 */
export function displayError(message, error) {
    console.error('\n=== Error ===');
    console.error(message);
    if (error?.stack) {
        console.error(error.stack);
    }
}

/**
 * Display completion message
 */
export function displayCompletion(phase, total, elapsed) {
    const speed = formatSpeed(total, elapsed);
    console.log(`\n=== ${phase} Complete ===`);
    console.log(`Processed ${total} items in ${formatDuration(elapsed)}`);
    console.log(`Average speed: ${speed}`);
}
