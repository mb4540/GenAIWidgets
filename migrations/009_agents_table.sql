-- Migration: 009_agents_table.sql
-- Description: Create agents table for Agent Mode Chat feature
-- Created: 2026-01-17
--
-- Rollback: DROP TABLE IF EXISTS agents;

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    agent_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    user_id        UUID NOT NULL,
    name           TEXT NOT NULL,
    description    TEXT,
    goal           TEXT NOT NULL,
    system_prompt  TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    model_name     TEXT NOT NULL,
    max_steps      INTEGER NOT NULL DEFAULT 10,
    temperature    DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_agents_tenant
        FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_agents_user
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL,

    -- Unique constraint: agent name must be unique per tenant
    CONSTRAINT agents_tenant_name_unique 
        UNIQUE (tenant_id, name),

    -- Check constraints
    CONSTRAINT agents_max_steps_positive 
        CHECK (max_steps > 0 AND max_steps <= 100),
    
    CONSTRAINT agents_temperature_range 
        CHECK (temperature >= 0 AND temperature <= 2),

    CONSTRAINT agents_model_provider_valid
        CHECK (model_provider IN ('openai', 'anthropic', 'gemini'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agents_tenant_id ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(tenant_id, is_active);

-- Add comment
COMMENT ON TABLE agents IS 'Agent definitions for Agent Mode Chat feature';
