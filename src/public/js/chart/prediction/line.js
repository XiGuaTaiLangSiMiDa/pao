import { createMultipointShape } from './shapes.js';

function createPredictionLine(startTime, endTime, currentPrice, predictedPrice, predictedChange) {
    const lineOptions = {
        shape: "trend_line",
        lock: true,
        disableSelection: true,
        disableSave: true,
        disableUndo: true,
        overrides: {
            linecolor: predictedChange >= 0 ? "#26a69a" : "#ef5350",
            linestyle: 2,
            linewidth: 2,
            showLabel: true,
            text: `Predicted: $${predictedPrice.toFixed(2)} (${predictedChange >= 0 ? '+' : ''}${predictedChange.toFixed(2)}%)`,
            textcolor: predictedChange >= 0 ? "#26a69a" : "#ef5350",
            fontsize: 12,
            fontfamily: "Arial",
            backgroundColor: "#1e222d",
        }
    };

    createMultipointShape([
        { time: startTime, price: currentPrice },
        { time: endTime, price: predictedPrice }
    ], lineOptions);
}

export { createPredictionLine };
