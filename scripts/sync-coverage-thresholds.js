#!/usr/bin/env node

/**
 * This script synchronizes coverage thresholds between vitest.config.ts and codecov.yml
 * It reads the thresholds from vitest.config.ts and updates codecov.yml accordingly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Read vitest.config.ts
const vitestConfigPath = path.join(rootDir, 'vitest.config.ts');
const vitestConfig = fs.readFileSync(vitestConfigPath, 'utf8');

// Extract thresholds using regex
const statementsMatch = vitestConfig.match(/statements:\s*(\d+)/);
const branchesMatch = vitestConfig.match(/branches:\s*(\d+)/);
const functionsMatch = vitestConfig.match(/functions:\s*(\d+)/);
const linesMatch = vitestConfig.match(/lines:\s*(\d+)/);

if (!statementsMatch || !branchesMatch || !functionsMatch || !linesMatch) {
  console.error('Could not extract all thresholds from vitest.config.ts');
  process.exit(1);
}

const statements = parseInt(statementsMatch[1], 10);
const branches = parseInt(branchesMatch[1], 10);
const functions = parseInt(functionsMatch[1], 10);
const lines = parseInt(linesMatch[1], 10);

console.log('Extracted thresholds from vitest.config.ts:');
console.log(`- Statements: ${statements}%`);
console.log(`- Branches: ${branches}%`);
console.log(`- Functions: ${functions}%`);
console.log(`- Lines: ${lines}%`);

// Use the lowest threshold for codecov
const lowestThreshold = Math.min(statements, branches, functions, lines);
console.log(`\nUsing lowest threshold for codecov: ${lowestThreshold}%`);

// Read codecov.yml
const codecovPath = path.join(rootDir, 'codecov.yml');
let codecovConfig = fs.readFileSync(codecovPath, 'utf8');

// Update the range and target values
codecovConfig = codecovConfig.replace(/range: "(\d+)\.\.\.100"/, `range: "${lowestThreshold}...100"`);
codecovConfig = codecovConfig.replace(/target: (\d+)%/g, `target: ${lowestThreshold}%`);

// Write updated codecov.yml
fs.writeFileSync(codecovPath, codecovConfig);
console.log('\nUpdated codecov.yml with new thresholds');

// No need to update CI workflow as it uses npm run test:coverage which respects vitest config

console.log('\nDone! Coverage thresholds are now synchronized.');
