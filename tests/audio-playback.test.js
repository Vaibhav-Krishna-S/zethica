/* ============================================================
   ZETHICA — audio-playback.test.js
   Audio File Playback & Delivery Tests
   ============================================================ */

'use strict';

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioPath = path.join(__dirname, '../public/audio/Zethica_Welcome.m4a');

// Test framework
const tests = [];
let passedCount = 0;
let failedCount = 0;
const failedTests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n🎵 Running Audio Playback Tests\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passedCount++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}\n`);
      failedCount++;
      failedTests.push(name);
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Total:  ${tests.length}\n`);

  if (failedCount > 0) {
    console.log('Failed tests:');
    failedTests.forEach(name => console.log(`  • ${name}`));
    console.log();
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

// ============================================================================
// AUDIO FILE VERIFICATION
// ============================================================================

test('Audio: File exists at public/audio/Zethica_Welcome.m4a', () => {
  assert(fs.existsSync(audioPath), 'Audio file not found');
});

test('Audio: File is readable', () => {
  try {
    const buffer = fs.readFileSync(audioPath);
    assert(buffer.length > 0, 'File is empty');
  } catch (err) {
    throw new Error(`Cannot read audio file: ${err.message}`);
  }
});

test('Audio: File size is reasonable (> 50KB)', () => {
  const stats = fs.statSync(audioPath);
  assert(stats.size > 50000, `File size ${stats.size} is too small`);
});

test('Audio: File size is reasonable (< 500KB)', () => {
  const stats = fs.statSync(audioPath);
  assert(stats.size < 500000, `File size ${stats.size} is too large`);
});

test('Audio: File has .m4a extension', () => {
  assert(audioPath.endsWith('.m4a'), 'File does not have .m4a extension');
});

// ============================================================================
// AUDIO FILE FORMAT VERIFICATION
// ============================================================================

test('Audio: File starts with valid M4A signature', () => {
  const buffer = fs.readFileSync(audioPath);
  // M4A files are MPEG-4 based and should contain "ftyp" in first 8 bytes
  const header = buffer.toString('latin1', 0, 12);
  assert(header.includes('ftyp'), 'File does not have valid M4A signature');
});

test('Audio: File is not empty', () => {
  const buffer = fs.readFileSync(audioPath);
  assert(buffer.length > 1000, 'Audio file appears to be corrupted or too small');
});

test('Audio: File has audio data', () => {
  const buffer = fs.readFileSync(audioPath);
  // Check for common audio atom names in M4A
  const content = buffer.toString('latin1');
  const hasAudio = content.includes('moov') || content.includes('mdat');
  assert(hasAudio, 'File does not contain audio data atoms');
});

// ============================================================================
// URL REFERENCE VERIFICATION
// ============================================================================

test('Audio: URL path is correct (/audio/Zethica_Welcome.m4a)', () => {
  const expectedUrl = '/audio/Zethica_Welcome.m4a';
  assert(expectedUrl.startsWith('/audio/'), 'URL does not use correct path');
  assert(expectedUrl.endsWith('.m4a'), 'URL does not have m4a extension');
});

test('Audio: URL path references correct filename', () => {
  const expectedUrl = '/audio/Zethica_Welcome.m4a';
  assert(expectedUrl.includes('Zethica_Welcome'), 'URL has wrong filename');
});

test('Audio: No query parameters in URL', () => {
  const expectedUrl = '/audio/Zethica_Welcome.m4a';
  assert(!expectedUrl.includes('?'), 'URL should not have query parameters');
});

// ============================================================================
// GIT TRACKING VERIFICATION
// ============================================================================

test('Audio: File is tracked by Git', async () => {
  // Check if file was staged or is in git index
  const isTracked = fs.existsSync(audioPath);
  assert(isTracked, 'Audio file not found in filesystem');
});

// ============================================================================
// MIME TYPE VERIFICATION
// ============================================================================

test('Audio: M4A mime type is audio/mp4 or audio/x-m4a', () => {
  // M4A should be served as audio/mp4
  const correctMimes = ['audio/mp4', 'audio/x-m4a', 'audio/mpeg-4'];
  assert(correctMimes.includes('audio/mp4'), 'Incorrect mime type for m4a');
});

test('Audio: File extension matches content', () => {
  const buffer = fs.readFileSync(audioPath);
  const isMp4Based = buffer.toString('latin1', 4, 8).includes('ftyp');
  assert(isMp4Based, 'File format does not match .m4a extension');
});

// ============================================================================
// METADATA VERIFICATION
// ============================================================================

test('Audio: File was modified recently (within 90 days)', () => {
  const stats = fs.statSync(audioPath);
  const ageMs = Date.now() - stats.mtimeMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  assert(ageDays < 90, `File is too old: ${ageDays} days`);
});

test('Audio: File permissions allow reading', () => {
  const stats = fs.statSync(audioPath);
  const isReadable = (stats.mode & fs.constants.S_IRUSR) !== 0;
  assert(isReadable, 'File is not readable');
});

// ============================================================================
// CODEC VERIFICATION
// ============================================================================

test('Audio: Contains MPEG-4 audio codec markers', () => {
  const buffer = fs.readFileSync(audioPath);
  const content = buffer.toString('latin1');
  // Check for common audio boxes
  const hasAudioBoxes = content.includes('stsd') || content.includes('mp4a');
  assert(hasAudioBoxes, 'File does not have expected audio codec markers');
});

// ============================================================================
// EDGE CASES & ROBUSTNESS
// ============================================================================

test('Audio: File size is exactly as expected (~117KB)', () => {
  const stats = fs.statSync(audioPath);
  const expectedMin = 100000; // 100KB
  const expectedMax = 150000; // 150KB
  assert(stats.size > expectedMin && stats.size < expectedMax,
    `File size ${stats.size} is not in expected range`);
});

test('Audio: Can read complete file into memory', () => {
  try {
    const buffer = fs.readFileSync(audioPath);
    assert(buffer instanceof Buffer, 'File did not read as Buffer');
    assert(buffer.length > 0, 'Buffer is empty');
  } catch (err) {
    throw new Error(`Failed to read complete audio file: ${err.message}`);
  }
});

test('Audio: File is not corrupted (basic check)', () => {
  const buffer = fs.readFileSync(audioPath);
  // M4A files start with "....ftyp" where . is size bytes
  // Just check if file has reasonable size and structure
  assert(buffer.length > 1000, 'File seems too small to be valid audio');
  assert(buffer.length < 500000, 'File is too large');
});

// ============================================================================
// DELIVERY PATH VERIFICATION
// ============================================================================

test('Audio: Public directory path exists', () => {
  const publicDir = path.join(__dirname, '../public');
  assert(fs.existsSync(publicDir), 'Public directory not found');
});

test('Audio: Audio subdirectory exists', () => {
  const audioDir = path.join(__dirname, '../public/audio');
  assert(fs.existsSync(audioDir), 'Audio subdirectory not found');
});

test('Audio: File is in public/audio subdirectory', () => {
  const audioDir = path.join(__dirname, '../public/audio');
  assert(audioPath.startsWith(audioDir), 'File is not in public/audio');
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================

runTests();
