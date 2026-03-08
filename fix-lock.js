const fs = require('fs');
const path = require('path');

const lockPath = path.join(process.cwd(), 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

let changed = false;

// 1. Remove from root packages[""] dependencies
const root = lock.packages?.[''];
if (root?.dependencies?.['expo-modules-autolinking']) {
  console.log('Removing expo-modules-autolinking from root packages[""].dependencies');
  delete root.dependencies['expo-modules-autolinking'];
  changed = true;
}
if (root?.devDependencies?.['expo-modules-autolinking']) {
  delete root.devDependencies['expo-modules-autolinking'];
  changed = true;
}

// 2. Remove from top-level "dependencies" (old lock format)
if (lock.dependencies?.['expo-modules-autolinking']) {
  console.log('Removing from lock.dependencies');
  delete lock.dependencies['expo-modules-autolinking'];
  changed = true;
}

// 3. Downgrade node_modules/expo-modules-autolinking to what expo@52 wants (2.0.8)
// We'll remove it entirely so npm install fetches the correct version
if (lock.packages?.['node_modules/expo-modules-autolinking']) {
  const current = lock.packages['node_modules/expo-modules-autolinking'].version;
  console.log('Removing node_modules/expo-modules-autolinking entry (was', current, ')');
  delete lock.packages['node_modules/expo-modules-autolinking'];
  changed = true;
}

if (changed) {
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  console.log('\npackage-lock.json fixed! Now run: npm install');
} else {
  console.log('Nothing to change.');
}
