-- Migration: 005_prompts_table.sql
-- Description: Add prompts table for database-driven LLM prompt management
-- Date: 2026-01-10

-- Prompts table: stores configurable prompts for LLM functions
CREATE TABLE prompts (
  prompt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  function_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Model configuration
  model_provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  
  -- Prompt content
  system_prompt TEXT,
  user_prompt_template TEXT NOT NULL,
  
  -- Model parameters
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(user_id)
);

-- Index for quick lookup by function
CREATE INDEX idx_prompts_function ON prompts(function_name);
CREATE INDEX idx_prompts_active ON prompts(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

-- Seed data: extraction prompt
INSERT INTO prompts (function_name, display_name, description, model_provider, model_name, user_prompt_template, temperature, max_tokens)
VALUES (
  'extraction',
  'Document Extraction',
  'Extracts structured text content from uploaded documents for RAG preprocessing',
  'google',
  'gemini-2.5-pro-preview-05-06',
  'Extract the text content from this document. Return a JSON object with:
- title: the document title if identifiable
- language: the primary language code (e.g., "en", "es", "fr")
- pages: an array of page objects, each with:
  - pageNumber: the page number (1-indexed)
  - text: the extracted text for that page
  - headings: any section headings found on that page

If the document doesn''t have clear pages (like a text file), return a single page with pageNumber 1.

Return ONLY valid JSON, no markdown formatting or explanation.',
  0.1,
  65536
);

-- Seed data: AI chat prompt (for existing AI Gateway Chat feature)
INSERT INTO prompts (function_name, display_name, description, model_provider, model_name, system_prompt, user_prompt_template, temperature, max_tokens)
VALUES (
  'ai_chat',
  'AI Gateway Chat',
  'General-purpose AI chat assistant',
  'anthropic',
  'claude-sonnet-4-20250514',
  'You are a helpful AI assistant. Be concise and accurate in your responses.',
  '{{user_message}}',
  0.7,
  4096
);
