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
let content = fs.readFileSync(file, 'utf8');

// Remove ALL kotlin extension imports and replace with clean correct set
content = content.replace(/import org\.jetbrains\.kotlin\.gradle\.dsl\.KotlinTopLevelExtension\n/g, '');
content = content.replace(/import org\.jetbrains\.kotlin\.gradle\.dsl\.KotlinAndroidProjectExtension\n/g, '');
content = content.replace(/import org\.jetbrains\.kotlin\.gradle\.dsl\.KotlinJvmProjectExtension\n/g, '');

// Add the correct imports once, after the last existing import
content = content.replace(
  'import org.gradle.api.plugins.AppliedPlugin\n',
  'import org.gradle.api.plugins.AppliedPlugin\nimport org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension\nimport org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension\n'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed!');

// Verify
const lines = fs.readFileSync(file, 'utf8').split('\n');
console.log('\n--- Lines 1-25 ---');
lines.slice(0, 25).forEach((l, i) => console.log(`${i+1}: ${l}`));
