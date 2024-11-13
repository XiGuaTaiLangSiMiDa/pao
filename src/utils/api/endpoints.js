export const API_ENDPOINTS = [
    'https://api.binance.com',
    'https://api-gcp.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api4.binance.com'
];

let currentEndpointIndex = 0;
let lastSuccessfulEndpoint = null;

export function getCurrentEndpoint() {
    return lastSuccessfulEndpoint || API_ENDPOINTS[currentEndpointIndex];
}

export function updateLastSuccessfulEndpoint(endpoint) {
    lastSuccessfulEndpoint = endpoint;
}

export function rotateEndpoint() {
    currentEndpointIndex = (currentEndpointIndex + 1) % API_ENDPOINTS.length;
    return API_ENDPOINTS[currentEndpointIndex];
}
