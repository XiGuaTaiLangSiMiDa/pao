import { createShape } from './shapes.js';

function createPredictionPoint(time, price, predictedChange) {
    const pointOptions = {
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
    };

    createShape(time, price, pointOptions);
}

export { createPredictionPoint };
