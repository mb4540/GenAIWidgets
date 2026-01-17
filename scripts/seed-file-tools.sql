-- Seed File Tools for Agent Mode
-- Run this script to add file management tools to the agent_tools table
-- Uses the first tenant and admin user from the database

-- List Files Tool
INSERT INTO agent_tools (tenant_id, user_id, name, description, tool_type, input_schema, is_active)
SELECT 
  t.tenant_id,
  u.user_id,
  'list_files',
  'List files and folders in a directory. Returns file names, sizes, types, and paths.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Directory path to list (e.g., \"/\" for root, \"/documents\" for documents folder)"
      }
    },
    "required": []
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

-- Read File Tool
INSERT INTO agent_tools (tenant_id, user_id, name, description, tool_type, input_schema, is_active)
SELECT 
  t.tenant_id,
  u.user_id,
  'read_file',
  'Read the contents of a text file. Only works with text-based files (txt, json, md, csv, xml, html).',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Full path to the file (e.g., \"/documents/notes.txt\")"
      }
    },
    "required": ["file_path"]
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

-- Create File Tool
INSERT INTO agent_tools (tenant_id, user_id, name, description, tool_type, input_schema, is_active)
SELECT 
  t.tenant_id,
  u.user_id,
  'create_file',
  'Create a new text file with the specified content. Overwrites if file already exists.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Full path for the new file (e.g., \"/documents/notes.txt\")"
      },
      "content": {
        "type": "string",
        "description": "Text content to write to the file"
      }
    },
    "required": ["file_path", "content"]
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

-- Delete File Tool
INSERT INTO agent_tools (tenant_id, user_id, name, description, tool_type, input_schema, is_active)
SELECT 
  t.tenant_id,
  u.user_id,
  'delete_file',
  'Delete a file from storage. This action cannot be undone.',
  'builtin',
  '{
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Full path to the file to delete (e.g., \"/documents/old-report.pdf\")"
      }
    },
    "required": ["file_path"]
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
SELECT tool_id, name, tool_type, description FROM agent_tools WHERE name IN ('list_files', 'read_file', 'create_file', 'delete_file');
