const fs = require('fs');
const path = require('path');

const f = path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const content = fs.readFileSync(f, 'utf8');
console.log(content);
