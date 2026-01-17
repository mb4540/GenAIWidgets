-- Migration: 013_mcp_servers_table.sql
-- Description: Create mcp_servers table for MCP server configurations
-- Created: 2026-01-17
--
-- Rollback: DROP TABLE IF EXISTS mcp_servers;

-- Create mcp_servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
    mcp_server_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id           UUID NOT NULL,
    tenant_id         UUID NOT NULL,
    server_name       TEXT NOT NULL,
    server_url        TEXT NOT NULL,
    auth_type         TEXT NOT NULL DEFAULT 'none',
    auth_config       JSONB,
    health_status     TEXT NOT NULL DEFAULT 'unknown',
    last_health_check TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Foreign keys
    CONSTRAINT fk_mcp_servers_tool
        FOREIGN KEY (tool_id) 
        REFERENCES agent_tools(tool_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_mcp_servers_tenant
        FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) 
        ON DELETE CASCADE,

    -- Check constraints
    CONSTRAINT mcp_servers_auth_type_valid
        CHECK (auth_type IN ('none', 'api_key', 'bearer', 'basic')),
    
    CONSTRAINT mcp_servers_health_status_valid
        CHECK (health_status IN ('healthy', 'unhealthy', 'unknown'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant_id ON mcp_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tool_id ON mcp_servers(tool_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_health ON mcp_servers(tenant_id, health_status);

-- Add comment
COMMENT ON TABLE mcp_servers IS 'MCP server configurations for agent tools';

-- Note: auth_config stores encrypted credentials
-- Encryption key is stored in NETLIFY_ENCRYPTION_KEY environment variable
-- Structure: { "encrypted": "<base64-encrypted-data>", "iv": "<initialization-vector>" }
