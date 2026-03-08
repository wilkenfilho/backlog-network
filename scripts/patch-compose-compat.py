#!/usr/bin/env python3
import re

path = 'node_modules/expo-modules-core/android/build.gradle'

with open(path, 'r') as f:
    content = f.read()

# Remove patches anteriores
content = re.sub(r'\n// === CI Patch.*', '', content, flags=re.DOTALL)
content = re.sub(r'\ntasks\.withType\(org\.jetbrains\.kotlin.*?\}\n', '', content, flags=re.DOTALL)

patch = """
// === CI Patch v3 ===
tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
  kotlinOptions {
    freeCompilerArgs += ["-P", "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=1.9.25"]
  }
}
"""

with open(path, 'w') as f:
    f.write(content + patch)

print('Patch aplicado com sucesso')
print('Últimas 10 linhas:')
lines = (content + patch).split('\n')
print('\n'.join(lines[-10:]))
