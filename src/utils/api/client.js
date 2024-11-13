import axios from 'axios';
import { getCurrentEndpoint, updateLastSuccessfulEndpoint, rotateEndpoint } from './endpoints.js';

async function fetchWithRetry(path, params, retries = 3) {
    try {
        const endpoint = getCurrentEndpoint();
        console.log(`Trying endpoint: ${endpoint}`);
        
        const response = await axios.get(`${endpoint}${path}`, { 
            params,
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        updateLastSuccessfulEndpoint(endpoint);
        return response;
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying with different endpoint... (${retries} retries left)`);
            const nextEndpoint = rotateEndpoint();
            return fetchWithRetry(path, params, retries - 1);
        }
        throw error;
    }
}

export { fetchWithRetry };
