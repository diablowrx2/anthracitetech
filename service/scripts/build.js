#!/usr/bin/env node
/**
 * Anthracite Tech Build Pipeline
 * Orchestrates validation, optimization, and deployment preparation.
 *
 * Usage:
 *   npm run build
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function runStep(name, command) {
  console.log(`${ANSI.bold}${ANSI.cyan}▶ ${name}${ANSI.reset}`);
  console.log(`${ANSI.gray}  $ ${command}${ANSI.reset}`);
  try {
    const output = execSync(command, { encoding: 'utf-8', cwd: path.join(__dirname, '..') });
    console.log(output);
    return true;
  } catch (err) {
    console.error(err.stdout || '');
    console.error(err.stderr || '');
    return false;
  }
}

function generateBuildInfo() {
  const buildDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const info = {
    builtAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    gitCommit: 'unknown',
    gitBranch: 'unknown'
  };

  try {
    info.gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {}
  try {
    info.gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {}

  fs.writeFileSync(path.join(buildDir, 'build-info.json'), JSON.stringify(info, null, 2));
  console.log(`${ANSI.green}  ✓ Generated build-info.json${ANSI.reset}`);
}

function copyAssets() {
  const srcDir = path.join(__dirname, '..');
  const destDir = path.join(__dirname, '..', 'dist');

  const files = ['index.html', 'favicon.svg', 'hero-bg.png'];
  const dirs = ['js', 'email-templates', 'locations'];

  files.forEach(f => {
    const src = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`${ANSI.green}  ✓ Copied ${f}${ANSI.reset}`);
    }
  });

  dirs.forEach(d => {
    const src = path.join(srcDir, d);
    const dest = path.join(destDir, d);
    if (fs.existsSync(src)) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src);
      entries.forEach(entry => {
        const srcFile = path.join(src, entry);
        const destFile = path.join(dest, entry);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
        }
      });
      console.log(`${ANSI.green}  ✓ Copied ${d}/${ANSI.reset}`);
    }
  });
}

function main() {
  console.log(`${ANSI.bold}${ANSI.blue}╔══════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║       Anthracite Tech Build Pipeline                                  ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}╚══════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log();

  const steps = [
    { name: 'Schema Validation', command: 'node scripts/validate-schemas.js' },
    { name: 'HTML Validation', command: 'node scripts/validate-html.js' },
    { name: 'Link Validation', command: 'node scripts/validate-links.js' }
  ];

  let allPassed = true;
  for (const step of steps) {
    const passed = runStep(step.name, step.command);
    if (!passed) {
      allPassed = false;
      break;
    }
    console.log();
  }

  if (!allPassed) {
    console.log(`${ANSI.red}${ANSI.bold}✗ Build failed due to validation errors.${ANSI.reset}`);
    process.exit(1);
  }

  console.log(`${ANSI.bold}${ANSI.cyan}▶ Build Assets${ANSI.reset}`);
  generateBuildInfo();
  copyAssets();
  console.log();

  console.log(`${ANSI.green}${ANSI.bold}✓ Build completed successfully.${ANSI.reset}`);
  console.log(`${ANSI.gray}  Output: service/dist/${ANSI.reset}`);
  process.exit(0);
}

main();
