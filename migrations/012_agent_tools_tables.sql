-- Migration: 012_agent_tools_tables.sql
-- Description: Create agent_tools and agent_tool_assignments tables
-- Created: 2026-01-17
--
-- Rollback: 
--   DROP TABLE IF EXISTS agent_tool_assignments;
--   DROP TABLE IF EXISTS agent_tools;

-- Create agent_tools table
CREATE TABLE IF NOT EXISTS agent_tools (
    tool_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    user_id      UUID NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    tool_type    TEXT NOT NULL,
    input_schema JSONB NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_tools_tenant
        FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_tools_user
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL,

    -- Unique constraint: tool name must be unique per tenant
    CONSTRAINT tools_tenant_name_unique 
        UNIQUE (tenant_id, name),

    -- Check constraints
    CONSTRAINT tools_type_valid
        CHECK (tool_type IN ('mcp_server', 'python_script'))
);

-- Create indexes for agent_tools
CREATE INDEX IF NOT EXISTS idx_agent_tools_tenant_id ON agent_tools(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_tools_user_id ON agent_tools(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tools_type ON agent_tools(tenant_id, tool_type);
CREATE INDEX IF NOT EXISTS idx_agent_tools_active ON agent_tools(tenant_id, is_active);

-- Add comment
COMMENT ON TABLE agent_tools IS 'Tool registry for agent capabilities';

---

-- Create agent_tool_assignments table (which tools an agent can use)
CREATE TABLE IF NOT EXISTS agent_tool_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL,
    tool_id       UUID NOT NULL,
    is_required   BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_tool_assignments_agent
        FOREIGN KEY (agent_id) 
        REFERENCES agents(agent_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_tool_assignments_tool
        FOREIGN KEY (tool_id) 
        REFERENCES agent_tools(tool_id) 
        ON DELETE CASCADE,

    -- Unique constraint: each tool can only be assigned once per agent
    CONSTRAINT tool_assignments_unique 
        UNIQUE (agent_id, tool_id)
);

-- Create indexes for agent_tool_assignments
CREATE INDEX IF NOT EXISTS idx_tool_assignments_agent_id ON agent_tool_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool_id ON agent_tool_assignments(tool_id);

-- Add comment
COMMENT ON TABLE agent_tool_assignments IS 'Maps which tools each agent can use';
