const fs = require('fs');

// Load words from the words.json file
const words = JSON.parse(fs.readFileSync('ewords.json', 'utf-8'));
const wordSet = new Set(words);  // For faster lookups

// Precompute neighbors for each word
function precomputeNeighbors(words) {
    const neighbors = {};
    const patternMap = {};

    // Create patterns by removing one letter at a time
    for (let word of words) {
        neighbors[word] = [];
        for (let i = 0; i < word.length; i++) {
            let pattern = word.slice(0, i) + "_" + word.slice(i + 1);
            if (patternMap[pattern]) {
                patternMap[pattern].forEach(neighbor => {
                    neighbors[word].push(neighbor);
                    neighbors[neighbor].push(word);
                });
            }
            if (!patternMap[pattern]) {
                patternMap[pattern] = [];
            }
            patternMap[pattern].push(word);
        }
    }

    return neighbors;
}

// BFS to find the longest word ladder
function findLongestWordLadder(neighbors, startWord) {
    const visited = new Set();
    const queue = [[startWord]];  // Each item is a path
    let longestPath = [];

    while (queue.length > 0) {
        const path = queue.shift();
        const word = path[path.length - 1];

        if (visited.has(word)) continue;
        visited.add(word);

        // Update longestPath if the current path is longer
        if (path.length > longestPath.length) {
            longestPath = path;
        }

        // Add neighbors to the queue
        for (let neighbor of neighbors[word]) {
            if (!visited.has(neighbor)) {
                queue.push([...path, neighbor]);
            }
        }
    }

    return longestPath;
}

// Main function to find the longest word ladder
function findLongestLadderInWords(words) {
    const neighbors = precomputeNeighbors(words);
    let longestLadder = [];

    // Perform BFS from each word (consider stopping early)
    for (let word of words) {
        const ladder = findLongestWordLadder(neighbors, word);
        if (ladder.length > longestLadder.length) {
            longestLadder = ladder;
            console.log(ladder)
        }
    }

    return longestLadder;
}

// Call the function and get the longest ladder
const longestLadder = findLongestLadderInWords(words);
console.log("Longest Word Ladder:", longestLadder);
console.log("Length:", longestLadder.length)
