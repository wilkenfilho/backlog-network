const fs = require('fs');
const path = require('path');

function findFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...findFiles(full, exts));
    else if (exts.some(x => e.name.endsWith(x))) results.push(full);
  }
  return results;
}

const coreDir = path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'android');
console.log('=== expo-modules-core/android jars/aars ===');
findFiles(coreDir, ['.jar', '.aar']).forEach(f => console.log(f));

// Also look for any gradle plugin dirs
console.log('\n=== expo-modules-core gradle plugin dirs ===');
findFiles(coreDir, ['.gradle', '.gradle.kts']).forEach(f => console.log(f));

// Check if there's a buildSrc or included build
const autolinkAndroid = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking', 'android', 'expo-gradle-plugin');
console.log('\n=== expo-gradle-plugin structure ===');
findFiles(autolinkAndroid, ['.kt']).forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('KotlinTopLevelExtension') || content.includes('KotlinAndroid') || content.includes('KotlinMultiplatform')) {
    console.log('MATCH:', f);
    content.split('\n').forEach((l,i) => {
      if (l.includes('KotlinTopLevel') || l.includes('getByType') || l.includes('extensions.find')) {
        console.log(`  ${i+1}: ${l.trim()}`);
      }
    });
  }
});
