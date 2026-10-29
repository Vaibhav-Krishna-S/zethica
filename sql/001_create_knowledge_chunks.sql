-- sql/001_create_knowledge_chunks.sql
-- ZETHICA RAG Knowledge Base Migration
-- Creates the knowledge_chunks table with PostgreSQL full-text search support
-- Safe to run multiple times; uses CREATE TABLE IF NOT EXISTS

-- Create the main knowledge chunks table
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id SERIAL PRIMARY KEY,
  
  -- Unique identifier for the chunk (based on content hash for deterministic deduplication)
  chunk_id TEXT NOT NULL UNIQUE,
  
  -- Source information
  source_file TEXT NOT NULL,           -- e.g., 'SERVICES.md'
  section_heading TEXT NOT NULL,       -- e.g., 'Logo and Brand Identity'
  subsection_heading TEXT,             -- e.g., null or a subsection if present
  
  -- Content
  chunk_content TEXT NOT NULL,         -- The actual text chunk
  
  -- Full-text search vector (generated from section_heading + chunk_content)
  content_tsvector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', 
      COALESCE(section_heading, '') || ' ' || 
      COALESCE(subsection_heading, '') || ' ' || 
      chunk_content
    )
  ) STORED,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: prevent duplicate chunks per source file, section, and subsection
  CONSTRAINT unique_chunk_per_source UNIQUE (source_file, section_heading, subsection_heading)
);

-- Full-text search index on the generated TSVECTOR
CREATE INDEX IF NOT EXISTS idx_knowledge_full_text 
  ON knowledge_chunks USING GIN(content_tsvector);

-- Index for filtering by source file
CREATE INDEX IF NOT EXISTS idx_knowledge_source 
  ON knowledge_chunks(source_file);

-- Index for retrieving recently updated chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_updated 
  ON knowledge_chunks(updated_at DESC);

-- Index on chunk_id for fast lookups during upsert
CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_id 
  ON knowledge_chunks(chunk_id);

-- Comment for documentation
COMMENT ON TABLE knowledge_chunks IS 
  'Stores chunked knowledge from ZETHICA markdown documents for RAG retrieval. '
  'Chunks are identified by chunk_id (content-based hash) to prevent duplicates on repeated ingestion.';

COMMENT ON COLUMN knowledge_chunks.chunk_id IS 
  'Stable identifier based on sha256(source_file + section_heading + subsection_heading + content). '
  'Used for upsert deduplication.';

COMMENT ON COLUMN knowledge_chunks.content_tsvector IS 
  'PostgreSQL full-text search vector. Generated from section headings and content. '
  'Used with plainto_tsquery for full-text search.';
