const fs = require('fs');
const path = require('path');

// Find JdkConfiguratorUtils.kt
function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findFile(full, name); if (r) return r; }
    else if (e.name === name) return full;
  }
  return null;
}

const rnPluginDir = path.join(process.cwd(), 'node_modules', '@react-native', 'gradle-plugin');
const file = findFile(rnPluginDir, 'JdkConfiguratorUtils.kt');

if (!file) {
  console.log('JdkConfiguratorUtils.kt not found!');
  console.log('Searching node_modules...');
  // Try broader search
  const nm = path.join(process.cwd(), 'node_modules');
  const f2 = findFile(nm, 'JdkConfiguratorUtils.kt');
  console.log('Found at:', f2);
  process.exit(1);
}

console.log('Found:', file);
const content = fs.readFileSync(file, 'utf8');

// Show lines around the problem
const lines = content.split('\n');
console.log('\n--- Lines 38-55 ---');
lines.slice(37, 55).forEach((l, i) => console.log(`${i+38}: ${l}`));

console.log('\n--- Lines with KotlinTopLevel ---');
lines.forEach((l, i) => { if (l.includes('KotlinTopLevel') || l.includes('getByType') || l.includes('javaToolchain') || l.includes('toolchain')) console.log(`${i+1}: ${l}`); });
