#!/usr/bin/env node
// beacon2026/scripts/bump-version.js
// Bumps backend and frontend package.json versions together, refreshes their
// package-lock.json files, and updates the version line in the Project
// Definition doc. Usage: npm run bump-version -- 0.12.0

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const newVersion = process.argv[2];
if (!newVersion || !SEMVER_RE.test(newVersion)) {
  console.error('Usage: npm run bump-version -- <x.y.z>');
  process.exit(1);
}

const backendPkgPath = join(ROOT, 'backend', 'package.json');
const frontendPkgPath = join(ROOT, 'frontend', 'package.json');
const projectDefPath = join(ROOT, 'beacon2026 Project Definition.md');

function bumpPackageJson(path) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${path}: ${oldVersion} -> ${newVersion}`);
}

console.log(`Bumping beacon2026 to v${newVersion}`);
bumpPackageJson(backendPkgPath);
bumpPackageJson(frontendPkgPath);

for (const dir of ['backend', 'frontend']) {
  console.log(`Refreshing ${dir}/package-lock.json ...`);
  execFileSync('npm', ['install'], { cwd: join(ROOT, dir), stdio: 'inherit', shell: true });
}

let projectDef = readFileSync(projectDefPath, 'utf8');
const before = projectDef;
projectDef = projectDef.replace(/version \d+\.\d+\.\d+/g, `version ${newVersion}`);
if (projectDef !== before) {
  writeFileSync(projectDefPath, projectDef);
  console.log(`  ${projectDefPath}: version references updated`);
} else {
  console.warn(`  ${projectDefPath}: no "version x.y.z" text found to update — check manually`);
}

console.log('\nDone. Review the diff, update CHANGELOG.md, then commit:');
console.log(
  '  git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json "beacon2026 Project Definition.md"',
);
