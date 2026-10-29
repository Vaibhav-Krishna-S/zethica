#!/usr/bin/env node

/**
 * scripts/ingest-knowledge.js
 * ZETHICA RAG Knowledge Base Ingestion Script
 * 
 * Reads approved Markdown files from ../zethica_rag_knowledge_base/
 * Parses them into chunks (by section heading)
 * Generates deterministic chunk_ids (based on content hash)
 * Upserts into knowledge_chunks table without creating duplicates
 * 
 * Usage:
 *   node scripts/ingest-knowledge.js              # Run ingestion
 *   node scripts/ingest-knowledge.js --check      # Test connection only (no data changes)
 *   node scripts/ingest-knowledge.js --load-env   # Load .env.local automatically
 * 
 * Environment variables required:
 *   POSTGRES_URL or (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   
 * These can be set manually in PowerShell or loaded from .env.local:
 *   $env:SUPABASE_URL = (Get-Content .env.local | Select-String "^SUPABASE_URL=" -Raw).Split("=")[1]
 *   $env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content .env.local | Select-String "^SUPABASE_SERVICE_ROLE_KEY=" -Raw).Split("=")[1]
 *   node scripts/ingest-knowledge.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pkg from 'pg';

const { Client } = pkg;

// Parse command-line arguments
const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const loadEnvMode = args.includes('--load-env');

// Optional: Load .env.local if --load-env flag is present
if (loadEnvMode) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const REPO_ROOT = path.resolve(__dirname, '..');
  const envLocalPath = path.join(REPO_ROOT, '.env.local');
  
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        process.env[key.trim()] = value;
      }
    }
  }
}

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Knowledge base is at ../zethica_rag_knowledge_base/ relative to repo root
// This script is at ./scripts/ingest-knowledge.js, so repo root is ../
const REPO_ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_BASE_DIR = path.resolve(REPO_ROOT, '..', 'zethica_rag_knowledge_base');

// Files to ingest (approved public knowledge)
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

// Files explicitly excluded (not for public retrieval)
const FILES_TO_SKIP = [
  'README.md',
  'SYSTEM_PROMPT.md',
  'VERIFY_BEFORE_LAUNCH.md',
];

/**
 * Generate a deterministic chunk_id based on content
 * Used for deduplication: same source+section+content = same chunk_id
 */
