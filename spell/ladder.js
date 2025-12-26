const fs = require('fs');

const words = JSON.parse(fs.readFileSync('ewords.json', 'utf8')).map(w => w.toLowerCase());
const wordSet = new Set(words);

const neighborsCache = {};

// Function to get neighbors from cache or calculate them if not cached
function getNeighbors(word) {
    if (neighborsCache[word]) {
        return neighborsCache[word];
    }

    const neighbors = [];
    for (let i = 0; i < word.length; i++) {
        for (let c = 97; c <= 122; c++) { // a-z
            const newWord = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
            if (wordSet.has(newWord) && newWord !== word) {
                neighbors.push(newWord);
            }
        }
    }

    neighborsCache[word] = neighbors;
    return neighbors;
}

// Optimized BFS function using a queue and visited set
function shortestPath(start, end) {
    if (!wordSet.has(start) || !wordSet.has(end)) return null;

    const queue = [start];  // Start with the start word in the queue
    const visited = new Set([start]);
    const parentMap = {};  // Map to reconstruct the path

    while (queue.length > 0) {
        const currentWord = queue.shift();  // O(1) operation with array (since we're shifting from the front)
        if (currentWord === end) {
            const path = [];
            let word = end;
            while (word !== start) {
                path.unshift(word);
                word = parentMap[word];
            }
            path.unshift(start);
            return path; // Return the path from start to end
        }

        for (const neighbor of getNeighbors(currentWord)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
                parentMap[neighbor] = currentWord;  // Keep track of the parent for path reconstruction
            }
        }
    }

    return null; // No path found
}

// Function to get a random word from the list
function getRandomWord() {
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
}

// Main loop to get two random words and find the shortest path
let path = null;
const random = false;
let rand1, rand2;
if (random) {
    while (path == null) {
        rand1 = getRandomWord();
        rand2 = getRandomWord();

        // Only try to find a path if rand1 and rand2 are not the same
        if (rand1 !== rand2) {
            path = shortestPath(rand1, rand2);
        }
    }
    console.log(`Random words: ${rand1}, ${rand2}`);
} else {
    rand1 = 'crane';
    rand2 = 'cramp';
    path = shortestPath(rand1, rand2);
}

console.log(path);
if (path) {
    console.log("Path Length:", path.length - 1);
    dlimit = Math.ceil((path.length-1)*1.4)
    console.log("Calculated Limit: ", dlimit);
    day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
        }).format(new Date());

    console.log(`'${day}', '${rand1}', '${rand2}', ${dlimit}, `)
}