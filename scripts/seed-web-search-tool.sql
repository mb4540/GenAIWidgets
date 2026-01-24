-- Seed script: seed-web-search-tool.sql
-- Description: Insert the builtin web_search tool
-- 
-- Usage: Run this against your database
-- Note: Uses the first admin user's tenant

-- Insert the web_search tool
INSERT INTO agent_tools (
  tenant_id,
  user_id,
  name,
  description,
  tool_type,
  input_schema,
  is_active
) 
SELECT 
  t.tenant_id,
  u.user_id,
  'web_search',
  'Search the web for information or fetch content from a specific URL. Use this to find current information, research topics, or extract content from web pages.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query or topic to search for"
      },
      "url": {
        "type": "string",
        "description": "Optional: A specific URL to fetch and extract content from. If provided, the query is used to focus on relevant parts of the page."
      }
    },
    "required": ["query"]
  }'::jsonb,
  true
FROM tenants t
CROSS JOIN users u
WHERE u.email = (SELECT email FROM admins a JOIN users u2 ON a.user_id = u2.user_id LIMIT 1)
LIMIT 1
ON CONFLICT (tenant_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  updated_at = now();

-- Verify insertion
SELECT tool_id, name, tool_type, description FROM agent_tools WHERE name = 'web_search';
