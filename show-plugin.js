const fs = require('fs');
const path = require('path');

const f = path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const lines = fs.readFileSync(f, 'utf8').split('\n');

console.log('Total lines:', lines.length);
console.log('Line 1 (patch marker?):', lines[0]);
console.log('\n--- Lines 45-60 ---');
lines.slice(44, 60).forEach((l, i) => console.log(`${i+45}: ${l}`));

console.log('\n--- All lines with "Kotlin" ---');
lines.forEach((l, i) => { if (l.includes('Kotlin')) console.log(`${i+1}: ${l}`); });
