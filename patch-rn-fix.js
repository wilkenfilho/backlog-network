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
console.log('Patching:', file);

let content = fs.readFileSync(file, 'utf8');

// Fix 1: import - add the concrete extension classes
content = content.replace(
  'import org.jetbrains.kotlin.gradle.dsl.KotlinTopLevelExtension',
  `import org.jetbrains.kotlin.gradle.dsl.KotlinTopLevelExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension`
);

// Fix 2: line 45 - kotlin.android plugin uses KotlinAndroidProjectExtension
content = content.replace(
  `      project.pluginManager.withPlugin("org.jetbrains.kotlin.android") {
        project.extensions.getByType(KotlinTopLevelExtension::class.java).jvmToolchain(17)
      }`,
  `      project.pluginManager.withPlugin("org.jetbrains.kotlin.android") {
        project.extensions.getByType(KotlinAndroidProjectExtension::class.java).jvmToolchain(17)
      }`
);

// Fix 3: line 48 - kotlin.jvm plugin uses KotlinJvmProjectExtension  
content = content.replace(
  `      project.pluginManager.withPlugin("org.jetbrains.kotlin.jvm") {
        project.extensions.getByType(KotlinTopLevelExtension::class.java).jvmToolchain(17)
      }`,
  `      project.pluginManager.withPlugin("org.jetbrains.kotlin.jvm") {
        project.extensions.getByType(KotlinJvmProjectExtension::class.java).jvmToolchain(17)
      }`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patch applied!');

// Verify
const updated = fs.readFileSync(file, 'utf8').split('\n');
console.log('\n--- Lines 38-55 after patch ---');
updated.slice(37, 57).forEach((l, i) => console.log(`${i+38}: ${l}`));
