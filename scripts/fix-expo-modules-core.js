#!/usr/bin/env node
/**
 * Postinstall: patcha ExpoModulesCorePlugin.gradle para compatibilidade com Kotlin 2.x
 *
 * Problema: No Kotlin 2.x, KotlinTopLevelExtension virou interface.
 * O plugin tenta usar .getByType(KotlinTopLevelExtension) que exige classe concreta.
 * Fix: substituir por KotlinProjectExtension que é classe concreta em todas as versões.
 */

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

// Marca o patch para idempotência
content = '// PATCHED_KOTLIN2X\n' + content;

// No Kotlin 2.x, KotlinTopLevelExtension virou interface — não pode ser usada em getByType().
// KotlinProjectExtension é a classe concreta que funciona em Kotlin 1.x e 2.x.
content = content.replace(
  /\bKotlinTopLevelExtension\b/g,
  'org.jetbrains.kotlin.gradle.dsl.KotlinProjectExtension'
);

fs.writeFileSync(pluginPath, content, 'utf8');
console.log('[fix-expo-modules-core] Patched ExpoModulesCorePlugin.gradle for Kotlin 2.x.');

// ----- Patch secundário: build.gradle (suprime Compose check) -----
const buildGradlePath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'build.gradle'
);

if (fs.existsSync(buildGradlePath)) {
  let bg = fs.readFileSync(buildGradlePath, 'utf8');
  if (!bg.includes('suppressKotlinVersionCompatibilityCheck')) {
    const patch = `

// === Patch: suppress Kotlin/Compose version compatibility check ===
tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
  kotlinOptions {
    freeCompilerArgs += [
      "-P",
      "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=2.1.21"
    ]
  }
}
`;
    fs.writeFileSync(buildGradlePath, bg + patch, 'utf8');
    console.log('[fix-expo-modules-core] Patched build.gradle (Compose suppress).');
  }
}
