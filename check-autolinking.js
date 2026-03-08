const fs = require('fs');
const path = require('path');

const base = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking');
console.log('Version:', require(path.join(base, 'package.json')).version);

const gradlePlugin = path.join(base, 'android', 'expo-gradle-plugin');
console.log('expo-gradle-plugin exists:', fs.existsSync(gradlePlugin));

const androidDir = path.join(base, 'android');
console.log('\nandroid/ contents:');
if (fs.existsSync(androidDir)) {
  fs.readdirSync(androidDir).forEach(f => console.log(' ', f));
} else {
  console.log('  (android dir does not exist)');
}

// Check what version of expo-modules-autolinking expo@52 actually needs
const expoPkg = path.join(process.cwd(), 'node_modules', 'expo', 'package.json');
const expo = JSON.parse(fs.readFileSync(expoPkg, 'utf8'));
console.log('\nexpo version:', expo.version);
console.log('expo requires autolinking:', expo.dependencies?.['expo-modules-autolinking']);
