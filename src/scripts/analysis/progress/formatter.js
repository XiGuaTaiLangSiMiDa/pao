/**
 * Format time duration into human readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

/**
 * Format memory size into human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted memory string
 */
export function formatMemory(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format percentage with fixed precision
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {string} Formatted percentage
 */
export function formatPercentage(current, total) {
    return `${Math.floor((current / total) * 100)}%`;
}
