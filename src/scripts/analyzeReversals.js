/**
 * This script has been refactored into modular components.
 * Please use the new modular version in the analysis directory:
 * 
 * - src/scripts/analysis/config.js    : Configuration parameters
 * - src/scripts/analysis/detector.js  : Reversal detection logic
 * - src/scripts/analysis/analyzer.js  : Indicator analysis and weight calculation
 * - src/scripts/analysis/main.js      : Main analysis process
 * 
 * To run the analysis, use:
 * node src/scripts/analysis/main.js
 */

import { main } from './analysis/main.js';
main();
