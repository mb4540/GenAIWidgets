-- Seed File Tools for Agent Mode
-- Run this script to add file management tools to the agent_tools table

-- List Files Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
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
  }',
  true
);

-- Read File Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
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
  }',
  true
);

-- Create File Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
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
  }',
  true
);

-- Delete File Tool
INSERT INTO agent_tools (
  tenant_id, user_id, name, description, tool_type, input_schema, is_active
) VALUES (
  NULL, NULL,
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
  }',
  true
);
