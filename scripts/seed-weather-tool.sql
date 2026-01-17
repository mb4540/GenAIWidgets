-- Seed script: seed-weather-tool.sql
-- Description: Insert the builtin get_weather tool
-- 
-- Usage: Run this against your database after running migration 014
-- Note: Replace the tenant_id and user_id with actual values from your database
--
-- To find your tenant_id and user_id:
--   SELECT tenant_id, name FROM tenants;
--   SELECT user_id, email FROM users WHERE email = 'your-admin-email';

-- Insert the weather tool (update tenant_id and user_id as needed)
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
  'get_weather',
  'Get the current weather and forecast for a given location. Returns temperature, conditions, humidity, wind, and a 6-hour forecast.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or location (e.g., \"New York, NY\" or \"Paris, France\")"
      },
      "units": {
        "type": "string",
        "enum": ["imperial", "metric"],
        "description": "Temperature units - imperial (°F) or metric (°C). Default: imperial"
      }
    },
    "required": ["location"]
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
SELECT tool_id, name, tool_type, description FROM agent_tools WHERE name = 'get_weather';
