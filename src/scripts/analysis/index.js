// Progress tracking modules
export * as progressFormatter from './progress/formatter.js';
export * as progressDisplay from './progress/display.js';
export { progressTracker } from './progress/tracker.js';

// Combination analysis modules
export * as combinationAnalyzer from './combinations/analyzer.js';
export * as combinationFormatter from './combinations/formatter.js';
export * as combinationStorage from './combinations/storage.js';

// Worker module
export * as worker from './worker.js';

/**
 * Module organization:
 * 
 * 1. Progress Tracking
 *    - formatter.js: Time and memory formatting utilities
 *    - display.js: Progress display functions
 *    - tracker.js: Progress state management
 * 
 * 2. Combination Analysis
 *    - analyzer.js: Core analysis functions
 *    - formatter.js: Result formatting utilities
 *    - storage.js: Result persistence and comparison
 * 
 * 3. Worker Processing
 *    - worker.js: Parallel processing implementation
 * 
 * This modular structure allows for:
 * - Better code organization
 * - Easier maintenance
 * - Improved testability
 * - Clear separation of concerns
 */
