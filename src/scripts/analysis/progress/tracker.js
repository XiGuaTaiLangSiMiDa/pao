import { displayProgress, displayError } from './display.js';

const UPDATE_INTERVAL = 1000; // Update progress every second

class ProgressTracker {
    constructor() {
        this.reset();
    }

    /**
     * Initialize progress tracking
     */
    init() {
        this.reset();
        this.startTime = Date.now();
        this.lastUpdate = this.startTime;
        return this.startTime;
    }

    /**
     * Start tracking a new phase
     * @param {string} phase - Phase name
     * @param {number} total - Total items to process
     */
    startPhase(phase, total) {
        this.phase = phase;
        this.current = 0;
        this.total = total;
        this.extraInfo = {};
        
        if (!this.startTime) {
            this.startTime = Date.now();
        }
        this.lastUpdate = Date.now();
        this.updateDisplay();
    }

    /**
     * Update progress
     * @param {number} current - Current progress value
     * @param {Object} extraInfo - Additional information to display
     */
    update(current, extraInfo = {}) {
        this.current = current;
        this.extraInfo = extraInfo;

        const now = Date.now();
        if (now - this.lastUpdate >= UPDATE_INTERVAL) {
            this.updateDisplay();
            this.lastUpdate = now;
        }
    }

    /**
     * Update display with current progress
     */
    updateDisplay() {
        const now = Date.now();
        const elapsed = now - this.startTime;
        const estimatedTotal = elapsed / (this.current / this.total);
        const remaining = Math.max(0, estimatedTotal - elapsed);

        displayProgress(
            this.phase,
            this.current,
            this.total,
            elapsed,
            remaining,
            this.extraInfo
        );
    }

    /**
     * Complete the current phase
     */
    completePhase() {
        this.update(this.total);
    }

    /**
     * Handle error in progress
     * @param {string} message - Error message
     * @param {Error} error - Error object
     */
    handleError(message, error) {
        displayError(message, error);
    }

    /**
     * Get elapsed time
     * @returns {number} Elapsed time in milliseconds
     */
    getElapsedTime() {
        return Date.now() - this.startTime;
    }

    /**
     * Reset tracker
     */
    reset() {
        this.startTime = 0;
        this.lastUpdate = 0;
        this.phase = '';
        this.current = 0;
        this.total = 0;
        this.extraInfo = {};
    }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();
