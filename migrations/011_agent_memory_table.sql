-- Migration: 011_agent_memory_table.sql
-- Description: Create agent_long_term_memory table for persistent knowledge
-- Created: 2026-01-17
--
-- Rollback: DROP TABLE IF EXISTS agent_long_term_memory;

-- Create agent_long_term_memory table
CREATE TABLE IF NOT EXISTS agent_long_term_memory (
    memory_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id          UUID NOT NULL,
    tenant_id         UUID NOT NULL,
    memory_type       TEXT NOT NULL DEFAULT 'fact',
    content           TEXT NOT NULL,
    source_session_id UUID,
    importance        INTEGER NOT NULL DEFAULT 5,
    last_accessed_at  TIMESTAMPTZ,
    access_count      INTEGER NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_memory_agent
        FOREIGN KEY (agent_id) 
        REFERENCES agents(agent_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_memory_tenant
        FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_memory_source_session
        FOREIGN KEY (source_session_id) 
        REFERENCES agent_sessions(session_id) 
        ON DELETE SET NULL,

    -- Check constraints
    CONSTRAINT memory_type_valid
        CHECK (memory_type IN ('fact', 'preference', 'learned', 'user_provided')),
    
    CONSTRAINT memory_importance_range
        CHECK (importance >= 1 AND importance <= 10),
    
    CONSTRAINT memory_access_count_positive
        CHECK (access_count >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_long_term_memory_agent_id ON agent_long_term_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memory_tenant_id ON agent_long_term_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memory_type ON agent_long_term_memory(agent_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_long_term_memory_importance ON agent_long_term_memory(agent_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_long_term_memory_active ON agent_long_term_memory(agent_id, is_active);

-- Add comment
COMMENT ON TABLE agent_long_term_memory IS 'Persistent knowledge for agents across sessions';
