const fs = require('fs');
const path = require('path');

// Check what version of autolinking is installed and its structure
const autolinkBase = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking');
const pkg = JSON.parse(fs.readFileSync(path.join(autolinkBase, 'package.json'), 'utf8'));
console.log('expo-modules-autolinking version:', pkg.version);

// Check the expo version
const expoPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules', 'expo', 'package.json'), 'utf8'));
console.log('expo version:', expoPkg.version);

// Check react-native version
const rnPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules', 'react-native', 'package.json'), 'utf8'));
console.log('react-native version:', rnPkg.version);

// Check what the autolinking package exports for android
const androidDir = path.join(autolinkBase, 'android');
console.log('\nexpo-modules-autolinking/android contents:');
if (fs.existsSync(androidDir)) {
  function listDir(d, depth=0) {
    fs.readdirSync(d).forEach(f => {
      console.log('  '.repeat(depth) + f);
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory() && depth < 2) listDir(full, depth+1);
    });
  }
  listDir(androidDir);
}

// Check if there's a scripts dir with generate functions
const scriptsDir = path.join(autolinkBase, 'scripts');
console.log('\nscripts dir exists:', fs.existsSync(scriptsDir));
if (fs.existsSync(scriptsDir)) {
  fs.readdirSync(scriptsDir).forEach(f => console.log(' ', f));
}

// Check what commands are available
console.log('\npackage.json bin:', pkg.bin);
console.log('package.json main:', pkg.main);
