#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import * as esbuild from 'esbuild';

const currentPlatform = platform();
const isWindows = currentPlatform === 'win32';
const isMacOS = currentPlatform === 'darwin';

// Determine output filename based on platform
const outputName = isWindows ? 'dist/autoship.exe' : 'dist/autoship';

// Get the path to the current node binary
const nodePath = process.execPath;
console.log(`Platform: ${currentPlatform}`);
console.log(`Using Node.js binary: ${nodePath}`);
console.log(`Output: ${outputName}`);

// Read and update sea-config.json with platform-specific settings
const configPath = 'sea-config.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const originalConfig = { ...config };

config.executable = nodePath;
config.output = outputName;

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

// Bundle with esbuild (no shebang for SEA - required for code cache)
console.log('\nBundling with esbuild...');
const result = await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
});

// Remove shebang if present (SEA + useCodeCache requires valid JS)
let code = result.outputFiles[0].text;
if (code.startsWith('#!')) {
  code = code.slice(code.indexOf('\n') + 1);
}
writeFileSync('dist/sea-bundle.cjs', code);

// Build SEA
console.log('\nBuilding SEA...');
execSync(`node --build-sea ${configPath}`, { stdio: 'inherit' });

// Restore original config (keep it portable)
writeFileSync(configPath, JSON.stringify(originalConfig, null, 2) + '\n');

// Platform-specific signing
if (isMacOS) {
  console.log('\nSigning executable (macOS)...');
  execSync(`codesign --sign - ${outputName}`, { stdio: 'inherit' });
} else if (isWindows) {
  console.log('\nNote: Run signtool to sign the executable on Windows (optional)');
  console.log('  signtool sign /fd SHA256 dist\\autoship.exe');
}

console.log(`\nSEA build complete: ${outputName}`);
