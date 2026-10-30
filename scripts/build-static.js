#!/usr/bin/env node

/**
 * build-static.js
 * 
 * Copies frontend-only files to dist/ directory for clean Vercel deployment.
 * This ensures:
 * - Only approved frontend files are deployed
 * - Private files (server/, sql/, scripts/, .env, etc.) are NOT exposed
 * - API functions remain separate in api/ folder
 * - Audio assets are accessible
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ROOT_DIR = path.join(__dirname, '..');

const FRONTEND_FILES = [
  'index.html',
  'styles.css',
  'chat-widget-styles.css',
  'welcome-audio-styles.css',
  'script.js',
  'chat-widget.js',
  'welcome-audio.js',
  'favicon.svg',
  'logo.png',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'browserconfig.xml'
];

const FRONTEND_DIRS = [
  'public/audio',
  'logo'
];

console.log('🔨 Building static deployment...\n');

// Create dist directory
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  console.log(`✓ Created dist/ directory`);
}

// Copy individual frontend files
FRONTEND_FILES.forEach(file => {
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(BUILD_DIR, file);
  
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.warn(`⚠ File not found: ${file}`);
  }
});

// Copy frontend directories
FRONTEND_DIRS.forEach(dir => {
  const src = path.join(ROOT_DIR, dir);
  const dest = path.join(BUILD_DIR, dir);
  
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`✓ Copied ${dir}/`);
  } else {
    console.warn(`⚠ Directory not found: ${dir}`);
  }
});

console.log('\n✨ Static build complete!\n');
console.log('Deployed structure:');
console.log(`  dist/index.html`);
console.log(`  dist/styles.css`);
console.log(`  dist/chat-widget.js`);
console.log(`  dist/public/audio/Zethica_Welcome.m4a`);
console.log(`  dist/logo/`);
console.log(`  (API functions in api/ remain separate)`);
console.log('\n✓ Private files NOT deployed:\n');
console.log(`  ✗ .env.local`);
console.log(`  ✗ server/`);
console.log(`  ✗ sql/`);
console.log(`  ✗ scripts/`);
console.log(`  ✗ package.json`);
console.log(`  ✗ tests/`);
console.log(`  ✗ zethica_rag_knowledge_base/`);

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  fs.readdirSync(src).forEach(file => {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    
    if (fs.statSync(srcFile).isDirectory()) {
      copyRecursive(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
}

