#!/usr/bin/env node
/**
 * Patch ExpoModulesCorePlugin.gradle para compatibilidade com Kotlin 2.x
 * NOTA: O suppress do Compose fica em scripts/patch-compose-compat.py
 */

const fs = require('fs');
const path = require('path');

// --- Patch 1: ExpoModulesCorePlugin.gradle ---
const pluginPath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle'
);

if (!fs.existsSync(pluginPath)) {
  console.log('[fix-expo-modules-core] ExpoModulesCorePlugin.gradle not found, skipping.');
} else {
  let content = fs.readFileSync(pluginPath, 'utf8');
  if (content.includes('// PATCHED_KOTLIN2X')) {
    console.log('[fix-expo-modules-core] Already patched.');
  } else {
    content = '// PATCHED_KOTLIN2X\n' + content;
    content = content.replace(/\bKotlinTopLevelExtension\b/g, 'org.jetbrains.kotlin.gradle.dsl.KotlinProjectExtension');
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
  }
}

// --- Patch 2: Limpar qualquer suppress antigo do build.gradle ---
// O suppress correto e unico e aplicado pelo patch-compose-compat.py
const buildGradlePath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'build.gradle'
);

if (fs.existsSync(buildGradlePath)) {
  let bg = fs.readFileSync(buildGradlePath, 'utf8');
  bg = bg.replace(/\n\/\/ === Patch[\s\S]*$/m, '');
  bg = bg.replace(/\n\/\/ === CI Patch[\s\S]*$/m, '');
  fs.writeFileSync(buildGradlePath, bg, 'utf8');
  console.log('[fix-expo-modules-core] Cleaned build.gradle suppress (patch-compose-compat.py will add the correct one).');
}
