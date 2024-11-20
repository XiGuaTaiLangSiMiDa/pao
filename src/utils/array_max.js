/**
 * Find maximum value in a large array
 * @param {number[]} arr - Input array of numbers
 * @returns {number} Maximum value in the array
 */
export function findMaxInLargeArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error('Input must be a non-empty array');
    }
    
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }
    return max;
}

// Example usage:
// const largeArray = new Array(149873).fill(0).map((_, i) => i); // Test array
// console.log(findMaxInLargeArray(largeArray)); // Will work with large arrays
