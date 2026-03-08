#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pluginPath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle'
);

if (!fs.existsSync(pluginPath)) {
  console.log('[fix-expo-modules-core] ExpoModulesCorePlugin.gradle not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(pluginPath, 'utf8');

if (content.includes('// PATCHED_KOTLIN2X')) {
  console.log('[fix-expo-modules-core] Already patched, skipping.');
  process.exit(0);
}

content = '// PATCHED_KOTLIN2X\n' + content;

// Fix KotlinTopLevelExtension → KotlinProjectExtension (interface→class fix for Kotlin 2.x)
content = content.replace(
  /\bKotlinTopLevelExtension\b/g,
  'org.jetbrains.kotlin.gradle.dsl.KotlinProjectExtension'
);

// Fix applyKotlinExpoModulesCorePlugin to not re-apply kotlin-android if already applied
content = content.replace(
  /ext\.applyKotlinExpoModulesCorePlugin\s*=\s*\{[\s\S]*?apply plugin:\s*KotlinExpoModulesCorePlugin\s*\}/,
  `ext.applyKotlinExpoModulesCorePlugin = {
  if (!project.plugins.hasPlugin('org.jetbrains.kotlin.android')) {
    try { apply plugin: 'kotlin-android' } catch (e) {}
  }
  apply plugin: KotlinExpoModulesCorePlugin
}`
);

fs.writeFileSync(pluginPath, content, 'utf8');
console.log('[fix-expo-modules-core] Patched ExpoModulesCorePlugin.gradle.');

// Fix build.gradle - suppress Compose compiler check with CORRECT kotlin version
const buildGradlePath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'build.gradle'
);

if (fs.existsSync(buildGradlePath)) {
  let bg = fs.readFileSync(buildGradlePath, 'utf8');

  // Remove any existing suppress patch
  bg = bg.replace(/\n\/\/ === Patch[\s\S]*?^\}\n/m, '');

  // Detect which kotlin version is actually being used from the kotlinVersion ext
  // Use 1.9.25 since that's what expo-modules-core 2.2.3 ships with
  const patch = `

// === Patch: suppress Kotlin/Compose version compatibility check ===
afterEvaluate {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    def kv = project.ext.has("kotlinVersion") ? project.ext.kotlinVersion() : "1.9.25"
    kotlinOptions {
      freeCompilerArgs += [
        "-P",
        "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=\${kv}"
      ]
    }
  }
}
`;
  fs.writeFileSync(buildGradlePath, bg + patch, 'utf8');
  console.log('[fix-expo-modules-core] Patched build.gradle with dynamic kotlin version suppress.');
}