function generateChunkId(sourceFile, sectionHeading, subsectionHeading, content) {
  const combined = `${sourceFile}::${sectionHeading}::${subsectionHeading || ''}::${content}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Parse a markdown file into chunks
 * Returns array of { section_heading, subsection_heading, content }
 */
function parseMarkdown(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const chunks = [];
  let currentSection = null;
  let currentSubsection = null;
  let currentContent = [];
  
  for (const line of lines) {
    // Detect section heading (## )
    if (line.startsWith('## ')) {
      // Save previous chunk if exists
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
    // Detect subsection heading (### )
    else if (line.startsWith('### ')) {
      // Save previous chunk if exists
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
    // Accumulate content lines
    else if (currentSection) {
      // Skip empty lines at boundaries, but keep them in the middle
      if (line.trim() !== '' || currentContent.length > 0) {
        currentContent.push(line);
      }
    }
  }
  
  // Save final chunk
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

/**
 * Connect to the database
 * Supports both POSTGRES_URL and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
function getConnectionString() {
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }
  
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Construct connection string from Supabase credentials
    const url = new URL(process.env.SUPABASE_URL);
    const host = url.hostname;
    const port = url.port || '5432';
    const db = 'postgres';
    const user = 'postgres';
    const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    return `postgres://${user}:${password}@${host}:${port}/${db}?sslmode=require`;
  }
  
  throw new Error(
    'Missing database configuration. Set either:\n' +
    '  - POSTGRES_URL, or\n' +
    '  - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * Test database connection without making any changes
 * Useful for validating credentials before running full ingestion
 */
async function checkConnection() {
  console.log('🔗 ZETHICA Knowledge Base — Connection Check\n');
  
  let connectionString;
  try {
    connectionString = getConnectionString();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    console.log('Testing database connection...');
    await client.connect();
    console.log('✓ Connected successfully\n');
    
    // Test basic query
    const result = await client.query('SELECT 1 as test');
    console.log(`✓ Query successful: SELECT 1 returned ${result.rows[0].test}\n`);
    
    // Verify table exists
    const tableCheckResult = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'knowledge_chunks'
      )`
    );
    
    if (tableCheckResult.rows[0].exists) {
      console.log('✓ Table knowledge_chunks exists\n');
      
      // Show current chunk count
      const countResult = await client.query(
        `SELECT COUNT(*) as chunk_count FROM knowledge_chunks`
      );
      console.log(`✓ Current chunks in database: ${countResult.rows[0].chunk_count}\n`);
    } else {
      console.warn('⚠️  Table knowledge_chunks does NOT exist\n');
      console.log('   Please run the migration first:');
      console.log('   psql $env:POSTGRES_URL -f sql/001_create_knowledge_chunks.sql\n');
    }
    
    console.log('✅ Connection check PASSED\n');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Connection check FAILED`);
    console.error(`   ${err.message}\n`);
    console.error('Possible causes:');
    console.error('   • Invalid POSTGRES_URL or Supabase credentials');
    console.error('   • Network connectivity issue');
    console.error('   • Database server is down\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Main ingestion flow
 */
async function ingest() {
  console.log('🔍 ZETHICA Knowledge Base Ingestion\n');
  
  // Verify knowledge base directory exists
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    console.error(`❌ Error: Knowledge base directory not found at:\n   ${KNOWLEDGE_BASE_DIR}`);
    process.exit(1);
  }
  
  console.log(`📂 Knowledge base directory: ${KNOWLEDGE_BASE_DIR}\n`);
  
  // Parse all markdown files
  console.log('📖 Parsing markdown files...');
  const allChunks = [];
  
  for (const fileName of FILES_TO_INGEST) {
    const filePath = path.join(KNOWLEDGE_BASE_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${fileName}`);
      continue;
    }
    
    try {
      const chunks = parseMarkdown(filePath, fileName);
      allChunks.push(...chunks);
      console.log(`   ✓ ${fileName}: ${chunks.length} chunks`);
    } catch (err) {
      console.error(`   ✗ ${fileName}: ${err.message}`);
      process.exit(1);
    }
  }
  
  // Verify we have content
  if (allChunks.length === 0) {
    console.error('❌ No chunks parsed from markdown files. Aborting.');
    process.exit(1);
  }
  
  console.log(`\n✓ Total chunks parsed: ${allChunks.length}\n`);
  
  // Connect to database
  console.log('🔗 Connecting to database...');
  let connectionString;
  try {
    connectionString = getConnectionString();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Vercel/Supabase
  });
  
  try {
    await client.connect();
    console.log('✓ Connected\n');
    
    // Verify table exists (should have been created by migration)
    const tableCheckResult = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'knowledge_chunks'
      )`
    );
    
    if (!tableCheckResult.rows[0].exists) {
      console.error(
        '❌ Table knowledge_chunks does not exist.\n' +
        '   Please run the migration first:\n' +
        '   psql $POSTGRES_URL < sql/001_create_knowledge_chunks.sql'
      );
      process.exit(1);
    }
    
    console.log('💾 Upserting chunks into database...\n');
    
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const chunk of allChunks) {
      try {
        const chunkId = generateChunkId(
          chunk.source_file,
          chunk.section_heading,
          chunk.subsection_heading,
          chunk.chunk_content
        );
        
        const result = await client.query(
          `INSERT INTO knowledge_chunks 
             (chunk_id, source_file, section_heading, subsection_heading, chunk_content)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (chunk_id) DO UPDATE SET
             updated_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [
            chunkId,
            chunk.source_file,
            chunk.section_heading,
            chunk.subsection_heading || null,
            chunk.chunk_content,
          ]
        );
        
        if (result.rows[0].inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (err) {
        console.error(
          `   ✗ Error upserting chunk from ${chunk.source_file} / ${chunk.section_heading}:`
        );
        console.error(`     ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n✓ Ingestion complete:`);
    console.log(`  • Inserted: ${insertedCount}`);
    console.log(`  • Updated:  ${updatedCount}`);
    if (errorCount > 0) {
      console.log(`  • Errors:   ${errorCount}`);
    }
    
    // Show summary statistics
    const countResult = await client.query(
      `SELECT source_file, COUNT(*) as chunk_count 
       FROM knowledge_chunks 
       GROUP BY source_file 
       ORDER BY source_file`
    );
    
    console.log(`\n📊 Knowledge base summary by source:\n`);
    let totalChunks = 0;
    for (const row of countResult.rows) {
      console.log(`   ${row.source_file}: ${row.chunk_count} chunks`);
      totalChunks += row.chunk_count;
    }
    console.log(`\n   Total: ${totalChunks} chunks in database`);
    
    console.log('\n✨ Ready for RAG retrieval!\n');
    
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (err) {
    console.error(`\n❌ Database error: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run ingestion or connection check
if (checkMode) {
  checkConnection();
} else {
  ingest();
}
