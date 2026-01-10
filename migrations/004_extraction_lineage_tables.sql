-- Migration: 004_extraction_lineage_tables.sql
-- Description: Add tables for blob extraction lineage tracking
-- Date: 2026-01-10

-- Blob Inventory: tracks all source blobs
CREATE TABLE blob_inventory (
  blob_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Blob identification
  source_store VARCHAR(100) NOT NULL,
  blob_key VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  byte_hash_sha256 VARCHAR(64),
  etag VARCHAR(100),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  extraction_priority INTEGER DEFAULT 0,
  
  -- Timestamps
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(source_store, blob_key)
);

-- Extraction Jobs: tracks each extraction attempt
CREATE TABLE extraction_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id) ON DELETE CASCADE,
  
  -- Job configuration
  extraction_version VARCHAR(50) NOT NULL,
  model_version VARCHAR(100),
  prompt_hash VARCHAR(64),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metrics
  processing_time_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  chunk_count INTEGER,
  
  -- Timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Correlation
  correlation_id VARCHAR(100)
);

-- Output Blobs: tracks extracted JSON chunks stored in output blob store
CREATE TABLE extraction_outputs (
  output_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES extraction_jobs(job_id) ON DELETE CASCADE,
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id) ON DELETE CASCADE,
  
  -- Output blob location
  output_store VARCHAR(100) NOT NULL,
  output_blob_key VARCHAR(500) NOT NULL,
  
  -- Output metadata
  output_type VARCHAR(50) NOT NULL,
  chunk_count INTEGER,
  size_bytes BIGINT,
  content_hash_sha256 VARCHAR(64),
  
  -- Schema versioning
  schema_version VARCHAR(20) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(output_store, output_blob_key)
);

-- Chunk Index: detailed tracking of individual chunks
CREATE TABLE chunk_index (
  chunk_id VARCHAR(100) PRIMARY KEY,
  output_id UUID NOT NULL REFERENCES extraction_outputs(output_id) ON DELETE CASCADE,
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id) ON DELETE CASCADE,
  
  -- Chunk metadata
  document_id UUID NOT NULL,
  chunk_sequence INTEGER NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  section_path TEXT[],
  
  -- Content summary
  char_count INTEGER,
  language VARCHAR(10),
  
  -- Quality
  confidence DECIMAL(3,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_blob_inventory_status ON blob_inventory(status);
CREATE INDEX idx_blob_inventory_tenant ON blob_inventory(tenant_id);
CREATE INDEX idx_blob_inventory_hash ON blob_inventory(byte_hash_sha256);
CREATE INDEX idx_extraction_jobs_blob ON extraction_jobs(blob_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_outputs_blob ON extraction_outputs(blob_id);
CREATE INDEX idx_chunk_index_document ON chunk_index(document_id);
CREATE INDEX idx_chunk_index_output ON chunk_index(output_id);

-- Trigger to update updated_at on blob_inventory
CREATE OR REPLACE FUNCTION update_blob_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blob_inventory_updated_at
  BEFORE UPDATE ON blob_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_blob_inventory_updated_at();
