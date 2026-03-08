const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nestedDir = path.join(process.cwd(), 'node_modules', 'expo', 'node_modules', 'expo-modules-autolinking');

if (!fs.existsSync(nestedDir)) {
  console.log('Nested autolinking not found — nothing to do.');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(path.join(nestedDir, 'package.json'), 'utf8'));
console.log('Removing nested expo-modules-autolinking@' + pkg.version + ' from expo/node_modules/...');

// Remove the nested copy so Node resolves to the root one (2.1.15 with expo-gradle-plugin)
fs.rmSync(nestedDir, { recursive: true, force: true });
console.log('Done. Node will now resolve expo-modules-autolinking from root node_modules (2.1.15).');

// Verify
const rootPkg = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking', 'package.json');
const root = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
const hasPlugin = fs.existsSync(path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking', 'android', 'expo-gradle-plugin'));
console.log('Root autolinking version:', root.version, '| expo-gradle-plugin:', hasPlugin);
