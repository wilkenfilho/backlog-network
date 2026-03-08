const fs = require('fs');
const path = require('path');

// Check the nested autolinking inside expo/node_modules
const nested = path.join(process.cwd(), 'node_modules', 'expo', 'node_modules', 'expo-modules-autolinking');
const root = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking');

for (const [label, base] of [['expo/node_modules/autolinking', nested], ['root autolinking', root]]) {
  const pkgPath = path.join(base, 'package.json');
  if (!fs.existsSync(pkgPath)) { console.log(label, '=> NOT FOUND'); continue; }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const hasAndroid = fs.existsSync(path.join(base, 'android'));
  const hasGradlePlugin = fs.existsSync(path.join(base, 'android', 'expo-gradle-plugin'));
  console.log(`${label} => version: ${pkg.version}, android/: ${hasAndroid}, expo-gradle-plugin: ${hasGradlePlugin}`);
}
