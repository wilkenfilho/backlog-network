#!/usr/bin/env python3
"""
Patch expo-modules-core/android/build.gradle
- Remove suppress antigo
- Adiciona suppress com a versao CORRETA (1.9.24 = versao em uso)
- Forca kotlinVersion para 1.9.25 no ExpoModulesCorePlugin para alinhar com Compose Compiler
"""
import re, os

# Patch 1: build.gradle - suppress com versao correta
path = 'node_modules/expo-modules-core/android/build.gradle'
with open(path, 'r') as f:
    content = f.read()

# Remove todos os patches anteriores
content = re.sub(r'\n// === CI Patch.*', '', content, flags=re.DOTALL)
content = re.sub(r'\ntasks\.withType\(org\.jetbrains\.kotlin.*', '', content, flags=re.DOTALL)

# Adiciona suppress com 1.9.24 (versao real em uso no CI)
patch = """
// === CI Patch ===
tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
  kotlinOptions {
    freeCompilerArgs += ["-P", "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=1.9.24"]
  }
}
"""

with open(path, 'w') as f:
    f.write(content + patch)

print('patch-compose-compat: build.gradle patched with suppress=1.9.24')

# Patch 2: ExpoModulesCorePlugin.gradle - forcar kotlinVersion default para 1.9.25
plugin_path = 'node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle'
with open(plugin_path, 'r') as f:
    plugin = f.read()

# Muda o default de 1.9.24 para 1.9.25
plugin = plugin.replace('"1.9.24"', '"1.9.25"')
plugin = plugin.replace("'1.9.24'", "'1.9.25'")

with open(plugin_path, 'w') as f:
    f.write(plugin)

print('patch-compose-compat: ExpoModulesCorePlugin.gradle kotlinVersion default -> 1.9.25')
