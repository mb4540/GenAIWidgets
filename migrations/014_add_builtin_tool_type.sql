-- Migration: 014_add_builtin_tool_type.sql
-- Description: Add 'builtin' to tool_type constraint for native Netlify function tools
-- Created: 2026-01-17
--
-- Rollback: 
--   ALTER TABLE agent_tools DROP CONSTRAINT tools_type_valid;
--   ALTER TABLE agent_tools ADD CONSTRAINT tools_type_valid CHECK (tool_type IN ('mcp_server', 'python_script'));

-- Drop existing constraint
ALTER TABLE agent_tools DROP CONSTRAINT IF EXISTS tools_type_valid;

-- Add new constraint with 'builtin' option
ALTER TABLE agent_tools ADD CONSTRAINT tools_type_valid 
    CHECK (tool_type IN ('mcp_server', 'python_script', 'builtin'));

-- Add comment
COMMENT ON COLUMN agent_tools.tool_type IS 'Tool type: mcp_server (external MCP), python_script (future), builtin (native Netlify function)';
