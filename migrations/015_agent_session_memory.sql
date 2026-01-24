-- Migration: 015_agent_session_memory.sql
-- Description: Short-term working memory for agent sessions (plan tracking, scratchpad)
-- Created: 2026-01-24
--
-- Rollback:
--   DROP TRIGGER IF EXISTS update_agent_session_memory_updated_at ON agent_session_memory;
--   DROP INDEX IF EXISTS idx_session_memory_session_key;
--   DROP INDEX IF EXISTS idx_session_memory_session_id;
--   DROP TABLE IF EXISTS agent_session_memory;

CREATE TABLE IF NOT EXISTS agent_session_memory (
    memory_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL,
    memory_key    TEXT NOT NULL,
    memory_value  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign key with CASCADE: memory deleted when session deleted
    CONSTRAINT fk_session_memory_session
        FOREIGN KEY (session_id) 
        REFERENCES agent_sessions(session_id) 
        ON DELETE CASCADE,

    -- Unique constraint: one value per key per session
    CONSTRAINT agent_session_memory_unique_key
        UNIQUE (session_id, memory_key)
);

-- Index on foreign key (required per database-design.md - not automatic)
CREATE INDEX IF NOT EXISTS idx_session_memory_session_id 
    ON agent_session_memory(session_id);

-- Composite index for key lookups within session
CREATE INDEX IF NOT EXISTS idx_session_memory_session_key 
    ON agent_session_memory(session_id, memory_key);

-- Add updated_at trigger (reuses existing function from 001_initial_schema.sql)
CREATE TRIGGER update_agent_session_memory_updated_at
    BEFORE UPDATE ON agent_session_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_session_memory IS 'Short-term working memory for agent sessions';
COMMENT ON COLUMN agent_session_memory.memory_key IS 'Key identifier: execution_plan, scratchpad, etc.';
COMMENT ON COLUMN agent_session_memory.memory_value IS 'JSONB structured data for the memory entry';
