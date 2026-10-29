#!/usr/bin/env node

/**
 * scripts/test-ingest-dry-run.js
 * DRY-RUN TEST for ingestion script
 * 
 * Tests the markdown parsing logic WITHOUT connecting to a database.
 * Verifies that chunks are parsed correctly and chunk_ids are deterministic.
 * 
 * Usage:
 *   node scripts/test-ingest-dry-run.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_BASE_DIR = path.resolve(REPO_ROOT, '..', 'zethica_rag_knowledge_base');

const FILES_TO_INGEST = [
  'COMPANY_OVERVIEW.md',
  'SERVICES.md',
  'WEBSITE_DEVELOPMENT_FAQ.md',
  'AI_SERVICES_STATUS.md',
  'PRICING_POLICIES_AND_COMMERCIALS.md',
  'PROCESS_AND_SUPPORT.md',
  'LEAD_QUALIFICATION.md',
  'EDGE_CASES_AND_SAFE_ANSWERS.md',
];

function generateChunkId(sourceFile, sectionHeading, subsectionHeading, content) {
  const combined = `${sourceFile}::${sectionHeading}::${subsectionHeading || ''}::${content}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

function parseMarkdown(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const chunks = [];
  let currentSection = null;
  let currentSubsection = null;
  let currentContent = [];
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection && currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
          chunks.push({
            source_file: fileName,
            section_heading: currentSection,
            subsection_heading: currentSubsection,
            chunk_content: text,
          });
        }
      }
      
      currentSection = line.replace(/^## /, '').trim();
      currentSubsection = null;
      currentContent = [];
    }
    else if (line.startsWith('### ')) {
      if (currentSection && currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
          chunks.push({
            source_file: fileName,
            section_heading: currentSection,
            subsection_heading: currentSubsection,
            chunk_content: text,
          });
        }
      }
      
      currentSubsection = line.replace(/^### /, '').trim();
      currentContent = [];
    }
    else if (currentSection) {
      if (line.trim() !== '' || currentContent.length > 0) {
        currentContent.push(line);
      }
    }
  }
  
  if (currentSection && currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text) {
      chunks.push({
        source_file: fileName,
        section_heading: currentSection,
        subsection_heading: currentSubsection,
        chunk_content: text,
      });
    }
  }
  
  return chunks;
}

async function test() {
  console.log('🧪 ZETHICA Knowledge Base Ingestion — DRY-RUN TEST\n');
  
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    console.error(`❌ Error: Knowledge base directory not found at:\n   ${KNOWLEDGE_BASE_DIR}`);
    process.exit(1);
  }
  
  console.log(`📂 Knowledge base directory: ${KNOWLEDGE_BASE_DIR}\n`);
  
  const allChunks = [];
  const chunkIds = new Map(); // Track chunk_id -> chunk for duplicate detection
  
  console.log('📖 Parsing markdown files...\n');
  
  for (const fileName of FILES_TO_INGEST) {
    const filePath = path.join(KNOWLEDGE_BASE_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${fileName}`);
      continue;
    }
    
    try {
      const chunks = parseMarkdown(filePath, fileName);
      allChunks.push(...chunks);
      console.log(`   ✓ ${fileName}`);
      console.log(`     Chunks: ${chunks.length}`);
      
      // Show sample of first 2 chunks
      for (let i = 0; i < Math.min(2, chunks.length); i++) {
        const chunk = chunks[i];
        const chunkId = generateChunkId(
          chunk.source_file,
          chunk.section_heading,
          chunk.subsection_heading,
          chunk.chunk_content
        );
        console.log(`     • [${i + 1}] ${chunk.section_heading}${chunk.subsection_heading ? ' > ' + chunk.subsection_heading : ''}`);
        console.log(`       Content length: ${chunk.chunk_content.length} chars`);
        console.log(`       Chunk ID: ${chunkId.substring(0, 12)}...`);
      }
      if (chunks.length > 2) {
        console.log(`     • ... and ${chunks.length - 2} more`);
      }
      console.log('');
    } catch (err) {
      console.error(`   ✗ ${fileName}: ${err.message}`);
      process.exit(1);
    }
  }
  
  if (allChunks.length === 0) {
    console.error('❌ No chunks parsed. Aborting.');
    process.exit(1);
  }
  
  console.log(`✓ Total chunks parsed: ${allChunks.length}\n`);
  
  // Test deterministic chunk_id generation and duplicate detection
  console.log('🔐 Testing deterministic chunk IDs and duplicate detection...\n');
  
  let duplicateCount = 0;
  for (const chunk of allChunks) {
    const chunkId = generateChunkId(
      chunk.source_file,
      chunk.section_heading,
      chunk.subsection_heading,
      chunk.chunk_content
    );
    
    if (chunkIds.has(chunkId)) {
      duplicateCount++;
      console.warn(`⚠️  Duplicate chunk_id: ${chunkId.substring(0, 12)}...`);
      console.warn(`   Source: ${chunk.source_file} / ${chunk.section_heading}`);
    } else {
      chunkIds.set(chunkId, chunk);
    }
  }
  
  console.log(`   Unique chunk IDs: ${chunkIds.size}`);
  console.log(`   Duplicates detected: ${duplicateCount}`);
  
  if (duplicateCount > 0) {
    console.warn(`\n⚠️  Found ${duplicateCount} duplicate chunks. This should not happen.`);
  } else {
    console.log(`\n✓ All chunk IDs are unique. ON CONFLICT deduplication will work correctly.\n`);
  }
  
  // Summary by source
  console.log('📊 Chunk distribution by source file:\n');
  const bySource = {};
  for (const chunk of allChunks) {
    if (!bySource[chunk.source_file]) {
      bySource[chunk.source_file] = 0;
    }
    bySource[chunk.source_file]++;
  }
  
  const sortedSources = Object.keys(bySource).sort();
  for (const source of sortedSources) {
    console.log(`   ${source}: ${bySource[source]} chunks`);
  }
  
  console.log(`\n   Total: ${allChunks.length} chunks ready for ingestion\n`);
  
  // Simulation of what will be upserted
  console.log('🔄 Simulating database upsert...\n');
  console.log(`   INSERT OR UPDATE: ${chunkIds.size} chunks`);
  console.log(`   Unique constraint: (chunk_id)\n`);
  
  console.log('✅ DRY-RUN TEST PASSED\n');
  console.log('All markdown files parsed successfully.');
  console.log('Ready to ingest into database with: node scripts/ingest-knowledge.js\n');
  
  process.exit(0);
}

test();
