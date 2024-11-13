import { getWidget } from '../init.js';

function removeAllShapes() {
    const widget = getWidget();
    if (!widget || !widget.chart) return;

    const chart = widget.chart();
    if (!chart) return;

    try {
        chart.removeAllShapes();
    } catch (error) {
        console.error('Error removing shapes:', error);
    }
}

function createShape(time, price, options) {
    const widget = getWidget();
    if (!widget || !widget.chart) return;

    const chart = widget.chart();
    if (!chart) return;

    try {
        chart.createShape({ time: time / 1000, price }, options);
    } catch (error) {
        console.error('Error creating shape:', error);
    }
}

function createMultipointShape(points, options) {
    const widget = getWidget();
    if (!widget || !widget.chart) return;

    const chart = widget.chart();
    if (!chart) return;

    try {
        chart.createMultipointShape(
            points.map(p => ({ time: p.time / 1000, price: p.price })),
            options
        );
    } catch (error) {
        console.error('Error creating multipoint shape:', error);
    }
}

export { removeAllShapes, createShape, createMultipointShape };
