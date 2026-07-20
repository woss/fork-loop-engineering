import { errorSignature } from './tools/loop-context/dist/context-manager.js';

function getTrigrams(str) {
  const trigrams = new Set();
  const padded = `  ${str.toLowerCase()}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  return trigrams;
}

function calculateSimilarity(a, b) {
  if (a === b) return 1.0;
  const setA = getTrigrams(a);
  const setB = getTrigrams(b);
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

const e1 = errorSignature('Error: timeout on port 8080');
const e2 = errorSignature('Error: timed out waiting for 8080');
const e3 = errorSignature('Error: connection timeout on port 8080');
console.log('e1:', e1);
console.log('e2:', e2);
console.log('e3:', e3);
console.log('e1 vs e2:', calculateSimilarity(e1, e2));
console.log('e1 vs e3:', calculateSimilarity(e1, e3));
console.log('e2 vs e3:', calculateSimilarity(e2, e3));
