const fs = require('fs');
const path = require('path');

const pluginDir = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking', 'android', 'expo-gradle-plugin');

function searchInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) searchInDir(full);
    else if (e.name.endsWith('.kt') || e.name.endsWith('.kts') || e.name.endsWith('.gradle')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('kotlinVersion') || content.includes('ksp') || content.includes('2.1.') || content.includes('missing in the map')) {
        console.log('\n=== FILE:', full, '===');
        // Show all lines with version numbers or ksp references
        content.split('\n').forEach((l, i) => {
          if (/2\.\d+\.\d+|ksp|kotlin.*version|missing/i.test(l)) {
            console.log(`  ${i+1}: ${l}`);
          }
        });
      }
    }
  }
}

searchInDir(pluginDir);
