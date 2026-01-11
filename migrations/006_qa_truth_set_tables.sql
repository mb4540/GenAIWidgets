-- Migration: 006_qa_truth_set_tables.sql
-- Description: Add tables for Q&A truth set generation and management
-- Date: 2026-01-11

-- Q&A Generation Jobs: tracks each Q&A generation request
CREATE TABLE qa_generation_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Configuration
  questions_per_chunk INTEGER NOT NULL DEFAULT 3,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_chunks INTEGER,
  processed_chunks INTEGER DEFAULT 0,
  total_qa_generated INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- User tracking
  created_by UUID REFERENCES users(user_id)
);

-- Chunk Q&A Pairs: stores generated question-answer pairs
CREATE TABLE chunk_qa_pairs (
  qa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES qa_generation_jobs(job_id) ON DELETE CASCADE,
  blob_id UUID NOT NULL REFERENCES blob_inventory(blob_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Chunk reference
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT,
  
  -- Q&A content
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  
  -- Status: pending, approved, rejected
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Generation metadata
  generated_by VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(user_id)
);

-- Indexes for common queries
CREATE INDEX idx_qa_jobs_blob ON qa_generation_jobs(blob_id);
CREATE INDEX idx_qa_jobs_tenant ON qa_generation_jobs(tenant_id);
CREATE INDEX idx_qa_jobs_status ON qa_generation_jobs(status);

CREATE INDEX idx_qa_pairs_job ON chunk_qa_pairs(job_id);
CREATE INDEX idx_qa_pairs_blob ON chunk_qa_pairs(blob_id);
CREATE INDEX idx_qa_pairs_tenant ON chunk_qa_pairs(tenant_id);
CREATE INDEX idx_qa_pairs_status ON chunk_qa_pairs(status);
CREATE INDEX idx_qa_pairs_chunk ON chunk_qa_pairs(blob_id, chunk_index);

-- Seed prompt for Q&A generation
INSERT INTO prompts (
  function_name,
  display_name,
  description,
  model_provider,
  model_name,
  system_prompt,
  user_prompt_template,
  temperature,
  max_tokens
) VALUES (
  'generate_chunk_qa',
  'Chunk Q&A Generator',
  'Generates question-answer pairs from document chunks for RAG truth sets',
  'google',
  'gemini-2.0-flash',
  'You are an expert at creating high-quality question-answer pairs from document content. Generate questions that a user might naturally ask when searching for information contained in the provided text. Answers should be accurate, concise, and directly supported by the source text.',
  'Generate exactly {{questionsPerChunk}} question-answer pairs from the following document chunk.

Document Title: {{documentTitle}}
Section: {{sectionPath}}

Chunk Content:
{{chunkText}}

Return your response as a JSON array with this exact format:
[
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."}
]

Requirements:
- Questions should be natural and varied (who, what, when, where, why, how)
- Answers must be factually grounded in the chunk content
- Avoid yes/no questions
- Each Q&A pair should be self-contained and useful for retrieval',
  0.7,
  2000
);
