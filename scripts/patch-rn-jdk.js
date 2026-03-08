#!/usr/bin/env node
/**
 * Patch JdkConfiguratorUtils.kt do @react-native/gradle-plugin
 * para compatibilidade com Kotlin 2.x (KotlinTopLevelExtension virou interface)
 */

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

const file = findFile(
  path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin'),
  'JdkConfiguratorUtils.kt'
);

if (!file) {
  console.log('[patch-rn-jdk] JdkConfiguratorUtils.kt not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

if (content.includes('// PATCHED_RN_JDK')) {
  console.log('[patch-rn-jdk] Already patched, skipping.');
  process.exit(0);
}

// Remove todos os imports kotlin dsl existentes (podem estar duplicados ou errados)
content = content.replace(/import org\.jetbrains\.kotlin\.gradle\.dsl\.Kotlin\w+\n/g, '');

// Adiciona os imports corretos uma vez
content = content.replace(
  'import org.gradle.api.plugins.AppliedPlugin\n',
  'import org.gradle.api.plugins.AppliedPlugin\n// PATCHED_RN_JDK\nimport org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension\nimport org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension\n'
);

// Garante que getByType usa as classes concretas corretas
content = content.replace(
  /getByType\(KotlinTopLevelExtension::class\.java\)/g,
  'getByType(KotlinAndroidProjectExtension::class.java)'
);

fs.writeFileSync(file, content, 'utf8');
console.log('[patch-rn-jdk] Patched:', file);
