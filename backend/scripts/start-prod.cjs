const fs = require('node:fs');
const path = require('node:path');

const entryCandidates = [
  path.join(__dirname, '..', 'dist', 'main.js'),
  path.join(__dirname, '..', 'dist', 'src', 'main.js'),
];
const entryPoint = entryCandidates.find((candidate) => fs.existsSync(candidate));

if (!entryPoint) {
  throw new Error(
    'NestJS production entry point not found. Expected dist/main.js or dist/src/main.js; run the backend build first.',
  );
}

require(entryPoint);
