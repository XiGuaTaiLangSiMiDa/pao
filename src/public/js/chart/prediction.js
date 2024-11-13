import { tvWidget } from './init.js';

function updatePredictionLine(currentPrice, predictedPrice, predictedChange) {
    if (!tvWidget) return;

    const chart = tvWidget.chart();
    if (!chart) return;

    // Remove previous prediction lines
    chart.removeAllShapes();

    // Get current time and 1 hour later
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Create prediction line
    chart.createShape(
        { time: now.getTime(), price: currentPrice },
        { time: oneHourLater.getTime(), price: predictedPrice },
        {
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
        }
    );

    // Add prediction point
    chart.createShape(
        { time: oneHourLater.getTime(), price: predictedPrice },
        {
            shape: "circle",
            lock: true,
            disableSelection: true,
            disableSave: true,
            disableUndo: true,
            overrides: {
                color: predictedChange >= 0 ? "#26a69a" : "#ef5350",
                backgroundColor: predictedChange >= 0 ? "#26a69a" : "#ef5350",
                size: 3,
            }
        }
    );
}

export { updatePredictionLine };
