const fs = require('fs');
const path = require('path');

// Fix 1: local.properties - correct SDK path format
const localProps = path.join(process.cwd(), 'android', 'local.properties');
const sdkPath = 'C:\\\\Users\\\\wilke\\\\AppData\\\\Local\\\\Android\\\\Sdk';
fs.writeFileSync(localProps, `sdk.dir=C:\\:\\\\Users\\\\wilke\\\\AppData\\\\Local\\\\Android\\\\Sdk\n`);

// Actually just write it correctly
const correctContent = 'sdk.dir=C:/Users/wilke/AppData/Local/Android/Sdk\n';
fs.writeFileSync(localProps, correctContent);
console.log('local.properties written:', correctContent.trim());

// Fix 2: ExpoModulesCorePlugin.gradle line 92 - 'release' component not found
// The useExpoPublishing closure uses afterEvaluate but 'release' variant isn't available
// We need to wrap it in a check
const pluginPath = path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
let content = fs.readFileSync(pluginPath, 'utf8');

const lines = content.split('\n');
console.log('\n--- Lines 85-100 (useExpoPublishing) ---');
lines.slice(84, 100).forEach((l, i) => console.log(`${i+85}: ${l}`));

// Find and fix the 'release' component issue
// Wrap the from components.release in a try-catch or check
content = content.replace(
  'from components.release',
  'from (components.findByName("release") ?: components.findByName("debug") ?: return)'
);

fs.writeFileSync(pluginPath, content, 'utf8');
console.log('\nExpoModulesCorePlugin.gradle patched for release component.');
