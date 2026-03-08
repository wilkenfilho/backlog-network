const fs = require('fs');
const path = require('path');

function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findFile(full, name); if (r) return r; }
    else if (e.name === name) return full;
  }
  return null;
}

const file = findFile(path.join(process.cwd(), 'node_modules', '@react-native', 'gradle-plugin'), 'JdkConfiguratorUtils.kt');
console.log('File:', file);

let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

console.log('\n--- Full imports section (lines 1-25) ---');
lines.slice(0, 25).forEach((l, i) => console.log(`${i+1}: ${l}`));

console.log('\n--- Lines with KotlinTopLevel or KotlinAndroid or KotlinJvm ---');
lines.forEach((l, i) => {
  if (l.includes('KotlinTopLevel') || l.includes('KotlinAndroid') || l.includes('KotlinJvm') || l.includes('getByType')) {
    console.log(`${i+1}: ${l}`);
  }
});
