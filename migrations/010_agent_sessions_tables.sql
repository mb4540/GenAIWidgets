-- Migration: 010_agent_sessions_tables.sql
-- Description: Create agent_sessions and agent_session_messages tables
-- Created: 2026-01-17
--
-- Rollback: 
--   DROP TABLE IF EXISTS agent_session_messages;
--   DROP TABLE IF EXISTS agent_sessions;

-- Create agent_sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id     UUID NOT NULL,
    user_id      UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    title        TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    current_step INTEGER NOT NULL DEFAULT 0,
    goal_met     BOOLEAN NOT NULL DEFAULT false,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_agent_sessions_agent
        FOREIGN KEY (agent_id) 
        REFERENCES agents(agent_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_agent_sessions_user
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_agent_sessions_tenant
        FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) 
        ON DELETE CASCADE,

    -- Check constraints
    CONSTRAINT agent_sessions_status_valid
        CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
    
    CONSTRAINT agent_sessions_step_positive
        CHECK (current_step >= 0)
);

-- Create indexes for agent_sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_id ON agent_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(agent_id, status);

-- Add comment
COMMENT ON TABLE agent_sessions IS 'Agent chat sessions (session memory)';

---

-- Create agent_session_messages table
CREATE TABLE IF NOT EXISTS agent_session_messages (
    message_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL,
    step_number INTEGER NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    tool_name   TEXT,
    tool_input  JSONB,
    tool_output JSONB,
    reasoning   TEXT,
    tokens_used INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_session_messages_session
        FOREIGN KEY (session_id) 
        REFERENCES agent_sessions(session_id) 
        ON DELETE CASCADE,

    -- Check constraints
    CONSTRAINT session_messages_role_valid
        CHECK (role IN ('user', 'assistant', 'tool', 'system')),
    
    CONSTRAINT session_messages_step_positive
        CHECK (step_number >= 0)
);

-- Create indexes for agent_session_messages
CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON agent_session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_step ON agent_session_messages(session_id, step_number);
CREATE INDEX IF NOT EXISTS idx_session_messages_role ON agent_session_messages(session_id, role);

-- Add comment
COMMENT ON TABLE agent_session_messages IS 'Messages within agent sessions';
