const fs = require('fs');
const path = require('path');

const f = path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
let content = fs.readFileSync(f, 'utf8');

// Remove patch marker if exists
content = content.replace('// PATCHED_KOTLIN2X\n', '');

// The problem: when 'kotlin-android' plugin is applied with Kotlin 2.x,
// it internally calls project.extensions.getByType(KotlinTopLevelExtension)
// which fails because KotlinTopLevelExtension is now an interface, not a class.
// Fix: replace the applyKotlinExpoModulesCorePlugin closure to skip re-applying
// the kotlin-android plugin (it's already applied by the time this runs)
// and apply KotlinExpoModulesCorePlugin safely.

const oldClosure = `ext.applyKotlinExpoModulesCorePlugin = {
  try {
    // Tries to apply the kotlin-android plugin if the client project does not apply yet.
    // On previous \`applyKotlinExpoModulesCorePlugin\`, it is inside the \`project.buildscript\` block.
    // We cannot use \`project.plugins.hasPlugin()\` yet but only to try-catch instead.
    apply plugin: 'kotlin-android'
  } catch (e) {}

  apply plugin: KotlinExpoModulesCorePlugin
}`;

const newClosure = `ext.applyKotlinExpoModulesCorePlugin = {
  // PATCH: Skip re-applying kotlin-android to avoid KotlinTopLevelExtension interface clash in Kotlin 2.x
  // The kotlin-android plugin is already applied by the root project.
  if (!project.plugins.hasPlugin('kotlin-android') && !project.plugins.hasPlugin('org.jetbrains.kotlin.android')) {
    try {
      apply plugin: 'kotlin-android'
    } catch (e) {
      // Ignore - plugin may already be applied or incompatible
    }
  }

  apply plugin: KotlinExpoModulesCorePlugin
}`;

if (content.includes(oldClosure)) {
  content = content.replace(oldClosure, newClosure);
  fs.writeFileSync(f, content, 'utf8');
  console.log('Patch applied successfully.');
} else {
  // Try a more flexible replacement
  console.log('Exact match not found, trying flexible patch...');
  
  // Replace the apply plugin: 'kotlin-android' block inside the closure
  content = content.replace(
    /ext\.applyKotlinExpoModulesCorePlugin\s*=\s*\{[\s\S]*?apply plugin:\s*KotlinExpoModulesCorePlugin\s*\}/,
    `ext.applyKotlinExpoModulesCorePlugin = {
  // PATCH: Only apply kotlin-android if not already applied (avoids KotlinTopLevelExtension issue in Kotlin 2.x)
  if (!project.plugins.hasPlugin('org.jetbrains.kotlin.android')) {
    try { apply plugin: 'kotlin-android' } catch (e) {}
  }
  apply plugin: KotlinExpoModulesCorePlugin
}`
  );
  fs.writeFileSync(f, content, 'utf8');
  console.log('Flexible patch applied.');
}

// Verify
const updated = fs.readFileSync(f, 'utf8');
const lines = updated.split('\n');
console.log('\n--- Patched closure (lines 44-60) ---');
lines.slice(43, 60).forEach((l, i) => console.log(`${i+44}: ${l}`));
