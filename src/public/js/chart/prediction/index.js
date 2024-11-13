import { removeAllShapes } from './shapes.js';
import { createPredictionLine } from './line.js';
import { createPredictionPoint } from './point.js';

function updatePredictionLine(currentPrice, predictedPrice, predictedChange) {
    try {
        // Remove previous prediction lines and points
        removeAllShapes();

        // Get current time and 1 hour later
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        // Create prediction line
        createPredictionLine(
            now.getTime(),
            oneHourLater.getTime(),
            currentPrice,
            predictedPrice,
            predictedChange
        );

        // Create prediction point
        createPredictionPoint(
            oneHourLater.getTime(),
            predictedPrice,
            predictedChange
        );
    } catch (error) {
        console.error('Error updating prediction visualization:', error);
    }
}

export { updatePredictionLine };
